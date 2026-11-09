import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {addCameraPreset,cameraPresetDefinitions,createCameraPresetConfig,createCameraEditSession,emptyCameraEdits,resolveShotCamera,sampleCameraPreset,validateCameraPreset,type StageScene,type CameraPresetId} from '../lib/core';
import {buildCameraRecording} from '../server/camera-records';
function fixture():StageScene {
 const scene=new T.Scene(),a=new T.Group(),b=new T.Group(),wall=new T.Mesh(new T.BoxGeometry(.6,3,.2));
 for(const g of [a,b]){g.add(new T.Mesh(new T.BoxGeometry(.6,1.8,.4)));const head=new T.Object3D();head.name='head';head.position.y=.7;g.add(head);scene.add(g);}
 a.name='a';b.name='b';b.position.set(.7,0,-3);wall.position.set(-.6,0,2);scene.add(wall);
 const main=new T.PerspectiveCamera();main.position.set(0,2,8);
 return {name:'fixture',scene,cameras:{main},subjects:{A:a,B:b,Wall:wall},output:{width:1280,height:720,fps:24},durationSeconds:6,update(t){a.position.set(-.5,0,-t*.25);a.rotation.y=t*.1;},dispose(){}};
}
function config(s:StageScene,id:CameraPresetId){return createCameraPresetConfig(s,id,{subject:{subject:'A'},secondary:{subject:'B'},occluder:{subject:'Wall'}});}
test('all sixteen presets are independently callable, serializable and deterministic under arbitrary seeks',()=>{
 assert.equal(cameraPresetDefinitions.length,16);
 for(const def of cameraPresetDefinitions){
  const s=fixture();s.update(0);const c=config(s,def.id);addCameraPreset(s,'shot',c);
  s.update(3);const expected=resolveShotCamera(s,'shot',3,16/9).info;
  for(const t of [6,0,1,5,3]){s.update(t);const shot=resolveShotCamera(s,'shot',t,16/9);assert.ok(shot.info.positionMeters.every(Number.isFinite));assert.equal(shot.info.preset!.id,def.id);}
  assert.deepEqual(resolveShotCamera(s,'shot',3,16/9).info,expected);
  assert.doesNotThrow(()=>validateCameraPreset(JSON.parse(JSON.stringify(c))));
  assert.deepEqual(s.cameras.main.position.toArray(),[0,2,8]);
 }
});
test('pan/tilt rotate without translation; push/pull translate without zoom; rack focus changes only optical focus',()=>{
 const s=fixture();s.update(0);
 for(const id of ['pan','tilt','rack-focus'] as const){const c=config(s,id),start=sampleCameraPreset(s,c,0),end=sampleCameraPreset(s,c,6);assert.deepEqual(start.camera.position,end.camera.position);assert.equal(start.metadata.focalLengthMm,end.metadata.focalLengthMm);if(id==='rack-focus'){assert.deepEqual(start.camera.quaternion.toArray(),end.camera.quaternion.toArray());assert.ok(start.metadata.focus!.distanceMeters!<end.metadata.focus!.distanceMeters!);}else assert.notDeepEqual(start.camera.quaternion.toArray(),end.camera.quaternion.toArray());}
 for(const id of ['push-in','pull-out'] as const){const c=config(s,id),start=sampleCameraPreset(s,c,0),end=sampleCameraPreset(s,c,6);assert.equal(start.metadata.focalLengthMm,end.metadata.focalLengthMm);const z=end.camera.position.z-start.camera.position.z;assert.ok(id==='push-in'?z<0:z>0);}
});
test('tracking keeps its relative offset; look and focus targets are independent',()=>{
 const s=fixture();s.update(0);const c=config(s,'rear-follow');c.parameters.frame='world';c.lookTarget={subject:'B'};c.focusTarget={subject:'A'};
 const start=sampleCameraPreset(s,c,0);s.update(4);const end=sampleCameraPreset(s,c,4);
 assert.ok(Math.abs((end.camera.position.z-start.camera.position.z)+1)<1e-10);
 const b=s.subjects!.B.getWorldPosition(new T.Vector3()),forward=end.camera.getWorldDirection(new T.Vector3());
 assert.ok(forward.dot(b.clone().sub(end.camera.position).normalize())>.999999);
 const expected=s.subjects!.A.getWorldPosition(new T.Vector3()).sub(end.camera.position).dot(forward);
 assert.ok(Math.abs(end.metadata.focus!.distanceMeters!-expected)<1e-10);
});
test('two-subject fitting retains reference bounds in both landscape and portrait',()=>{
 const s=fixture();s.update(0);const c=config(s,'two-shot'),bounds=c.reference.bounds!;
 for(const aspect of [16/9,9/16]){const {camera}=sampleCameraPreset(s,c,0,aspect);for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1);}}
});
test('saved presets survive session reload, cuts, export records and non-pose manual lens edits',()=>{
 const s=fixture();s.update(0);const edits=emptyCameraEdits();edits.cameras.follow={created:true,preset:config(s,'rear-follow'),aperture:2};edits.sequences.edit=[{id:'one',cameraId:'follow',start:0,end:6}];
 const session=createCameraEditSession(s,edits);s.update(2);const shot=resolveShotCamera(s,'edit',2,16/9).info;
 const fresh=fixture();createCameraEditSession(fresh,JSON.parse(JSON.stringify(session.getEdits())));fresh.update(2);assert.deepEqual(resolveShotCamera(fresh,'edit',2,16/9).info,shot);assert.equal(shot.aperture,2);
 const record=buildCameraRecording({kind:'still',camera:'edit',duration:6,time:2,fps:24,width:1280,height:720,cameraPlan:edits.sequences.edit},[{frame:0,timeSeconds:2,camera:shot}]);assert.equal(record.frames[0].camera.preset!.id,'rear-follow');
 const bad=structuredClone(edits);bad.cameras.follow.position=[0,0,0];assert.throws(()=>session.setEdits(bad),/预设机位/);assert.deepEqual(session.getEdits(),edits);
 session.setEdits(emptyCameraEdits());assert.deepEqual(Object.keys(s.cameraPresets??{}),[]);
});
test('invalid inputs, missing anchors, impossible push and time ranges fail before saving or rendering',()=>{
 const s=fixture();s.update(0);const c=config(s,'push-in');c.parameters.travel=10;assert.throws(()=>validateCameraPreset(c),/终点/);
 c.parameters.travel=1;c.parameters.holdEndSeconds=6;assert.throws(()=>validateCameraPreset(c),/停留/);
 c.parameters.holdEndSeconds=0;c.subject.anchor='missing';assert.throws(()=>sampleCameraPreset(s,c,0),/锚点/);
 c.subject.anchor=undefined;c.subject.subject='missing';assert.throws(()=>sampleCameraPreset(s,c,0),/不存在/);
 const r=config(s,'rack-focus');delete r.secondary;assert.throws(()=>validateCameraPreset(r),/主体 B/);
});
test('POV focuses ahead or on its independent look target, never on its own head behind the camera',()=>{
 const s=fixture();s.update(0);const c=config(s,'pov');c.subject.anchor='head';
 const forward=sampleCameraPreset(s,c,0);assert.ok(forward.metadata.focus!.distanceMeters!>1);assert.ok(!forward.record.warnings.some(w=>w.includes('焦点')));
 c.lookTarget={subject:'B',anchor:'head'};const target=sampleCameraPreset(s,c,0);const expected=s.subjects!.B.getObjectByName('head')!.getWorldPosition(new T.Vector3()).distanceTo(target.camera.position);
 assert.ok(Math.abs(target.metadata.focus!.distanceMeters!-expected)<1e-8);
});
