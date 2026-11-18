import {cutContainsTime} from '../lib/core/cut-time';
import {Euler,MathUtils,Quaternion,Vector3} from 'three';
import {resolveShotCamera,sampleFramingKeys,framingKeyTimeTolerance,FULL_FRAME,focalLengthFromFov} from '@vibestage/core';
import type {CameraEdit,CameraEdits,CameraPresetConfig,StageScene} from '@vibestage/core';

/** Copy the current framing without silently leaving the edit timeline behind. */
export function copyCameraForShot(stage:StageScene,edits:CameraEdits,selected:string,time:number,pose:CameraEdit){
  let n=1;while(stage.cameras[`camera_${n}`])n++;
  const cameraId=`camera_${n}`,next=structuredClone(edits),cuts=stage.cameraCuts?.[selected];
  const index=cuts?.findIndex(c=>cutContainsTime(c,time)||time===stage.durationSeconds&&c===cuts.at(-1))??-1;
  if(cuts&&index<0)throw new Error('当前时间没有对应镜头，无法替换机位');
  next.cameras[cameraId]={...structuredClone(pose),created:true,label:cuts?`${cuts[index].label||cuts[index].id} · 手动机位`:`手动机位 ${n}`,movement:'固定机位 · 手动构图'};
  if(cuts)next.sequences[selected]=cuts.map((c,i)=>i===index?{...structuredClone(c),cameraId}:structuredClone(c));
  return {edits:next,cameraId,selection:cuts?selected:cameraId};
}

/** Detach on apply, so entering/cancelling control never changes shot references. */
export function applyControlledCamera(stage:StageScene,edits:CameraEdits,selected:string,time:number,cameraId:string,patch:CameraEdit,framing:CameraEdit,scope:'shot'|'shared'='shot',timing:'whole'|'key'='whole',aspect=stage.output.width/stage.output.height){
  void framing;
  const cuts=stage.cameraCuts?.[selected];
  const references=Object.values(stage.cameraCuts??{}).flat().filter(c=>c.cameraId===cameraId).length;
  const next=structuredClone(edits),old=next.cameras[cameraId]??{};
  const isolated=scope==='shot'&&(cuts?references>1:references>0);
  let id=cameraId;
  if(isolated){
    const index=cuts?.findIndex(c=>cutContainsTime(c,time)||time===stage.durationSeconds&&c===cuts.at(-1))??-1;
    if(cuts&&(index<0||cuts[index].cameraId!==cameraId))throw new Error('当前镜头机位已变化');
    let n=1;while(stage.cameras[`camera_${n}`]||next.cameras[`camera_${n}`])n++;id=`camera_${n}`;
    if(cuts)next.sequences[selected]=cuts.map((c,i)=>i===index?{...structuredClone(c),cameraId:id}:structuredClone(c));
  }
  const preset=old.preset??stage.cameraPresets?.[cameraId];
  const previousKey=sampleFramingKeys(old.framingKeys,time);
  const edit:CameraEdit={...old,...(isolated?{created:true,...(preset?{preset:structuredClone(preset)}:!old.created?{sourceCameraId:cameraId}:{}),label:old.label??stage.cameraMetadata?.[cameraId]?.label}:{}),...(timing==='whole'?patch:{})};
  // Inputs describe the desired pose at this instant, not a replacement for the timeline.
  if(timing==='key'){
    const info=resolveShotCamera(stage,selected,time,aspect).info;
    const key={...previousKey,time};
    if(patch.position)key.position=new Vector3(...key.position).add(new Vector3(...patch.position).sub(new Vector3(...info.positionMeters))).toArray();
    if(patch.rotationDegrees){
      const wanted=new Quaternion().setFromEuler(new Euler(...patch.rotationDegrees.map(MathUtils.degToRad) as [number,number,number],'YXZ'));
      const delta=new Quaternion(...info.quaternion).normalize().invert().multiply(wanted);
      key.quaternion=new Quaternion(...key.quaternion).multiply(delta).normalize().toArray();
    }
    if(patch.focalLengthMm){
      const current=info.focalLengthMm??focalLengthFromFov(info.verticalFovDegrees!,FULL_FRAME,aspect);
      key.focalScale*=patch.focalLengthMm/current;
    }
    const keys=(old.framingKeys??[]).filter(item=>Math.abs(item.time-time)>framingKeyTimeTolerance);
    edit.framingKeys=[...keys,key].sort((a,b)=>a.time-b.time);
  }else if(patch.position||patch.rotationDegrees){
    const info=resolveShotCamera(stage,selected,time,aspect).info;
    const position=new Vector3(...info.positionMeters),rotation=new Quaternion(...info.quaternion).normalize();
    const offset:NonNullable<CameraEdit['framingOffset']>=structuredClone(old.framingOffset??{position:[0,0,0],quaternion:[0,0,0,1]});
    if(patch.position)offset.position=new Vector3(...offset.position).add(new Vector3(...patch.position).sub(position)).toArray();
    if(patch.rotationDegrees){const wanted=new Quaternion().setFromEuler(new Euler(...patch.rotationDegrees.map(MathUtils.degToRad) as [number,number,number],'YXZ'));offset.quaternion=new Quaternion(...offset.quaternion).multiply(new Quaternion(...previousKey.quaternion)).multiply(rotation.invert().multiply(wanted)).multiply(new Quaternion(...previousKey.quaternion).invert()).normalize().toArray();}
    edit.framingOffset=offset;
    // Keep legacy absolute overrides as the baseline; new changes are always relative.
    if(old.position)edit.position=old.position;else delete edit.position;
    if(old.rotationDegrees)edit.rotationDegrees=old.rotationDegrees;else delete edit.rotationDegrees;
    edit.movement='保留原运镜 · 手动构图偏移';
  }
  if(timing==='whole'&&patch.focalLengthMm)edit.focalLengthMm=patch.focalLengthMm/previousKey.focalScale;
  next.cameras[id]=edit;
  return {edits:next,cameraId:id,selection:cuts?selected:id,isolated};
}

/** Keep the whole moving preset; never turn a scoped parameter edit into a fixed pose. */
export function applyPresetForShot(stage:StageScene,edits:CameraEdits,selected:string,time:number,cameraId:string,config:CameraPresetConfig,scope:'shot'|'shared'='shot'){
  const next=structuredClone(edits),cuts=stage.cameraCuts?.[selected];
  const references=Object.values(stage.cameraCuts??{}).flat().filter(c=>c.cameraId===cameraId).length;
  const isolated=scope==='shot'&&(cuts?references>1:references>0);
  let id=cameraId;
  if(isolated){
    const index=cuts?.findIndex(c=>cutContainsTime(c,time)||time===stage.durationSeconds&&c===cuts.at(-1))??-1;
    if(cuts&&(index<0||cuts[index].cameraId!==cameraId))throw new Error('当前镜头机位已变化，请重新打开预设调整');
    let n=1;while(stage.cameras[`preset_${n}`]||next.cameras[`preset_${n}`])n++;id=`preset_${n}`;
    if(cuts)next.sequences[selected]=cuts.map((c,i)=>i===index?{...structuredClone(c),cameraId:id}:structuredClone(c));
  }
  const old=next.cameras[cameraId]??{};
  const {position:_p,rotationDegrees:_r,focusDistanceMeters:_f,focalLengthMm:_l,aperture:_a,sensor:_s,...rest}=old;
  next.cameras[id]={...rest,created:isolated?true:old.created,preset:structuredClone(config),label:old.label??stage.cameraMetadata?.[cameraId]?.label};
  return {edits:next,cameraId:id,selection:cuts?selected:id,isolated};
}
