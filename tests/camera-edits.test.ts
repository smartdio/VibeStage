import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as T from 'three';
import {createCameraEditSession,emptyCameraEdits,resolveShotCamera,type StageScene,type CameraEdits} from '../lib/core';
import {readCameraSettings,saveCameraSettings} from '../server/camera-settings';
function fixture():StageScene{
 const scene=new T.Scene(),rig=new T.Group(),camera=new T.PerspectiveCamera(40,16/9,.1,100);rig.position.x=2;rig.add(camera);scene.add(rig);camera.name='原始机位';camera.position.set(0,1,5);
 const meta={focalLengthMm:25,sensor:{widthMm:36,heightMm:24},aperture:4};
 return {name:'manual',scene,cameras:{main:camera},cameraMetadata:{main:meta},durationSeconds:4,output:{width:1280,height:720,fps:24},update(t){camera.position.z=5-t;meta.focalLengthMm=25+t;},dispose(){}};
}
test('manual pose/lens overrides follow authored update, persist across seeks and reset cleanly',()=>{
 const s=fixture(),session=createCameraEditSession(s,emptyCameraEdits());
 const edits:CameraEdits={version:1,cameras:{main:{position:[1,2,3],rotationDegrees:[10,20,0],focalLengthMm:50,label:'手调'}},sequences:{}};
 session.setEdits(edits);s.update(3);let info=resolveShotCamera(s,'main',3,16/9).info;
 assert.deepEqual(info.positionMeters,[1,2,3]);assert.equal(info.focalLengthMm,50);assert.equal(info.label,'手调');
 s.update(0);s.update(3);assert.deepEqual(resolveShotCamera(s,'main',3,16/9).info,info);
 session.setEdits(emptyCameraEdits());s.update(3);info=resolveShotCamera(s,'main',3,16/9).info;
 assert.deepEqual(info.positionMeters,[2,1,2]);assert.equal(info.focalLengthMm,28);assert.equal(info.label,'原始机位');
});
test('manual camera + sequence survives JSON reload; invalid edits roll back without corrupting preview',()=>{
 const s=fixture(),session=createCameraEditSession(s,emptyCameraEdits());const edits=emptyCameraEdits();
 edits.cameras.camera_1={created:true,focalLengthMm:35,sensor:{widthMm:36,heightMm:24},position:[0,2,6],rotationDegrees:[0,0,0]};
 edits.sequences.sequence_1=[{id:'one',cameraId:'main',start:0,end:2},{id:'two',cameraId:'camera_1',start:2,end:4}];
 session.setEdits(edits);s.update(3);assert.equal(resolveShotCamera(s,'sequence_1',3,16/9).info.focalLengthMm,35);
 const restored=fixture();createCameraEditSession(restored,JSON.parse(JSON.stringify(session.getEdits())));restored.update(3);assert.deepEqual(resolveShotCamera(restored,'sequence_1',3,16/9).info,resolveShotCamera(s,'sequence_1',3,16/9).info);
 const bad=structuredClone(edits);bad.sequences.sequence_1[1].cameraId='missing';assert.throws(()=>session.setEdits(bad),/机位/);assert.equal(resolveShotCamera(s,'sequence_1',3,16/9).info.cameraId,'camera_1');
 bad.cameras.camera_1.focalLengthMm=-1;assert.throws(()=>session.setEdits(bad),/正数/);
 session.setEdits(emptyCameraEdits());assert.deepEqual(Object.keys(s.cameras),['main']);assert.deepEqual(s.cameraCuts,{});
});
test('saving private camera settings preserves authored code and rejects stale concurrent writes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'vibestage-manual-'));try{
  await mkdir(path.join(root,'projects/test/scenes'),{recursive:true});await writeFile(path.join(root,'projects/test/scenes/main.ts'),'// authored scene');
  const initial=await readCameraSettings(root,'test','main');assert.equal(initial.revision,'missing');
  const edits=emptyCameraEdits();edits.cameras.main={focalLengthMm:50};
  const writes=await Promise.allSettled([saveCameraSettings(root,'test','main',initial.revision,edits),saveCameraSettings(root,'test','main',initial.revision,edits)]);
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.filter(r=>r.status==='rejected').length,1);
  const stored=await readCameraSettings(root,'test','main');assert.equal(stored.edits.cameras.main.focalLengthMm,50);assert.notEqual(stored.revision,'missing');
  assert.equal(await readFile(path.join(root,'projects/test/scenes/main.ts'),'utf8'),'// authored scene');
  await assert.rejects(saveCameraSettings(root,'../escape','main','missing',edits));
 }finally{await rm(root,{recursive:true,force:true});}
});
