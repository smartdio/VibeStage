import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capturePresets,applyCapturePreset,matchingCapturePreset} from '../lib/core/capture-presets';
import {blankFields,captureFields,emptyDelivery,emptyShotBrief,deliveryShots} from '../lib/core/delivery';
import {generateShotPrompt,resolveShotPrompts} from '../lib/core/prompts';
import {Scene,PerspectiveCamera} from 'three';
import {resolveShotCamera} from '../lib/core/cameras';
import type {StageScene} from '../lib/core/types';

test('body, lens and film selection compose independently and preserve authored text',()=>{
 const original=blankFields(captureFields);original.filters='手填柔光镜';original.shutter='手填 90 度';original.filmFormat='16 mm';
 const body=applyCapturePreset(original,'body','alexa-mini-lf'),lens=applyCapturePreset(body,'lens','cooke-s4'),film=applyCapturePreset(lens,'film','vision3-500t');
 assert.equal(original.cameraBody,'');assert.equal(film.cameraBody,body.cameraBody);assert.equal(film.lensModel,lens.lensModel);assert.equal(film.filters,'手填柔光镜');assert.equal(film.shutter,'手填 90 度');assert.equal(film.filmFormat,'16 mm');
 const changed=applyCapturePreset(film,'body','arriflex-sr3');assert.equal(changed.filmStock,film.filmStock);assert.equal(changed.sensitivity,film.sensitivity);assert.equal(changed.lensModel,film.lensModel);
 assert.equal(matchingCapturePreset(film,'body'),'alexa-mini-lf');assert.equal(matchingCapturePreset(film,'film'),'vision3-500t');
 film.lensModel+='；导演手改';assert.equal(matchingCapturePreset(film,'lens'),'');assert.equal(matchingCapturePreset(film,'body'),'alexa-mini-lf');
 const none=applyCapturePreset(film,'film','film-none');assert.equal(none.filmStock,'没有');assert.equal(none.filmProcessing,'没有');assert.equal(none.lensModel,film.lensModel);
 assert.throws(()=>applyCapturePreset(film,'body','vision3-500t'),/不存在/);
});

test('every catalog entry yields a valid patch and round-trips its selection',()=>{
 const ids=new Set<string>();
 for(const kind of ['body','lens','film'] as const)for(const p of capturePresets[kind]){
  assert.ok(!ids.has(p.id));ids.add(p.id);
  for(const [key,text] of Object.entries(p.values)){assert.ok(key in captureFields);assert.ok(text.trim());}
  assert.equal(matchingCapturePreset(applyCapturePreset(undefined,kind,p.id),kind),p.id);
 }
});

test('preset and manual edits enter both prompt types while camera state stays identical',()=>{
 const doc=emptyDelivery(),shot=deliveryShots('main',2)[0],b=emptyShotBrief();doc.shots[shot.key]=b;
 const stage:StageScene={name:'test',scene:new Scene(),cameras:{main:new PerspectiveCamera()},durationSeconds:2,output:{width:320,height:180,fps:24},update(){},dispose(){}};
 const before=JSON.stringify(resolveShotCamera(stage,'main',0,16/9).info),camera=JSON.parse(before);
 b.capture=applyCapturePreset(applyCapturePreset(applyCapturePreset(b.capture,'body','alexa-35'),'lens','panavision-c'),'film','vision3-250d');
 b.prompts=resolveShotPrompts(doc,shot,stage.output,camera);
 for(const kind of ['image','video'] as const){assert.match(b.prompts[kind]!.text,/ALEXA 35/);assert.match(b.prompts[kind]!.text,/Panavision C Series/);assert.match(b.prompts[kind]!.text,/VISION3 250D/);}
 b.capture.filmProcessing='导演自定扫描方案';assert.throws(()=>resolveShotPrompts(doc,shot,stage.output,camera),/过期/);
 assert.match(generateShotPrompt(doc,shot,stage.output,camera,'video').text,/导演自定扫描方案/);
 assert.equal(JSON.stringify(resolveShotCamera(stage,'main',0,16/9).info),before);
});
