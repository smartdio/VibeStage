import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {slug} from './projects';
import {isBuiltinProject,assertWritableProject} from '../lib/core/builtins';
import {emptyCameraEdits,validateCameraEdits} from '../lib/core/camera-edits';
const locks=new Map<string,Promise<unknown>>();
function file(root:string,project:string,scene:string){return path.join(root,'projects',slug(project),'settings',slug(scene)+'.camera.json');}
export async function readCameraSettings(root:string,project:string,scene:string){
  if(isBuiltinProject(project))return {edits:emptyCameraEdits(),revision:'builtin'};
  const target=file(root,project,scene);
  try{const bytes=await fs.readFile(target);const edits:unknown=JSON.parse(bytes.toString());validateCameraEdits(edits);return {edits,revision:createHash('sha256').update(bytes).digest('hex')};}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {edits:emptyCameraEdits(),revision:'missing'};throw e;}
}
export async function saveCameraSettings(root:string,project:string,scene:string,expectedRevision:string,edits:unknown){
  assertWritableProject(project);validateCameraEdits(edits);const target=file(root,project,scene);
  const previous=locks.get(target)??Promise.resolve();
  const pending=previous.catch(()=>{}).then(async()=>{
    await fs.access(path.join(root,'projects',slug(project),'scenes',slug(scene)+'.ts'));
    const current=await readCameraSettings(root,project,scene);if(current.revision!==expectedRevision)throw new Error('摄影机设置已被其他操作修改，请重新加载后再保存');
    await fs.mkdir(path.dirname(target),{recursive:true});const temp=target+'.'+randomUUID()+'.tmp';
    try{await fs.writeFile(temp,JSON.stringify(edits,null,2)+'\n',{flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
    return readCameraSettings(root,project,scene);
  });
  locks.set(target,pending);try{return await pending;}finally{if(locks.get(target)===pending)locks.delete(target);}
}
