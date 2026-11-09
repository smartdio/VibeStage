import {Box3,Euler,MathUtils,Object3D,PerspectiveCamera,Quaternion,Raycaster,Vector3} from 'three';
import type {CameraMetadata,SensorSize} from './cameras';
import type {StageScene} from './types';

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
] as const;
export type CameraPresetId=typeof cameraPresetDefinitions[number]['id'];
/** Stable subject key, or a unique scene object name. Anchors are relative to this object. */
export interface CameraBinding {subject:string;anchor?:string;offset?:V3}
export interface CameraPresetParameters {
  startSeconds:number;endSeconds:number;holdStartSeconds:number;holdEndSeconds:number;
  distance:number;height:number;sideOffset:number;travel:number;angleDegrees:number;headingDegrees:number;
  focalLengthMm:number;aperture:number;sensor:SensorSize;
  frame:'world'|'subject';easing:'smooth'|'linear';fitFrame:boolean;
}
export interface CameraPresetConfig {
  version:1;presetId:CameraPresetId;subject:CameraBinding;secondary?:CameraBinding;lookTarget?:CameraBinding;focusTarget?:CameraBinding;occluder?:CameraBinding;
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
  for(const key of ['subject','secondary','lookTarget','focusTarget','occluder']){
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
  const config:CameraPresetConfig={version:1,presetId,...structuredClone(bindings),reference:{timeSeconds:referenceTimeSeconds,target:tuple(target),bounds:bounds.isEmpty()?undefined:{min:tuple(bounds.min),max:tuple(bounds.max)}},parameters:{startSeconds:0,endSeconds:duration,holdStartSeconds:duration*.15,holdEndSeconds:duration*.15,distance:def.distance,height:def.height,sideOffset:presetId==='over-shoulder'?.6:0,travel:1.5,angleDegrees:presetId==='tilt'?25:45,headingDegrees:0,focalLengthMm:def.focal,aperture:def.aperture,sensor:{widthMm:36,heightMm:24},frame:['rear-follow','lead-follow','side-follow','pov'].includes(presetId)?'subject':'world',easing:'smooth',fitFrame:['establishing','two-shot'].includes(presetId),...overrides}};
  if(presetId==='over-shoulder'&&b&&overrides.headingDegrees===undefined){const outward=a.point.clone().sub(b.point);config.parameters.headingDegrees=MathUtils.radToDeg(Math.atan2(outward.x,outward.z));}
  validateCameraPreset(config);return config;
}
function corners(bounds:{min:V3;max:V3}){const points:Vector3[]=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])points.push(new Vector3(x,y,z));return points;}
/** Pure in time: objects must already be at timeSeconds; no previous-frame camera state is read. */
export function sampleCameraPreset(stage:StageScene,config:CameraPresetConfig,timeSeconds:number,aspect=stage.output.width/stage.output.height){
  validateCameraPreset(config);if(!Number.isFinite(timeSeconds)||!Number.isFinite(aspect)||aspect<=0)throw new Error('预设采样时间或画幅无效');
  const p=config.parameters,id=config.presetId,def=presetDefinition(id),a=resolveCameraBinding(stage,config.subject),b=config.secondary?resolveCameraBinding(stage,config.secondary):undefined;
  if(p.endSeconds>stage.durationSeconds+1e-6)throw new Error('预设结束时间超出场景时长');
  const u=MathUtils.clamp((timeSeconds-p.startSeconds-p.holdStartSeconds)/(p.endSeconds-p.startSeconds-p.holdStartSeconds-p.holdEndSeconds),0,1),s=p.easing==='linear'?u:u*u*u*(u*(u*6-15)+10);
  const follow=['rear-follow','lead-follow','side-follow','pov'].includes(id);
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
  if(id==='arc'){const angle=heading+MathUtils.degToRad(p.angleDegrees)*s;pos.copy(center).add(new Vector3(Math.sin(angle)*p.distance,p.height,Math.cos(angle)*p.distance)).addScaledVector(right,p.sideOffset);}
  if(id==='reveal-slide')pos.addScaledVector(right,p.travel*(s-.5));
  if(id==='pov'){pos.copy(center).addScaledVector(out,-p.distance).addScaledVector(right,p.sideOffset).add(new Vector3(0,p.height,0));if(!config.lookTarget)look.copy(pos).addScaledVector(out,-10);}
  const camera=new PerspectiveCamera(45,aspect,.05,500);camera.position.copy(pos);camera.name=def.name;
  if(pos.distanceToSquared(look)<1e-8)throw new Error('机位与观看目标重合，请增加距离或更换观看目标');
  camera.lookAt(look);
  if(id==='pan'||id==='tilt'){const e=new Euler().setFromQuaternion(camera.quaternion,'YXZ'),angle=MathUtils.degToRad(p.angleDegrees)*(s-.5);if(id==='pan')e.y+=angle;else e.x=MathUtils.clamp(e.x+angle,-Math.PI/2+.001,Math.PI/2-.001);camera.quaternion.setFromEuler(e);}
  const gateHeight=aspect>=p.sensor.widthMm/p.sensor.heightMm?p.sensor.widthMm/aspect:p.sensor.heightMm;
  camera.fov=MathUtils.radToDeg(2*Math.atan(gateHeight/(2*p.focalLengthMm)));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  if(p.fitFrame&&config.reference.bounds&&['establishing','two-shot'].includes(id)){
    const inverse=camera.quaternion.clone().invert(),tan=Math.tan(MathUtils.degToRad(camera.fov)/2);let extra=0;
    for(const point of corners(config.reference.bounds)){const v=point.sub(camera.position).applyQuaternion(inverse);extra=Math.max(extra,Math.abs(v.y)*1.12/tan+v.z,Math.abs(v.x)*1.12/(tan*aspect)+v.z);}
    camera.position.addScaledVector(camera.getWorldDirection(new Vector3()),-extra);camera.updateMatrixWorld(true);
  }
  const forward=camera.getWorldDirection(new Vector3()),depth=(v:Vector3)=>v.clone().sub(camera.position).dot(forward);
  const focus=config.focusTarget?resolveCameraBinding(stage,config.focusTarget).point:(id==='over-shoulder'&&b?b.point:id==='pov'?look:a.point);
  let focusDistance=depth(focus);
  const warnings:string[]=[];
  if(id==='rack-focus'&&b){const from=depth(a.point),to=depth(b.point);if(from<=p.focalLengthMm/1000||to<=p.focalLengthMm/1000)throw new Error('拉焦的 A、B 都需位于镜头前方有效焦平面');focusDistance=1/MathUtils.lerp(1/from,1/to,s);if(Math.abs(from-to)<.3)warnings.push('A/B 纵深差较小，拉焦效果可能不明显');}
  if(focusDistance<=p.focalLengthMm/1000)warnings.push('焦点位于镜头后方或过近，本帧不启用景深');
  const projected=(id==='over-shoulder'&&b?b.point:a.point).clone().project(camera);
  if(id!=='pov'&&(Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z>1||projected.z< -1))warnings.push('主要目标锚点不在画面内，请调整距离、方位或观看目标');
  if(b&&['two-shot','rack-focus'].includes(id)){const v=b.point.clone().project(camera);if(Math.abs(v.x)>1||Math.abs(v.y)>1||v.z>1||v.z< -1)warnings.push('主体 B 锚点不在画面内，请调整构图或观看目标');}
  if(id==='reveal-slide'&&config.occluder){const occluder=resolveCameraBinding(stage,config.occluder).root,delta=a.point.clone().sub(camera.position);const hits=new Raycaster(camera.position,delta.clone().normalize(),.05,delta.length()).intersectObject(occluder,true);if(s<.02&&!hits.length)warnings.push('揭示起点未被指定前景遮挡，请调整方位、横移或前景位置');if(s>.98&&hits.length)warnings.push('揭示终点仍被指定前景遮挡，请增加横移或调整方位');}
  const metadata:CameraMetadata={label:def.name,shotSize:def.name,movement:def.description,focalLengthMm:p.focalLengthMm,sensor:{...p.sensor},aperture:p.aperture,focus:{distanceMeters:Math.max(focusDistance,.000001)}};
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
