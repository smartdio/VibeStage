import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {resolveShotCamera,circleOfConfusionRadius,FULL_FRAME,type StageScene} from '../lib/core';
import {buildCameraRecording} from '../server/camera-records';
function fixture():StageScene{return {name:'focus',scene:new T.Scene(),cameras:{main:new T.PerspectiveCamera(45,1,.1,100)},cameraMetadata:{main:{focalLengthMm:50,sensor:FULL_FRAME,aperture:2,focus:{distanceMeters:2}}},durationSeconds:1,output:{width:1280,height:720,fps:24},update(){},dispose(){}};}
test('thin lens focuses at plane, opens with aperture and uses sensor units across output sizes',()=>{
 const s=fixture(),info=resolveShotCamera(s,'main',0,16/9).info,d=info.depthOfField!;
 assert.equal(info.depthOfFieldEnabled,true);assert.equal(circleOfConfusionRadius(d,2),0);
 const radius=circleOfConfusionRadius(d,6);assert.ok(Math.abs(radius-2500/(2*2*1950*20.25)*2/3)<1e-12);
 s.cameraMetadata!.main.aperture=4;assert.equal(circleOfConfusionRadius(resolveShotCamera(s,'main',0,16/9).info.depthOfField!,6),radius/2);
 const portrait=resolveShotCamera(s,'main',0,9/16).info.depthOfField!;assert.ok(Math.abs(portrait.radiusScale*24-d.radiusScale*20.25/2)<1e-12);
 assert.equal(circleOfConfusionRadius(d,.001),.03);
});
test('target focus uses axial depth, follows world transforms and safely bypasses impossible focus',()=>{
 const s=fixture(),parent=new T.Group(),target=new T.Object3D();parent.position.set(1,0,-3);parent.add(target);s.scene.add(parent);s.cameraMetadata!.main.focus={target};
 const info=resolveShotCamera(s,'main',0,1).info;assert.equal(info.focus!.planeDistanceMeters,3);assert.equal(info.focus!.distanceMeters,Math.sqrt(10));assert.equal(info.depthOfField!.focusPlaneMeters,3);
 parent.position.z=1;assert.equal(resolveShotCamera(s,'main',0,1).info.depthOfFieldEnabled,false);
 s.cameraMetadata!.main.focus={distanceMeters:.02};assert.equal(resolveShotCamera(s,'main',0,1).info.depthOfFieldEnabled,false);
 delete s.cameraMetadata!.main.focus;assert.equal(resolveShotCamera(s,'main',0,1).info.depthOfFieldEnabled,false);
 delete s.cameraMetadata;assert.equal(resolveShotCamera(s,'main',0,1).info.depthOfFieldEnabled,false);
});
test('export recording validates actual optical settings and records enabled state',()=>{
 const info=resolveShotCamera(fixture(),'main',0,16/9).info,frames=[{frame:0,timeSeconds:0,camera:info}];
 const spec={kind:'still' as const,camera:'main',duration:1,time:0,fps:24,width:1280,height:720};
 const record=buildCameraRecording(spec,frames);assert.equal(record.schemaVersion,2);assert.equal(record.depthOfFieldEnabled,true);
 info.depthOfField!.radiusScale*=2;assert.throws(()=>buildCameraRecording(spec,frames),/景深/);
});
