import {promises as fs} from 'node:fs';
import path from 'node:path';

async function writeOnce(file:string,text:string){
  try{await fs.writeFile(file,text,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
}

/** Safe on every startup. Never overwrite existing user projects or assets. */
export async function initializeWorkspace(root:string){
  const projects=path.join(root,'projects');
  let fresh=false;
  try{await fs.mkdir(projects);fresh=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  await fs.mkdir(path.join(root,'user-models'),{recursive:true});
  if(fresh){
    const examples=path.join(root,'examples');
    for(const entry of await fs.readdir(examples,{withFileTypes:true})){
      if(entry.isDirectory())await fs.cp(path.join(examples,entry.name),path.join(projects,entry.name),{recursive:true,errorOnExist:true,force:false});
    }
  }
  await writeOnce(path.join(projects,'README.md'),'此目录保存你自己的项目与场景，整体由 Git 忽略。Agent 使用说明见根目录 AGENT_GUIDE.md。新建场景：npm run create-scene -- my-project shot-01 blocking。\n');
  await writeOnce(path.join(projects,'tsconfig.json'),JSON.stringify({extends:'../tsconfig.json',include:['./**/*.ts','./**/*.tsx','../user-models/**/*.ts','../src/assets.d.ts']},null,2)+'\n');
  await writeOnce(path.join(root,'user-models','README.md'),'此目录是你的本地模型库，整体由 Git 忽略。GLB 可直接放入子目录；glTF 请连同 .bin 和纹理保留相对路径。加载方式见根目录 MODEL_GUIDE.md。\n');
  return {seededExamples:fresh,projects:'projects/',models:'user-models/'};
}
