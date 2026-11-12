import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,PerspectiveCamera} from 'three';
import {createCameraEditSession,emptyCameraEdits,type StageScene} from '../lib/core';
import {StageRuntime} from '../src/runtime';
import {adjacentShot} from '../src/shot-navigation';

test('shot jumps sample actors, joints and camera at the destination and preserve playback',()=>{
  const actor=new Group(),joint=new Group(),scene=new Scene();actor.add(joint);scene.add(actor);
  const wide=new PerspectiveCamera(),close=new PerspectiveCamera();
  const stage:StageScene={name:'seek',scene,cameras:{edit:new PerspectiveCamera(),wide,close},cameraCuts:{edit:[
    {id:'approach',cameraId:'wide',start:0,end:1.75},
    {id:'turn',cameraId:'close',start:1.75,end:8},
  ]},durationSeconds:8,output:{width:1280,height:720,fps:24},update(t){actor.position.x=t*2;joint.rotation.y=t/4;wide.position.z=10-t;close.position.z=5+t;},dispose(){}};
  createCameraEditSession(stage,emptyCameraEdits());
  // Exercise real seek/draw/update/shot resolution, replacing only GPU output.
  const runtime=Object.create(StageRuntime.prototype) as StageRuntime;
  const frames:{x:number;angle:number;camera:string;z:number}[]=[],events:{time:number;playing:boolean}[]=[];
  Object.assign(runtime,{instance:stage,pilot:null,busy:false,mode:'shot',cameraId:'edit',time:0,output:stage.output,helpers:new Group(),gridHelper:new Group(),
    renderShot(){frames.push({x:actor.position.x,angle:joint.rotation.y,camera:runtime.cameraInfo!.cameraId,z:runtime.cameraInfo!.positionMeters[2]});},
    onTime(time:number,playing:boolean){events.push({time,playing});},
  });
  for(const playing of [false,true]){
    runtime.cameraId='edit';runtime.time=.5;runtime.playing=playing;
    const target=adjacentShot(stage,runtime.cameraId,runtime.time,1)!;
    runtime.cameraId=target.cameraId;runtime.seek(target.time,{preservePlayback:true});
    assert.equal(runtime.time,1.75);assert.equal(runtime.playing,playing);
    assert.deepEqual(frames.at(-1),{x:3.5,angle:1.75/4,camera:'close',z:6.75});
    assert.deepEqual(events.at(-1),{time:1.75,playing});
    const previous=adjacentShot(stage,runtime.cameraId,runtime.time,-1)!;
    runtime.seek(previous.time,{preservePlayback:true});
    assert.deepEqual(frames.at(-1),{x:0,angle:0,camera:'wide',z:10});assert.equal(runtime.playing,playing);
  }
  runtime.playing=true;runtime.seek(4);assert.equal(runtime.playing,false);
  assert.deepEqual(frames.at(-1),{x:8,angle:1,camera:'close',z:9});
});

test('review captures independently placed shots and restores the live sample, including after capture failure',()=>{
  const actor=new Group(),scene=new Scene(),wide=new PerspectiveCamera();scene.add(actor);wide.position.set(0,2,8);
  const stage:StageScene={name:'review',scene,cameras:{edit:new PerspectiveCamera(),wide},subjects:{actor},cameraCuts:{edit:[{id:'a',cameraId:'wide',start:0,end:2},{id:'b',cameraId:'wide',start:2,end:4,performance:{mode:'independent',subjects:{actor:{position:[10,0,0]}}}}]},durationSeconds:4,output:{width:1280,height:720,fps:24},update(t){actor.position.x=t;},dispose(){}};
  createCameraEditSession(stage,emptyCameraEdits());
  const runtime=Object.create(StageRuntime.prototype) as StageRuntime;
  let fail=false;
  const capture={setSize(){},setScissorTest(){},setViewport(){},domElement:{toDataURL(){if(fail)throw new Error('capture failed');return 'data:image/png;base64,test';}}};
  Object.assign(runtime,{instance:stage,pilot:null,busy:false,mode:'shot',cameraId:'edit',time:1,output:stage.output,helpers:new Group(),gridHelper:new Group(),capture,shotRenderers:new Map([[capture,{render(){}}]]),renderShot(){}});
  runtime.draw();const result=runtime.reviewFrame('edit',2);
  assert.equal(result.world.subjects.actor.positionMeters[0],10);assert.equal(actor.position.x,1);assert.equal(runtime.time,1);assert.equal(runtime.cameraInfo?.shot?.id,'a');
  fail=true;assert.throws(()=>runtime.reviewFrame('edit',2),/capture failed/);assert.equal(actor.position.x,1);assert.equal(runtime.cameraId,'edit');
});
