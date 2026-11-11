import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {slug} from './projects';
import {assertWritableProject,isBuiltinProject} from '../lib/core/builtins';
import {emptyDelivery,validateDelivery,type DeliveryDocument} from '../lib/core/delivery';
interface ProjectDelivery {version:1;film:DeliveryDocument['film'];scenes:Record<string,Pick<DeliveryDocument,'context'|'shots'>>}
const locks=new Map<string,Promise<unknown>>();
const location=(root:string,project:string)=>path.join(root,'projects',slug(project),'delivery.json');
async function readProject(root:string,project:string){
  try{const bytes=await fs.readFile(location(root,project));const data=JSON.parse(bytes.toString()) as ProjectDelivery;
    if(data.version!==1||!data.scenes||typeof data.scenes!=='object'||Array.isArray(data.scenes))throw new Error('项目交付格式无效');
    validateDelivery({...emptyDelivery(),film:data.film});
    for(const scene of Object.values(data.scenes))validateDelivery({version:1,film:data.film,...scene});
    return {data,revision:createHash('sha256').update(bytes).digest('hex')};
  }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {data:null,revision:'missing'};throw e;}
}
export async function readDeliverySettings(root:string,project:string,scene:string){
  slug(scene);if(isBuiltinProject(project))return {film:null,document:null,revision:'builtin'};
  const {data,revision}=await readProject(root,project);
  return {film:data?.film??null,document:data?.scenes[scene]?{version:1 as const,film:data.film,...data.scenes[scene]}:null,revision};
}
export async function saveDeliverySettings(root:string,project:string,scene:string,revision:string,document:unknown){
  assertWritableProject(project);slug(scene);validateDelivery(document);const target=location(root,project),previous=locks.get(target)??Promise.resolve();
  const pending=previous.catch(()=>{}).then(async()=>{
    await fs.access(path.join(root,'projects',slug(project),'scenes',scene+'.ts'));
    const current=await readProject(root,project);if(current.revision!==revision)throw new Error('交付资料已被其他操作修改，请保留草稿并重新加载后再保存');
    const data:ProjectDelivery={version:1,film:document.film,scenes:{...current.data?.scenes,[scene]:{context:document.context,shots:document.shots}}};
    const temp=target+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
    return readDeliverySettings(root,project,scene);
  });locks.set(target,pending);try{return await pending;}finally{if(locks.get(target)===pending)locks.delete(target);}
}
