import {PROMPT_LIMIT} from './prompts';
import type {CameraCut} from './cameras';
import type {StageScene} from './types';

/** Empty = pending; 没有 = an explicit author decision. Never fill missing values automatically. */
export const filmFields = {concept:'影片理念',story:'故事背景与前因后果',relationships:'人物关系',style:'视觉风格',palette:'整体色彩',continuity:'全片连续性约束',exclusions:'禁止出现的内容'};
export const contextFields = {context:'场景上下文',before:'前情',after:'后续',constraints:'场景约束'};
export const shotFields = {purpose:'叙事目的',content:'画面内容',emotion:'观众感受',composition:'构图与空间关系',startState:'起始状态',endState:'结束状态',transition:'前后镜头衔接',palette:'主色与辅助色',skin:'肤色倾向',saturation:'饱和度',contrast:'对比度',grade:'调色方向',environment:'环境与道具',cameraIntent:'摄影与运镜设计要求',constraints:'必须保持的内容',exclusions:'禁止出现的内容',sound:'对白、声音与节奏'};
export const captureFields = {cameraBody:'摄影机品牌与机型',recordingMedium:'记录介质（数字／胶片／混合）',captureFormat:'传感器或胶片画幅与有效成像区域',lensModel:'镜头品牌、型号与光学特征',filters:'滤镜与扩散镜',sensitivity:'感光度 ISO／EI 与曝光意图',shutter:'快门角度或快门时间',whiteBalance:'白平衡与色温偏移',digitalRecording:'数字记录格式、编码与色彩空间',filmStock:'胶片／胶卷品牌、系列与型号',filmFormat:'胶片规格与胶卷／片盒要求',filmProcessing:'冲洗、增感减感与扫描要求',imageTexture:'颗粒、晕光与成像质感'};
export type CaptureBrief = TextFields<typeof captureFields>;
export const actorFields = {subjectId:'人物 ID（对应 subjects）',appearance:'身份、外形与服装',expression:'神态与情绪',gaze:'视线',pose:'姿态',action:'动作',interaction:'交互对象与行为',reaction:'对方反应'};
export const lightFields = {id:'光源 ID',type:'光源类型',role:'用途',position:'位置（米及参照系）',target:'照射目标',azimuth:'方位角（度；无方向写不适用）',elevation:'俯仰角（度；无方向写不适用）',reference:'角度参照系',color:'颜色或色温',intensity:'强度及单位',softness:'软硬程度',shadow:'阴影',change:'随时间变化'};
export const beatFields = {action:'人物动作与交互过程',expression:'神态与视线变化',environment:'环境与道具变化',lighting:'光线变化',camera:'运镜与焦点变化'};
export type TextFields<T> = {[K in keyof T]:string};
export type ActorBrief = TextFields<typeof actorFields>;
export type LightBrief = TextFields<typeof lightFields>;
export type ActionBeat = TextFields<typeof beatFields> & {time:number};
export type DeclaredList<T> = {state:'pending'|'none'|'present';items:T[]};
export interface ShotBrief {/** Optional only for loading legacy drafts; required for complete delivery. */ capture?:CaptureBrief;prompts?:import('./prompts').ShotPrompts;reviewedSignature:string; details:TextFields<typeof shotFields>;actors:DeclaredList<ActorBrief>;lights:DeclaredList<LightBrief>;beats:DeclaredList<ActionBeat>}
export interface DeliveryDocument {version:1;film:TextFields<typeof filmFields>;context:TextFields<typeof contextFields>;shots:Record<string,ShotBrief>}
export interface DeliveryShot {key:string;sequenceId:string;id:string;label:string;cameraId:string;start:number;end:number;signature:string}
export interface DeliveryIssue {path:string;message:string}
export function blankFields<T extends Record<string,string>>(fields:T):TextFields<T>{return Object.fromEntries(Object.keys(fields).map(k=>[k,''])) as TextFields<T>;}
export function emptyDelivery():DeliveryDocument {return {version:1,film:blankFields(filmFields),context:blankFields(contextFields),shots:{}};}
export function emptyShotBrief():ShotBrief {return {capture:blankFields(captureFields),reviewedSignature:'',details:blankFields(shotFields),actors:{state:'pending',items:[]},lights:{state:'pending',items:[]},beats:{state:'pending',items:[]}};}
// Non-security fingerprint for review invalidation (two independent 32-bit accumulators).
function reviewSignature(text:string){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `v1:${(a>>>0).toString(16)}:${(b>>>0).toString(16)}:${text.length}`;}
export function deliveryShots(camera:string,duration:number,cuts?:CameraCut[]):DeliveryShot[]{
  const plan=cuts?.length?cuts:[{id:camera,cameraId:camera,start:0,end:duration}];
  // A continuing shot inherits earlier independent performances and their timing.
  let previous='';
  return plan.map(c=>{previous=reviewSignature(JSON.stringify([previous,camera,c.id,c.cameraId,c.start,c.end,c.performance??null]));return {key:JSON.stringify([camera,c.id]),sequenceId:camera,id:c.id,label:c.label||c.id,cameraId:c.cameraId,start:c.start,end:c.end,signature:previous};});
}
export function sceneDeliveryShots(scene:StageScene,camera:string){return deliveryShots(camera,scene.durationSeconds,scene.cameraCuts?.[camera]);}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fieldsValid(value:unknown,fields:Record<string,string>){return object(value)&&Object.keys(value).every(k=>k in fields)&&Object.keys(fields).every(k=>typeof value[k]==='string'&&(value[k] as string).length<=12000);}
/** Structural validation accepts unfinished drafts; completeness validation is separate. */
export function validateDelivery(value:unknown):asserts value is DeliveryDocument {
  if(!object(value)||value.version!==1||!fieldsValid(value.film,filmFields)||!fieldsValid(value.context,contextFields)||!object(value.shots)||Object.keys(value.shots).length>1800)throw new Error('交付资料格式无效');
  for(const [key,raw] of Object.entries(value.shots)){
    if(key.length>600||!object(raw)||typeof raw.reviewedSignature!=='string'||raw.reviewedSignature.length>20000||!fieldsValid(raw.details,shotFields))throw new Error('镜头交付格式无效');
    if(raw.capture!==undefined&&!fieldsValid(raw.capture,captureFields))throw new Error('摄影机与成像介质格式无效');
    if(raw.prompts!==undefined){
      if(!object(raw.prompts)||Object.keys(raw.prompts).some(k=>!['image','video'].includes(k)))throw new Error('提示词格式无效');
      for(const p of Object.values(raw.prompts))if(!object(p)||typeof p.text!=='string'||p.text.length>PROMPT_LIMIT||typeof p.sourceSignature!=='string'||p.sourceSignature.length>200||typeof p.technicalSignature!=='string'||p.technicalSignature.length>200)throw new Error('提示词字段无效');
    }
    for(const [name,fields] of [['actors',actorFields],['lights',lightFields],['beats',beatFields]] as const){
      const list=raw[name];if(!object(list)||!['pending','none','present'].includes(String(list.state))||!Array.isArray(list.items)||list.items.length>100||list.state!=='present'&&list.items.length)throw new Error('交付列表状态无效');
      for(const item of list.items){if(!object(item))throw new Error('交付列表条目无效');const {time,...rest}=item;
        if(name==='beats'?(!Number.isFinite(time)||!fieldsValid(rest,fields)):!fieldsValid(item,fields))throw new Error('交付列表字段无效');
      }
    }
  }
}
export function deliveryIssues(doc:DeliveryDocument,shots:DeliveryShot[],subjects?:string[]):DeliveryIssue[]{
  const issues:DeliveryIssue[]=[];
  const add=(path:string,message:string)=>issues.push({path,message});
  function required(values:Record<string,string>,fields:Record<string,string>,path:string,essential:string[]=[]){for(const [key,label] of Object.entries(fields)){if(!values[key]?.trim())add(`${path}.${key}`,`${label}未填写`);else if(essential.includes(key)&&['没有','不适用'].includes(values[key].trim()))add(`${path}.${key}`,`${label}必须有具体内容`);}}
  required(doc.film,filmFields,'film',['concept','story','style']);required(doc.context,contextFields,'context',['context']);
  for(const shot of shots){const p=`shots.${shot.key}`,b=doc.shots[shot.key];if(!b){add(p,`${shot.label}尚无交付档案`);continue;}
    required(b.capture??{},captureFields,p+'.capture');
    required(b.details,shotFields,p+'.details',['purpose','content','composition','startState','endState']);
    if(b.reviewedSignature!==shot.signature)add(p,`${shot.label}的切点、机位或表演尚未复核`);
    for(const name of ['actors','lights','beats'] as const){const list=b[name];if(list.state==='pending'||list.state==='present'&&!list.items.length)add(`${p}.${name}`,`${{actors:'人物',lights:'光源',beats:'动作过程'}[name]}需填写或明确选择没有`);}
    const ids=new Set<string>();b.actors.items.forEach((a,i)=>{required(a,actorFields,`${p}.actors.${i}`,['subjectId','appearance']);if(ids.has(a.subjectId))add(`${p}.actors.${i}`,'人物 ID 重复');ids.add(a.subjectId);if(subjects&&!subjects.includes(a.subjectId))add(`${p}.actors.${i}`,'人物 ID 不在场景 subjects 中');});
    const lights=new Set<string>();b.lights.items.forEach((l,i)=>{required(l,lightFields,`${p}.lights.${i}`,['id','type','role']);if(lights.has(l.id))add(`${p}.lights.${i}`,'光源 ID 重复');lights.add(l.id);});
    let previous=-1;b.beats.items.forEach((b,i)=>{const {time:_,...text}=b;required(text,beatFields,`${p}.beats.${i}`);if(b.time<0||b.time>shot.end-shot.start||b.time<=previous)add(`${p}.beats.${i}`,'动作节点必须递增，且位于镜头内（秒）');previous=b.time;});
  }
  return issues;
}
