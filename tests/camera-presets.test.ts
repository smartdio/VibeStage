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
test('all thirty-two presets are independently callable, serializable and deterministic under arbitrary seeks',()=>{
 assert.equal(cameraPresetDefinitions.length,32);
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

test('angles, pedestal and crane presets preserve their distinct geometric behavior',()=>{
 const s=fixture();s.update(0);
 const low=sampleCameraPreset(s,config(s,'low-angle'),0).camera,high=sampleCameraPreset(s,config(s,'high-angle'),0).camera;
 assert.ok(low.getWorldDirection(new T.Vector3()).y>0);assert.ok(high.getWorldDirection(new T.Vector3()).y<0);
 const top=sampleCameraPreset(s,config(s,'top-down'),3).camera;
 assert.ok(top.getWorldDirection(new T.Vector3()).distanceTo(new T.Vector3(0,-1,0))<1e-8);
 assert.ok(new T.Vector3(0,1,0).applyQuaternion(top.quaternion).distanceTo(new T.Vector3(0,0,-1))<1e-8);
 const dutch=config(s,'dutch-angle');dutch.parameters.rollDegrees=0;const straight=sampleCameraPreset(s,dutch,0).camera;dutch.parameters.rollDegrees=15;const tilted=sampleCameraPreset(s,dutch,0).camera;
 assert.ok(straight.getWorldDirection(new T.Vector3()).distanceTo(tilted.getWorldDirection(new T.Vector3()))<1e-8);assert.ok(Math.abs(straight.quaternion.angleTo(tilted.quaternion)-Math.PI/12)<1e-8);
 const lift=config(s,'pedestal');lift.parameters.lockOrientation=true;const first=sampleCameraPreset(s,lift,0).camera,last=sampleCameraPreset(s,lift,6).camera;
 assert.equal(first.position.x,last.position.x);assert.equal(first.position.z,last.position.z);assert.equal(last.position.y-first.position.y,lift.parameters.travel);assert.deepEqual(first.quaternion.toArray(),last.quaternion.toArray());
 for(const id of ['crane-up','crane-down'] as const){const c=config(s,id),a=sampleCameraPreset(s,c,0).camera,b=sampleCameraPreset(s,c,6).camera;assert.ok((b.position.y-a.position.y)*(id==='crane-up'?1:-1)>0);assert.ok((b.position.z-a.position.z)*(id==='crane-up'?1:-1)>0);}
});
test('zoom is optical only; fast presets honor holds and expose motion-blur limitation',()=>{
 const s=fixture();s.update(0);
 for(const id of ['zoom','snap-zoom'] as const){const c=config(s,id),a=sampleCameraPreset(s,c,0),b=sampleCameraPreset(s,c,6);assert.deepEqual(a.camera.position,b.camera.position);assert.deepEqual(a.camera.quaternion.toArray(),b.camera.quaternion.toArray());assert.equal(a.metadata.focalLengthMm,35);assert.equal(b.metadata.focalLengthMm,70);}
 for(const id of ['whip-pan','snap-zoom'] as const){const c=config(s,id),a=sampleCameraPreset(s,c,0),held=sampleCameraPreset(s,c,2),b=sampleCameraPreset(s,c,6);assert.deepEqual(a.camera.position,held.camera.position);assert.deepEqual(a.camera.quaternion.toArray(),held.camera.quaternion.toArray());assert.equal(a.camera.fov,held.camera.fov);assert.ok(b.record.warnings.some(w=>w.includes('运动模糊')));}
});
test('dolly zoom keeps a stationary subject plane the same projected size in landscape and portrait',()=>{
 const s=fixture();s.update(0);const c=config(s,'dolly-zoom');c.parameters.height=0;
 for(const aspect of [16/9,9/16]){const a=sampleCameraPreset(s,c,0,aspect),b=sampleCameraPreset(s,c,6,aspect);const point=new T.Vector3(-.5,.7,0);assert.ok(Math.abs(point.clone().project(a.camera).y-point.clone().project(b.camera).y)<1e-8);assert.ok(b.metadata.focalLengthMm<a.metadata.focalLengthMm);assert.ok(b.camera.position.z<a.camera.position.z);}
 c.parameters.travel=-1000;assert.throws(()=>sampleCameraPreset(s,c,0),/镜头范围/);
});
test('handheld is bounded, repeatable and seed-dependent; mounted camera retains full local attitude',()=>{
 const s=fixture();s.update(0);const c=config(s,'handheld');c.parameters.frame='world';
 const sample=(t:number)=>sampleCameraPreset(s,c,t).camera;
 const expected=sample(2);sample(5);assert.deepEqual(sample(2).matrixWorld,expected.matrixWorld);
 c.parameters.seed=8;assert.notDeepEqual(sample(2).quaternion.toArray(),expected.quaternion.toArray());
 const mounted=config(s,'subject-mounted');mounted.subject.anchor='head';const root=s.subjects!.A;
 root.rotation.set(.3,.5,.2);const a=sampleCameraPreset(s,mounted,1).camera;const localPos=root.worldToLocal(a.position.clone()),localQuat=root.getWorldQuaternion(new T.Quaternion()).invert().multiply(a.quaternion);
 root.rotation.set(-.2,1,-.3);root.position.set(4,2,-5);const b=sampleCameraPreset(s,mounted,4).camera;
 assert.ok(root.worldToLocal(b.position.clone()).distanceTo(localPos)<1e-8);assert.ok(root.getWorldQuaternion(new T.Quaternion()).invert().multiply(b.quaternion).angleTo(localQuat)<1e-7);
});
test('full orbit closes one loop with uniform radius and explicit direction',()=>{
 const s=fixture();s.update(0);const c=config(s,'orbit-360');const a=sampleCameraPreset(s,c,0).camera,b=sampleCameraPreset(s,c,6).camera;
 assert.ok(a.position.distanceTo(b.position)<1e-8);assert.ok(a.quaternion.angleTo(b.quaternion)<1e-7);
 const time=c.parameters.holdStartSeconds+(6-c.parameters.holdStartSeconds-c.parameters.holdEndSeconds)/4;
 const forward=sampleCameraPreset(s,c,time).camera.position;c.parameters.angleDegrees=-360;const reverse=sampleCameraPreset(s,c,time).camera.position;
 assert.ok(forward.x>0);assert.ok(reverse.x<0);
});
test('handoff and flythrough are continuous under dense sampling and arbitrary seeks',()=>{
 const s=fixture();s.update(0);
 for(const id of ['handoff-oner','flythrough'] as const){const c=config(s,id);if(id==='handoff-oner'){s.subjects!.Wall.position.set(3,1,-2);c.eventTarget={subject:'Wall'};}
 const frames=Array.from({length:601},(_,i)=>{s.update(i/100);return sampleCameraPreset(s,c,i/100).camera;});
 for(let i=1;i<frames.length;i++){assert.ok(frames[i].position.distanceTo(frames[i-1].position)<.15);assert.ok(frames[i].quaternion.angleTo(frames[i-1].quaternion)<.15);}
 for(const i of [500,1,210,390,300,600,0]){s.update(i/100);const shot=sampleCameraPreset(s,c,i/100);assert.deepEqual(shot.camera.matrixWorld,frames[i].matrixWorld);assert.ok(shot.metadata.focus!.distanceMeters!>0);}
 }
});
test('vertical flythrough has stable frames, path warnings and validated editable control points',()=>{
 const s=fixture();s.update(0);const c=config(s,'flythrough');c.path={points:[[0,2,4],[0,5,4],[0,8,4],[1,10,3]],lookAheadMeters:2};
 let previous: T.Quaternion|undefined;for(let i=0;i<=120;i++){const shot=sampleCameraPreset(s,c,i/20);assert.ok(shot.camera.quaternion.toArray().every(Number.isFinite));if(previous)assert.ok(previous.angleTo(shot.camera.quaternion)<.15);previous=shot.camera.quaternion;}
 c.parameters.maxSpeedMps=.1;assert.ok(sampleCameraPreset(s,c,3).record.warnings.some(w=>w.includes('速度')));
 c.path.points=[[0,0,0],[0,0,0]];assert.throws(()=>validateCameraPreset(c),/相邻路径点/);
 c.path.points=[[0,0,0]];assert.throws(()=>validateCameraPreset(c),/路径需要/);
 c.path.points=[[-.6,0,2],[-.6,0,3]];assert.ok(sampleCameraPreset(s,c,0).record.warnings.some(w=>w.includes('包围盒')));
});
test('new preset configs, paths and seeds survive saved settings and export records',()=>{
 for(const def of cameraPresetDefinitions.slice(16)){
  const s=fixture();s.update(0);const edits=emptyCameraEdits();edits.cameras.newShot={created:true,preset:config(s,def.id)};edits.sequences.edit=[{id:'new',cameraId:'newShot',start:0,end:6}];
  const session=createCameraEditSession(s,edits);const saved=JSON.parse(JSON.stringify(session.getEdits()));const fresh=fixture();createCameraEditSession(fresh,saved);
  for(const aspect of [16/9,9/16])for(const t of [0,1.5,3,4.5,5.99]){s.update(t);fresh.update(t);const shot=resolveShotCamera(s,'edit',t,aspect).info;assert.deepEqual(resolveShotCamera(fresh,'edit',t,aspect).info,shot);const recording=buildCameraRecording({kind:'still',camera:'edit',duration:6,time:t,fps:24,width:aspect>1?1280:720,height:aspect>1?720:1280,cameraPlan:edits.sequences.edit},[{frame:0,timeSeconds:t,camera:shot}]);assert.deepEqual(recording.frames[0].camera.preset!.config,saved.cameras.newShot.preset);}
 }
});
test('legacy version 1 configs need no new parameters; invalid new fields fail validation',()=>{
 const s=fixture();s.update(0);const c=config(s,'rear-follow');for(const key of ['endFocalLengthMm','rise','rollDegrees','lockOrientation','shakeMeters','shakeDegrees','shakeFrequencyHz','seed','handoffStartSeconds','handoffEndSeconds','maxSpeedMps','maxAngularSpeedDeg','clearanceMeters'])delete (c.parameters as unknown as Record<string,unknown>)[key];assert.doesNotThrow(()=>sampleCameraPreset(s,c,2));
 const handoff=config(s,'handoff-oner');handoff.parameters.handoffEndSeconds=1;assert.throws(()=>validateCameraPreset(handoff),/交接/);
 const handheld=config(s,'handheld');handheld.parameters.seed=1.5;assert.throws(()=>validateCameraPreset(handheld),/整数/);handheld.parameters.seed=3;handheld.parameters.shakeMeters=NaN;assert.throws(()=>validateCameraPreset(handheld),/shakeMeters/);
});
