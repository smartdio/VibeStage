import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Mesh,PerspectiveCamera,Scene} from 'three';
import {createCameraPresetConfig,createCameraEditSession,emptyCameraEdits,resolveShotCamera,sampleScene,type StageScene} from '../lib/core';
import {applyControlledCamera,applyPresetForShot,copyCameraForShot} from '../src/camera-workspace';
function fixture():StageScene{return {name:'timeline',scene:new Scene(),cameras:{edit:new PerspectiveCamera(),original:new PerspectiveCamera()},cameraCuts:{edit:[{id:'a',cameraId:'original',start:0,end:2,performance:{mode:'independent',sourceStartSeconds:1}},{id:'b',cameraId:'original',start:2,end:4}]},durationSeconds:4,output:{width:1280,height:720,fps:24},update(){this.cameras.original.position.set(0,1,5);},dispose(){}};}
const pose={position:[2,3,4] as [number,number,number],rotationDegrees:[0,20,0] as [number,number,number],focalLengthMm:18,sensor:{widthMm:36,heightMm:24}};
test('copying framing inside a timeline replaces only the active cut and playback uses the copy',()=>{
 const s=fixture(),session=createCameraEditSession(s,emptyCameraEdits());
 const copy=copyCameraForShot(s,session.getEdits(),'edit',.5,pose);
 assert.equal(copy.selection,'edit');session.setEdits(copy.edits);
 for(const t of [0,.5,1.9]){sampleScene(s,'edit',t);const shot=resolveShotCamera(s,'edit',t,16/9).info;assert.equal(shot.cameraId,copy.cameraId);assert.equal(shot.focalLengthMm,18);assert.deepEqual(shot.positionMeters,pose.position);}
 sampleScene(s,'edit',2);assert.equal(resolveShotCamera(s,'edit',2,16/9).info.cameraId,'original');
 assert.deepEqual(s.cameraCuts!.edit[0].performance,{mode:'independent',sourceStartSeconds:1});
 const reloaded=fixture();createCameraEditSession(reloaded,JSON.parse(JSON.stringify(copy.edits)));sampleScene(reloaded,'edit',0);assert.equal(resolveShotCamera(reloaded,'edit',0,16/9).info.cameraId,copy.cameraId);
});
test('boundary copies target the next cut, and standalone copies do not alter timelines',()=>{
 const s=fixture();assert.equal(copyCameraForShot(s,emptyCameraEdits(),'edit',2,pose).edits.sequences.edit[1].cameraId,'camera_1');
 assert.equal(copyCameraForShot(s,emptyCameraEdits(),'edit',4,pose).edits.sequences.edit[1].cameraId,'camera_1');
 const standalone=copyCameraForShot(s,emptyCameraEdits(),'original',1,pose);assert.equal(standalone.selection,standalone.cameraId);assert.deepEqual(standalone.edits.sequences,{});
});

test('default control isolates only the current shot, including references in other sequences and reload',()=>{
 const stage=fixture();stage.cameraCuts!.other=structuredClone(stage.cameraCuts!.edit);stage.cameras.other=new PerspectiveCamera();
 const session=createCameraEditSession(stage,emptyCameraEdits());
 const result=applyControlledCamera(stage,session.getEdits(),'edit',0,'original',{rotationDegrees:pose.rotationDegrees},pose);
 assert.equal(result.isolated,true);assert.equal(result.selection,'edit');assert.equal(result.edits.cameras.original,undefined);
 session.setEdits(result.edits);
 for(const [sequence,time,id] of [['edit',0,result.cameraId],['edit',2,'original'],['other',0,'original']] as const){sampleScene(stage,sequence,time);assert.equal(resolveShotCamera(stage,sequence,time,16/9).info.cameraId,id);}
 assert.deepEqual(stage.cameraCuts!.edit[0].performance,{mode:'independent',sourceStartSeconds:1});
 const again=applyControlledCamera(stage,session.getEdits(),'edit',0,result.cameraId,{focalLengthMm:50},pose);
 assert.equal(again.isolated,false);assert.equal(Object.keys(again.edits.cameras).length,1);
 const reloaded=fixture();reloaded.cameras.other=new PerspectiveCamera();reloaded.cameraCuts!.other=structuredClone(reloaded.cameraCuts!.edit);createCameraEditSession(reloaded,JSON.parse(JSON.stringify(again.edits)));
 sampleScene(reloaded,'edit',0);assert.equal(resolveShotCamera(reloaded,'edit',0,16/9).info.focalLengthMm,50);
 sampleScene(reloaded,'edit',2);assert.deepEqual(resolveShotCamera(reloaded,'edit',2,16/9).info.positionMeters,[0,1,5]);
});
test('explicit shared control keeps references and changes their common camera',()=>{
 const stage=fixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 const result=applyControlledCamera(stage,session.getEdits(),'edit',2,'original',pose,pose,'shared');
 assert.equal(result.isolated,false);assert.deepEqual(result.edits.sequences,{});session.setEdits(result.edits);
 for(const t of [0,2,4]){sampleScene(stage,'edit',t);const info=resolveShotCamera(stage,'edit',t,16/9).info;assert.equal(info.cameraId,'original');assert.deepEqual(info.positionMeters,pose.position);}
});

