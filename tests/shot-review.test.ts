import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shotSamples,cutPlaybackRange} from '../src/shot-review';
import {StageRuntime} from '../src/runtime';
test('review boundary frames follow export half-open intervals, including non-aligned cuts',()=>{
  assert.deepEqual(shotSamples({start:0,end:1.01},24),{first:0,last:1});
  assert.deepEqual(shotSamples({start:1.01,end:2},24),{first:25/24,last:47/24});
  assert.deepEqual(shotSamples({start:1,end:2},24),{first:1,last:47/24});
  assert.equal(shotSamples({start:.001,end:.002},24),null);
});
test('cut review stays within adjacent shots even when the requested handles are longer',()=>{
  assert.deepEqual(cutPlaybackRange({start:1,end:1.5},{start:1.5,end:2},3),{start:1,end:2});
  assert.deepEqual(cutPlaybackRange({start:0,end:4},{start:4,end:8},1),{start:3,end:5});
});
test('range playback preserves loop choice, starts audio at edit time and clears on seek/pause',()=>{
  const rt=Object.create(StageRuntime.prototype) as StageRuntime;
  const audio:number[]=[];
  Object.assign(rt,{instance:{durationSeconds:8},time:0,busy:false,pilot:null,loop:true,draw(){},onTime(){},audio:{play(t:number){audio.push(t);},pause(){}}});
  rt.playReview(3,5);assert.equal(rt.time,3);assert.equal(rt.reviewEnd,5);assert.equal(rt.playing,true);assert.equal(rt.loop,true);assert.deepEqual(audio,[3]);
  rt.seek(1);assert.equal(rt.playing,false);assert.equal(rt.reviewEnd,null);
  rt.playReview(6,9);assert.equal(rt.playing,false);
});
test('cut playback stops on the last output frame even with scene looping enabled',()=>{
  const rt=Object.create(StageRuntime.prototype) as StageRuntime;
  Object.assign(rt,{instance:{durationSeconds:8},time:0,busy:false,pilot:null,loop:true,output:{fps:24},draw(){},onTime(){},audio:{play(){},pause(){},position(){return null;}}});
  rt.playReview(3,5);rt.advancePlayback(2.1);
  assert.equal(rt.time,119/24);assert.equal(rt.playing,false);assert.equal(rt.reviewEnd,null);assert.equal(rt.loop,true);
  rt.playing=true;rt.advancePlayback(4);assert.equal(rt.playing,true);assert.ok(rt.time<8);
});
