import {prepareSceneSampling,setPerformanceSampleHook,validatePerformancePlan,type PerformanceContext} from './performances';
import {validateCameraPreset,type CameraPresetConfig} from './camera-presets';
import {Euler,PerspectiveCamera,Quaternion,Vector3,MathUtils} from 'three';
import {FULL_FRAME,focalLengthFromFov,validateCameraSetup,type CameraCut,type CameraMetadata,type SensorSize} from './cameras';
import type {StageScene} from './types';

export interface CameraEdit {
  created?:boolean;
  preset?:CameraPresetConfig;
  label?:string; shotSize?:string; movement?:string;
  focalLengthMm?:number; sensor?:SensorSize; aperture?:number; focusDistanceMeters?:number;
  /** World space, meters and degrees; Euler order YXZ (pitch, yaw, roll). */
  position?:[number,number,number]; rotationDegrees?:[number,number,number];
}
export interface CameraEdits {version:1;cameras:Record<string,CameraEdit>;sequences:Record<string,CameraCut[]>}
export const emptyCameraEdits=():CameraEdits=>({version:1,cameras:{},sequences:{}});
const positive=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const map=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=(x:string)=>x.length>0&&x.length<=128&&!['__proto__','constructor','prototype'].includes(x);
export function validateCameraEdits(value:unknown):asserts value is CameraEdits{
  if(!map(value)||value.version!==1||!map(value.cameras)||!map(value.sequences))throw new Error('无效的摄影机设置文件');
  if(Object.keys(value.cameras).length>100||Object.keys(value.sequences).length>30)throw new Error('机位或分镜组数量超过限制');
  for(const [key,e] of Object.entries(value.cameras)){
    if(!id(key)||!map(e))throw new Error('无效的机位 ID');
    if(e.created!==undefined&&typeof e.created!=='boolean')throw new Error('无效的新增机位标记');
    for(const field of ['label','shotSize','movement'])if(e[field]!==undefined&&(typeof e[field]!=='string'||(e[field] as string).length>300))throw new Error('机位说明需为 300 字以内的文本');
    for(const field of ['focalLengthMm','aperture','focusDistanceMeters'])if(e[field]!==undefined&&!positive(e[field]))throw new Error('焦距、光圈和对焦距离必须为正数');
    if(e.sensor!==undefined&&(!map(e.sensor)||!positive(e.sensor.widthMm)||!positive(e.sensor.heightMm)))throw new Error('传感器尺寸必须为正数');
    for(const field of ['position','rotationDegrees'])if(e[field]!==undefined&&(!Array.isArray(e[field])||e[field].length!==3||!e[field].every(Number.isFinite)))throw new Error('位置和角度需要三个有效数值');
    if(e.preset!==undefined){validateCameraPreset(e.preset);if(e.position||e.rotationDegrees||e.focusDistanceMeters!==undefined)throw new Error('预设机位请在预设参数中调节位置与对焦；或先复制为固定机位');}
    if(e.created&&!e.preset&&(!e.position||!e.rotationDegrees||!positive(e.focalLengthMm)||!e.sensor))throw new Error('新增机位需要位置、朝向、焦距与传感器');
  }
  for(const [key,cuts] of Object.entries(value.sequences)){
    if(!id(key)||!Array.isArray(cuts)||!cuts.length||cuts.length>300)throw new Error('分镜组需要至少一个片段');
    validatePerformancePlan(cuts as CameraCut[]);
    let end=0;const seen=new Set<string>();
    for(const cut of cuts){
      if(!map(cut)||typeof cut.id!=='string'||!id(cut.id)||seen.has(cut.id)||typeof cut.cameraId!=='string'||!id(cut.cameraId)||!Number.isFinite(cut.start)||!Number.isFinite(cut.end)||Math.abs((cut.start as number)-end)>1e-6||(cut.end as number)<=(cut.start as number))throw new Error('分镜时间必须连续且不能重叠，片段 ID 不可重复');
      if(cut.label!==undefined&&(typeof cut.label!=='string'||cut.label.length>300))throw new Error('分镜名称过长');
      seen.add(cut.id);end=cut.end as number;
    }
  }
}

