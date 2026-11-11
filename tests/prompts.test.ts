import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene} from 'three';
import {emptyDelivery,emptyShotBrief,deliveryShots,validateDelivery,blankFields,beatFields} from '../lib/core/delivery';
import {generateShotPrompt,resolveShotPrompts,promptSourceSignature,promptTechnicalSignature} from '../lib/core/prompts';
import {resolveShotCamera} from '../lib/core/cameras';
import type {StageScene} from '../lib/core/types';
function fixture(){const doc=emptyDelivery(),shot=deliveryShots('main',2)[0],b=emptyShotBrief(),output={width:320,height:180,fps:4};doc.shots[shot.key]=b;b.reviewedSignature=shot.signature;
 for(const fields of [doc.film,doc.context,b.details,b.capture!])for(const k of Object.keys(fields))(fields as Record<string,string>)[k]='已明确的设计';
 b.details.startState='站立望向门口';b.details.endState='走到窗前';b.actors={state:'none',items:[]};b.lights={state:'none',items:[]};b.beats={state:'present',items:[{...blankFields(beatFields),time:1,action:'走到窗前',expression:'焦急',environment:'没有',lighting:'变暗',camera:'推近'}]};
 const stage:StageScene={name:'test',scene:new Scene(),cameras:{main:new PerspectiveCamera()},durationSeconds:2,output,update(){},dispose(){}};const camera=resolveShotCamera(stage,'main',0,320/180).info;return {doc,shot,b,output,camera};}
test('image is a single first frame; video includes ordered action nodes, duration and fps; no invented optics',()=>{
 const {doc,shot,output,camera}=fixture(),image=generateShotPrompt(doc,shot,output,camera,'image'),video=generateShotPrompt(doc,shot,output,camera,'video');
 assert.match(image.text,/一张首帧/);assert.match(image.text,/站立望向门口/);assert.doesNotMatch(image.text,/走到窗前/);assert.match(video.text,/1 秒/);assert.match(video.text,/走到窗前/);assert.match(video.text,/2 秒，4 fps/);assert.match(image.text,/光圈未配置/);assert.match(video.text,/光源：没有/);
 assert.deepEqual(image,generateShotPrompt(doc,shot,output,camera,'image'));
});
test('manual edits survive resolve; changes to film, lighting, timing, resolution and actual lens invalidate',()=>{
 const {doc,shot,b,output,camera}=fixture();b.prompts=resolveShotPrompts(doc,shot,output,camera);b.prompts.image!.text='手工改写，必须逐字保留';
 assert.equal(resolveShotPrompts(doc,shot,output,camera).image.text,'手工改写，必须逐字保留');validateDelivery(doc);
 doc.film.concept='变更理念';assert.throws(()=>resolveShotPrompts(doc,shot,output,camera),/过期/);
 b.prompts.image!.sourceSignature=promptSourceSignature(doc,shot,output);b.prompts.video!.sourceSignature=promptSourceSignature(doc,shot,output);
 assert.throws(()=>resolveShotPrompts(doc,shot,{...output,width:640},camera),/过期/);
 assert.throws(()=>resolveShotPrompts(doc,shot,output,{...camera,zoom:3}),/过期/);
 const before=promptSourceSignature(doc,shot,output);b.details.palette='红色';assert.notEqual(promptSourceSignature(doc,shot,output),before);
 assert.notEqual(promptSourceSignature(doc,{...shot,end:3},output),before);
 b.prompts.image!.text='';assert.throws(()=>resolveShotPrompts(doc,shot,output,camera),/为空/);
});
test('legacy docs generate both prompts; malformed prompt drafts fail validation; property order is irrelevant',()=>{
 const {doc,shot,b,output,camera}=fixture();validateDelivery(doc);const p=resolveShotPrompts(doc,shot,output,camera);assert.ok(p.image.text);assert.ok(p.video.text);
 assert.equal(promptTechnicalSignature(camera),promptTechnicalSignature(Object.fromEntries(Object.entries(camera).reverse()) as typeof camera));
 assert.equal(promptSourceSignature(doc,shot,output),promptSourceSignature(doc,shot,{...output,durationSeconds:2} as typeof output));
 b.prompts={image:{...p.image,text:3 as unknown as string}};assert.throws(()=>validateDelivery(doc),/提示词/);
});

