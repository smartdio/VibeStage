import {CAMERA_SCHOOL} from '../lib/core/builtins';
export type SceneSelection={project:string;scene:string};
/** Resume a valid choice; otherwise start with the installed learning sample. */
export function initialScene(projects:{id:string;scenes:{id:string}[]}[],saved?:SceneSelection|null):SceneSelection|undefined {
 const available=projects.flatMap(p=>p.scenes.map(s=>({project:p.id,scene:s.id})));
 return available.find(s=>s.project===saved?.project&&s.scene===saved?.scene)
  ??available.find(s=>s.project===CAMERA_SCHOOL.id&&s.scene===CAMERA_SCHOOL.scene)
  ??available.find(s=>s.project==='demo'&&s.scene==='meeting')
  ??available[0];
}
