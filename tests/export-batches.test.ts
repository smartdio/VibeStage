import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer,type ViteDevServer} from 'vite';
import * as T from 'three';
import {stagePlugin} from '../server/plugin';
import {resolveShotCamera} from '../lib/core/cameras';
import type {StageScene} from '../lib/core/types';

test('export API rejects missing/duplicate/out-of-order metadata, completes batches, and rejects uploads after cancel',async()=>{
 const original=process.cwd(),root=await mkdtemp(path.join(tmpdir(),'vs-batches-'));let server:ViteDevServer|undefined;
 try{
  for(const dir of ['projects/test/scenes','lib','templates','user-models'])await mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','AGENTS.md','AGENT_GUIDE.md','MODEL_GUIDE.md','LICENSE','THIRD_PARTY_NOTICES.md'])await writeFile(path.join(root,name),name.endsWith('.json')?'{}':'');
  await writeFile(path.join(root,'projects/test/project.json'),'{"name":"test"}');await writeFile(path.join(root,'projects/test/scenes/main.ts'),'// export API fixture');
  process.chdir(root);const plugin=stagePlugin();process.chdir(original);
  server=await createServer({root,configFile:false,plugins:[plugin],server:{host:'127.0.0.1',port:0},logLevel:'silent'});await server.listen();
  const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/__vs`;
  const request=async(url:string,body?:unknown)=>{const res=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'X-VibeStage':'1'},body:body===undefined?undefined:body instanceof Buffer?body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
  const {data:source}=await request('/projects?project=test');
  const spec={kind:'sequence',project:'test',scene:'main',camera:'main',sourceHash:source.sourceHash,width:16,height:16,duration:1,time:0,fps:31};
  const {data:job}=await request('/exports',spec),url='/exports/'+job.id;
  const scene:StageScene={name:'test',scene:new T.Scene(),cameras:{main:new T.PerspectiveCamera()},durationSeconds:1,output:{width:16,height:16,fps:31},update(){},dispose(){}};
  const frames=Array.from({length:31},(_,frame)=>({frame,timeSeconds:frame/31,camera:resolveShotCamera(scene,'main',frame/31,1).info}));
  const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(16,16);png.writeUInt32BE(16,20);
  assert.equal((await request(url+'/camera-frames',{start:0,cameraFrames:frames.slice(0,30)})).status,400);
  for(let i=0;i<31;i++)assert.equal((await request(url+'/frame?index='+i,png)).status,200);
  assert.equal((await request(url+'/finish',{})).status,400);
  assert.equal((await request(url+'/camera-frames',{start:1,cameraFrames:frames.slice(0,30)})).status,400);
  assert.equal((await request(url+'/camera-frames',{start:0,cameraFrames:frames})).status,400);
  const corrupt=structuredClone(frames.slice(0,30));corrupt[29].timeSeconds=0;
  assert.equal((await request(url+'/camera-frames',{start:0,cameraFrames:corrupt})).status,400);
  assert.equal((await request(url+'/camera-frames',{start:0,cameraFrames:frames.slice(0,30)})).status,200);
  assert.equal((await request(url+'/camera-frames',{start:0,cameraFrames:frames.slice(0,30)})).status,400);
  assert.equal((await request(url+'/finish',{})).status,400);
  assert.equal((await request(url+'/camera-frames',{start:30,cameraFrames:frames.slice(30)})).status,200);
  assert.equal((await request(url+'/finish',{})).status,200);
  let final;for(let i=0;i<200;i++){final=(await request(url)).data;if(final.status==='complete'||final.status==='failed')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(final.status,'complete',final.error);assert.equal(final.packProgress,1);
  assert.equal(JSON.parse(await readFile(path.join(root,'exports',job.id,'cameras.json'),'utf8')).frames.length,31);
  const {data:cancelled}=await request('/exports',spec),cancelUrl='/exports/'+cancelled.id;
  assert.equal((await request(cancelUrl+'/cancel',{})).data.status,'cancelled');
  for(const [action,body] of [['frame?index=0',png],['camera-frames',{start:0,cameraFrames:[frames[0]]}],['finish',{}]] as const)assert.equal((await request(cancelUrl+'/'+action,body)).status,400);
  assert.equal((await fetch(base+cancelUrl+'/frames.zip')).status,404);
 }finally{process.chdir(original);await server?.close();await rm(root,{recursive:true,force:true});}
});
