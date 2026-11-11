import {describeCameraMotion} from './camera-motion-description';
import {filmFields,contextFields,shotFields,captureFields,actorFields,lightFields,beatFields,type DeliveryDocument,type DeliveryShot} from './delivery';
import type {CameraSnapshot} from './cameras';
import type {OutputSettings} from './types';
export type PromptKind='image'|'video';
export interface PromptDraft {text:string;sourceSignature:string;technicalSignature:string}
export type ShotPrompts=Partial<Record<PromptKind,PromptDraft>>;
export const PROMPT_LIMIT=500000;
function stable(value:unknown):string {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';return JSON.stringify(value)??'null';}
function signature(value:unknown){const text=stable(value);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `prompt-v1:${a>>>0}:${b>>>0}:${text.length}`;}
export function promptSourceSignature(doc:DeliveryDocument,shot:DeliveryShot,output:OutputSettings){const b=doc.shots[shot.key];return signature({generatorVersion:4,film:doc.film,context:doc.context,shot,output:{width:output.width,height:output.height,fps:output.fps},brief:b?{capture:b.capture,details:b.details,actors:b.actors,lights:b.lights,beats:b.beats}:null});}
// Browser and Node transcendental math can differ in the last floating-point bits.
// Retain 12 significant digits so numerical noise cannot invalidate the same shot.
export function promptTechnicalSignature(camera:CameraSnapshot){return signature(JSON.parse(JSON.stringify(camera,(_key,value)=>typeof value==='number'&&Number.isFinite(value)?Number(value.toPrecision(12)):value)));}
const lines=(values:Record<string,unknown>,labels:Record<string,string>,omit:string[]=[])=>Object.entries(labels).filter(([k])=>!omit.includes(k)).map(([k,label])=>`${label}：${String(values[k]??'').trim()||'【未填写】'}。`).join('\n');
export function generateShotPrompt(doc:DeliveryDocument,shot:DeliveryShot,output:OutputSettings,camera:CameraSnapshot,kind:PromptKind):PromptDraft {
  const b=doc.shots[shot.key];if(!b)throw new Error('请先建立镜头交付档案');
  const image=kind==='image';const list=(name:string,state:string,items:Record<string,unknown>[],labels:Record<string,string>,omit:string[]=[])=>`${name}：${state==='none'?'没有':state==='pending'?'【未填写】':items.map((item,i)=>`\n${name} ${i+1}\n${lines(item,labels,omit)}`).join('\n')}`;
  const cameraText=[`输出尺寸 ${output.width} × ${output.height}，画幅比 ${output.width}:${output.height}。`,!image?`视频时长 ${shot.end-shot.start} 秒，${output.fps} fps。`:'',`参考机位：${shot.cameraId}，投影 ${camera.projection}。`,camera.focalLengthMm!==undefined?`焦距 ${camera.focalLengthMm} mm。`:`焦距未配置；垂直视场角 ${camera.verticalFovDegrees??'不适用'} 度。`,camera.sensor?`传感器 ${camera.sensor.widthMm} × ${camera.sensor.heightMm} mm。`:'',camera.aperture!==undefined?`光圈 f/${camera.aperture}。`:'光圈未配置，不推断。',camera.focus?`对焦距离 ${camera.focus.planeDistanceMeters??camera.focus.distanceMeters} 米。`:'对焦距离未配置，不推断。',`机位世界坐标 ${camera.positionMeters.join(', ')} 米；朝向四元数 xyzw ${camera.quaternion.join(', ')}。`].filter(Boolean).join('\n');
  const parts=[image?`生成镜头“${shot.label}”的一张首帧画面。只表现起始瞬间，不生成拼贴、分镜格或连续动作序列。`:`生成镜头“${shot.label}”的视频，严格遵循以下时序与连续性。`,
    '影片上下文\n'+lines(doc.film,filmFields),'场景上下文\n'+lines(doc.context,contextFields),
    '摄影机与成像介质设计（最终画面要求；不代表白模已模拟机身、胶片或冲洗效果）\n'+lines(b.capture??{},captureFields),
    '镜头设计\n'+lines(b.details,shotFields,image?['endState','transition','sound']:[]),
    list('人物',b.actors.state,b.actors.items,actorFields,image?['action','interaction','reaction']:[]),
    list('光源',b.lights.state,b.lights.items,lightFields,image?['change']:[]),
    image?'起始动作与互动参考（仅取起始状态，不把全过程叠加进一张图）\n'+(b.actors.state==='none'?'没有':b.actors.items.map(a=>`${a.subjectId}：${a.action}；交互：${a.interaction}；反应：${a.reaction}`).join('\n')):
      '动作时间线（秒数相对本镜头起点）\n'+(b.beats.state==='none'?'没有额外动作节点，遵循起止状态与人物动作描述。':b.beats.items.map(beat=>`${beat.time} 秒：\n${lines(beat,beatFields)}`).join('\n')),
    image&&b.beats.items.some(beat=>beat.time===0)?'0 秒节点\n'+lines(b.beats.items.find(beat=>beat.time===0)!,beatFields):'',
    '白模摄影参考参数（镜头首个实际采样帧）\n'+cameraText,
    (image?'单帧摄影机约束\n':'摄影机动作与节奏（根据白模实际预设）\n')+describeCameraMotion(camera,shot,image),
    image?'以同目录 keyframe-001.png 约束构图、透视、人物与道具位置；美术、色彩和神态按上述设计实现。':'以同目录 reference.mp4 约束空间、动作节奏与运镜，结合关键帧保持角色、服装、道具、光线与镜头衔接一致；动态技术参数见 video.json。',
    '白模是空间与动作参考，不将白模外观当成最终材质；未实现的设计按文字要求实现。没有的信息不擅自添加；设计要求与参考不一致时按明确的最终设计执行。'];
  const text=parts.filter(Boolean).join('\n\n');if(text.length>PROMPT_LIMIT)throw new Error('生成的提示词过长，请精简交付说明');
  return {text,sourceSignature:promptSourceSignature(doc,shot,output),technicalSignature:promptTechnicalSignature(camera)};
}
export function resolveShotPrompts(doc:DeliveryDocument,shot:DeliveryShot,output:OutputSettings,camera:CameraSnapshot):Record<PromptKind,PromptDraft>{
  return Object.fromEntries((['image','video'] as const).map(kind=>{const saved=doc.shots[shot.key]?.prompts?.[kind];if(saved){if(!saved.text.trim())throw new Error(`${shot.label}的${kind==='image'?'生图':'视频'}提示词为空`);if(saved.sourceSignature!==promptSourceSignature(doc,shot,output)||saved.technicalSignature!==promptTechnicalSignature(camera))throw new Error(`${shot.label}的${kind==='image'?'生图':'视频'}提示词已过期，请重新生成或复核后保存`);}return [kind,saved??generateShotPrompt(doc,shot,output,camera,kind)];})) as Record<PromptKind,PromptDraft>;
}
