import {resolvePerformance,validatePerformancePlan,type ShotPerformance,type PerformanceContext} from './performances';
import {sampleCameraPreset,validateCameraPreset,resolveCameraBinding,type CameraPresetRecord} from './camera-presets';
import {Camera, OrthographicCamera, PerspectiveCamera, Vector3, MathUtils, type Object3D} from 'three';
import {depthOfFieldSettings,type DepthOfFieldSettings} from './depth-of-field';
import type {StageScene} from './types';

export interface SensorSize {widthMm:number; heightMm:number}
export type FocusSettings = {distanceMeters:number; target?:never} | {target:Object3D; label?:string; offset?:[number,number,number]; distanceMeters?:never};
export interface CameraMetadata {
  label?:string;
  shotSize?:string;
  focalLengthMm:number;
  sensor:SensorSize;
  aperture?:number;
  focus?:FocusSettings;
  movement?:string;
}
export interface CameraCut {id:string; label?:string; cameraId:string; start:number; end:number; performance?:ShotPerformance}
/** Plain JSON: no scene objects or renderer references. Distances are in meters. */
export interface CameraSnapshot {
  selectedCameraId:string; cameraId:string; label:string;
  shot?:CameraCut;
  performance?:PerformanceContext;
  preset?:CameraPresetRecord;
  projection:'perspective'|'orthographic'|'custom';
  shotSize?:string; movement?:string;
  lensMode:'focal-length'|'legacy-fov'|'orthographic'|'custom';
  focalLengthMm?:number; sensor?:SensorSize; activeSensor?:SensorSize;
  aperture?:number; focus?:{mode:'target'|'distance';distanceMeters:number;planeDistanceMeters?:number;targetName?:string;targetWorld?:number[]};
  verticalFovDegrees?:number; horizontalFovDegrees?:number;
  zoom?:number; near?:number; far?:number; filmOffsetMm?:number;
  orthographicBounds?:{left:number;right:number;top:number;bottom:number};
  positionMeters:number[]; quaternion:number[];
  outputAspect:number; depthOfFieldEnabled:boolean; depthOfField?:DepthOfFieldSettings;
}
export interface CameraFrame {frame:number; timeSeconds:number; camera:CameraSnapshot}
export const FULL_FRAME:SensorSize={widthMm:36,heightMm:24};
const positive=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>0;

/** Center-crop the sensor to the output aspect; never stretch the image. */
export function activeSensor(sensor:SensorSize,aspect:number):SensorSize {
  if(!positive(sensor.widthMm)||!positive(sensor.heightMm)||!positive(aspect))throw new Error('传感器尺寸与画幅比例必须为正数');
  return aspect>=sensor.widthMm/sensor.heightMm
    ?{widthMm:sensor.widthMm,heightMm:sensor.widthMm/aspect}
    :{widthMm:sensor.heightMm*aspect,heightMm:sensor.heightMm};
}
export function focalLengthFromFov(verticalFovDegrees:number,sensor:SensorSize,aspect:number){
  if(!positive(verticalFovDegrees)||verticalFovDegrees>=180)throw new Error('垂直视场角需在 0–180 度之间');
  return activeSensor(sensor,aspect).heightMm/(2*Math.tan(MathUtils.degToRad(verticalFovDegrees)/2));
}
export function validateCameraSetup(stage:StageScene){
  for(const [id,p] of Object.entries(stage.cameraPresets??{})){
    if(!(stage.cameras[id] instanceof PerspectiveCamera)||stage.cameraCuts?.[id])throw new Error(`预设 ${id} 需要独立透视机位`);
    validateCameraPreset(p);if(p.parameters.endSeconds>stage.durationSeconds)throw new Error('预设结束时间超出场景时长');
    for(const binding of [p.subject,p.secondary,p.lookTarget,p.focusTarget,p.occluder])if(binding)resolveCameraBinding(stage,binding);
  }
  for(const [id,m] of Object.entries(stage.cameraMetadata??{})){
    if(!(stage.cameras[id] instanceof PerspectiveCamera))throw new Error(`机位 ${id}：摄影镜头参数需要透视摄影机`);
    if(!positive(m.focalLengthMm))throw new Error(`机位 ${id}：焦距必须为正数`);
    if(!m.sensor)throw new Error(`机位 ${id}：需要传感器尺寸`);
    activeSensor(m.sensor,1);
    if(m.aperture!==undefined&&!positive(m.aperture))throw new Error(`机位 ${id}：光圈必须为正数`);
    if(m.focus){
      if(m.focus.target){
        if(!m.focus.target.isObject3D)throw new Error(`机位 ${id}：对焦目标需要 Object3D`);
        if(m.focus.offset&&(m.focus.offset.length!==3||!m.focus.offset.every(Number.isFinite)))throw new Error(`机位 ${id}：对焦偏移无效`);
      }else if(!positive(m.focus.distanceMeters))throw new Error(`机位 ${id}：对焦距离必须为正数`);
    }
  }
  for(const [id,cuts] of Object.entries(stage.cameraCuts??{})){
    if(!stage.cameras[id]||!Array.isArray(cuts)||!cuts.length)throw new Error(`自动分镜 ${id}：需要有效机位和分镜列表`);
    validatePerformancePlan(cuts,stage);
    let end=0;const ids=new Set<string>();
    for(const cut of cuts){
      if(!cut.id||ids.has(cut.id)||!stage.cameras[cut.cameraId]||stage.cameraCuts?.[cut.cameraId])throw new Error(`自动分镜 ${id}：分镜 ID 重复、机位缺失或嵌套分镜`);
      if(!Number.isFinite(cut.start)||!Number.isFinite(cut.end)||Math.abs(cut.start-end)>1e-6||cut.end<=cut.start)throw new Error(`自动分镜 ${id}：时间段必须从 0 起连续且不重叠`);
      ids.add(cut.id);end=cut.end;
    }
    if(Math.abs(end-stage.durationSeconds)>1e-6)throw new Error(`自动分镜 ${id}：必须覆盖完整场景时长`);
  }
}

