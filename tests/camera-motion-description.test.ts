import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Object3D,Euler} from 'three';
import {createCameraPresetConfig,addCameraPreset,cameraPresetProgress,type CameraPresetId,type CameraPresetParameters} from '../lib/core/camera-presets';
import {resolveShotCamera} from '../lib/core/cameras';
import {describeCameraMotion} from '../lib/core/camera-motion-description';
import {deliveryShots} from '../lib/core/delivery';
import type {StageScene} from '../lib/core/types';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(id:CameraPresetId,overrides:Partial<CameraPresetParameters>={}){
 const scene=new Scene(),a=new Object3D(),b=new Object3D();b.position.z=-4;scene.add(a,b);
 const stage:StageScene={name:'motion',scene,cameras:{},subjects:{a,b},durationSeconds:6,output:{width:320,height:180,fps:24},update(){},dispose(){}};
 const config=createCameraPresetConfig(stage,id,{subject:{subject:'a'},...(id==='rack-focus'?{secondary:{subject:'b'}}:{})},{distance:10,height:0,sideOffset:0,headingDegrees:0,travel:2,angleDegrees:180,focalLengthMm:40,endFocalLengthMm:80,frame:'world',startSeconds:0,endSeconds:6,holdStartSeconds:1,holdEndSeconds:1,easing:'linear',...overrides});
 addCameraPreset(stage,'main',config);const shot=deliveryShots('main',6)[0];
 const sample=(t:number)=>{stage.update(t);return resolveShotCamera(stage,'main',t,320/180);};
 const text=()=>describeCameraMotion(sample(0).info,shot);
 return {a,b,stage,config,shot,sample,text};
}
test('push and pull signed displacement and hold samples match described base offsets',()=>{
 for(const id of ['push-in','pull-out'] as const)for(const travel of [-2,0,2]){
  const {sample,text}=fixture(id,{travel,sideOffset:1,height:2});const sign=id==='push-in'?-1:1;
  near(sample(0).camera.position.z,10);near(sample(1).camera.position.z,10);near(sample(3).camera.position.z,10+sign*travel*.5);near(sample(5).camera.position.z,10+sign*travel);near(sample(6).camera.position.z,10+sign*travel);
  near(sample(3).camera.position.x,1);near(sample(3).camera.position.y,2);near(sample(3).info.focalLengthMm!,40);
  assert.ok(text().includes(`外向坐标由 10 米变为 ${10+sign*travel} 米`));assert.match(text(),/不保证沿当前观看光轴|实际方向|位移量为零/);
 }
});
test('shared easing gives clipped shot progress rather than replaying the full motion',()=>{
 const {sample,config,shot}=fixture('push-in',{easing:'smooth'});near(cameraPresetProgress(config.parameters,2),.103515625);near(sample(2).camera.position.z,10-2*.103515625);
 const text=describeCameraMotion(sample(2).info,{...shot,start:2,end:4});assert.match(text,/继承进度 10.351563%/);assert.match(text,/89.648438%/);assert.match(text,/五次平滑/);assert.match(text,/最后输出帧略早/);
});
test('pan tilt and whip use signed Euler offsets; tilt clamps and movement does not add translation',()=>{
 for(const id of ['pan','tilt','whip-pan'] as const){const {sample,text}=fixture(id,{angleDegrees:-60});
  const axis=id==='tilt'?'x':'y';near(new Euler().setFromQuaternion(sample(1).camera.quaternion,'YXZ')[axis]*180/Math.PI,30);near(new Euler().setFromQuaternion(sample(3).camera.quaternion,'YXZ')[axis],0);near(new Euler().setFromQuaternion(sample(5).camera.quaternion,'YXZ')[axis]*180/Math.PI,-30);
  assert.deepEqual(sample(1).camera.position.toArray(),sample(5).camera.position.toArray());assert.match(text(),/30° → -30°/);assert.match(text(),/不增加机位平移/);
 }
 const {sample,text}=fixture('tilt',{angleDegrees:220});near(new Euler().setFromQuaternion(sample(5).camera.quaternion,'YXZ').x,Math.PI/2-.001);assert.match(text(),/89.942704/);
});
test('follow ignores hold progress and distinguishes world-locked offsets from subject-turning offsets',()=>{
 for(const id of ['rear-follow','lead-follow','side-follow'] as const){const {stage,a,sample,text}=fixture(id,{sideOffset:2});stage.update=t=>{a.position.x=t;a.rotation.y=t*.2;};
  const start=sample(0).camera.position.clone(),duringHold=sample(.5).camera.position.clone();near(duringHold.x-start.x,.5);near(duringHold.z,start.z);
  near(start.x,id==='side-follow'?10:2);near(start.z,id==='rear-follow'?10:id==='lead-follow'?-10:2);
  assert.match(text(),/首尾停留不会停止跟随/);assert.match(text(),/主体转身不会旋转机位偏移/);
 }
 const {stage,a,sample,text}=fixture('rear-follow',{frame:'subject'});stage.update=t=>{a.position.x=t;a.rotation.y=t*Math.PI/2;};const end=sample(1).camera.position;near(end.x,11);near(end.z,0);assert.match(text(),/偏移方向也同步旋转/);
});
test('arc side offset shifts circle center; orbit zero angle still means positive full revolution',()=>{
 const {sample,text}=fixture('arc',{sideOffset:2});near(sample(1).camera.position.x,2);near(sample(1).camera.position.z,10);near(sample(3).camera.position.x,12);near(sample(3).camera.position.z,0);near(sample(5).camera.position.x,2);near(sample(5).camera.position.z,-10);assert.match(text(),/圆心是基准点加这个侧偏/);
 for(const angle of [-1,0,1]){const f=fixture('orbit-360',{angleDegrees:angle});near(f.sample(2).camera.position.x,angle<0?-10:10);near(f.sample(5).camera.position.z,10);assert.match(f.text(),/包含零都执行/);}
});
test('zoom and snap zoom change focal length, not position; dolly zoom compensates optical depth',()=>{
 for(const id of ['zoom','snap-zoom'] as const)for(const endFocalLengthMm of [20,40,80]){const {sample,text}=fixture(id,{endFocalLengthMm});near(sample(3).info.focalLengthMm!,(40+endFocalLengthMm)/2);near(sample(5).info.focalLengthMm!,endFocalLengthMm);assert.deepEqual(sample(1).camera.position.toArray(),sample(5).camera.position.toArray());assert.match(text(),/不增加机位位移/);assert.match(text(),/视场角/);}
 const {sample,text}=fixture('dolly-zoom');near(sample(5).camera.position.z,8);near(sample(5).info.focalLengthMm!,32);near(sample(1).info.focalLengthMm!/10,sample(5).info.focalLengthMm!/8);assert.match(text(),/主体的光轴深度/);
});
test('rack focus uses inverse depths and moving target depths; focus does not aim at B',()=>{
 const {sample,text,b,stage}=fixture('rack-focus');near(sample(1).info.focus!.distanceMeters,10);near(sample(3).info.focus!.distanceMeters,1/(.5/10+.5/14));near(sample(5).info.focus!.distanceMeters,14);
 assert.deepEqual(sample(1).camera.quaternion.toArray(),sample(5).camera.quaternion.toArray());assert.match(text(),/不是把两个距离做算术线性插值/);assert.match(text(),/拉焦不代表摄影机转向 B/);
 stage.update=t=>{b.position.z=-4-t;};near(sample(5.5).info.focus!.distanceMeters,19.5);assert.match(text(),/停留并不锁死对焦米数/);
});
test('explicit viewing and focusing bindings remain separate and world reference does not follow actor',()=>{
 const {stage,a,b,sample,shot}=fixture('push-in');const c=stage.cameraPresets!.main;c.lookTarget={subject:'b'};c.focusTarget={subject:'a'};b.position.x=3;
 stage.update=t=>{a.position.x=t;};near(sample(3).camera.position.x,0);
 const text=describeCameraMotion(sample(3).info,shot);assert.match(text,/观看目标：b/);assert.match(text,/对焦目标：a/);assert.match(text,/固定为创建预设时的世界参考点/);
});
