import {Box3,CatmullRomCurve3,MathUtils,Matrix4,Quaternion,Vector3} from 'three';
import type {StageScene} from './types';
import type {CameraPresetConfig} from './camera-presets';

const cache=new WeakMap<object,{signature:string;curve:CatmullRomCurve3;rotations:Quaternion[]}>();
/** Arc-length sampling with parallel-transport frames; no previous render state. */
export function samplePresetPath(path:NonNullable<CameraPresetConfig['path']>,progress:number){
  const signature=JSON.stringify(path.points);let cached=cache.get(path);
  if(!cached||cached.signature!==signature){
    const curve=new CatmullRomCurve3(path.points.map(p=>new Vector3(...p)),false,'centripetal');curve.arcLengthDivisions=512;
    const rotations:Quaternion[]=[],up=new Vector3(0,1,0);let previous=curve.getTangentAt(0).normalize();
    if(Math.abs(previous.dot(up))>.98)up.set(0,0,-1);
    up.addScaledVector(previous,-up.dot(previous)).normalize();
    for(let i=0;i<=256;i++){
      const tangent=curve.getTangentAt(i/256).normalize();up.applyQuaternion(new Quaternion().setFromUnitVectors(previous,tangent));
      up.addScaledVector(tangent,-up.dot(tangent)).normalize();
      rotations.push(new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(),tangent,up)));
      previous=tangent;
    }
    cached={signature,curve,rotations};cache.set(path,cached);
  }
  const t=MathUtils.clamp(progress,0,1),index=t*256,i=Math.min(255,Math.floor(index));
  const quaternion=cached.rotations[i].clone().slerp(cached.rotations[i+1],index-i),position=cached.curve.getPointAt(t);
  const forward=new Vector3(0,0,-1).applyQuaternion(quaternion);
  return {position,quaternion,look:position.clone().addScaledVector(forward,path.lookAheadMeters),length:cached.curve.getLength()};
}
/** Conservative near-mesh warnings, not automatic avoidance or a collision solver. */
export function pathWarnings(stage:StageScene,position:Vector3,clearance:number){
  const warnings:string[]=[];stage.scene.updateMatrixWorld(true);
  stage.scene.traverseVisible(o=>{
    if(warnings.length>=3||!(o as {isMesh?:boolean}).isMesh)return;
    for(let p=o.parent;p;p=p.parent)if(p.name==='预览辅助')return;
    const box=new Box3().setFromObject(o);
    if(box.containsPoint(position))warnings.push(`机位进入物体包围盒：${o.name||o.parent?.name||'未命名物体'}`);
    else if(box.distanceToPoint(position)<clearance)warnings.push(`机位靠近物体：${o.name||o.parent?.name||'未命名物体'}（小于 ${clearance} m）`);
  });return warnings;
}
