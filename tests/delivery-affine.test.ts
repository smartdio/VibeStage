import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {sampleDeliveryWorld,validateDeliveryWorld} from '../lib/core/delivery-sampling';
import type {StageScene} from '../lib/core/types';

function fixture(){
  const scene=new T.Scene(),parent=new T.Group(),subject=new T.Object3D();
  parent.position.set(3,4,5);parent.rotation.z=Math.PI/2;parent.scale.set(2,1,3);
  subject.position.set(1,2,3);subject.rotation.y=Math.PI/4;parent.add(subject);scene.add(parent);
  const stage:StageScene={name:'affine',scene,cameras:{main:new T.PerspectiveCamera()},subjects:{subject},durationSeconds:1,output:{width:16,height:16,fps:2},update(){},dispose(){}};
  return {parent,subject,stage};
}
test('delivery records the complete rendered affine transform, including anisotropic shear under a hidden ancestor',()=>{
  const {parent,subject,stage}=fixture();parent.visible=false;
  const record=sampleDeliveryWorld(stage),s=record.subjects.subject,q=Math.SQRT2;
  const expected=[0,q,-3/q,0,-1,0,0,0,0,q,3/q,0,1,6,14,1];
  assert.ok(s.matrixWorld);expected.forEach((v,i)=>assert.ok(Math.abs(s.matrixWorld![i]-v)<1e-12));
  assert.equal(s.visible,false);assert.ok(new T.Vector3().fromArray(s.positionMeters).distanceTo(new T.Vector3(1,6,14))<1e-12);
  assert.ok(Math.abs(Math.hypot(...s.quaternion)-1)<1e-12);
  const exported=new T.Matrix4().fromArray(s.matrixWorld!);
  // Nonorthogonal basis vectors prove that a position/rotation/scale-only record loses information.
  const x=new T.Vector3().setFromMatrixColumn(exported,0),z=new T.Vector3().setFromMatrixColumn(exported,2);
  assert.ok(Math.abs(x.dot(z)+2.5)<1e-12);
  for(const point of [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,-1,2]]){
    const rendered=subject.localToWorld(new T.Vector3().fromArray(point)),restored=new T.Vector3().fromArray(point).applyMatrix4(exported);
    assert.ok(rendered.distanceTo(restored)<1e-12);
  }
  parent.scale.x=4;parent.visible=true;const next=sampleDeliveryWorld(stage).subjects.subject;
  assert.notDeepEqual(next.matrixWorld,s.matrixWorld);assert.equal(next.visible,true);
  expected.forEach((v,i)=>assert.ok(Math.abs(s.matrixWorld![i]-v)<1e-12));
  validateDeliveryWorld(JSON.parse(JSON.stringify(record)));
});
test('delivery accepts legacy object records and validates an optional complete matrix',()=>{
  const {stage}=fixture(),record=sampleDeliveryWorld(stage);validateDeliveryWorld(record);
  for(const value of [[],Array(15).fill(0),[...Array(15).fill(0),Infinity],Array(16).fill('0')]){
    const malformed=structuredClone(record);malformed.subjects.subject.matrixWorld=value as number[];
    assert.throws(()=>validateDeliveryWorld(malformed),/实际对象记录无效/);
  }
  const legacy=structuredClone(record);delete legacy.subjects.subject.matrixWorld;validateDeliveryWorld(legacy);
});

test('mounted camera offsets stay in world metres under nonuniform parent scale and rotating children',async()=>{
  const {createCameraPresetConfig,sampleCameraPreset}=await import('../lib/core/camera-presets');
  const {stage,parent,subject}=fixture();stage.scene.updateMatrixWorld(true);
  const config=createCameraPresetConfig(stage,'subject-mounted',{subject:{subject:'subject'}},{distance:4,height:.6,sideOffset:.8,headingDegrees:35},0);
  for(const time of [0,1,.5,0]){
    parent.scale.set(2+time,.75,3-time*.4);subject.rotation.set(.3+time*.1,.6+time,-.2,'YXZ');stage.scene.updateMatrixWorld(true);
    const {camera}=sampleCameraPreset(stage,config,time);
    assert.ok(Math.abs(camera.position.distanceTo(subject.getWorldPosition(new T.Vector3()))-Math.sqrt(17))<1e-10);
    assert.ok(Math.abs(camera.quaternion.length()-1)<1e-12);
  }
});
