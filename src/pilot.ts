import {Euler,MathUtils,PerspectiveCamera,Quaternion,Vector3} from 'three';
import {FULL_FRAME,focalLengthFromFov,resolveShotCamera,type CameraEdit,type CameraMetadata,type CameraSnapshot,type StageScene} from '@vibestage/core';

/** A detached camera: moving the view never changes the project until Apply. */
export class PilotCamera {
  readonly camera:PerspectiveCamera;
  readonly metadata:CameraMetadata;
  readonly id:string;
  speed=1;
  private poseChanged=false;
  private lensPatch:CameraEdit={};
  constructor(info:CameraSnapshot,metadata?:CameraMetadata){
    if(info.projection!=='perspective')throw new Error('第一人称操控需要透视机位');
    this.id=info.cameraId;
    this.camera=new PerspectiveCamera(info.verticalFovDegrees??40,info.outputAspect,info.near??.1,info.far??500);
    this.camera.position.fromArray(info.positionMeters);this.camera.quaternion.fromArray(info.quaternion);this.camera.name=info.label;
    this.metadata={...metadata,label:info.label,focalLengthMm:info.focalLengthMm??focalLengthFromFov(info.verticalFovDegrees??40,FULL_FRAME,info.outputAspect),sensor:{...(info.sensor??FULL_FRAME)}};
  }
  turn(yaw:number,pitch:number){
    const e=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
    e.y+=yaw;e.x=MathUtils.clamp(e.x+pitch,-Math.PI/2+.01,Math.PI/2-.01);e.z=0;
    this.camera.quaternion.setFromEuler(e);this.poseChanged=true;
  }
  move(right:number,up:number,forward:number,seconds:number){
    const input=new Vector3(right,up,forward);if(!input.lengthSq())return;
    if(input.length()>1)input.normalize();
    const e=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
    const side=new Vector3(1,0,0).applyQuaternion(new Quaternion().setFromEuler(new Euler(0,e.y,0)));
    const ahead=new Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(side,input.x*this.speed*seconds).addScaledVector(new Vector3(0,1,0),input.y*this.speed*seconds).addScaledVector(ahead,input.z*this.speed*seconds);
    this.poseChanged=true;
  }
  lens(field:'focalLengthMm'|'aperture'|'focusDistanceMeters',value:number){
    if(!Number.isFinite(value)||value<=0)throw new Error('摄影机参数必须为正数');
    if(field==='focusDistanceMeters')this.metadata.focus={distanceMeters:value};else this.metadata[field]=value;
    this.lensPatch[field]=value;
  }
  patch():CameraEdit{
    const patch={...this.lensPatch};
    if(this.poseChanged){const e=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');Object.assign(patch,{position:this.camera.position.toArray(),rotationDegrees:[e.x,e.y,e.z].map(MathUtils.radToDeg),movement:'固定机位 · 第一人称调整'});}
    // Legacy cameras need a physical gate when a physical lens parameter is applied.
    if(Object.keys(patch).length)Object.assign(patch,{focalLengthMm:this.metadata.focalLengthMm,sensor:{...this.metadata.sensor}});
    return patch;
  }
  shot(stage:StageScene,time:number,aspect:number){
    return resolveShotCamera({...stage,cameras:{[this.id]:this.camera},cameraMetadata:{[this.id]:this.metadata},cameraCuts:{}},this.id,time,aspect);
  }
}