/** Keep UI overrides outside authored scene code and apply them after every authored update. */
export function createCameraEditSession(stage:StageScene,initial:CameraEdits){
  validateCameraEdits(initial);prepareSceneSampling(stage);
  const baseUpdate=stage.update.bind(stage),baseCameras={...stage.cameras},baseMetadata=stage.cameraMetadata??{},baseCuts=stage.cameraCuts??{},basePresets=stage.cameraPresets??{};
  const cameraRest=new Map(Object.values(baseCameras).map(c=>[c,{position:c.position.clone(),rotation:c.rotation.clone(),scale:c.scale.clone(),name:c.name}]));
  const metaRest=new Map(Object.values(baseMetadata).map(m=>[m,{...m,sensor:{...m.sensor}}]));
  let edits=structuredClone(initial),time=0;
  const created=new Map<string,PerspectiveCamera>();
  const cameraFor=(id:string)=>{let c=created.get(id);if(!c){c=new PerspectiveCamera(40,stage.output.width/stage.output.height,.1,100);c.name=id;created.set(id,c);}return c;};
  function update(t:number,context?:PerformanceContext,afterAuthored?:()=>void){
    time=t;
    stage.cameras={...baseCameras};stage.cameraMetadata={...baseMetadata};stage.cameraCuts={...baseCuts};stage.cameraPresets={...basePresets};
    for(const [c,r] of cameraRest){c.position.copy(r.position);c.rotation.copy(r.rotation);c.scale.copy(r.scale);c.name=r.name;}
    for(const [m,r] of metaRest){for(const key of Object.keys(m))delete (m as unknown as Record<string,unknown>)[key];Object.assign(m,r,{sensor:{...r.sensor}});}
    baseUpdate(t,context);if(afterAuthored)afterAuthored();else stage.updateCameras?.(t,context);
    for(const [key,e] of Object.entries(edits.cameras)){
      if(e.created){if(baseCameras[key])throw new Error(`新增机位 ${key} 与场景机位重名`);stage.cameras[key]=cameraFor(key);}
      const c=stage.cameras[key];if(!(c instanceof PerspectiveCamera)||baseCuts[key])throw new Error(`不能调整机位 ${key}：机位不存在或不是独立透视机位`);
      const preset=e.preset??stage.cameraPresets[key];
      if(preset){
        if(e.position||e.rotationDegrees||e.focusDistanceMeters!==undefined)throw new Error('预设机位不能同时设置固定姿态或固定对焦距离');
        const config=structuredClone(preset);
        if(e.focalLengthMm!==undefined)config.parameters.focalLengthMm=e.focalLengthMm;
        if(e.aperture!==undefined)config.parameters.aperture=e.aperture;
        if(e.sensor)config.parameters.sensor={...e.sensor};
        stage.cameraPresets[key]=config;
      }
      const base=stage.cameraMetadata[key];
      const meta:CameraMetadata={...(base??{focalLengthMm:focalLengthFromFov(c.getEffectiveFOV(),FULL_FRAME,stage.output.width/stage.output.height),sensor:{...FULL_FRAME}})};
      for(const key of ['label','shotSize','movement','focalLengthMm','aperture'] as const){if(e[key]!==undefined)Object.assign(meta,{[key]:e[key]});}
      if(e.sensor)meta.sensor={...e.sensor};
      if(e.focusDistanceMeters!==undefined)meta.focus={distanceMeters:e.focusDistanceMeters};
      stage.cameraMetadata[key]=meta;c.name=e.label||c.name;
      if(e.position){const v=new Vector3(...e.position);if(c.parent){c.parent.updateWorldMatrix(true,false);c.parent.worldToLocal(v);}c.position.copy(v);}
      if(e.rotationDegrees){const q=new Quaternion().setFromEuler(new Euler(...e.rotationDegrees.map(MathUtils.degToRad) as [number,number,number],'YXZ'));if(c.parent){const parent=c.parent.getWorldQuaternion(new Quaternion());q.premultiply(parent.invert());}c.quaternion.copy(q);}
      c.updateWorldMatrix(true,false);
    }
    for(const [key,cuts] of Object.entries(edits.sequences)){
      if(baseCameras[key]&&!baseCuts[key])throw new Error(`分镜组 ${key} 与独立机位重名`);
      stage.cameras[key]??=cameraFor(key);stage.cameras[key].name=baseCameras[key]?.name||('手动分镜 · '+key);
      stage.cameraCuts[key]=cuts.map(c=>({...c}));
    }
  }
  stage.update=update;
  try{update(0);validateCameraSetup(stage);}catch(e){stage.update=baseUpdate;throw e;}
  setPerformanceSampleHook(stage,(t,context,after)=>update(t,context,after));
  return {
    stage,baseCameraIds:Object.keys(baseCameras),baseSequenceIds:Object.keys(baseCuts),
    getEdits:()=>structuredClone(edits),
    setEdits(next:CameraEdits){validateCameraEdits(next);const previous=edits;edits=structuredClone(next);try{update(time);validateCameraSetup(stage);}catch(error){edits=previous;update(time);throw error;}},
  };
}
export type CameraEditSession=ReturnType<typeof createCameraEditSession>;
