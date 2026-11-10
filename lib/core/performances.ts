import {Euler,Quaternion,Vector3,MathUtils,type Object3D,type Matrix4} from 'three';
import type {StageScene} from './types';
import type {CameraCut} from './cameras';
export interface SubjectPlacement {
  /** Start transform in the subject parent's local coordinates. Animation deltas are preserved. */
  position?:[number,number,number];
  rotationDegrees?:[number,number,number];
  scale?:[number,number,number];
  visible?:boolean;
}
export interface ShotPerformance {
  mode:'continue'|'independent';
  takeId?:string;
  sourceStartSeconds?:number;
  subjects?:Record<string,SubjectPlacement>;
}
export interface PerformanceContext {
  timelineTimeSeconds:number;
  localTimeSeconds:number;
  sourceTimeSeconds:number;
  sourceStartSeconds:number;
  mode:'continue'|'independent';
  takeId?:string;
  shotId?:string;
  originShotId?:string;
}
export interface ScenePerformance {label?:string;update:(timeSeconds:number,context:PerformanceContext)=>void}
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const validId=(x:unknown):x is string=>typeof x==='string'&&!!x&&x.length<=128&&!['__proto__','prototype','constructor'].includes(x);
export function validateShotPerformance(value:unknown):asserts value is ShotPerformance|undefined {
  if(value===undefined)return;
  if(!record(value)||!['continue','independent'].includes(value.mode as string))throw new Error('分镜表演模式无效');
  if(value.mode==='continue'&&(value.takeId!==undefined||value.sourceStartSeconds!==undefined||value.subjects!==undefined))throw new Error('延续表演不能另设动作或摆位，请切换为独立表演');
  if(value.takeId!==undefined&&!validId(value.takeId))throw new Error('动作 ID 无效');
  if(value.sourceStartSeconds!==undefined&&(typeof value.sourceStartSeconds!=='number'||!Number.isFinite(value.sourceStartSeconds)||value.sourceStartSeconds<0||value.sourceStartSeconds>300))throw new Error('动作起点须在 0–300 秒之间');
  if(value.subjects!==undefined){
    if(!record(value.subjects)||Object.keys(value.subjects).length>200)throw new Error('分镜摆位需要有效对象列表');
    for(const [id,p] of Object.entries(value.subjects)){
      if(!validId(id)||!record(p))throw new Error('摆位对象无效');
      for(const field of ['position','rotationDegrees','scale'])if(p[field]!==undefined&&(!Array.isArray(p[field])||p[field].length!==3||!p[field].every(n=>typeof n==='number'&&Number.isFinite(n)&&(field!=='scale'||n>0))))throw new Error('摆位需要三个有效数值，缩放须为正数');
      if(p.visible!==undefined&&typeof p.visible!=='boolean')throw new Error('对象可见性无效');
    }
  }
}
/** A continue cut extends the last independent take, regardless of seek/playback history. */
export function resolvePerformance(cuts:CameraCut[]|undefined,time:number){
  if(!cuts?.length)return {context:{timelineTimeSeconds:time,localTimeSeconds:time,sourceTimeSeconds:time,sourceStartSeconds:0,mode:'continue'} as PerformanceContext,placements:undefined};
  const index=cuts.findIndex(c=>time>=c.start&&time<c.end);
  const current=index<0&&time===cuts.at(-1)!.end?cuts.length-1:index;
  if(current<0)throw new Error('当前时间没有对应分镜');
  const cut=cuts[current];let origin:CameraCut|undefined;
  for(let i=current;i>=0;i--)if(cuts[i].performance?.mode==='independent'){origin=cuts[i];break;}
  const start=origin?.performance?.sourceStartSeconds??0;
  return {context:{timelineTimeSeconds:time,localTimeSeconds:time-cut.start,sourceTimeSeconds:start+time-(origin?.start??0),sourceStartSeconds:start,mode:cut.performance?.mode??'continue',takeId:origin?.performance?.takeId,shotId:cut.id,originShotId:origin?.id} as PerformanceContext,placements:origin?.performance?.subjects};
}
export function validatePerformancePlan(cuts:CameraCut[],stage?:StageScene){
  for(const cut of cuts){
    validateShotPerformance(cut.performance);
    const p=cut.performance;
    if(stage&&p?.takeId&&!Object.hasOwn(stage.performances??{},p.takeId))throw new Error(`动作不存在：${p.takeId}`);
    if(stage)for(const id of Object.keys(p?.subjects??{}))if(!Object.hasOwn(stage.subjects??{},id))throw new Error(`摆位对象不存在：${id}`);
    const context=resolvePerformance(cuts,cut.start).context;
    if(context.sourceTimeSeconds+cut.end-cut.start>300+1e-6)throw new Error('表演采样时间不能超过 300 秒');
  }
}
type Transform={matrix:Matrix4;matrixAutoUpdate:boolean;position:Vector3;quaternion:Quaternion;scale:Vector3;visible:boolean};
const capture=(o:Object3D):Transform=>({matrix:o.matrix.clone(),matrixAutoUpdate:o.matrixAutoUpdate,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),visible:o.visible});
const rests=new WeakMap<StageScene,Map<Object3D,Transform>>();
type SampleHook=(time:number,context:PerformanceContext,afterAuthored:()=>void)=>void;
const hooks=new WeakMap<StageScene,SampleHook>();
/** Internal hook preserves the priority of saved camera edits over take-authored camera motion. */
export function setPerformanceSampleHook(stage:StageScene,hook:SampleHook){hooks.set(stage,hook);}
export function prepareSceneSampling(stage:StageScene){
  if(rests.has(stage))return;
  const rest=new Map<Object3D,Transform>();stage.scene.traverse(o=>rest.set(o,capture(o)));for(const c of Object.values(stage.cameras))c.traverse(o=>rest.set(o,capture(o)));rests.set(stage,rest);
}
function reset(stage:StageScene){for(const [o,t] of rests.get(stage)!){o.position.copy(t.position);o.quaternion.copy(t.quaternion);o.scale.copy(t.scale);o.visible=t.visible;o.matrix.copy(t.matrix);o.matrixAutoUpdate=t.matrixAutoUpdate;o.matrixWorldNeedsUpdate=true;}}
/** Common deterministic evaluator for preview, arbitrary seeks, stills and video frames. */
export function sampleScene(stage:StageScene,selectedCameraId:string,time:number):PerformanceContext {
  if(!Number.isFinite(time)||time<0||time>stage.durationSeconds)throw new Error('场景采样时间超出范围');
  prepareSceneSampling(stage);
  const {context,placements}=resolvePerformance(stage.cameraCuts?.[selectedCameraId],time);
  const take=context.takeId?stage.performances?.[context.takeId]:undefined;
  if(context.takeId&&!take)throw new Error(`动作不存在：${context.takeId}`);
  const run=(sourceTime:number,ctx:PerformanceContext,afterTake:()=>void)=>{
    reset(stage);
    const after=()=>{take?.update(sourceTime,ctx);afterTake();stage.updateCameras?.(sourceTime,ctx);};
    const hook=hooks.get(stage);if(hook)hook(sourceTime,ctx,after);else{stage.update(sourceTime,ctx);after();}
  };
  const starts=new Map<string,Transform>();
  if(placements&&Object.keys(placements).length){
    const origin=stage.cameraCuts![selectedCameraId].find(c=>c.id===context.originShotId)!;
    run(context.sourceStartSeconds,{...context,timelineTimeSeconds:origin.start,localTimeSeconds:0,sourceTimeSeconds:context.sourceStartSeconds,shotId:origin.id,mode:'independent'},()=>{});
    for(const id of Object.keys(placements)){const object=stage.subjects?.[id];if(!object)throw new Error(`摆位对象不存在：${id}`);starts.set(id,capture(object));}
  }
  run(context.sourceTimeSeconds,context,()=>{
    for(const [id,p] of Object.entries(placements??{})){
      const o=stage.subjects![id],start=starts.get(id)!;
      // Rebase authored motion around the shot's start placement, including heading/scale.
      const q=p.rotationDegrees?new Quaternion().setFromEuler(new Euler(...p.rotationDegrees.map(MathUtils.degToRad) as [number,number,number],'YXZ')).multiply(start.quaternion.clone().invert()):new Quaternion();
      if(p.scale&&[start.scale.x,start.scale.y,start.scale.z].some(v=>v===0))throw new Error(`对象 ${id} 的动作起始缩放为 0，无法重新设置缩放`);
      const scale=p.scale?new Vector3(...p.scale).divide(start.scale):new Vector3(1,1,1);
      if(p.position||p.rotationDegrees||p.scale)o.position.sub(start.position).multiply(scale).applyQuaternion(q).add(p.position?new Vector3(...p.position):start.position);
      if(p.rotationDegrees)o.quaternion.premultiply(q);
      if(p.scale)o.scale.multiply(scale);
      if(p.visible!==undefined)o.visible=p.visible;
      o.updateMatrix();
    }
  });
  stage.scene.updateMatrixWorld(true);return context;
}
