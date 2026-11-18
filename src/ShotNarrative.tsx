import {cutContainsTime} from '../lib/core/cut-time';
import {emptyShotBrief,sceneDeliveryShots,shotFields,type DeliveryDocument,type StageScene} from '@vibestage/core';
import {Fields} from './DeliveryEditor';
import {StoryEditor,StagingEditor} from './StagingEditor';

/** A focused view of the same delivery dossier, never a second copy of its data. */
export function ShotNarrative({scene,camera,time,value,onChange,disabled}:{scene:StageScene;camera:string;time:number;value:DeliveryDocument;onChange:(v:DeliveryDocument)=>void;disabled:boolean}){
 const shots=sceneDeliveryShots(scene,camera),shot=shots.find(s=>cutContainsTime(s,time))??shots.at(-1);
 if(!shot)return null;
 const brief=value.shots[shot.key]??emptyShotBrief();
 const patch=(p:Partial<typeof brief>)=>onChange({...value,shots:{...value.shots,[shot.key]:{...brief,...p}}});
 return <fieldset disabled={disabled} className="shot-narrative" key={shot.key}>
   <p>当前镜头：{shot.label}。与“交付信息”共用同一份档案。</p>
   <StoryEditor document={value} onChange={onChange}/>
   <StagingEditor value={brief.staging} nodes={value.storyNodes??[]} subjects={Object.keys(scene.subjects??{})} duration={shot.end-shot.start} onChange={staging=>patch({staging})}/>
   <Fields labels={Object.fromEntries(Object.entries(shotFields).filter(([key])=>['purpose','content','composition','startState','endState','transition'].includes(key)))} values={brief.details} onChange={(key,text)=>patch({details:{...brief.details,[key]:text}})}/>
 </fieldset>;
}
