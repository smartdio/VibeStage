import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {CAMERA_SCHOOL} from '../lib/core/builtins';
import {initializeWorkspace} from '../server/workspace';
import {listProjects,createSceneFiles,cloneBuiltinProject,sceneEntryPath,sourceSnapshot} from '../server/projects';
import {readCameraSettings,saveCameraSettings} from '../server/camera-settings';
import {readAudioSettings,saveAudioSettings,importAudio} from '../server/audio';
import {cameraPresetDefinitions,emptyCameraEdits,sampleScene,resolveShotCamera,validateScene} from '../lib/core';
import {initialScene} from '../src/initial-scene';
import {adjacentShot} from '../src/shot-navigation';
import {createScene} from '../examples/camera-school/scenes/showroom';

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'vibestage-school-'));
 for(const folder of ['examples','templates'])await cp(folder,path.join(root,folder),{recursive:true});
 for(const file of ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','AGENTS.md','AGENT_GUIDE.md','MODEL_GUIDE.md','LICENSE','THIRD_PARTY_NOTICES.md'])await cp(file,path.join(root,file));
 await initializeWorkspace(root);return root;
}
test('built-in teaching project is pinned without installing an editable original; saved choices win',async()=>{
 const root=await fixture();try{
  const catalog=await listProjects(root);assert.equal(catalog[0].id,CAMERA_SCHOOL.id);assert.equal(catalog[0].readOnly,true);
  assert.equal(await stat(path.join(root,'projects/camera-school')).catch(()=>null),null);
  assert.deepEqual(initialScene(catalog),{project:CAMERA_SCHOOL.id,scene:'showroom'});
  assert.deepEqual(initialScene(catalog,{project:'demo',scene:'meeting'}),{project:'demo',scene:'meeting'});
  assert.equal(initialScene(catalog,{project:'gone',scene:'gone'})!.project,CAMERA_SCHOOL.id);
  assert.deepEqual(initialScene([{id:'demo',scenes:[{id:'meeting'}]}]),{project:'demo',scene:'meeting'});assert.equal(initialScene([]),undefined);
  await rm(path.join(root,'projects/demo'),{recursive:true});await initializeWorkspace(root);
  assert.equal((await listProjects(root))[0].readOnly,true);assert.equal(await stat(path.join(root,'projects/demo')).catch(()=>null),null);
  assert.equal(sceneEntryPath(CAMERA_SCHOOL.id,'showroom'),'examples/camera-school/scenes/showroom.ts');
  assert.throws(()=>sceneEntryPath(CAMERA_SCHOOL.id,'other'),/不存在/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('built-in project rejects scene, camera and audio writes and ignores private shadow overrides',async()=>{
 const root=await fixture();try{
  const id=CAMERA_SCHOOL.id;
  await assert.rejects(createSceneFiles(root,{project:id,scene:'new-scene',template:'empty'}),/只读/);
  await assert.rejects(saveCameraSettings(root,id,'showroom','builtin',emptyCameraEdits()),/只读/);
  await assert.rejects(saveAudioSettings(root,id,'showroom','builtin',null),/只读/);
  await assert.rejects(importAudio(root,id,'showroom','builtin','test.wav',Buffer.from('test')),/只读/);
  await mkdir(path.join(root,'projects',id,'settings'),{recursive:true});
  await writeFile(path.join(root,'projects',id,'settings/showroom.camera.json'),'invalid private shadow');
  assert.deepEqual((await readCameraSettings(root,id,'showroom')).edits,emptyCameraEdits());assert.equal((await readAudioSettings(root,id,'showroom')).track,null);
  const snapshot=await sourceSnapshot(root,{project:id,includeFiles:true});assert.ok(snapshot.files['examples/camera-school/scenes/showroom.ts']);
  assert.ok(!Object.keys(snapshot.files).some(f=>f.startsWith('projects/')||f.startsWith('user-models/')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('practice copies are independent, uniquely named and never overwritten by setup',async()=>{
 const root=await fixture();try{
  const original=await readFile(path.join(root,'examples/camera-school/shared/lessons.ts'),'utf8');
  const [one,two]=await Promise.all([cloneBuiltinProject(root,CAMERA_SCHOOL.id),cloneBuiltinProject(root,CAMERA_SCHOOL.id)]);assert.notEqual(one.project,two.project);
  const file=path.join(root,'projects',one.project,'shared/lessons.ts');await writeFile(file,'// my edited lessons\n');
  await initializeWorkspace(root);assert.equal(await readFile(file,'utf8'),'// my edited lessons\n');assert.equal(await readFile(path.join(root,'examples/camera-school/shared/lessons.ts'),'utf8'),original);
  await saveCameraSettings(root,one.project,'showroom','missing',emptyCameraEdits());
  assert.ok(!(await listProjects(root)).find(p=>p.id===one.project)!.readOnly);
  await assert.rejects(cloneBuiltinProject(root,'demo'),/内置/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('teaching scene covers all 32 presets in order with notes, deterministic playback and clean shot layers',()=>{
 const stage=createScene();try{
  validateScene(stage);assert.equal(stage.initialView,'shot');
  const ids=cameraPresetDefinitions.map(d=>d.id);assert.deepEqual(Object.keys(stage.cameraPresets!),ids);assert.deepEqual(Object.keys(stage.cameras).slice(0,32),ids);
  for(const [i,id] of ids.entries()){
   const lesson=stage.cameraLessons![id];assert.ok(lesson.purpose&&lesson.observe&&lesson.tryThis);
   if(i<31)assert.deepEqual(adjacentShot(stage,id,6,1),{cameraId:ids[i+1],time:0});
   const sample=(t:number)=>{sampleScene(stage,id,t);return resolveShotCamera(stage,id,t,16/9);};
   const expected=sample(6).info;
   for(const t of [12,0,9,3,6]){const shot=sample(t);assert.equal(shot.camera.layers.mask,1);assert.ok(shot.info.positionMeters.every(Number.isFinite));assert.ok(!shot.info.preset!.warnings.some(w=>w.includes('未命名物体')));}
   assert.deepEqual(sample(6).info,expected);assert.ok(expected.label.startsWith(String(i+1).padStart(2,'0')));
  }
  assert.equal(stage.cameras.paths.layers.mask,3);assert.equal(stage.cameras.overview.layers.mask,1);
 }finally{stage.dispose();}
});
