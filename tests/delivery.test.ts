import {applyCapturePreset} from '../lib/core/capture-presets';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {unzipSync,strFromU8} from 'fflate';
import * as T from 'three';
import {emptyDelivery,emptyShotBrief,deliveryShots,deliveryIssues,validateDelivery,blankFields,actorFields,lightFields,beatFields} from '../lib/core/delivery';
import {sampleDeliveryWorld} from '../lib/core/delivery-sampling';
import {resolveShotCamera,type CameraFrame} from '../lib/core/cameras';
import type {StageScene} from '../lib/core/types';
import {readDeliverySettings,saveDeliverySettings} from '../server/delivery-settings';
import {assertDeliveryExport,writeDeliveryPackage} from '../server/delivery-export';
function complete(){const doc=emptyDelivery(),shot=deliveryShots('main',1)[0],brief=emptyShotBrief();
  for(const fields of [doc.film,doc.context,brief.details,brief.capture!])for(const key of Object.keys(fields))(fields as Record<string,string>)[key]='具体设计要求';
  brief.actors={state:'none',items:[]};brief.lights={state:'none',items:[]};brief.beats={state:'none',items:[]};brief.reviewedSignature=shot.signature;doc.shots[shot.key]=brief;return {doc,shot,brief};
}
test('draft stays pending; explicit none differs from absent; core narrative cannot be none',()=>{
  const {doc,shot,brief}=complete();validateDelivery(doc);assert.equal(deliveryIssues(doc,[shot],[]).length,0);
  brief.actors.state='pending';assert.match(deliveryIssues(doc,[shot])[0].message,/人物/);
  brief.actors.state='none';brief.details.purpose='没有';assert.match(deliveryIssues(doc,[shot])[0].message,/必须有具体内容/);
  brief.details.purpose='';assert.match(deliveryIssues(doc,[shot])[0].message,/未填写/);
  assert.ok(deliveryIssues(emptyDelivery(),[shot]).some(i=>i.message.includes('尚无交付档案')));
  assert.throws(()=>validateDelivery({...doc,film:{concept:3}}),/格式/);
  brief.actors.items=[blankFields(actorFields)];assert.throws(()=>validateDelivery(doc),/列表状态/);
});
test('stable shot keys isolate sequences; changed cuts require review; broken subjects and times block delivery',()=>{
  const {doc,shot,brief}=complete();assert.notEqual(shot.key,deliveryShots('other',1,[{id:'main',cameraId:'main',start:0,end:1}])[0].key);
  assert.ok(deliveryIssues(doc,deliveryShots('main',2)).some(i=>i.message.includes('复核')));
  brief.actors={state:'present',items:[{...blankFields(actorFields),subjectId:'missing'}]};
  brief.beats={state:'present',items:[{...blankFields(beatFields),time:2}]};
  const issues=deliveryIssues(doc,[shot],[]);assert.ok(issues.some(i=>i.message.includes('subjects')));assert.ok(issues.some(i=>i.message.includes('递增')));
  brief.lights={state:'present',items:[blankFields(lightFields),blankFields(lightFields)]};assert.ok(deliveryIssues(doc,[shot]).some(i=>i.message.includes('光源 ID 重复')));
});
test('project-shared film and per-scene drafts persist atomically, preserve other scenes, reject stale writes and builtins',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'vs-delivery-'));
  try{await mkdir(path.join(root,'projects/test/scenes'),{recursive:true});for(const name of ['one','two'])await writeFile(path.join(root,`projects/test/scenes/${name}.ts`),'// unchanged');
    const {doc,brief}=complete();brief.capture!.filmStock='保存胶卷设计';brief.prompts={image:{text:'保存手工提示词',sourceSignature:'draft',technicalSignature:'draft'}};const results=await Promise.allSettled([saveDeliverySettings(root,'test','one','missing',doc),saveDeliverySettings(root,'test','one','missing',doc)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const one=await readDeliverySettings(root,'test','one');assert.equal(Object.values(one.document!.shots)[0].capture?.filmStock,'保存胶卷设计');assert.equal(Object.values(one.document!.shots)[0].prompts?.image?.text,'保存手工提示词');doc.film.concept='更新全片理念';doc.context.context='第二场景';
    await saveDeliverySettings(root,'test','two',one.revision,doc);
    const reread=await readDeliverySettings(root,'test','one');assert.equal(reread.document?.film.concept,'更新全片理念');assert.equal(reread.document?.context.context,'具体设计要求');
    assert.equal(await readFile(path.join(root,'projects/test/scenes/one.ts'),'utf8'),'// unchanged');
    await assert.rejects(saveDeliverySettings(root,'vibestage-camera-school','showroom','builtin',doc));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('delivery rejects subframe shots and unresolved actor references',()=>{
  const {doc}=complete();assertDeliveryExport({camera:'main',duration:1,fps:24,width:1280,height:720,sourceHash:'hash',delivery:doc,subjectIds:[]});
  assert.throws(()=>assertDeliveryExport({camera:'main',duration:1,fps:24,width:1280,height:720,sourceHash:'hash',delivery:emptyDelivery(),subjectIds:[]}),/完整交付未通过/);
  const cuts=[{id:'short',cameraId:'main',start:0,end:.001},{id:'rest',cameraId:'main',start:.001,end:1}];
  const shots=deliveryShots('main',1,cuts);for(const s of shots){doc.shots[s.key]=structuredClone(Object.values(doc.shots)[0]);doc.shots[s.key].reviewedSignature=s.signature;}
  // The rest of the timeline has frames, but a cut entirely between samples does not.
  cuts[0].end=.01;cuts[1].start=.01;cuts.splice(1,0,{id:'invisible',cameraId:'main',start:.01,end:.02});cuts[2].start=.02;
  for(const s of deliveryShots('main',1,cuts)){doc.shots[s.key]=structuredClone(Object.values(doc.shots)[0]);doc.shots[s.key].reviewedSignature=s.signature;}
  assert.throws(()=>assertDeliveryExport({camera:'main',duration:1,fps:24,width:16,height:16,sourceHash:'h',delivery:doc,subjectIds:[],cameraPlan:cuts}),/可采样帧/);
});
test('archive separates image and video, carries exact camera/light samples and binds endpoint to last rendered frame',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'vs-package-'));
  try{await mkdir(path.join(dir,'frames'));for(const name of ['reference.mp4','source.zip','cameras.json'])await writeFile(path.join(dir,name),'fixture');
    const stage:StageScene={name:'test',scene:new T.Scene(),cameras:{main:new T.PerspectiveCamera()},durationSeconds:1,output:{width:16,height:16,fps:2},update(){},dispose(){}};
    const light=new T.PointLight('red',2);light.name='key';stage.scene.add(light);
    const frames:CameraFrame[]=[0,.5].map((t,i)=>{light.position.x=i;return {frame:i,timeSeconds:t,camera:resolveShotCamera(stage,'main',t,1).info,world:sampleDeliveryWorld(stage)};});
    for(let i=0;i<2;i++)await writeFile(path.join(dir,'frames',String(i).padStart(6,'0')+'.png'),`frame ${i}`);
    const {doc,brief}=complete();brief.capture=applyCapturePreset(applyCapturePreset(applyCapturePreset(brief.capture,'body','alexa-35'),'lens','cooke-s4'),'film','vision3-500t');brief.capture.filmProcessing='手工冲洗扫描要求';doc.shots['orphan']=emptyShotBrief();const spec={camera:'main',duration:1,fps:2,width:16,height:16,sourceHash:'frozen',delivery:doc,subjectIds:[]};
    await writeDeliveryPackage(dir,spec,frames,async args=>{await writeFile(args.at(-1)!,'clip');},()=>false);
    const files=unzipSync(await readFile(path.join(dir,'delivery.zip'))),image=JSON.parse(strFromU8(files['shots/001/image.json'])),video=JSON.parse(strFromU8(files['shots/001/video.json']));
    assert.match(image.design.capture.filmStock,/VISION3 500T/);assert.equal(image.design.capture.filmProcessing,'手工冲洗扫描要求');for(const kind of ['image','video']){const prompt=strFromU8(files[`shots/001/${kind}-prompt.txt`]);assert.match(prompt,/ALEXA 35/);assert.match(prompt,/Cooke S4/);assert.match(prompt,/手工冲洗扫描要求/);}assert.deepEqual(image.design.capture,video.design.capture);assert.match(strFromU8(files['shots/001/image.md']),/胶片／胶卷品牌/);assert.match(strFromU8(files['shots/001/video-prompt.txt']),/胶片／胶卷品牌/);
    assert.equal(image.keyframes.at(-1).timelineSeconds,.5);assert.equal(image.keyframes.at(-1).actual.world.lights[0].positionMeters[0],1);
    assert.equal(Object.keys(JSON.parse(strFromU8(files['delivery.json'])).shots).length,1);assert.equal(video.actualFrames.length,2);assert.equal(video.sourceHash,'frozen');assert.ok(files['shots/001/reference.mp4']);assert.ok(files['shots/001/image.md']);assert.match(strFromU8(files['shots/001/image-prompt.txt']),/一张首帧/);assert.match(strFromU8(files['shots/001/video-prompt.txt']),/视频/);assert.ok(JSON.parse(strFromU8(files['delivery.json'])).shots[JSON.stringify(['main','main'])].prompts.image.text);assert.ok(files['source.zip']);
    await assert.rejects(writeDeliveryPackage(dir,spec,frames,async()=>{},()=>true),/取消/);
    await assert.rejects(writeDeliveryPackage(dir,spec,frames.map(f=>({...f,world:undefined})),async()=>{},()=>false),/实际场景/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('continuing shots require review when a predecessor independent performance changes',()=>{
  const cuts=[{id:'a',cameraId:'main',start:0,end:1,performance:{mode:'independent' as const,sourceStartSeconds:0}},{id:'b',cameraId:'main',start:1,end:2}];
  const before=deliveryShots('edit',2,cuts);cuts[0].performance!.sourceStartSeconds=2;
  const after=deliveryShots('edit',2,cuts);assert.equal(before[1].key,after[1].key);assert.notEqual(before[1].signature,after[1].signature);
});

test('legacy capture stays editable but blocks complete export until explicitly filled',()=>{
  const {doc,shot,brief}=complete();delete brief.capture;
  validateDelivery(doc);
  assert.ok(deliveryIssues(doc,[shot]).some(i=>i.path.endsWith('.capture.filmStock')));
  const spec={camera:'main',duration:1,fps:24,width:16,height:16,sourceHash:'hash',delivery:doc,subjectIds:[]};
  assert.throws(()=>assertDeliveryExport(spec),/完整交付未通过/);
  brief.capture=emptyShotBrief().capture!;
  for(const key of Object.keys(brief.capture))brief.capture[key as keyof typeof brief.capture]='没有';
  brief.capture.recordingMedium='数字';assertDeliveryExport(spec);
  (brief.capture as unknown as Record<string,unknown>).filmStock=123;
  assert.throws(()=>validateDelivery(doc),/成像介质格式/);
});
