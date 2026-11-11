import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referenceOutput} from '../lib/core/reference-output';
test('fast references reduce pixels without changing target settings, frame timing or portrait orientation',()=>{
 const output={width:1920,height:1080,fps:24};
 assert.deepEqual(referenceOutput(output,'video'),{width:640,height:360,fps:24});
 assert.deepEqual(referenceOutput({width:1080,height:1920,fps:60},'delivery'),{width:360,height:640,fps:60});
 assert.deepEqual(output,{width:1920,height:1080,fps:24});
 assert.deepEqual(referenceOutput(output,'still'),output);assert.deepEqual(referenceOutput(output,'sequence'),output);
 assert.deepEqual(referenceOutput({width:320,height:180,fps:12},'video'),{width:320,height:180,fps:12});
 const arbitrary=referenceOutput({width:1000,height:666,fps:25},'delivery');assert.equal(arbitrary.width%2,0);assert.equal(arbitrary.height%2,0);assert.equal(arbitrary.fps,25);
});
