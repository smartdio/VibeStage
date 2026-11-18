import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,PerspectiveCamera} from 'three';
import {createCameraEditSession,emptyCameraEdits,type StageScene} from '../lib/core';
import {StageRuntime} from '../src/runtime';
import {adjacentShot} from '../src/shot-navigation';

test('layout resize presents the current shot without a cleared frame or a playback step',()=>{
  const scene=new Scene(),camera=new PerspectiveCamera(),actor=new Group();scene.add(actor);
  let samples=0;
  const stage:StageScene={name:'resize',scene,cameras:{main:camera},durationSeconds:4,output:{width:1280,height:720,fps:24},update(t){samples++;actor.position.x=t*2;},dispose(){}};
  createCameraEditSession(stage,emptyCameraEdits());
  const surface=()=>({pixels:null as number|null,resizes:0,setSize(){this.resizes++;this.pixels=null;}});
  const main=surface(),monitor=surface(),runtime=Object.create(StageRuntime.prototype) as StageRuntime;
  Object.assign(runtime,{instance:stage,pilot:null,busy:false,mode:'shot',cameraId:'main',time:1.5,output:stage.output,
    main,monitor,free:new PerspectiveCamera(),width:100,height:60,monitorWidth:20,monitorHeight:12,helpers:new Group(),gridHelper:new Group(),
    renderShot(target:ReturnType<typeof surface>){target.pixels=actor.position.x;},audio:{play(){},pause(){}},onError(e:Error){throw e;},
  });
  runtime.playing=true;runtime.draw();runtime.resizePreview(120,80,20,12);
  assert.equal(main.pixels,3,'the resized surface must be painted before resize returns');
  assert.equal(runtime.time,1.5);assert.equal(runtime.playing,true);
  runtime.resizePreview(120,80,30,18);
  assert.equal(main.resizes,1,'resizing the monitor must not clear an unchanged main surface');
  assert.equal(monitor.pixels,3);
  const before=samples;runtime.resizePreview(120,80,30,18);assert.equal(samples,before);
  runtime.busy=true;runtime.resizePreview(140,90,30,18);
  assert.equal(samples,before,'layout must not replace the frame currently being sampled by export');
  runtime.busy=false;runtime.draw();assert.equal(main.pixels,3);
});

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

test('playback applies pending original-camera edits before audio or rendered frames, without copying',()=>{
  const scene=new Scene(),camera=new PerspectiveCamera();camera.position.set(0,1,5);
  const stage:StageScene={name:'pending',scene,cameras:{main:camera},durationSeconds:4,output:{width:1280,height:720,fps:24},update(){camera.position.set(0,1,5);},dispose(){}};
  const session=createCameraEditSession(stage,emptyCameraEdits()),runtime=Object.create(StageRuntime.prototype) as StageRuntime;
  const events:string[]=[],frames:number[][]=[];
  Object.assign(runtime,{instance:stage,pilot:null,busy:false,mode:'shot',cameraId:'main',time:0,output:stage.output,helpers:new Group(),gridHelper:new Group(),
    audio:{play(){events.push('audio');},pause(){},position(){return null;}},onTime(){},
    renderShot(){frames.push(runtime.cameraInfo!.positionMeters);},
    preparePlayback(){events.push('apply');session.setEdits({version:1,cameras:{main:{position:[2,3,6]}},sequences:{}});return true;},
  });
  runtime.playing=true;runtime.advancePlayback(.5);runtime.draw();
  assert.deepEqual(events,['apply','audio']);assert.deepEqual(frames.at(-1),[2,3,6]);assert.equal(runtime.cameraId,'main');assert.deepEqual(Object.keys(stage.cameras),['main']);
});

test('invalid pending camera input blocks regular and range playback instead of showing the old composition',()=>{
  const runtime=Object.create(StageRuntime.prototype) as StageRuntime,reported:boolean[]=[];let starts=0;
  Object.assign(runtime,{instance:{durationSeconds:4},time:0,busy:false,pilot:null,draw(){},onTime(_t:number,p:boolean){reported.push(p);},audio:{play(){starts++;},pause(){},position(){return null;}},preparePlayback:()=>false});
  runtime.playing=true;assert.ok(!runtime.playing);assert.equal(starts,0);
  runtime.playReview(1,3);assert.ok(!runtime.playing);assert.equal(starts,0);assert.equal(reported.at(-1),false);
  runtime.preparePlayback=undefined;runtime.playing=true;assert.equal(runtime.playing,true);assert.equal(starts,1);
});