/** Call after update(t). Used by preview, monitor, picking and export alike. */
export function resolveShotCamera(stage:StageScene,selectedCameraId:string,time:number,aspect:number){
  const cuts=stage.cameraCuts?.[selectedCameraId];
  const shot=cuts?.find(c=>time>=c.start&&time<c.end)??(cuts&&time===stage.durationSeconds?cuts.at(-1):undefined);
  if(cuts&&!shot)throw new Error('当前时间没有对应分镜');
  const performance=resolvePerformance(cuts,time).context;
  const id=shot?.cameraId??selectedCameraId;
  const preset=stage.cameraPresets?.[id]?sampleCameraPreset(stage,stage.cameraPresets[id],time,aspect):undefined;
  const source=preset?.camera??stage.cameras[id];
  if(!source)throw new Error(`机位不存在：${id}`);
  source.updateWorldMatrix(true,false);
  // copy without cloning scene children; camera hierarchies may contain arbitrary objects.
  const camera:Camera=source instanceof PerspectiveCamera?new PerspectiveCamera().copy(source,false):source instanceof OrthographicCamera?new OrthographicCamera().copy(source,false):new Camera().copy(source,false);
  source.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);
  const meta=preset?{...preset.metadata,label:stage.cameraMetadata?.[id]?.label||preset.metadata.label}:stage.cameraMetadata?.[id];
  const info:CameraSnapshot={selectedCameraId,cameraId:id,label:meta?.label||source.name||id,shot:shot?structuredClone(shot):undefined,performance:shot?performance:undefined,
    preset:preset?.record,projection:'custom',lensMode:'custom',positionMeters:camera.position.toArray(),quaternion:camera.quaternion.toArray(),outputAspect:aspect,depthOfFieldEnabled:false};
  if(camera instanceof PerspectiveCamera){
    camera.aspect=aspect;info.projection='perspective';info.lensMode=meta?'focal-length':'legacy-fov';
    if(meta){
      if(!positive(meta.focalLengthMm)||meta.aperture!==undefined&&!positive(meta.aperture))throw new Error(`机位 ${id}：动态焦距或光圈无效`);
      const gate=activeSensor(meta.sensor,aspect);
      camera.fov=MathUtils.radToDeg(2*Math.atan(gate.heightMm/(2*meta.focalLengthMm)));
      // Metadata is authoritative: legacy zoom, film skew and view offsets must not silently change the lens.
      camera.zoom=1;camera.filmGauge=meta.sensor.widthMm;camera.filmOffset=0;camera.clearViewOffset();
      Object.assign(info,{focalLengthMm:meta.focalLengthMm,sensor:{...meta.sensor},activeSensor:gate,aperture:meta.aperture,shotSize:meta.shotSize,movement:meta.movement});
      if(meta.focus){
        if(meta.focus.target){
          const target=new Vector3(...(meta.focus.offset??[0,0,0]));meta.focus.target.updateWorldMatrix(true,false);meta.focus.target.localToWorld(target);
          info.focus={mode:'target',distanceMeters:camera.position.distanceTo(target),planeDistanceMeters:target.clone().sub(camera.position).dot(camera.getWorldDirection(new Vector3())),targetName:meta.focus.label||meta.focus.target.name||'未命名目标',targetWorld:target.toArray()};
        }else{
          if(!positive(meta.focus.distanceMeters))throw new Error(`机位 ${id}：动态对焦距离无效`);
          info.focus={mode:'distance',distanceMeters:meta.focus.distanceMeters};
        }
      }
    }
    camera.updateProjectionMatrix();info.verticalFovDegrees=camera.getEffectiveFOV();info.horizontalFovDegrees=MathUtils.radToDeg(2*Math.atan(Math.tan(MathUtils.degToRad(info.verticalFovDegrees)/2)*aspect));
    info.zoom=camera.zoom;info.near=camera.near;info.far=camera.far;info.filmOffsetMm=camera.filmOffset;
  }else if(camera instanceof OrthographicCamera){
    const cy=(camera.top+camera.bottom)/2,h=(camera.top-camera.bottom)/2;camera.left=-h*aspect;camera.right=h*aspect;camera.top=cy+h;camera.bottom=cy-h;camera.updateProjectionMatrix();
    info.projection='orthographic';info.lensMode='orthographic';info.zoom=camera.zoom;info.near=camera.near;info.far=camera.far;
    info.orthographicBounds={left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom};
  }
  camera.updateMatrixWorld(true);
  info.depthOfField=depthOfFieldSettings(info);info.depthOfFieldEnabled=!!info.depthOfField;
  return {camera,info};
}