test('partial parameter edits detach once and accumulate without changing neighbouring framing',()=>{
 const stage=fixture(),session=createCameraEditSession(stage,{version:1,cameras:{original:{position:[1,2,6],rotationDegrees:[-10,15,0],focalLengthMm:28,sensor:{widthMm:36,heightMm:24},aperture:5.6}},sequences:{}});
 const framing={...session.getEdits().cameras.original};
 const lens=applyControlledCamera(stage,session.getEdits(),'edit',2,'original',{focalLengthMm:50},framing);
 session.setEdits(lens.edits);
 const position=applyControlledCamera(stage,session.getEdits(),'edit',2,lens.cameraId,{position:[3,2,6]},framing);session.setEdits(position.edits);
 const angle=applyControlledCamera(stage,session.getEdits(),'edit',2,lens.cameraId,{rotationDegrees:[-10,30,0]},framing);session.setEdits(angle.edits);
 assert.equal(Object.keys(angle.edits.cameras).length,2);
 assert.deepEqual(angle.edits.cameras.original,framing);
 assert.deepEqual(angle.edits.cameras[lens.cameraId].framingOffset?.position,[2,0,0]);assert.equal(angle.edits.cameras[lens.cameraId].focalLengthMm,50);assert.equal(angle.edits.cameras[lens.cameraId].aperture,5.6);
 sampleScene(stage,'edit',0);assert.deepEqual(resolveShotCamera(stage,'edit',0,16/9).info.positionMeters,[1,2,6]);
 const reloaded=fixture();createCameraEditSession(reloaded,JSON.parse(JSON.stringify(angle.edits)));sampleScene(reloaded,'edit',2);
 const actual=resolveShotCamera(reloaded,'edit',2,16/9).info;assert.equal(actual.focalLengthMm,50);assert.deepEqual(actual.positionMeters,[3,2,6]);
});

function presetFixture(){
 const stage=fixture();stage.scene.add(new Mesh(new BoxGeometry(1,2,1)));
 const config=createCameraPresetConfig(stage,'push-in',{subject:{subject:'@scene'}},{startSeconds:0,endSeconds:4,holdStartSeconds:0,holdEndSeconds:0,travel:2});
 stage.cameraPresets={original:config};return stage;
}
test('preset parameter edit isolates the active shot without freezing motion, including reload',()=>{
 const stage=presetFixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 sampleScene(stage,'edit',2);const neighbour=resolveShotCamera(stage,'edit',2,16/9).info;
 const config=structuredClone(stage.cameraPresets!.original);config.parameters.focalLengthMm=18;config.parameters.travel=3;
 const result=applyPresetForShot(stage,session.getEdits(),'edit',0,'original',config);
 assert.equal(result.selection,'edit');assert.equal(result.isolated,true);assert.equal(result.edits.cameras.original,undefined);
 assert.deepEqual(result.edits.cameras[result.cameraId].preset,config);assert.equal(result.edits.cameras[result.cameraId].position,undefined);
 session.setEdits(result.edits);sampleScene(stage,'edit',0);const first=resolveShotCamera(stage,'edit',0,16/9).info;
 sampleScene(stage,'edit',1);const later=resolveShotCamera(stage,'edit',1,16/9).info;assert.notDeepEqual(first.positionMeters,later.positionMeters);assert.equal(later.focalLengthMm,18);
 sampleScene(stage,'edit',2);assert.deepEqual(resolveShotCamera(stage,'edit',2,16/9).info,neighbour);
 const reload=presetFixture();createCameraEditSession(reload,JSON.parse(JSON.stringify(result.edits)));sampleScene(reload,'edit',1);assert.deepEqual(resolveShotCamera(reload,'edit',1,16/9).info,later);
 const again=applyPresetForShot(stage,result.edits,'edit',0,result.cameraId,config);assert.equal(again.isolated,false);assert.equal(Object.keys(again.edits.cameras).length,1);
});
test('explicit shared preset edits retain references and final-frame isolation targets last cut',()=>{
 const stage=presetFixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 const config=structuredClone(stage.cameraPresets!.original);config.parameters.focalLengthMm=60;
 const shared=applyPresetForShot(stage,session.getEdits(),'edit',0,'original',config,'shared');assert.deepEqual(shared.edits.sequences,{});session.setEdits(shared.edits);
 for(const time of [0,2,4]){sampleScene(stage,'edit',time);assert.equal(resolveShotCamera(stage,'edit',time,16/9).info.focalLengthMm,60);}
 const end=applyPresetForShot(stage,session.getEdits(),'edit',4,'original',config);assert.equal(end.edits.sequences.edit[0].cameraId,'original');assert.equal(end.edits.sequences.edit[1].cameraId,end.cameraId);
});

