import {createSceneFiles} from '../server/projects';
const [project,scene,template='empty']=process.argv.slice(2);
if(!project||!scene){console.error('用法：npm run create-scene -- <project> <scene> [empty|room|blocking]');process.exit(1);}
try{console.log(await createSceneFiles(process.cwd(),{project,scene,template}));}catch(error){console.error((error as Error).message);process.exit(1);}
