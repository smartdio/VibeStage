import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,PerspectiveCamera,Vector3} from 'three';
import {sampleScene,resolveShotCamera,resolvePerformance,validateScene,createCameraEditSession,emptyCameraEdits,validateCameraEdits,type StageScene,type CameraCut} from '../lib/core';
import {buildCameraRecording,validateCameraPlan} from '../server/camera-records';
function fixture(){
  const scene=new Scene(),actor=new Group(),joint=new Group(),prop=new Group(),camera=new PerspectiveCamera();actor.add(joint);scene.add(actor,prop);prop.position.set(5,0,0);camera.position.set(0,3,15);
  const cuts:CameraCut[]=[{id:'first',cameraId:'main',start:0,end:2},{id:'jump',cameraId:'main',start:2,end:4,performance:{mode:'independent',takeId:'wave',sourceStartSeconds:1,subjects:{actor:{position:[10,0,0],rotationDegrees:[0,90,0]},prop:{position:[-4,0,0],visible:false}}}},{id:'continue',cameraId:'main',start:4,end:6},{id:'reset',cameraId:'main',start:6,end:8,performance:{mode:'independent',sourceStartSeconds:0}}];
  const stage:StageScene={name:'performance test',scene,cameras:{edit:new PerspectiveCamera(),main:camera},cameraCuts:{edit:cuts},subjects:{actor,prop},performances:{wave:{label:'Wave',update(t){actor.position.x=2*t;joint.rotation.x=t;}}},durationSeconds:8,output:{width:640,height:360,fps:4},update(t){actor.position.x=t;joint.rotation.z=t;},updateCameras(){camera.lookAt(actor.position);},dispose(){}};
  return {stage,actor,joint,prop,camera,cuts};
}
function snapshot(f:ReturnType<typeof fixture>,t:number,id='edit'){sampleScene(f.stage,id,t);return {a:f.actor.position.toArray(),rotation:f.actor.quaternion.toArray(),joint:f.joint.rotation.toArray(),prop:f.prop.position.toArray(),visible:f.prop.visible,camera:resolveShotCamera(f.stage,id,t,16/9).info};}
test('independent takes jump, continue cuts inherit motion and placement, later takes restore untouched state',()=>{
  const f=fixture();validateScene(f.stage);createCameraEditSession(f.stage,emptyCameraEdits());
  assert.deepEqual(snapshot(f,1).a,[1,0,0]);
  let state=snapshot(f,2);assert.deepEqual(state.a,[10,0,0]);assert.equal(state.visible,false);assert.deepEqual(state.prop,[-4,0,0]);assert.equal(state.joint[0],1);
  state=snapshot(f,3);assert.ok(Math.abs(state.a[0]-10)<1e-10);assert.ok(Math.abs(state.a[2]+2)<1e-10);
  const boundary=snapshot(f,4);assert.ok(Math.abs(boundary.a[2]+4)<1e-10);assert.equal(boundary.camera.performance?.sourceTimeSeconds,3);assert.equal(boundary.camera.performance?.takeId,'wave');
  state=snapshot(f,6);assert.deepEqual(state.a,[0,0,0]);assert.equal(Math.abs(state.joint[0] as number),0);assert.equal(state.visible,true);assert.deepEqual(state.prop,[5,0,0]);
  const independentCamera=snapshot(f,3,'main');assert.deepEqual(independentCamera.a,[3,0,0]);assert.equal(independentCamera.visible,true);
  assert.deepEqual(snapshot(f,8).a,[2,0,0]);
});
test('arbitrary seeks, scene loops and a second sequence produce the same complete state as forward sampling',()=>{
  const f=fixture();f.stage.cameras.other=new PerspectiveCamera();f.stage.cameraCuts!.other=[{id:'first',cameraId:'main',start:0,end:8}];createCameraEditSession(f.stage,emptyCameraEdits());
  const expected=new Map([0,1.5,2,2.5,3.99,4,5.5,6,7,8].map(t=>[t,snapshot(f,t)]));
  for(const time of [7,2,8,4,0,5.5,3.99,2.5,6,1.5]){snapshot(f,5,'other');assert.deepEqual(snapshot(f,time),expected.get(time));}
});
test('camera targeting sees final placements and manual camera overrides retain highest priority',()=>{
  const f=fixture();const session=createCameraEditSession(f.stage,emptyCameraEdits());sampleScene(f.stage,'edit',3);
  const direction=f.actor.position.clone().sub(f.camera.position).normalize();assert.ok(f.camera.getWorldDirection(new Vector3()).distanceTo(direction)<1e-10);
  const edits=session.getEdits();edits.cameras.main={position:[1,2,3],rotationDegrees:[0,0,0]};session.setEdits(edits);sampleScene(f.stage,'edit',3);
  assert.deepEqual(f.camera.position.toArray(),[1,2,3]);assert.deepEqual(f.camera.quaternion.toArray(),[0,0,0,1]);
});
test('private camera JSON round-trip keeps independent takes and invalid edits roll back',()=>{
  const f=fixture(),edits=emptyCameraEdits();edits.sequences.edit=structuredClone(f.cuts);const session=createCameraEditSession(f.stage,JSON.parse(JSON.stringify(edits)));
  const original=snapshot(f,3),bad=session.getEdits();bad.sequences.edit[1].performance!.takeId='missing';assert.throws(()=>session.setEdits(bad),/动作不存在/);assert.deepEqual(snapshot(f,3),original);
  const badTime=session.getEdits();badTime.sequences.edit[1].performance!.sourceStartSeconds=300;assert.throws(()=>validateCameraEdits(badTime),/300/);
  const badObject=session.getEdits();badObject.sequences.edit[1].performance!.subjects={missing:{visible:false}};assert.throws(()=>session.setEdits(badObject),/摆位对象不存在/);
  const restored=fixture();createCameraEditSession(restored.stage,session.getEdits());assert.deepEqual(snapshot(restored,3),original);
});
test('export frames record edit time and take time; server rejects mismatched or missing performance records',()=>{
  const f=fixture();createCameraEditSession(f.stage,emptyCameraEdits());
  const frames=Array.from({length:32},(_,i)=>({frame:i,timeSeconds:i/4,camera:snapshot(f,i/4).camera}));
  const spec={kind:'video' as const,camera:'edit',duration:8,time:0,fps:4,width:640,height:360,cameraPlan:f.cuts};
  const result=buildCameraRecording(spec,frames);assert.equal(result.frames[8].timeSeconds,2);assert.equal(result.frames[8].camera.performance?.sourceTimeSeconds,1);assert.equal(result.frames[16].camera.performance?.sourceTimeSeconds,3);
  const corrupt=structuredClone(frames);corrupt[8].camera.performance!.sourceTimeSeconds=2;assert.throws(()=>buildCameraRecording(spec,corrupt),/表演记录/);
  delete corrupt[8].camera.performance;assert.throws(()=>buildCameraRecording(spec,corrupt),/逐帧记录/);
  assert.throws(()=>validateCameraPlan([{id:'x',cameraId:'main',start:0,end:8,performance:{mode:'continue',sourceStartSeconds:1}}],8),/延续/);
  assert.equal(resolvePerformance(f.cuts,4).context.sourceTimeSeconds,3);
});
test('legacy scenes retain explicit static matrices and no cut placement leaks into another camera',()=>{
  const f=fixture(),object=new Group();object.matrixAutoUpdate=false;object.matrix.makeTranslation(7,8,9);f.stage.scene.add(object);
  sampleScene(f.stage,'edit',3);sampleScene(f.stage,'main',1);
  assert.deepEqual(new Vector3().setFromMatrixPosition(object.matrixWorld).toArray(),[7,8,9]);
  assert.deepEqual(f.actor.position.toArray(),[1,0,0]);assert.equal(f.prop.visible,true);
});

