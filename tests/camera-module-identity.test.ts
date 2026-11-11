import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {validateCameraSetup,resolveShotCamera,FULL_FRAME} from '../lib/core/cameras';
import {createCameraEditSession} from '../lib/core/camera-edits';
import type {StageScene} from '../lib/core/types';

// A real second Three.js module graph reproduces dev-server cache/HMR constructor identity changes.
const other=await import(new URL('../node_modules/three/src/Three.js',import.meta.url).href);
function fixture():StageScene {
 const perspective=new other.PerspectiveCamera(45,1,.1,100),ortho=new other.OrthographicCamera(-2,2,2,-2,.1,100);
 perspective.position.z=5;ortho.position.z=5;
 return {name:'cross-module cameras',scene:new T.Scene(),cameras:{edit:perspective,ortho},cameraMetadata:{edit:{focalLengthMm:35,sensor:FULL_FRAME}},durationSeconds:1,output:{width:720,height:1280,fps:24},update(){},dispose(){}};
}
test('cameras from another Three module validate, preserve projection and accept manual lens edits',()=>{
 const s=fixture();assert.equal(s.cameras.edit instanceof T.PerspectiveCamera,false);
 assert.doesNotThrow(()=>validateCameraSetup(s));
 const perspective=resolveShotCamera(s,'edit',0,9/16);
 assert.equal(perspective.info.projection,'perspective');assert.equal(perspective.info.focalLengthMm,35);
 const orthographic=resolveShotCamera(s,'ortho',0,9/16);assert.equal(orthographic.info.projection,'orthographic');
 assert.ok(orthographic.camera instanceof T.OrthographicCamera);
 createCameraEditSession(s,{version:1,cameras:{edit:{focalLengthMm:50}},sequences:{}});
 s.update(0);assert.equal(resolveShotCamera(s,'edit',0,9/16).info.focalLengthMm,50);
});
test('cross-module support still rejects orthographic cameras with perspective lens metadata',()=>{
 const s=fixture();s.cameraMetadata!.ortho={focalLengthMm:35,sensor:FULL_FRAME};
 assert.throws(()=>validateCameraSetup(s),/摄影镜头参数需要透视摄影机/);
});
