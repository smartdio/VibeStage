import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {FULL_FRAME,activeSensor,focalLengthFromFov,resolveShotCamera,validateScene,type StageScene,type CameraFrame} from '../lib/core';
import {buildCameraRecording} from '../server/camera-records';
function stage():StageScene{
  const scene=new T.Scene(),wide=new T.PerspectiveCamera(45,16/9,.1,100),close=new T.PerspectiveCamera(36,16/9,.1,100);
  wide.position.set(0,0,5);close.position.set(0,0,3);
  return {name:'camera fixture',scene,cameras:{wide,close,edit:wide.clone()},cameraMetadata:{wide:{focalLengthMm:25,sensor:FULL_FRAME,aperture:5.6,focus:{distanceMeters:5}},close:{focalLengthMm:50,sensor:FULL_FRAME,aperture:2.8}},cameraCuts:{edit:[{id:'a',cameraId:'wide',start:0,end:1},{id:'b',cameraId:'close',start:1,end:2}]},durationSeconds:2,output:{width:1280,height:720,fps:24},update(){},dispose(){}};
}
test('physical lens uses a center-cropped sensor in landscape and portrait; no source mutation',()=>{
 const s=stage(),source=s.cameras.wide as T.PerspectiveCamera;source.zoom=2;
 const shot=resolveShotCamera(s,'wide',0,16/9);
 assert.deepEqual(shot.info.activeSensor,{widthMm:36,heightMm:20.25});
 const expected=2*Math.atan(20.25/50)*180/Math.PI;assert.ok(Math.abs(shot.info.verticalFovDegrees!-expected)<1e-10);
 assert.equal((shot.camera as T.PerspectiveCamera).zoom,1);assert.equal(source.zoom,2);assert.equal(source.fov,45);
 assert.deepEqual(activeSensor(FULL_FRAME,9/16),{widthMm:13.5,heightMm:24});
 s.cameraMetadata!.wide.focalLengthMm=50;
 const longer=resolveShotCamera(s,'wide',0,16/9);assert.ok(longer.info.verticalFovDegrees!<shot.info.verticalFovDegrees!);
 const point=new T.Vector3(1,0,0);assert.ok(point.clone().project(longer.camera).x>point.clone().project(shot.camera).x);
 assert.ok(Math.abs(focalLengthFromFov(expected,FULL_FRAME,16/9)-25)<1e-10);
});
test('legacy FOV and orthographic cameras remain compatible without inventing lens metadata',()=>{
 const s=stage();delete s.cameraMetadata;s.cameraCuts=undefined;
 const legacy=resolveShotCamera(s,'wide',0,16/9);assert.equal(legacy.info.verticalFovDegrees,45);assert.equal(legacy.info.focalLengthMm,undefined);assert.equal(legacy.info.lensMode,'legacy-fov');
 s.cameras.ortho=new T.OrthographicCamera(-2,2,2,-2);const ortho=resolveShotCamera(s,'ortho',0,2);assert.equal(ortho.info.projection,'orthographic');assert.equal(ortho.info.orthographicBounds?.right,4);
});
test('world-space camera and moving focus target produce stable serializable frame metadata',()=>{
 const s=stage(),rig=new T.Group(),person=new T.Group(),anchor=new T.Object3D();rig.position.set(2,0,0);rig.add(s.cameras.wide);s.scene.add(rig,person);person.add(anchor);anchor.position.y=1.5;
 s.cameraMetadata!.wide.focus={target:anchor,label:'人物 A',offset:[0,.2,0]};
 const first=resolveShotCamera(s,'wide',0,16/9).info;assert.deepEqual(first.positionMeters,[2,0,5]);assert.deepEqual(first.focus!.targetWorld,[0,1.7,0]);
 person.position.z=2;const second=resolveShotCamera(s,'wide',1,16/9).info;assert.ok(second.focus!.distanceMeters<first.focus!.distanceMeters);
 assert.equal(second.depthOfFieldEnabled,true);assert.doesNotThrow(()=>JSON.stringify(second));
 person.position.z=0;assert.deepEqual(resolveShotCamera(s,'wide',0,16/9).info,first);
});
test('automatic cuts resolve source lenses at exact boundaries and reject ambiguous plans',()=>{
 const s=stage();validateScene(s);
 assert.equal(resolveShotCamera(s,'edit',.999,16/9).info.focalLengthMm,25);
 assert.equal(resolveShotCamera(s,'edit',1,16/9).info.focalLengthMm,50);
 assert.equal(resolveShotCamera(s,'edit',2,16/9).info.shot!.id,'b');
 s.cameraCuts!.edit[1].start=.9;assert.throws(()=>validateScene(s),/连续/);
 s.cameraCuts!.edit[1].start=1;s.cameraCuts!.edit[1].cameraId='missing';assert.throws(()=>validateScene(s),/机位/);
 s.cameraCuts!.edit[1].cameraId='close';s.cameraMetadata!.wide.focalLengthMm=NaN;assert.throws(()=>validateScene(s),/焦距/);
});
test('recording preserves every rendered frame and cut; current-frame still uses its actual timestamp',()=>{
 const s=stage(),frames:CameraFrame[]=Array.from({length:48},(_,frame)=>({frame,timeSeconds:frame/24,camera:resolveShotCamera(s,'edit',frame/24,16/9).info}));
 const spec={kind:'video' as const,camera:'edit',duration:2,time:0,fps:24,width:1280,height:720,cameraPlan:s.cameraCuts!.edit};
 const recording=buildCameraRecording(spec,frames);assert.equal(recording.frames.length,48);assert.equal(recording.shots.length,2);assert.equal(recording.shots[1].startFrame,24);assert.equal(recording.shots[1].cameraAtStart.focalLengthMm,50);
 assert.throws(()=>buildCameraRecording(spec,frames.slice(1)),/数量/);
 const bad=structuredClone(frames);bad[24].camera.cameraId='wide';assert.throws(()=>buildCameraRecording(spec,bad),/分镜计划/);
 const still=buildCameraRecording({...spec,kind:'still',time:1.5},[{frame:0,timeSeconds:1.5,camera:resolveShotCamera(s,'edit',1.5,16/9).info}]);assert.equal(still.frames[0].camera.cameraId,'close');assert.equal(still.shots[0].startSeconds,1.5);
});
test('five-minute 60 fps recording validates batches at absolute frame offsets',()=>{
 const s=stage();s.durationSeconds=300;const spec={kind:'video' as const,camera:'wide',duration:300,time:0,fps:60,width:1280,height:720};
 const frames=Array.from({length:18000},(_,frame)=>({frame,timeSeconds:frame/60,camera:resolveShotCamera(s,'wide',frame/60,16/9).info}));
 for(let start=0;start<frames.length;start+=30)assert.doesNotThrow(()=>buildCameraRecording(spec,frames.slice(start,start+30),start));
 assert.equal(buildCameraRecording(spec,frames).shots[0].endSeconds,300);
 assert.throws(()=>buildCameraRecording(spec,frames.slice(30,60),0));
 assert.throws(()=>buildCameraRecording(spec,frames.slice(0,-1)));
 assert.throws(()=>buildCameraRecording(spec,frames.slice(-30),17980));
});
