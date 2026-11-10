import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {initializeWorkspace} from '../server/workspace';
import {sourceSnapshot} from '../server/projects';

async function fixture(){
  const root=await mkdtemp(path.join(os.tmpdir(),'vibestage-workspace-'));
  await cp('examples',path.join(root,'examples'),{recursive:true});
  await cp('docs',path.join(root,'docs'),{recursive:true});
  for(const file of ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','AGENTS.md','AGENT_GUIDE.md','MODEL_GUIDE.md','LICENSE','THIRD_PARTY_NOTICES.md'])await cp(file,path.join(root,file));
  return root;
}
test('fresh setup creates private directories from public examples; reruns preserve edits and deletions',async()=>{
  const root=await fixture();try{
    const first=await initializeWorkspace(root);assert.equal(first.seededExamples,true);
    const scene=path.join(root,'projects/demo/scenes/meeting.ts');assert.match(await readFile(scene,'utf8'),/createScene/);
    await writeFile(scene,'// user-edited scene\n');
    const model=path.join(root,'user-models/private.glb');await writeFile(model,'private asset');
    const second=await initializeWorkspace(root);assert.equal(second.seededExamples,false);
    assert.equal(await readFile(scene,'utf8'),'// user-edited scene\n');assert.equal(await readFile(model,'utf8'),'private asset');
    await rm(path.join(root,'projects/demo'),{recursive:true});await initializeWorkspace(root);
    assert.equal(await stat(scene).catch(()=>null),null);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('ordinary Git add stages framework and examples but excludes both private directories and outputs',async()=>{
  const root=await fixture();try{
    await initializeWorkspace(root);
    for(const dir of ['exports','artifacts']){await mkdir(path.join(root,dir));await writeFile(path.join(root,dir,'private.txt'),'private');}
    await writeFile(path.join(root,'user-models','secret.glb'),'private');
    execFileSync('git',['init','--quiet',root]);execFileSync('git',['-C',root,'add','.']);
    const tracked=execFileSync('git',['-C',root,'ls-files'],{encoding:'utf8'}).split('\n');
    assert.ok(tracked.includes('examples/demo/scenes/meeting.ts'));
    assert.ok(tracked.includes('AGENTS.md'));
    assert.ok(!tracked.some(f=>/^(projects|user-models|exports|artifacts)\//.test(f)));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('project export includes private model sidecars and excludes unrelated projects; preview hashes are scoped',async()=>{
  const root=await fixture();try{
    await initializeWorkspace(root);await mkdir(path.join(root,'projects/other/scenes'),{recursive:true});
    await writeFile(path.join(root,'projects/other/scenes/private.ts'),'private project');
    await mkdir(path.join(root,'user-models/chair'),{recursive:true});
    await writeFile(path.join(root,'user-models/chair/model.gltf'),'{}');
    await writeFile(path.join(root,'user-models/chair/model.bin'),'binary-sidecar');
    const preview=await sourceSnapshot(root,{project:'demo'});assert.deepEqual(preview.files,{});
    const snapshot=await sourceSnapshot(root,{project:'demo',includeFiles:true});assert.equal(snapshot.hash,preview.hash);
    assert.ok(snapshot.files['projects/demo/scenes/meeting.ts']);assert.ok(snapshot.files['user-models/chair/model.bin']);
    for(const file of ['docs/USER_GUIDE.md','docs/LICENSING.md','docs/images/workbench.png']){
      assert.deepEqual(Buffer.from(snapshot.files[file]),await readFile(path.join(root,file)));
    }
    assert.equal(Buffer.from(snapshot.files['LICENSE']).toString(),await readFile(path.join(root,'LICENSE'),'utf8'));
    assert.equal(Buffer.from(snapshot.files['THIRD_PARTY_NOTICES.md']).toString(),await readFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8'));
    assert.ok(!Object.keys(snapshot.files).some(f=>f.startsWith('projects/other/')));
    await writeFile(path.join(root,'projects/other/scenes/private.ts'),'changed unrelated project');
    assert.equal((await sourceSnapshot(root,{project:'demo'})).hash,preview.hash);
    await writeFile(path.join(root,'user-models/chair/model.bin'),'updated-model');
    assert.notEqual((await sourceSnapshot(root,{project:'demo'})).hash,preview.hash);
  }finally{await rm(root,{recursive:true,force:true});}
});
