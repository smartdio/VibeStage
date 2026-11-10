import {validatePerformancePlan,resolvePerformance} from '../lib/core/performances';
import {validateCameraPreset} from '../lib/core/camera-presets';
import {depthOfFieldSettings} from '../lib/core/depth-of-field';
import type {CameraCut,CameraFrame} from '../lib/core/cameras';
export interface RecordingSpec {kind:'still'|'sequence'|'video';camera:string;duration:number;time:number;fps:number;width:number;height:number;cameraPlan?:CameraCut[]}
const positive=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const vector=(a:unknown,n:number)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
export function validateCameraPlan(plan:CameraCut[]|undefined,duration:number){
  if(plan===undefined)return;
  if(!Array.isArray(plan)||plan.length>1800)throw new Error('无效的分镜计划');
  validatePerformancePlan(plan);
  let end=0;const ids=new Set<string>();
  for(const cut of plan){
    if(!cut||typeof cut.id!=='string'||!cut.id||ids.has(cut.id)||typeof cut.cameraId!=='string'||!cut.cameraId||!Number.isFinite(cut.start)||!Number.isFinite(cut.end)||Math.abs(cut.start-end)>1e-6||cut.end<=cut.start)throw new Error('分镜计划的机位或时间无效');
    end=cut.end;ids.add(cut.id);
  }
  if(plan.length&&Math.abs(end-duration)>1e-6)throw new Error('分镜计划未覆盖完整时长');
}
/** Validate JSON captured at the exact rendering sample, rather than re-evaluating scene code. */
export function buildCameraRecording(spec:RecordingSpec,value:unknown){
  const count=spec.kind==='still'?1:Math.ceil(spec.duration*spec.fps-1e-8);
  if(!Array.isArray(value)||value.length!==count)throw new Error('摄影机记录数量与渲染帧数不一致');
  validateCameraPlan(spec.cameraPlan,spec.duration);
  const frames=value as CameraFrame[];
  for(let i=0;i<count;i++){
    const f=frames[i],time=spec.kind==='still'?spec.time:i/spec.fps,c=f?.camera;
    if(!f||f.frame!==i||!Number.isFinite(f.timeSeconds)||Math.abs(f.timeSeconds-time)>1e-7||!c||c.selectedCameraId!==spec.camera||typeof c.cameraId!=='string'||!c.cameraId||typeof c.label!=='string')throw new Error('摄影机记录的帧号、时间或机位不匹配');
    if(!vector(c.positionMeters,3)||!vector(c.quaternion,4)||!Number.isFinite(c.outputAspect)||Math.abs(c.outputAspect-spec.width/spec.height)>1e-8||typeof c.depthOfFieldEnabled!=='boolean')throw new Error('摄影机记录的姿态或画幅无效');
    if(!['perspective','orthographic','custom'].includes(c.projection)||!['focal-length','legacy-fov','orthographic','custom'].includes(c.lensMode))throw new Error('无效的摄影机投影记录');
    if(c.lensMode==='focal-length'&&(!positive(c.focalLengthMm)||!positive(c.sensor?.widthMm)||!positive(c.sensor?.heightMm)||!positive(c.activeSensor?.widthMm)||!positive(c.activeSensor?.heightMm)))throw new Error('摄影机记录缺少有效焦距或传感器');
    if(c.projection==='perspective'&&(!positive(c.verticalFovDegrees)||c.verticalFovDegrees!>=180||!positive(c.horizontalFovDegrees)||c.horizontalFovDegrees!>=180))throw new Error('摄影机记录缺少有效视场角');
    if(c.aperture!==undefined&&!positive(c.aperture))throw new Error('无效的光圈记录');
    if(c.focus&&(!Number.isFinite(c.focus.distanceMeters)||c.focus.distanceMeters<0||!['target','distance'].includes(c.focus.mode)||c.focus.mode==='target'&&!vector(c.focus.targetWorld,3)))throw new Error('无效的对焦记录');
    if(c.focus?.planeDistanceMeters!==undefined&&!Number.isFinite(c.focus.planeDistanceMeters))throw new Error('无效的焦平面记录');
    const expectedDof=depthOfFieldSettings(c);
    if(c.depthOfFieldEnabled!==!!expectedDof||JSON.stringify(c.depthOfField)!==JSON.stringify(expectedDof))throw new Error('景深记录与镜头参数不一致');
    if(c.preset){validateCameraPreset(c.preset.config);if(c.preset.version!==1||c.preset.id!==c.preset.config.presetId||!Array.isArray(c.preset.warnings)||c.preset.warnings.some(w=>typeof w!=='string'))throw new Error('无效的镜头预设记录');}
    const cut=spec.cameraPlan?.find(s=>time>=s.start&&time<s.end)??(time===spec.duration?spec.cameraPlan?.at(-1):undefined);
    if(c.performance&&JSON.stringify(c.performance)!==JSON.stringify(resolvePerformance(spec.cameraPlan,time).context))throw new Error('表演记录与分镜时间不一致');
    if(spec.cameraPlan?.some(cut=>cut.performance)&&!c.performance)throw new Error('分镜表演缺少逐帧记录');
    if(cut?(c.cameraId!==cut.cameraId||c.shot?.id!==cut.id||c.shot.start!==cut.start||c.shot.end!==cut.end):(c.cameraId!==spec.camera||c.shot!==undefined))throw new Error('摄影机记录与分镜计划不一致');
  }
  const shots:{cameraId:string;shotId?:string;label:string;startSeconds:number;endSeconds:number;startFrame:number;endFrameExclusive:number;cameraAtStart:CameraFrame['camera']}[]=[];
  for(const f of frames){
    let shot=shots.at(-1);
    if(!shot||shot.cameraId!==f.camera.cameraId||shot.shotId!==f.camera.shot?.id){
      shot={cameraId:f.camera.cameraId,shotId:f.camera.shot?.id,label:f.camera.shot?.label??f.camera.label,startSeconds:f.timeSeconds,endSeconds:f.timeSeconds,startFrame:f.frame,endFrameExclusive:f.frame,cameraAtStart:f.camera};shots.push(shot);
    }
    shot.endSeconds=spec.kind==='still'?f.timeSeconds:Math.min(spec.duration,(f.frame+1)/spec.fps);shot.endFrameExclusive=f.frame+1;
  }
  return {schemaVersion:2,selectedCameraId:spec.camera,units:{position:'meters',focalLength:'millimeters',sensor:'millimeters',rotation:'quaternion_xyzw',time:'seconds'},depthOfFieldEnabled:frames.some(f=>f.camera.depthOfFieldEnabled),plannedShots:spec.cameraPlan??[],shots,frames};
}
