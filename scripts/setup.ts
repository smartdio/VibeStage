import {initializeWorkspace} from '../server/workspace';
try{const result=await initializeWorkspace(process.cwd());console.log(`本地工作区就绪：${result.projects}、${result.models}${result.seededExamples?'；已复制公开示例':''}`);}
catch(e){console.error((e as Error).message);process.exit(1);}
