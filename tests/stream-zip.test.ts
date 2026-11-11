import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {streamZip} from '../server/stream-zip';
import {writeFrameJSON} from '../server/frame-json';
test('streamed ZIP preserves many files, binary chunks and progress; cancellation removes partial archives',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vs-zip-'));
 try{
  const data=Buffer.alloc(2*1024*1024,123),source=path.join(dir,'large');await writeFile(source,data);
  const files=Object.fromEntries(Array.from({length:18000},(_,i)=>[`frames/${i}.png`,new Uint8Array([i%256])]));
  let done=0;const zip=path.join(dir,'frames.zip');await streamZip(zip,{...files,large:source},()=>false,n=>{done=n;});
  assert.equal(done,18001);const decoded=unzipSync(await readFile(zip));assert.equal(Object.keys(decoded).length,18001);assert.deepEqual(Buffer.from(decoded.large),data);assert.equal(decoded['frames/17999.png'][0],17999%256);
  let cancel=false;const aborted=path.join(dir,'cancel.zip');await assert.rejects(streamZip(aborted,{one:source,two:source},()=>cancel,()=>{cancel=true;}),/取消/);
  await assert.rejects(stat(aborted));await assert.rejects(stat(aborted+'.partial'));
  await assert.rejects(streamZip(path.join(dir,'missing.zip'),{missing:path.join(dir,'absent')}));
  const json=path.join(dir,'records.json');await writeFrameJSON(json,{version:1},'frames',[{frame:0},{frame:1}],()=>false);assert.deepEqual(JSON.parse(await readFile(json,'utf8')),{version:1,frames:[{frame:0},{frame:1}]});
  await assert.rejects(writeFrameJSON(json,{version:1},'frames',[],()=>true),/取消/);await assert.rejects(stat(json));
 }finally{await rm(dir,{recursive:true,force:true});}
});
