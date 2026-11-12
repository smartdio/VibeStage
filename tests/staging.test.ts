import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene} from 'three';
import {emptyDelivery,emptyShotBrief,deliveryShots,validateDelivery,deliveryIssues} from '../lib/core/delivery';
import {emptyStaging,cuesAt,stagingIssues,type StageTarget} from '../lib/core/staging';
import {generateShotPrompt,promptSourceSignature,resolveShotPrompts} from '../lib/core/prompts';
import {resolveShotCamera} from '../lib/core/cameras';
import type {StageScene} from '../lib/core/types';
const target=(subjectId:string):StageTarget=>({kind:'subject',subjectId,note:''});
function fixture(){const doc=emptyDelivery(),shot=deliveryShots('edit',2)[0],brief=emptyShotBrief();doc.shots[shot.key]=brief;doc.storyNodes=[{id:'reveal',label:'发现钥匙',change:'A发现B隐瞒',audience:'观众知道钥匙所在'}];brief.staging={...emptyStaging(),storyNodeIds:['reveal'],transition:'continuous',gazes:{state:'present',items:[{time:0,subjectId:'A',target:target('B')},{time:1,subjectId:'A',target:target('key')}]},props:{state:'present',items:[{time:0,propId:'key',holder:target('B')},{time:1,propId:'key',holder:{kind:'place',subjectId:'',note:'桌面左侧'}}]}};return {doc,shot,brief};}
test('legacy drafts remain valid; annotation structures reject malformed data but accept unfinished drafts',()=>{
 const old=emptyDelivery();validateDelivery(old);old.shots.x=emptyShotBrief();validateDelivery(old);
 const {doc,brief}=fixture();validateDelivery(doc);brief.staging!.gazes.items[0].subjectId='';validateDelivery(doc);
 brief.staging!.gazes.items[0].time=NaN;assert.throws(()=>validateDelivery(doc),/节点格式/);
 const other=fixture();other.doc.storyNodes!.push({...other.doc.storyNodes![0]});assert.throws(()=>validateDelivery(other.doc),/ID/);
});
test('relationship issues detect broken references, invalid times and duplicate per-subject states',()=>{
 const {doc,shot,brief}=fixture();assert.deepEqual(stagingIssues(doc,shot,['A','B','key']),[]);
 brief.staging!.gazes.items[1].time=0;brief.staging!.props.items[0].holder=target('missing');brief.staging!.storyNodeIds=['gone'];
 const issues=deliveryIssues(doc,[shot],['A','B','key']);assert.ok(issues.some(i=>i.message.includes('剧情节点不存在')));assert.ok(issues.some(i=>i.message.includes('递增')));assert.ok(issues.some(i=>i.message.includes('missing')));
 brief.staging!.props.items[1].time=3;assert.ok(stagingIssues(doc,shot).some(i=>i.message.includes('位于镜头内')));
 brief.staging!.gazes={state:'pending',items:[]};assert.ok(stagingIssues(doc,shot).some(i=>i.message.includes('视线目标需填写')));
});
test('frame state is per subject; later cues never leak into earlier frames and unknown stays unknown',()=>{
 const rows=fixture().brief.staging!.gazes.items;assert.deepEqual(cuesAt(rows,-.1),[]);assert.equal(cuesAt(rows,.9)[0].target.subjectId,'B');assert.equal(cuesAt(rows,1)[0].target.subjectId,'key');
 assert.equal(cuesAt([...rows,{time:.5,subjectId:'B',target:target('A')}],1).length,2);
});
test('only linked story changes invalidate prompts; first-frame prompt excludes future relationship states',()=>{
 const {doc,shot,brief}=fixture(),output={width:320,height:180,fps:24};const stage:StageScene={name:'test',scene:new Scene(),cameras:{edit:new PerspectiveCamera()},durationSeconds:2,output,update(){},dispose(){}};const camera=resolveShotCamera(stage,'edit',0,16/9).info;
 const image=generateShotPrompt(doc,shot,output,camera,'image'),video=generateShotPrompt(doc,shot,output,camera,'video');assert.match(image.text,/A 看向 B/);assert.doesNotMatch(image.text,/A 看向 key|桌面左侧/);assert.match(video.text,/A 看向 key/);assert.match(video.text,/桌面左侧/);assert.match(video.text,/动作连续/);
 const signature=promptSourceSignature(doc,shot,output);doc.storyNodes!.push({id:'unused',label:'不关联',change:'其他事件',audience:'其他信息'});assert.equal(promptSourceSignature(doc,shot,output),signature);
 brief.prompts={image};doc.storyNodes![0].audience='新信息';assert.notEqual(promptSourceSignature(doc,shot,output),signature);assert.throws(()=>resolveShotPrompts(doc,shot,output,camera),/过期/);assert.equal(brief.prompts.image!.text,image.text);
});