test('handheld prompts describe actual multi-axis motion, dual frequency, hold phase and independent aim/focus',async()=>{
 const {createCameraPresetConfig}=await import('../lib/core/camera-presets');const {describeCameraMotion}=await import('../lib/core/camera-motion-description');
 const {doc,shot,output,camera}=fixture();
 const stage:StageScene={name:'handheld',scene:new Scene(),cameras:{main:new PerspectiveCamera()},durationSeconds:2,output,update(){},dispose(){}};
 stage.subjects={actor:stage.cameras.main};
 const config=createCameraPresetConfig(stage,'handheld',{subject:{subject:'actor'}},{shakeMeters:.02,shakeDegrees:1,shakeFrequencyHz:2,seed:9,frame:'world'},0);
 camera.preset={id:'handheld',version:1,config,warnings:[]};
 const video=generateShotPrompt(doc,shot,output,camera,'video').text;
 for(const pattern of [/±0.02 米/,/±2 厘米/,/±1°/,/基频 2 Hz/,/3.46 Hz/,/65%/,/35%/,/世界 X 轴/,/YXZ/,/0.3–1.7 秒/,/没有额外振幅淡入淡出/,/不随主体转身旋转/,/复现种子为 9/])assert.match(video,pattern);
 const image=generateShotPrompt(doc,shot,output,camera,'image').text;assert.doesNotMatch(image,/基频 2 Hz|±2 厘米/);assert.match(image,/不把抖动轨迹、重影/);
 const original=generateShotPrompt(doc,shot,output,camera,'video');doc.shots[shot.key].prompts={video:original};config.parameters.shakeFrequencyHz=3;assert.throws(()=>resolveShotPrompts(doc,shot,output,camera),/过期/);
 config.parameters.shakeMeters=0;config.parameters.shakeDegrees=0;const off=describeCameraMotion(camera,shot);assert.match(off,/所有附加手持抖动关闭/);assert.doesNotMatch(off,/基频/);
 assert.match(describeCameraMotion(camera,{...shot,start:1.8,end:2}),/未与预设运动段相交/);
 delete config.parameters.shakeMeters;delete config.parameters.shakeDegrees;delete config.parameters.shakeFrequencyHz;delete config.parameters.seed;
 const legacy=describeCameraMotion(camera,shot);assert.match(legacy,/±1.5 厘米/);assert.match(legacy,/±0.35°/);assert.match(legacy,/基频 1.4 Hz/);assert.match(legacy,/2.422 Hz/);
});

test('custom cameras do not acquire invented handheld and pan uses signed angle and actual timing',async()=>{
 const {describeCameraMotion}=await import('../lib/core/camera-motion-description');const {createCameraPresetConfig}=await import('../lib/core/camera-presets');const {shot,output,camera}=fixture();
 assert.match(describeCameraMotion(camera,shot),/不从单帧推断/);camera.movement='自定义轨道缓慢前进';assert.match(describeCameraMotion(camera,shot),/自定义轨道缓慢前进/);
 const stage:StageScene={name:'pan',scene:new Scene(),cameras:{main:new PerspectiveCamera()},durationSeconds:2,output,update(){},dispose(){}};stage.subjects={actor:stage.cameras.main};
 const config=createCameraPresetConfig(stage,'pan',{subject:{subject:'actor'}},{angleDegrees:-60,holdStartSeconds:.2,holdEndSeconds:.4},0);camera.preset={id:'pan',version:1,config,warnings:['主体出画']};
 const text=describeCameraMotion(camera,shot);assert.match(text,/0.2–1.6 秒/);assert.match(text,/30° → -30°/);assert.match(text,/主体出画/);assert.doesNotMatch(text,/双频|基频/);
});

test('capture design enters both prompts and invalidates saved prompts without inventing actual optics',()=>{
 const {doc,shot,b,output,camera}=fixture();b.capture!.cameraBody='指定机身';b.capture!.filmStock='指定胶卷';b.capture!.filmProcessing='指定冲洗扫描';
 b.prompts=resolveShotPrompts(doc,shot,output,camera);
 for(const kind of ['image','video'] as const){assert.match(b.prompts[kind]!.text,/指定机身/);assert.match(b.prompts[kind]!.text,/指定胶卷/);assert.match(b.prompts[kind]!.text,/指定冲洗扫描/);assert.match(b.prompts[kind]!.text,/不代表白模已模拟/);assert.match(b.prompts[kind]!.text,/光圈未配置/);}
 b.capture!.filmStock='改用另一胶卷';assert.throws(()=>resolveShotPrompts(doc,shot,output,camera),/过期/);
 assert.match(b.prompts.image!.text,/指定胶卷/);
});


test('technical signatures tolerate cross-runtime float noise but reject material optical changes',()=>{
 const {camera}=fixture();const a={...camera,verticalFovDegrees:22.895192527371208};
 assert.equal(promptTechnicalSignature(a),promptTechnicalSignature({...a,verticalFovDegrees:22.89519252737121}));
 assert.notEqual(promptTechnicalSignature(a),promptTechnicalSignature({...a,verticalFovDegrees:22.8952}));
});