test('editing a referenced camera directly protects its timeline users by default, even one reference',()=>{
 const stage=fixture();stage.cameraCuts!.edit=[{id:'a',cameraId:'original',start:0,end:4}];
 const session=createCameraEditSession(stage,emptyCameraEdits());
 const result=applyControlledCamera(stage,session.getEdits(),'original',0,'original',{focalLengthMm:42,label:'独立构图'},pose);
 assert.equal(result.selection,result.cameraId);assert.notEqual(result.cameraId,'original');assert.deepEqual(result.edits.sequences,{});assert.equal(result.edits.cameras[result.cameraId].label,'独立构图');session.setEdits(result.edits);
 sampleScene(stage,'edit',1);assert.equal(resolveShotCamera(stage,'edit',1,16/9).info.cameraId,'original');assert.deepEqual(resolveShotCamera(stage,'edit',1,16/9).info.positionMeters,[0,1,5]);
 const shared=applyControlledCamera(stage,session.getEdits(),'original',0,'original',{focalLengthMm:60},pose,'shared');assert.equal(shared.cameraId,'original');
});
test('editing a preset directly protects timeline users and preserves its motion configuration',()=>{
 const stage=presetFixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 const config=structuredClone(stage.cameraPresets!.original);config.parameters.focalLengthMm=24;
 const result=applyPresetForShot(stage,session.getEdits(),'original',0,'original',config);
 assert.equal(result.selection,result.cameraId);assert.notEqual(result.cameraId,'original');assert.deepEqual(result.edits.sequences,{});session.setEdits(result.edits);
 sampleScene(stage,'edit',1);assert.notEqual(resolveShotCamera(stage,'edit',1,16/9).info.focalLengthMm,24);
 sampleScene(stage,result.selection,1);assert.equal(resolveShotCamera(stage,result.selection,1,16/9).info.focalLengthMm,24);
 const shared=applyPresetForShot(stage,session.getEdits(),'original',0,'original',config,'shared');assert.equal(shared.cameraId,'original');
});