test('restoring a 180-degree heading preserves authored Euler axes across seeks, cuts and reloads',()=>{
 for(const wrapped of [false,true])for(const order of ['XYZ','YXZ'] as const){
  function make(){const actor=new Group(),camera=new PerspectiveCamera(),scene=new Scene();scene.add(actor);actor.rotation.set(0,Math.PI,0,order);camera.rotation.set(0,Math.PI,0,order);
   const stage:StageScene={name:'heading regression',scene,cameras:{edit:new PerspectiveCamera(),main:camera},subjects:{actor},durationSeconds:4,output:{width:16,height:16,fps:24},cameraCuts:{edit:[{id:'a',cameraId:'main',start:0,end:2},{id:'b',cameraId:'main',start:2,end:4}]},update(t){actor.position.z=t;actor.rotation.y=Math.PI-.1*t;camera.rotation.y=Math.PI-.1*t;},dispose(){}};
   if(wrapped)createCameraEditSession(stage,emptyCameraEdits());return {stage,actor,camera};}
  const first=make(),fresh=make();
  for(const [t,id] of [[0,'edit'],[3,'edit'],[1,'main'],[2,'edit'],[0,'edit']] as const){
   sampleScene(first.stage,id,t);sampleScene(fresh.stage,id,t);
   for(const o of [first.actor,first.camera]){assert.equal(o.rotation.x,0);assert.equal(o.rotation.z,0);assert.equal(o.rotation.order,order);const forward=new Vector3(0,0,-1).applyQuaternion(o.quaternion);assert.ok(forward.z>.95,'actor and camera must keep facing south');}
   assert.deepEqual(first.actor.quaternion.toArray(),fresh.actor.quaternion.toArray());
  }
 }
});
