import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene,Group,Euler,Quaternion} from 'three';
import {resolveShotCamera,createCameraEditSession,emptyCameraEdits,type StageScene} from '../lib/core';
import {PilotCamera} from '../src/pilot';
function fixture():StageScene{const camera=new PerspectiveCamera(45,16/9,.1,100),scene=new Scene(),target=new Group();target.position.set(0,1,0);scene.add(target);camera.position.set(0,1,5);return {name:'pilot',scene,cameras:{main:camera},cameraMetadata:{main:{focalLengthMm:35,sensor:{widthMm:36,heightMm:24},aperture:4,focus:{target}}},durationSeconds:4,output:{width:1280,height:720,fps:24},update(){},dispose(){}};}
test('first-person draft is detached, movement uses view axes and apply survives code updates',()=>{
 const s=fixture(),session=createCameraEditSession(s,emptyCameraEdits()),before=resolveShotCamera(s,'main',2,16/9).info,pilot=new PilotCamera(before,s.cameraMetadata!.main);
 pilot.move(0,0,1,1);pilot.move(0,1,0,.5);pilot.turn(Math.PI/2,0);pilot.move(0,0,1,1);pilot.lens('focalLengthMm',50);
 assert.deepEqual(resolveShotCamera(s,'main',2,16/9).info,before);
 assert.ok(Math.abs(pilot.camera.position.x+1)<1e-9);assert.ok(Math.abs(pilot.camera.position.z-4)<1e-9);assert.equal(pilot.camera.position.y,1.5);
 const next=emptyCameraEdits();next.cameras.main=pilot.patch();session.setEdits(next);s.update(3);const after=resolveShotCamera(s,'main',3,16/9).info;
 assert.equal(after.focalLengthMm,50);assert.deepEqual(after.positionMeters,pilot.camera.position.toArray());assert.equal(after.focus?.mode,'target');
});
test('no-op draft has no override; lens-only changes preserve code movement and target focus until explicitly changed',()=>{
 const s=fixture(),info=resolveShotCamera(s,'main',0,16/9).info,pilot=new PilotCamera(info,s.cameraMetadata!.main);
 assert.deepEqual(pilot.patch(),{});pilot.lens('aperture',2.8);assert.equal(pilot.patch().position,undefined);assert.equal(pilot.shot(s,0,16/9).info.focus?.mode,'target');
 pilot.lens('focusDistanceMeters',3);assert.equal(pilot.shot(s,0,16/9).info.focus?.distanceMeters,3);assert.equal(s.cameraMetadata!.main.aperture,4);assert.ok(s.cameraMetadata!.main.focus?.target);
 assert.throws(()=>pilot.lens('focalLengthMm',0));assert.throws(()=>pilot.lens('aperture',NaN));
});
test('turning levels the horizon and clamps pitch; movement speed does not depend on frame rate',()=>{
 const s=fixture(),info=resolveShotCamera(s,'main',0,16/9).info;info.quaternion=new Quaternion().setFromEuler(new Euler(.2,.3,.4,'YXZ')).toArray();
 const p=new PilotCamera(info),q=new PilotCamera(info);p.turn(0,100);const e=new Euler().setFromQuaternion(p.camera.quaternion,'YXZ');assert.ok(e.x<Math.PI/2);assert.ok(Math.abs(e.z)<1e-9);
 p.camera.quaternion.identity();q.camera.quaternion.identity();p.move(0,0,1,1);for(let i=0;i<60;i++)q.move(0,0,1,1/60);assert.ok(p.camera.position.distanceTo(q.camera.position)<1e-9);
});
test('a quick tap moves or turns without waiting for a render frame',()=>{
 const s=fixture(),p=new PilotCamera(resolveShotCamera(s,'main',0,16/9).info);
 const still={right:0,up:0,forward:0,yaw:0,pitch:0};
 p.nudge({...still,right:1});assert.equal(p.camera.position.x,.1);
 p.speed=.25;p.nudge({...still,up:1});assert.equal(p.camera.position.y,1.025);
 p.nudge({...still,yaw:1});assert.ok(Math.abs(new Euler().setFromQuaternion(p.camera.quaternion,'YXZ').y-Math.PI/180)<1e-10);
});
test('applied world pose survives parent transforms, authored tracking, cut sampling and JSON reload',async()=>{
 const {sampleScene}=await import('../lib/core');
 const s=fixture(),rig=new Group();rig.position.set(2,1,-1);rig.rotation.y=.4;s.scene.add(rig);rig.add(s.cameras.main);
 s.cameras.edit=new PerspectiveCamera();s.cameraCuts={edit:[{id:'a',cameraId:'main',start:0,end:2},{id:'b',cameraId:'main',start:2,end:4}]};
 s.updateCameras=()=>s.cameras.main.lookAt(0,1,0);
 const session=createCameraEditSession(s,emptyCameraEdits());sampleScene(s,'edit',1);
 const p=new PilotCamera(resolveShotCamera(s,'edit',1,16/9).info,s.cameraMetadata!.main);p.move(1,1,0,.5);p.turn(.15,.08);p.lens('focalLengthMm',50);
 const expected=p.shot(s,1,16/9).info,next=emptyCameraEdits();next.cameras.main=p.patch();
 session.setEdits(JSON.parse(JSON.stringify(next)));
 for(const t of [1,3,0,3.9]){sampleScene(s,'edit',t);const actual=resolveShotCamera(s,'edit',t,16/9).info;actual.positionMeters.forEach((v,i)=>assert.ok(Math.abs(v-expected.positionMeters[i])<1e-9));assert.ok(1-Math.abs(new Quaternion(...actual.quaternion).dot(new Quaternion(...expected.quaternion)))<1e-9);assert.equal(actual.focalLengthMm,50);}
});