function movingFixture(){const s=fixture();delete s.cameraCuts!.edit[0].performance;s.update=function(t){this.cameras.original.position.set(t,1,5);this.cameras.original.rotation.set(.1*t,.2*t,0,'YXZ');};return s;}
test('first-frame framing preserves authored translation and rotation through isolation, repeated edits and reload',()=>{
 const s=movingFixture(),session=createCameraEditSession(s,emptyCameraEdits());
 sampleScene(s,'edit',0);
 const result=applyControlledCamera(s,session.getEdits(),'edit',0,'original',{position:[1,2,5],rotationDegrees:[0,20,0]},pose);session.setEdits(result.edits);
 const states=[0,1,1.9].map(t=>{sampleScene(s,'edit',t);return resolveShotCamera(s,'edit',t,16/9).info;});
 assert.deepEqual(states.map(s=>s.positionMeters),[[1,2,5],[2,2,5],[2.9,2,5]]);assert.notDeepEqual(states[0].quaternion,states[1].quaternion);
 sampleScene(s,'edit',1);const again=applyControlledCamera(s,session.getEdits(),'edit',1,result.cameraId,{position:[3,2,5]},pose);session.setEdits(again.edits);
 const reload=movingFixture();createCameraEditSession(reload,JSON.parse(JSON.stringify(again.edits)));
 for(const t of [1.9,0,1,2,4]){sampleScene(s,'edit',t);sampleScene(reload,'edit',t);assert.deepEqual(resolveShotCamera(s,'edit',t,16/9).info,resolveShotCamera(reload,'edit',t,16/9).info);}
 sampleScene(reload,'edit',2);assert.deepEqual(resolveShotCamera(reload,'edit',2,16/9).info.positionMeters,[2,1,5]);
});
test('manual preset framing retains moving preset and only explicit freezing stops motion',()=>{
 const s=presetFixture(),session=createCameraEditSession(s,emptyCameraEdits());sampleScene(s,'edit',0);
 const before=resolveShotCamera(s,'edit',0,16/9).info;
 const pos=before.positionMeters.map((v,i)=>v+(i===0?1:0)) as [number,number,number];
 const result=applyControlledCamera(s,session.getEdits(),'edit',0,'original',{position:pos},pose);session.setEdits(result.edits);
 sampleScene(s,'edit',0);const first=resolveShotCamera(s,'edit',0,16/9).info;sampleScene(s,'edit',1);const later=resolveShotCamera(s,'edit',1,16/9).info;
 assert.ok(first.preset);assert.deepEqual(first.positionMeters,pos);assert.notDeepEqual(first.positionMeters,later.positionMeters);
 const reload=presetFixture();createCameraEditSession(reload,JSON.parse(JSON.stringify(result.edits)));sampleScene(reload,'edit',1);assert.deepEqual(resolveShotCamera(reload,'edit',1,16/9).info,later);
 const freeze=copyCameraForShot(s,session.getEdits(),'edit',1,pose);session.setEdits(freeze.edits);
 for(const t of [0,1,1.9]){sampleScene(s,'edit',t);const info=resolveShotCamera(s,'edit',t,16/9).info;assert.equal(info.preset,undefined);assert.deepEqual(info.positionMeters,pose.position);}
});

test('keyframes preserve the prefix, interpolate relative to moving shots and round-trip',()=>{
 const stage=movingFixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 function at(t:number){sampleScene(stage,'edit',t);return resolveShotCamera(stage,'edit',t,16/9).info;}
 function write(t:number,height:number,yaw:number){
   const current=at(t);
   const change=applyControlledCamera(stage,session.getEdits(),'edit',t,current.cameraId,
     {position:[t,height,5],rotationDegrees:[0,yaw,0]},pose,'shot','key');
   session.setEdits(change.edits);
 }
 const prefix=at(.4);
 write(.5,2,10);write(1.5,4,50);
 assert.deepEqual(at(.4).positionMeters,prefix.positionMeters);assert.deepEqual(at(.4).quaternion,prefix.quaternion);
 assert.equal(at(.75).positionMeters[1],2.3125);assert.equal(at(1).positionMeters[1],3);
 write(1.5,5,65);assert.equal(session.getEdits().cameras[at(1).cameraId].framingKeys?.length,2);
 const reload=movingFixture();createCameraEditSession(reload,JSON.parse(JSON.stringify(session.getEdits())));
 for(const t of [1.5,.4,1,.75,1.99,2]){sampleScene(reload,'edit',t);assert.deepEqual(resolveShotCamera(reload,'edit',t,16/9).info,at(t));}
 assert.deepEqual(at(2).positionMeters,[2,1,5]);
});

test('a first key set with the time slider takes effect on the same export frame',()=>{
 const stage=movingFixture(),session=createCameraEditSession(stage,emptyCameraEdits());
 const sliderTime=0.291666666666667;
 sampleScene(stage,'edit',sliderTime);
 const result=applyControlledCamera(stage,session.getEdits(),'edit',sliderTime,'original',{position:[sliderTime,3,5]},pose,'shot','key');
 session.setEdits(result.edits);
 for(const [frame,height] of [[6,1],[7,3],[8,3]]){
   sampleScene(stage,'edit',frame/24);
   assert.equal(resolveShotCamera(stage,'edit',frame/24,16/9).info.positionMeters[1],height);
 }
});

test('a saved slider split and its exact export frame select the same independent camera and performance',()=>{
 const stage=fixture(),at=2.29166666666667;
 stage.cameras.right=new PerspectiveCamera();
 stage.cameraCuts!.edit=[{id:'left',cameraId:'original',start:0,end:at},{id:'right',cameraId:'right',start:at,end:4}];
 createCameraEditSession(stage,emptyCameraEdits());
 for(const time of [54/24,55/24,at,56/24]){
   sampleScene(stage,'edit',time);
   const info=resolveShotCamera(stage,'edit',time,16/9).info;
   assert.equal(info.cameraId,time===54/24?'original':'right');
   assert.equal(info.performance?.shotId,info.shot?.id);
 }
});
