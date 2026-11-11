import {Box3,Euler,MathUtils,Object3D,PerspectiveCamera,Quaternion,Raycaster,Vector3} from 'three';
import type {CameraMetadata,SensorSize} from './cameras';
import type {StageScene} from './types';
import {samplePresetPath,pathWarnings} from './camera-paths';

type V3=[number,number,number];
export const cameraPresetDefinitions=[
  {id:'establishing',name:'环境建立',group:'构图',description:'同时展示人物与周围空间。',focal:28,aperture:5.6,distance:8,height:2},
  {id:'two-shot',name:'双人关系',group:'构图',description:'把两个人物放进同一个画面，交代相互位置。',focal:40,aperture:4,distance:5,height:.4,secondary:true},
  {id:'over-shoulder',name:'过肩镜头',group:'构图',description:'以前景人物的肩背衬托另一人物。',focal:50,aperture:2.8,distance:1.3,height:.1,secondary:true},
  {id:'reaction',name:'反应近景',group:'构图',description:'靠近头部，强调受惊、倾听或决定。',focal:85,aperture:2.8,distance:2.4,height:0},
  {id:'insert',name:'细节插入',group:'构图',description:'突出手部或道具上的具体信息。',focal:70,aperture:4,distance:1,height:.15},
  {id:'pov',name:'人物主观',group:'构图',description:'从人物眼位看向指定目标。',focal:35,aperture:4,distance:.22,height:0},
  {id:'push-in',name:'缓慢推进',group:'运动',description:'保持焦距，逐渐靠近主体。',focal:50,aperture:2.8,distance:5,height:.3},
  {id:'pull-out',name:'拉远揭示',group:'运动',description:'从主体后退，纳入更多环境。',focal:35,aperture:4,distance:3,height:.5},
  {id:'pan',name:'水平摇镜',group:'运动',description:'固定机位，水平转动视线。',focal:40,aperture:4,distance:5,height:.3},
  {id:'tilt',name:'上下摇镜',group:'运动',description:'固定机位，在高低方向转动视线。',focal:35,aperture:4,distance:4,height:.3},
  {id:'rear-follow',name:'背后跟拍',group:'跟拍',description:'在主体后方保持距离，一同进入空间。',focal:35,aperture:4,distance:3,height:.4},
  {id:'lead-follow',name:'正面引导',group:'跟拍',description:'在主体前方退行，持续观察面部。',focal:40,aperture:4,distance:3,height:.3},
  {id:'side-follow',name:'侧向跟拍',group:'跟拍',description:'在主体侧面平行移动，展示步态。',focal:35,aperture:4,distance:3,height:.3},
  {id:'arc',name:'短弧环绕',group:'运动',description:'沿短弧改变观察角度，保持主体可见。',focal:50,aperture:2.8,distance:4,height:.3},
  {id:'reveal-slide',name:'遮挡后揭示',group:'运动',description:'从指定前景后横移，露出被摄主体。',focal:50,aperture:2.8,distance:4,height:.2,occluder:true},
  {id:'rack-focus',name:'A/B 拉焦',group:'光学',description:'固定构图，从主体 A 的焦平面转向 B。',focal:85,aperture:1.4,distance:4,height:.2,secondary:true},
  {id:'low-angle',name:'低角度仰拍',group:'构图',description:'从主体下方仰拍，强调人物与环境的高低关系。',focal:35,aperture:4,distance:3,height:-.8},
  {id:'high-angle',name:'高角度俯拍',group:'构图',description:'从高位俯看主体，保留周围空间。',focal:35,aperture:4,distance:4,height:3},
  {id:'top-down',name:'垂直顶拍',group:'构图',description:'垂直向下展示走位；方位 0° 时画面上方为北。',focal:28,aperture:5.6,distance:7,height:0},
  {id:'dutch-angle',name:'倾斜构图',group:'构图',description:'沿镜头光轴倾斜画面，保留主体构图。',focal:50,aperture:4,distance:4,height:.3},
  {id:'pedestal',name:'垂直升降',group:'运动',description:'沿世界 Y 轴升降，可锁定起始朝向或持续看向目标。',focal:40,aperture:4,distance:4,height:0},
  {id:'crane-up',name:'升起拉远',group:'运动',description:'平滑升高并后退，从人物扩展到环境。',focal:28,aperture:5.6,distance:4,height:.5},
  {id:'crane-down',name:'下降入场',group:'运动',description:'从高处平滑下降并靠近，落到人物身上。',focal:35,aperture:4,distance:4,height:.5},
  {id:'whip-pan',name:'甩镜',group:'运动',description:'短时间快速水平转向并停稳；当前不模拟运动模糊。',focal:35,aperture:4,distance:4,height:.3},
  {id:'zoom',name:'平滑变焦',group:'光学',description:'机位不动，连续改变焦距与取景范围。',focal:35,aperture:4,distance:5,height:.3},
  {id:'snap-zoom',name:'快速变焦',group:'光学',description:'在短时间内快速变焦，再停留于目标画面。',focal:35,aperture:4,distance:5,height:.3},
  {id:'dolly-zoom',name:'滑动变焦',group:'光学',description:'沿光轴移动并补偿焦距，近似保持主体平面大小。',focal:50,aperture:4,distance:5,height:.3},
  {id:'handheld',name:'克制手持',group:'跟拍',description:'跟随主体，叠加由固定种子控制的轻微位移与旋转。',focal:35,aperture:4,distance:3,height:.3},
  {id:'orbit-360',name:'完整环绕',group:'运动',description:'围绕主体完成一整圈，保持观看目标。',focal:35,aperture:4,distance:4,height:.4},
  {id:'subject-mounted',name:'主体固定机位',group:'跟拍',description:'相对绑定节点的完整姿态固定，人物稳定而环境运动。',focal:24,aperture:4,distance:1.2,height:.15},
  {id:'handoff-oner',name:'连续交接长镜头',group:'编排',description:'连续跟随 A，经过可选事件目标，交接给 B 并拉远。',focal:35,aperture:4,distance:3,height:.4,secondary:true},
  {id:'flythrough',name:'穿行与俯冲',group:'编排',description:'沿世界坐标曲线穿行，支持俯冲、受控横滚与路径检查。',focal:24,aperture:5.6,distance:6,height:2},
] as const;
export type CameraPresetId=typeof cameraPresetDefinitions[number]['id'];
/** Stable subject key, or a unique scene object name. Anchors are relative to this object. */
export interface CameraBinding {subject:string;anchor?:string;offset?:V3}
export interface CameraPresetParameters {
  startSeconds:number;endSeconds:number;holdStartSeconds:number;holdEndSeconds:number;
  distance:number;height:number;sideOffset:number;travel:number;angleDegrees:number;headingDegrees:number;
  focalLengthMm:number;aperture:number;sensor:SensorSize;
  frame:'world'|'subject';easing:'smooth'|'linear';fitFrame:boolean;
  /** Optional additions preserve existing version:1 presets. */
  endFocalLengthMm?:number;rise?:number;rollDegrees?:number;lockOrientation?:boolean;
  shakeMeters?:number;shakeDegrees?:number;shakeFrequencyHz?:number;seed?:number;
  handoffStartSeconds?:number;handoffEndSeconds?:number;
  maxSpeedMps?:number;maxAngularSpeedDeg?:number;clearanceMeters?:number;
}
export interface CameraPresetConfig {
  version:1;presetId:CameraPresetId;subject:CameraBinding;secondary?:CameraBinding;lookTarget?:CameraBinding;focusTarget?:CameraBinding;occluder?:CameraBinding;eventTarget?:CameraBinding;
  path?:{points:V3[];lookAheadMeters:number};
  reference:{timeSeconds:number;target:V3;bounds?:{min:V3;max:V3}};
  parameters:CameraPresetParameters;
}
export interface CameraPresetRecord {id:CameraPresetId;version:1;config:CameraPresetConfig;warnings:string[]}
export const presetDefinition=(id:CameraPresetId)=>cameraPresetDefinitions.find(p=>p.id===id)!;
const tuple=(v:Vector3):V3=>v.toArray();
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const vec=(v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(finite);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateCameraPreset(config:unknown):asserts config is CameraPresetConfig {
  if(!object(config)||config.version!==1||!cameraPresetDefinitions.some(p=>p.id===config.presetId))throw new Error('未知的镜头预设或版本');
  for(const key of ['subject','secondary','lookTarget','focusTarget','occluder','eventTarget']){
    const b=config[key];if(b===undefined&&key!=='subject')continue;
    if(!object(b)||typeof b.subject!=='string'||!b.subject||b.subject.length>200||b.anchor!==undefined&&(typeof b.anchor!=='string'||b.anchor.length>200)||b.offset!==undefined&&!vec(b.offset))throw new Error('预设需要有效的主体与锚点');
  }
  const def=presetDefinition(config.presetId as CameraPresetId);
  if(config.presetId==='rack-focus'&&config.focusTarget)throw new Error('拉焦使用主体 A/B，请通过 A/B 锚点指定焦点');
  if('secondary' in def&&!config.secondary)throw new Error('此预设需要第二主体 B');
  if('occluder' in def&&!config.occluder)throw new Error('遮挡揭示需要指定前景遮挡物');
  if(!object(config.reference)||!vec(config.reference.target)||!finite(config.reference.timeSeconds)||(config.reference.timeSeconds as number)<0)throw new Error('预设参考位置无效');
  const b=config.reference.bounds;if(b!==undefined&&(!object(b)||!vec(b.min)||!vec(b.max)||(b.min as number[]).some((x,i)=>x>(b.max as number[])[i])))throw new Error('预设参考边界无效');
  const p=config.parameters;
  if(!object(p)||!['startSeconds','endSeconds','holdStartSeconds','holdEndSeconds','distance','height','sideOffset','travel','angleDegrees','headingDegrees','focalLengthMm','aperture'].every(k=>finite(p[k])))throw new Error('预设参数需要有效数字');
  if((p.startSeconds as number)<0||(p.endSeconds as number)<= (p.startSeconds as number)||(p.endSeconds as number)>300||(p.holdStartSeconds as number)<0||(p.holdEndSeconds as number)<0||(p.holdStartSeconds as number)+(p.holdEndSeconds as number)>=(p.endSeconds as number)-(p.startSeconds as number))throw new Error('运动区间必须为正，首尾停留之和需小于区间时长');
  if((p.distance as number)<=.05||(p.distance as number)>10000||(p.focalLengthMm as number)<1||(p.focalLengthMm as number)>1000||(p.aperture as number)<=0||(p.aperture as number)>128)throw new Error('距离需大于 0.05 m，焦距 1–1000 mm，光圈需为有效正数');
  if(Math.abs(p.angleDegrees as number)>360||Math.abs(p.height as number)>10000||Math.abs(p.sideOffset as number)>10000||Math.abs(p.travel as number)>10000||Math.abs(p.headingDegrees as number)>3600)throw new Error('预设移动或角度超出范围');
  if(config.presetId==='push-in'&&(p.distance as number)-(p.travel as number)<=.1||config.presetId==='pull-out'&&(p.distance as number)+(p.travel as number)<=.1)throw new Error('推拉终点不能越过目标；请缩短位移或增加距离');
  const ranges:Record<string,[number,number]>={endFocalLengthMm:[1,1000],rise:[-10000,10000],rollDegrees:[-180,180],shakeMeters:[0,.5],shakeDegrees:[0,10],shakeFrequencyHz:[.05,10],seed:[0,2147483647],handoffStartSeconds:[0,300],handoffEndSeconds:[0,300],maxSpeedMps:[.1,200],maxAngularSpeedDeg:[1,720],clearanceMeters:[0,5]};
  for(const [key,[min,max]] of Object.entries(ranges))if(p[key]!==undefined&&(!finite(p[key])||(p[key] as number)<min||(p[key] as number)>max))throw new Error(`预设参数 ${key} 需在 ${min}–${max} 之间`);
  if(p.seed!==undefined&&!Number.isInteger(p.seed))throw new Error('手持随机种子必须为整数');
  if(p.lockOrientation!==undefined&&typeof p.lockOrientation!=='boolean')throw new Error('锁定朝向需为布尔值');
  if(config.presetId==='handoff-oner'){
    const start=p.handoffStartSeconds??Number(p.startSeconds)+(Number(p.endSeconds)-Number(p.startSeconds))*.35,end=p.handoffEndSeconds??Number(p.startSeconds)+(Number(p.endSeconds)-Number(p.startSeconds))*.65;
    if(Number(start)<Number(p.startSeconds)||Number(end)>Number(p.endSeconds)||Number(end)<=Number(start))throw new Error('交接起止时间需位于镜头区间内且递增');
  }
  if(config.presetId==='dolly-zoom'&&(p.distance as number)-(p.travel as number)<=.1)throw new Error('滑动变焦终点不能越过目标');
  if(config.presetId==='flythrough'&&!config.path)throw new Error('穿行需要至少两个路径控制点');
  if(config.path!==undefined){
    const path=config.path;
    if(!object(path)||!Array.isArray(path.points)||path.points.length<2||path.points.length>32||!path.points.every(v=>vec(v)&&(v as number[]).every(n=>Math.abs(n)<=10000))||!finite(path.lookAheadMeters)||Number(path.lookAheadMeters)<=.05||Number(path.lookAheadMeters)>100)throw new Error('路径需要 2–32 个有效世界坐标，前视距离需大于 0.05 且不超过 100 m');
    for(let i=1;i<path.points.length;i++)if(new Vector3(...path.points[i] as V3).distanceTo(new Vector3(...path.points[i-1] as V3))<.01)throw new Error('相邻路径点至少相距 0.01 m');
  }
  if(!object(p.sensor)||!finite(p.sensor.widthMm)||!finite(p.sensor.heightMm)||(p.sensor.widthMm as number)<=0||(p.sensor.heightMm as number)<=0)throw new Error('预设传感器尺寸无效');
  if(!['world','subject'].includes(p.frame as string)||!['smooth','linear'].includes(p.easing as string)||typeof p.fitFrame!=='boolean')throw new Error('预设坐标框架或缓动设置无效');
}
function boundsOf(root:Object3D){
  if(!(root as {isScene?:boolean}).isScene)return new Box3().setFromObject(root);
  const box=new Box3();for(const child of root.children)if(child.name!=='预览辅助'&&!(child as {isCamera?:boolean}).isCamera&&!(child as {isLight?:boolean}).isLight)box.union(new Box3().setFromObject(child));return box;
}
export function resolveCameraBinding(stage:StageScene,binding:CameraBinding){
  let root=binding.subject==='@scene'?stage.scene:stage.subjects?.[binding.subject];
  if(!root){const matches:Object3D[]=[];stage.scene.traverse(o=>{if(o.name===binding.subject)matches.push(o);});if(matches.length!==1)throw new Error(`镜头主体“${binding.subject}”${matches.length?'名称重复，请登记 subjects 唯一键':'不存在'}`);root=matches[0];}
  let anchor=root;
  if(binding.anchor){const matches:Object3D[]=[];root.traverse(o=>{if(o.name===binding.anchor)matches.push(o);});if(matches.length!==1)throw new Error(`主体 ${binding.subject} 的锚点 ${binding.anchor} 缺失或重复`);anchor=matches[0];}
  anchor.updateWorldMatrix(true,true);
  const point=binding.anchor?anchor.getWorldPosition(new Vector3()):boundsOf(anchor).getCenter(new Vector3());
  if(!binding.anchor&&boundsOf(anchor).isEmpty())anchor.getWorldPosition(point);
  if(binding.offset){const origin=anchor.getWorldPosition(new Vector3()),shift=anchor.localToWorld(new Vector3(...binding.offset)).sub(origin);point.add(shift);}
  if(!point.toArray().every(Number.isFinite))throw new Error('镜头目标位置无效');
  return {root,anchor,point};
}
export function listCameraSubjects(stage:StageScene){
  const registered=Object.entries(stage.subjects??{});if(registered.length)return [['@scene',stage.scene],...registered] as [string,Object3D][];
  return [['@scene',stage.scene],...stage.scene.children.filter(o=>o.name&&!(o as {isCamera?:boolean}).isCamera&&!o.name.includes('预览辅助')&&!(o as {isLight?:boolean}).isLight).map(o=>[o.name,o] as const)] as [string,Object3D][];
}
export function defaultCameraBinding(stage:StageScene,subject:string,head=false):CameraBinding {
  if(subject==='@scene')return {subject};
  const root=resolveCameraBinding(stage,{subject}).root;
  const preferred=head?['anchor:head','head']:['anchor:chest','spine'];
  return {subject,anchor:preferred.find(name=>!!root.getObjectByName(name))};
}
/** Call after authored update(referenceTime). This captures a reproducible starting composition. */
export function createCameraPresetConfig(stage:StageScene,presetId:CameraPresetId,bindings:{subject:CameraBinding;secondary?:CameraBinding;occluder?:CameraBinding},overrides:Partial<CameraPresetParameters>={},referenceTimeSeconds=0):CameraPresetConfig {
  const def=presetDefinition(presetId);if(!def)throw new Error('未知镜头预设');
  const a=resolveCameraBinding(stage,bindings.subject),b=bindings.secondary?resolveCameraBinding(stage,bindings.secondary):undefined;
  const bounds=boundsOf(a.root);if(b)bounds.union(boundsOf(b.root));
  const target=presetId==='two-shot'&&b?a.point.clone().add(b.point).multiplyScalar(.5):a.point.clone();
  if(presetId==='establishing'&&!bounds.isEmpty())bounds.getCenter(target);
  const duration=stage.durationSeconds;
  const config:CameraPresetConfig={version:1,presetId,...structuredClone(bindings),reference:{timeSeconds:referenceTimeSeconds,target:tuple(target),bounds:bounds.isEmpty()?undefined:{min:tuple(bounds.min),max:tuple(bounds.max)}},parameters:{startSeconds:0,endSeconds:duration,holdStartSeconds:duration*.15,holdEndSeconds:duration*.15,distance:def.distance,height:def.height,sideOffset:presetId==='over-shoulder'?.6:0,travel:1.5,angleDegrees:presetId==='tilt'?25:45,headingDegrees:0,focalLengthMm:def.focal,aperture:def.aperture,sensor:{widthMm:36,heightMm:24},frame:['rear-follow','lead-follow','side-follow','pov','handheld','subject-mounted','handoff-oner'].includes(presetId)?'subject':'world',easing:presetId==='orbit-360'?'linear':'smooth',fitFrame:['establishing','two-shot'].includes(presetId),endFocalLengthMm:70,rise:3,rollDegrees:presetId==='dutch-angle'?12:0,lockOrientation:false,shakeMeters:.015,shakeDegrees:.35,shakeFrequencyHz:1.4,seed:7,handoffStartSeconds:duration*.35,handoffEndSeconds:duration*.65,maxSpeedMps:12,maxAngularSpeedDeg:120,clearanceMeters:.15,...overrides}};
  if(presetId==='handoff-oner'){
    const {startSeconds,endSeconds}=config.parameters;
    if(overrides.handoffStartSeconds===undefined)config.parameters.handoffStartSeconds=MathUtils.lerp(startSeconds,endSeconds,.35);
    if(overrides.handoffEndSeconds===undefined)config.parameters.handoffEndSeconds=MathUtils.lerp(startSeconds,endSeconds,.65);
  }
  if(presetId==='whip-pan'||presetId==='snap-zoom'){
    const span=config.parameters.endSeconds-config.parameters.startSeconds,moving=Math.min(.4,span*.4);
    if(overrides.holdStartSeconds===undefined)config.parameters.holdStartSeconds=(span-moving)/2;
    if(overrides.holdEndSeconds===undefined)config.parameters.holdEndSeconds=(span-moving)/2;
    if(presetId==='whip-pan'&&overrides.angleDegrees===undefined)config.parameters.angleDegrees=100;
  }
  if(presetId==='flythrough'){
    const t=target;config.path={points:[[t.x-3,t.y+3,t.z+6],[t.x-2,t.y+1.5,t.z+2],[t.x+2,t.y+.5,t.z-2],[t.x+3,t.y+2,t.z-6]],lookAheadMeters:2};
  }
  if(presetId==='over-shoulder'&&b&&overrides.headingDegrees===undefined){const outward=a.point.clone().sub(b.point);config.parameters.headingDegrees=MathUtils.radToDeg(Math.atan2(outward.x,outward.z));}
  validateCameraPreset(config);return config;
}
function corners(bounds:{min:V3;max:V3}){const points:Vector3[]=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])points.push(new Vector3(x,y,z));return points;}
/** Shared by rendering and delivery descriptions; progress is absolute edit time. */
export function cameraPresetProgress(p:CameraPresetParameters,timeSeconds:number){
  const u=MathUtils.clamp((timeSeconds-p.startSeconds-p.holdStartSeconds)/(p.endSeconds-p.startSeconds-p.holdStartSeconds-p.holdEndSeconds),0,1);
  return p.easing==='linear'?u:u*u*u*(u*(u*6-15)+10);
}
/** Pure in time: objects must already be at timeSeconds; no previous-frame camera state is read. */
export function sampleCameraPreset(stage:StageScene,config:CameraPresetConfig,timeSeconds:number,aspect=stage.output.width/stage.output.height){
  validateCameraPreset(config);if(!Number.isFinite(timeSeconds)||!Number.isFinite(aspect)||aspect<=0)throw new Error('预设采样时间或画幅无效');
  const p=config.parameters,id=config.presetId,def=presetDefinition(id),a=resolveCameraBinding(stage,config.subject),b=config.secondary?resolveCameraBinding(stage,config.secondary):undefined;
  if(p.endSeconds>stage.durationSeconds+1e-6)throw new Error('预设结束时间超出场景时长');
  const s=cameraPresetProgress(p,timeSeconds);
  const follow=['rear-follow','lead-follow','side-follow','pov','handheld','subject-mounted','handoff-oner'].includes(id);
  const center=follow||p.frame==='subject'?a.point.clone():new Vector3(...config.reference.target);
  let heading=MathUtils.degToRad(p.headingDegrees);
  if(p.frame==='subject'){const forward=new Vector3(0,0,-1).applyQuaternion(a.root.getWorldQuaternion(new Quaternion()));if(Math.hypot(forward.x,forward.z)>.0001)heading+=Math.atan2(-forward.x,-forward.z);}
  const out=new Vector3(Math.sin(heading),0,Math.cos(heading)),right=new Vector3(out.z,0,-out.x);
  const pos=center.clone().addScaledVector(out,p.distance).addScaledVector(right,p.sideOffset);pos.y+=p.height;
  const look=config.lookTarget?resolveCameraBinding(stage,config.lookTarget).point:(id==='over-shoulder'&&b?b.point:follow||p.frame==='subject'?a.point.clone():center.clone());
  if(id==='push-in')pos.addScaledVector(out,-p.travel*s);
  if(id==='pull-out')pos.addScaledVector(out,p.travel*s);
  if(id==='lead-follow')pos.copy(center).addScaledVector(out,-p.distance).addScaledVector(right,p.sideOffset).add(new Vector3(0,p.height,0));
  if(id==='side-follow')pos.copy(center).addScaledVector(right,p.distance).addScaledVector(out,p.sideOffset).add(new Vector3(0,p.height,0));
  if(id==='arc'||id==='orbit-360'){const angle=heading+MathUtils.degToRad(id==='orbit-360'?(p.angleDegrees<0?-360:360):p.angleDegrees)*s;pos.copy(center).add(new Vector3(Math.sin(angle)*p.distance,p.height,Math.cos(angle)*p.distance)).addScaledVector(right,p.sideOffset);}
  if(id==='reveal-slide')pos.addScaledVector(right,p.travel*(s-.5));
  if(id==='pov'){pos.copy(center).addScaledVector(out,-p.distance).addScaledVector(right,p.sideOffset).add(new Vector3(0,p.height,0));if(!config.lookTarget)look.copy(pos).addScaledVector(out,-10);}
  const initialPos=pos.clone(),initialLook=look.clone();
  let focal=p.focalLengthMm,pathRotation:Quaternion|undefined;
  const warnings:string[]=[],roll=MathUtils.degToRad(p.rollDegrees??0);
  const smooth=(v:number)=>{const x=MathUtils.clamp(v,0,1);return x*x*x*(x*(x*6-15)+10);};
  if(id==='top-down'){pos.copy(center).add(new Vector3(0,p.distance,0));if(!config.lookTarget)look.copy(center);}
  if(id==='pedestal')pos.y+=p.travel*s;
  if(id==='crane-up'||id==='crane-down'){const k=id==='crane-up'?s:1-s;pos.addScaledVector(out,p.travel*k);pos.y+=(p.rise??3)*k;}
  if(id==='zoom'||id==='snap-zoom')focal=MathUtils.lerp(p.focalLengthMm,p.endFocalLengthMm??70,s);
  if(id==='dolly-zoom'){
    const axis=look.clone().sub(pos).normalize(),depth=a.point.clone().sub(pos).dot(axis);
    if(depth<=.1||depth-p.travel<=.1)throw new Error('滑动变焦需要主体在镜头前方，移动终点不能越过主体焦平面');
    const end=p.focalLengthMm*(depth-p.travel)/depth;
    if(end<1||end>1000)throw new Error('滑动变焦超出 1–1000 mm 镜头范围，请缩短移动距离');
    pos.addScaledVector(axis,p.travel*s);look.copy(pos).add(axis);focal=p.focalLengthMm*(depth-p.travel*s)/depth;
    if(config.lookTarget)warnings.push('滑动变焦锁定起始光轴；主体大小约束只适用于与光轴垂直的主体平面');
  }
  if(id==='subject-mounted'){
    const q=a.anchor.getWorldQuaternion(new Quaternion());
    const offset=new Vector3(p.sideOffset,p.height,-p.distance).applyAxisAngle(new Vector3(0,1,0),MathUtils.degToRad(p.headingDegrees)).applyQuaternion(q);
    pos.copy(a.point).add(offset);if(!config.lookTarget)look.copy(a.point);
    pathRotation=q;
  }
  if(id==='handoff-oner'&&b){
    const from=p.handoffStartSeconds??MathUtils.lerp(p.startSeconds,p.endSeconds,.35),to=p.handoffEndSeconds??MathUtils.lerp(p.startSeconds,p.endSeconds,.65);
    const h=smooth((timeSeconds-from)/(to-from));
    const offsetFor=(binding:typeof a)=>{
      let yaw=MathUtils.degToRad(p.headingDegrees);
      if(p.frame==='subject'){const f=new Vector3(0,0,1).applyQuaternion(binding.root.getWorldQuaternion(new Quaternion()));yaw+=Math.atan2(f.x,f.z);}
      return new Vector3(Math.sin(yaw)*p.distance+Math.cos(yaw)*p.sideOffset,p.height,Math.cos(yaw)*p.distance-Math.sin(yaw)*p.sideOffset);
    };
    pos.copy(a.point).add(offsetFor(a)).lerp(b.point.clone().add(offsetFor(b)),h);
    const reveal=smooth((timeSeconds-to)/Math.max(.001,p.endSeconds-to));
    pos.addScaledVector(offsetFor(b).setY(0).normalize(),p.travel*reveal);
    if(!config.lookTarget){
      look.copy(a.point).lerp(b.point,h);
      if(config.eventTarget){const event=resolveCameraBinding(stage,config.eventTarget).point;
        if(h<.5)look.copy(a.point).lerp(event,smooth(h*2));else look.copy(event).lerp(b.point,smooth(h*2-1));
      }
    }
  }
  if(config.path&&['flythrough','handoff-oner'].includes(id)){
    const path=samplePresetPath(config.path,s);pos.copy(path.position);
    if(id==='flythrough'&&!config.lookTarget){look.copy(path.look);pathRotation=path.quaternion;}
    const duration=p.endSeconds-p.startSeconds-p.holdStartSeconds-p.holdEndSeconds;
    const peakRate=p.easing==='linear'?1:1.875;
    if(path.length*peakRate/duration>(p.maxSpeedMps??12))warnings.push('路径峰值速度超过设定上限，请延长运动时间或缩短路径');
    const ds=.001,left=samplePresetPath(config.path,Math.max(0,s-ds)),rightSample=samplePresetPath(config.path,Math.min(1,s+ds));
    const rate=MathUtils.radToDeg(left.quaternion.angleTo(rightSample.quaternion))/(Math.min(1,s+ds)-Math.max(0,s-ds))*peakRate/duration;
    if(rate>(p.maxAngularSpeedDeg??120))warnings.push('路径转弯角速度超过设定上限，请拉开控制点或延长时间');
  }
  // Smooth analytical noise with fixed phases, never per-frame randomness.
  const shake=(axis:number)=>{
    const seed=p.seed??7,phase=Math.sin(seed*12.9898+axis*78.233)*43758.5453;
    const t=MathUtils.clamp(timeSeconds,p.startSeconds+p.holdStartSeconds,p.endSeconds-p.holdEndSeconds)-(p.startSeconds+p.holdStartSeconds);
    const f=2*Math.PI*(p.shakeFrequencyHz??1.4);
    return .65*Math.sin(t*f+phase)+.35*Math.sin(t*f*1.73+phase*.37);
  };
  if(id==='handheld')pos.add(new Vector3(shake(1),shake(2),shake(3)).multiplyScalar(p.shakeMeters??.015));
  const camera=new PerspectiveCamera(45,aspect,.05,500);camera.position.copy(pos);camera.name=def.name;
  if(pos.distanceToSquared(look)<1e-8)throw new Error('机位与观看目标重合，请增加距离或更换观看目标');
  if(id==='top-down')camera.up.set(Math.sin(heading),0,-Math.cos(heading));
  if(id==='subject-mounted'&&pathRotation)camera.up.set(0,1,0).applyQuaternion(pathRotation);
  if(id==='flythrough'&&pathRotation)camera.quaternion.copy(pathRotation);
  else {
    const direction=look.clone().sub(pos).normalize();
    if(Math.abs(direction.dot(camera.up))>.9999)camera.up.set(0,0,-1);
    camera.lookAt(look);
  }
  if(id==='pedestal'&&p.lockOrientation){const ref=new PerspectiveCamera();ref.position.copy(initialPos);ref.lookAt(initialLook);camera.quaternion.copy(ref.quaternion);}
  if(id==='dutch-angle')camera.rotateZ(roll);
  if(id==='flythrough')camera.rotateZ(roll*Math.sin(Math.PI*s));
  if(id==='handheld')camera.quaternion.multiply(new Quaternion().setFromEuler(new Euler(shake(4)*MathUtils.degToRad(p.shakeDegrees??.35),shake(5)*MathUtils.degToRad(p.shakeDegrees??.35),shake(6)*MathUtils.degToRad(p.shakeDegrees??.35),'YXZ')));
  if(id==='pan'||id==='tilt'||id==='whip-pan'){const e=new Euler().setFromQuaternion(camera.quaternion,'YXZ'),angle=MathUtils.degToRad(p.angleDegrees)*(s-.5);if(id==='pan'||id==='whip-pan')e.y+=angle;else e.x=MathUtils.clamp(e.x+angle,-Math.PI/2+.001,Math.PI/2-.001);camera.quaternion.setFromEuler(e);}
  const gateHeight=aspect>=p.sensor.widthMm/p.sensor.heightMm?p.sensor.widthMm/aspect:p.sensor.heightMm;
  camera.fov=MathUtils.radToDeg(2*Math.atan(gateHeight/(2*focal)));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  if(p.fitFrame&&config.reference.bounds&&['establishing','two-shot'].includes(id)){
    const inverse=camera.quaternion.clone().invert(),tan=Math.tan(MathUtils.degToRad(camera.fov)/2);let extra=0;
    for(const point of corners(config.reference.bounds)){const v=point.sub(camera.position).applyQuaternion(inverse);extra=Math.max(extra,Math.abs(v.y)*1.12/tan+v.z,Math.abs(v.x)*1.12/(tan*aspect)+v.z);}
    camera.position.addScaledVector(camera.getWorldDirection(new Vector3()),-extra);camera.updateMatrixWorld(true);
  }
  const forward=camera.getWorldDirection(new Vector3()),depth=(v:Vector3)=>v.clone().sub(camera.position).dot(forward);
  const focus=config.focusTarget?resolveCameraBinding(stage,config.focusTarget).point:(id==='over-shoulder'&&b?b.point:['pov','flythrough','handoff-oner'].includes(id)?look:a.point);
  let focusDistance=depth(focus);
  if(id==='rack-focus'&&b){const from=depth(a.point),to=depth(b.point);if(from<=p.focalLengthMm/1000||to<=p.focalLengthMm/1000)throw new Error('拉焦的 A、B 都需位于镜头前方有效焦平面');focusDistance=1/MathUtils.lerp(1/from,1/to,s);if(Math.abs(from-to)<.3)warnings.push('A/B 纵深差较小，拉焦效果可能不明显');}
  if(focusDistance<=focal/1000)warnings.push('焦点位于镜头后方或过近，本帧不启用景深');
  const projected=(id==='over-shoulder'&&b?b.point:a.point).clone().project(camera);
  if(!['pov','flythrough','handoff-oner'].includes(id)&&(Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z>1||projected.z< -1))warnings.push('主要目标锚点不在画面内，请调整距离、方位或观看目标');
  if(b&&['two-shot','rack-focus'].includes(id)){const v=b.point.clone().project(camera);if(Math.abs(v.x)>1||Math.abs(v.y)>1||v.z>1||v.z< -1)warnings.push('主体 B 锚点不在画面内，请调整构图或观看目标');}
  if(id==='reveal-slide'&&config.occluder){const occluder=resolveCameraBinding(stage,config.occluder).root,delta=a.point.clone().sub(camera.position);const hits=new Raycaster(camera.position,delta.clone().normalize(),.05,delta.length()).intersectObject(occluder,true);if(s<.02&&!hits.length)warnings.push('揭示起点未被指定前景遮挡，请调整方位、横移或前景位置');if(s>.98&&hits.length)warnings.push('揭示终点仍被指定前景遮挡，请增加横移或调整方位');}
  if(['whip-pan','snap-zoom'].includes(id))warnings.push('轨迹可预览；当前未模拟运动模糊');
  if(['flythrough','handoff-oner','crane-up','crane-down','orbit-360'].includes(id))warnings.push(...pathWarnings(stage,camera.position,p.clearanceMeters??.15));
  const metadata:CameraMetadata={label:def.name,shotSize:def.name,movement:def.description,focalLengthMm:focal,sensor:{...p.sensor},aperture:p.aperture,focus:{distanceMeters:Math.max(focusDistance,.000001)}};
  const record:CameraPresetRecord={id,version:1,config:structuredClone(config),warnings};
  return {camera,metadata,record};
}
/** Register a new independent camera; authored scene update still owns character animation. */
export function addCameraPreset(stage:StageScene,cameraId:string,config:CameraPresetConfig){
  if(!cameraId||['__proto__','constructor','prototype'].includes(cameraId)||Object.hasOwn(stage.cameras,cameraId))throw new Error('预设机位 ID 为空、保留或已存在');
  const sample=sampleCameraPreset(stage,config,0);
  stage.cameras[cameraId]=sample.camera;(stage.cameraPresets??={})[cameraId]=structuredClone(config);
  return sample.camera;
}
