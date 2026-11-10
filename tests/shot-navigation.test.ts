import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {adjacentShot} from '../src/shot-navigation';

const stage={cameras:{edit:new PerspectiveCamera(),wide:new PerspectiveCamera(),side:new PerspectiveCamera()},cameraCuts:{edit:[
  {id:'a',cameraId:'wide',start:0,end:1.75},
  {id:'b',cameraId:'side',start:1.75,end:4.65},
  {id:'c',cameraId:'wide',start:4.65,end:8},
]}};
test('shot navigation uses adjacent cut starts, including exact cuts, end time and reused cameras',()=>{
  assert.deepEqual(adjacentShot(stage,'edit',.5,1),{cameraId:'edit',time:1.75});
  assert.deepEqual(adjacentShot(stage,'edit',1.75,1),{cameraId:'edit',time:4.65});
  assert.deepEqual(adjacentShot(stage,'edit',4, -1),{cameraId:'edit',time:0});
  assert.deepEqual(adjacentShot(stage,'edit',4.65,-1),{cameraId:'edit',time:1.75});
  assert.deepEqual(adjacentShot(stage,'edit',8,-1),{cameraId:'edit',time:1.75});
  assert.equal(adjacentShot(stage,'edit',0,-1),undefined);
  assert.deepEqual(adjacentShot(stage,'edit',8,1),{cameraId:'wide',time:0});
});
test('independent camera navigation seeks its authored segment time and enters adjacent sequences',()=>{
  assert.deepEqual(adjacentShot(stage,'wide',2.37,1),{cameraId:'side',time:1.75});
  assert.deepEqual(adjacentShot(stage,'side',2.37,-1),{cameraId:'wide',time:0});
  assert.deepEqual(adjacentShot(stage,'wide',0,-1),{cameraId:'edit',time:4.65});
  assert.equal(adjacentShot(stage,'side',0,1),undefined);
  assert.equal(adjacentShot(stage,'missing',0,1),undefined);
  assert.equal(adjacentShot({cameras:{only:new PerspectiveCamera()}},'only',0,1),undefined);
});
test('mixed camera and sequence navigation visits every segment in both directions',()=>{
  const mixed={cameras:{wide:new PerspectiveCamera(),edit:new PerspectiveCamera(),alternate:new PerspectiveCamera(),side:new PerspectiveCamera()},cameraCuts:{...stage.cameraCuts,alternate:[
    {id:'d',cameraId:'side',start:0,end:3},
    {id:'e',cameraId:'side',start:3,end:8},
  ]}};
  let current={cameraId:'wide',time:0};
  const forward=[];
  for(let i=0;i<6;i++){const next=adjacentShot(mixed,current.cameraId,current.time,1);assert.ok(next);forward.push(next);current=next;}
  assert.deepEqual(forward,[{cameraId:'edit',time:0},{cameraId:'edit',time:1.75},{cameraId:'edit',time:4.65},{cameraId:'alternate',time:0},{cameraId:'alternate',time:3},{cameraId:'side',time:0}]);
  assert.equal(adjacentShot(mixed,current.cameraId,current.time,1),undefined);
  const backward=[];
  for(let i=0;i<6;i++){const next=adjacentShot(mixed,current.cameraId,current.time,-1);assert.ok(next);backward.push(next);current=next;}
  assert.deepEqual(backward,[{cameraId:'alternate',time:3},{cameraId:'alternate',time:0},{cameraId:'edit',time:4.65},{cameraId:'edit',time:1.75},{cameraId:'edit',time:0},{cameraId:'wide',time:0}]);
  assert.equal(adjacentShot(mixed,current.cameraId,current.time,-1),undefined);
});
