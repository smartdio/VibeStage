import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const templates=['empty','room','blocking'] as const;
export function slug(value:unknown):string { if(typeof value!=='string'||!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(value))throw new Error('目录名须为 1–48 位小写英文、数字、横线或下划线');return value; }
export async function createSceneFiles(root:string,input:{project:string;scene:string;template:string;projectName?:string}){
  const project=slug(input.project),scene=slug(input.scene);
  if(!templates.includes(input.template as typeof templates[number]))throw new Error('未知模板');
  const folder=path.join(root,'projects',project);await fs.mkdir(path.join(folder,'scenes'),{recursive:true});
  try{await fs.writeFile(path.join(folder,'project.json'),JSON.stringify({name:input.projectName?.slice(0,100)||project},null,2)+'\n',{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  const source=await fs.readFile(path.join(root,'templates',input.template+'.ts'),'utf8');
  await fs.writeFile(path.join(folder,'scenes',scene+'.ts'),source,{flag:'wx'});
  return {project,scene,path:`projects/${project}/scenes/${scene}.ts`};
}
export async function listProjects(root:string){
  const result=[];for(const dir of await fs.readdir(path.join(root,'projects'),{withFileTypes:true})){
    if(!dir.isDirectory()||!dir.name.match(/^[a-z0-9][a-z0-9_-]{0,47}$/))continue;
    let meta:{name?:string}={};try{meta=JSON.parse(await fs.readFile(path.join(root,'projects',dir.name,'project.json'),'utf8'));}catch{/* metadata is optional */}
    const files=await fs.readdir(path.join(root,'projects',dir.name,'scenes')).catch(()=>[] as string[]);
    result.push({id:dir.name,name:meta.name||dir.name,scenes:files.filter(s=>/^[a-z0-9][a-z0-9_-]{0,47}\.ts$/.test(s)).sort().map(s=>({id:s.slice(0,-3),path:`projects/${dir.name}/scenes/${s}`}))});
  }return result;
}
const digestCache = new Map<string, {stamp:string; digest:string}>();
const publicFolders = ['examples','lib','templates','src','server','scripts','tests'];
const publicFiles = ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','AGENTS.md','AGENT_GUIDE.md','MODEL_GUIDE.md','LICENSE','THIRD_PARTY_NOTICES.md'];

/** Hash without buffering large assets for preview; freeze bytes only when exporting. */
export async function sourceSnapshot(root:string,options:{project?:string;includeFiles?:boolean}={}){
  const paths:string[]=[];
  async function walk(relative:string){
    let entries;try{entries=await fs.readdir(path.join(root,relative),{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
    for(const item of entries){
      if(['node_modules','.git','exports','.DS_Store'].includes(item.name)||item.name==='.env'||item.name.startsWith('.env.'))continue;
      if(item.isSymbolicLink())throw new Error('源快照不接受符号链接：'+relative+'/'+item.name);
      const key=relative+'/'+item.name;if(item.isDirectory())await walk(key);else paths.push(key);
    }
  }
  for(const folder of publicFolders)await walk(folder);
  if(options.project){await walk('projects/'+slug(options.project));for(const name of ['README.md','tsconfig.json']){
    const key='projects/'+name;if(await fs.stat(path.join(root,key)).catch(()=>null))paths.push(key);
  }}else await walk('projects');
  // All private models are included for arbitrary code references and glTF sidecar files.
  await walk('user-models');
  paths.push(...publicFiles);
  const files:Record<string,Uint8Array>={},hash=createHash('sha256');let total=0;
  for(const key of paths.sort()){
    const absolute=path.join(root,key),before=await fs.stat(absolute);
    const stamp=[before.size,before.mtimeMs,before.ctimeMs].join(':');let digest:string;
    if(options.includeFiles){
      total+=before.size;
      if(total>256*1024*1024)throw new Error('源码快照超过 256 MB，请将暂不用的模型移出 user-models 后再导出');
      const bytes=await fs.readFile(absolute);files[key]=bytes;digest=createHash('sha256').update(bytes).digest('hex');
    }else{
      const cached=digestCache.get(absolute);
      if(cached?.stamp===stamp)digest=cached.digest;
      else{const fileHash=createHash('sha256');for await(const chunk of createReadStream(absolute))fileHash.update(chunk);digest=fileHash.digest('hex');}
    }
    const after=await fs.stat(absolute);
    if(stamp!==[after.size,after.mtimeMs,after.ctimeMs].join(':'))throw new Error('读取时文件发生变化，请重新加载：'+key);
    digestCache.set(absolute,{stamp,digest});hash.update(key);hash.update('\0');hash.update(digest);hash.update('\0');
  }
  return {hash:hash.digest('hex'),files};
}
