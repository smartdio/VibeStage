import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SceneAudio} from '../src/audio';
import {validateAudioTrack,audioWindow,type AudioTrack} from '../lib/core/audio';
import {audioFilter,importAudio,readAudioSettings,saveAudioSettings} from '../server/audio';
const track:AudioTrack={version:1,asset:`assets/audio/${'a'.repeat(64)}.wav`,name:'配音.wav',durationSeconds:2,offsetSeconds:.25,volume:.5,muted:false};
function wav(){const rate=48000,n=rate*2,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++){const t=i/rate;const v=(t>=.5&&t<.6)||(t>=1.5&&t<1.6)?Math.sin(i*2*Math.PI*440/rate)*16000:0;b.writeInt16LE(Math.round(v),44+i*2);}return b;}
test('audio clock stays independent of render rate, reschedules after seeks, and releases stopped sources',()=>{
  const starts:number[][]=[],stops:number[]=[],disconnected:number[]=[];
  const context={currentTime:10,resume:async()=>{},createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createBufferSource(){const id=stops.length;stops.push(0);return {buffer:null,connect(){},disconnect(){disconnected.push(id);},start(...n:number[]){starts.push(n);},stop(){stops[id]++;}};}};
  const audio=new SceneAudio();audio.context=context as unknown as AudioContext;audio.buffer={duration:2} as AudioBuffer;audio.configure(track);
  audio.play(0);assert.deepEqual(starts[0],[10.25,0]);context.currentTime=11.234;assert.equal(audio.position(),1.234);
  audio.play(1);assert.deepEqual(starts[1],[11.234,.75]);assert.equal(stops[0],1);
  audio.pause();assert.equal(audio.position(),null);assert.equal(stops[1],1);assert.equal(disconnected.length,2);
  audio.play(3);assert.equal(starts.length,2);context.currentTime+=.5;assert.equal(audio.position(),3.5);
  audio.clear();assert.equal(audio.buffer,null);assert.equal(audio.track,null);
});
test('audio time mapping and settings reject invalid values and path traversal',()=>{
  assert.deepEqual(audioWindow(0,1,2),{delay:1,position:0,audible:true});assert.deepEqual(audioWindow(0,-1,2),{delay:0,position:1,audible:true});
  for(const change of [{asset:'../bad.wav'},{volume:3},{offsetSeconds:NaN},{durationSeconds:301},{muted:0}])assert.throws(()=>validateAudioTrack({...track,...change}));
});
test('private audio settings persist with revision checks and reject symlink assets',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vs-audio-test-'));
  try{const p=path.join(root,'projects/demo');await fs.mkdir(path.join(p,'scenes'),{recursive:true});await fs.writeFile(path.join(p,'scenes/test.ts'),'scene');await fs.mkdir(path.join(p,'assets/audio'),{recursive:true});await fs.writeFile(path.join(p,track.asset),wav());
    const saved=await saveAudioSettings(root,'demo','test','missing',track);assert.deepEqual((await readAudioSettings(root,'demo','test')).track,track);
    await assert.rejects(saveAudioSettings(root,'demo','test','missing',null),/其他操作/);
    await saveAudioSettings(root,'demo','test',saved.revision,null);assert.equal((await readAudioSettings(root,'demo','test')).track,null);assert.ok(await fs.stat(path.join(p,track.asset)));
    await fs.rm(path.join(p,track.asset));await fs.writeFile(path.join(root,'external.wav'),wav());await fs.symlink(path.join(root,'external.wav'),path.join(p,track.asset));
    await assert.rejects(saveAudioSettings(root,'demo','test',(await readAudioSettings(root,'demo','test')).revision,track),/符号链接/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
const ffmpegAvailable=spawnSync('ffmpeg',['-version']).status===0&&spawnSync('ffprobe',['-version']).status===0;
test('FFmpeg import normalizes valid audio, preserves old track on failure, and exports exact signed offsets/gain/silence',{skip:!ffmpegAvailable},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vs-audio-ffmpeg-'));
  try{await fs.mkdir(path.join(root,'projects/demo/scenes'),{recursive:true});await fs.writeFile(path.join(root,'projects/demo/scenes/test.ts'),'scene');
    const saved=await importAudio(root,'demo','test','missing','test.wav',wav());assert.equal(saved.track?.durationSeconds,2);
    await assert.rejects(importAudio(root,'demo','test',saved.revision,'broken.wav',Buffer.from('broken')));assert.deepEqual(await readAudioSettings(root,'demo','test'),saved);
    for(const offset of [.25,-.25,4,-4]){
      const t:AudioTrack={...saved.track!,offsetSeconds:offset,volume:.5};const out=spawnSync('ffmpeg',['-v','error','-i',path.join(root,'projects/demo',t.asset),'-af',audioFilter(t,3),'-ac','1','-f','f32le','pipe:1'],{maxBuffer:2*1024*1024});assert.equal(out.status,0,out.stderr.toString());assert.equal(out.stdout.length,3*48000*4);
      const sample=(time:number)=>Math.abs(out.stdout.readFloatLE(Math.round(time*48000)*4));
      if(Math.abs(offset)<1){assert.ok(sample(.526+offset)>.01);assert.equal(sample(.2),0);assert.equal(sample(2.8),0);}else assert.ok(out.stdout.every(x=>x===0));
    }
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
