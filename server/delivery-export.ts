import {referenceOutput,fastReferenceRendering} from '../lib/core/reference-output';
import {resolveShotPrompts,promptSourceSignature} from '../lib/core/prompts';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {writeFrameJSON} from './frame-json';
import {streamZip} from './stream-zip';
import {deliveryShots,deliveryIssues,validateDelivery,filmFields,contextFields,shotFields,captureFields,actorFields,lightFields,beatFields,type DeliveryDocument} from '../lib/core/delivery';
import {validateDeliveryWorld} from '../lib/core/delivery-sampling';
import type {CameraCut,CameraFrame} from '../lib/core/cameras';
export interface DeliveryExportSpec {camera:string;duration:number;fps:number;width:number;height:number;sourceHash:string;cameraPlan?:CameraCut[];delivery?:DeliveryDocument;subjectIds?:string[]}
export function assertDeliveryExport(spec:DeliveryExportSpec){
  validateDelivery(spec.delivery);
  if(!Array.isArray(spec.subjectIds)||spec.subjectIds.some(x=>typeof x!=='string'))throw new Error('缺少场景对象 ID');
  const shots=deliveryShots(spec.camera,spec.duration,spec.cameraPlan),issues=deliveryIssues(spec.delivery,shots,spec.subjectIds);
  for(const shot of shots)for(const [kind,prompt] of Object.entries(spec.delivery.shots[shot.key]?.prompts??{}))if(!prompt.text.trim()||prompt.sourceSignature!==promptSourceSignature(spec.delivery,shot,spec))issues.push({path:shot.key,message:`${shot.label}的${kind==='image'?'生图':'视频'}提示词为空或已过期，请重新生成或复核`});
  for(const shot of shots)if(Math.ceil(shot.end*spec.fps-1e-8)<=Math.ceil(shot.start*spec.fps-1e-8))issues.push({path:shot.key,message:`${shot.label}短于可采样帧，请调整切点或帧率`});
  if(issues.length)throw new Error(`完整交付未通过：${issues.slice(0,5).map(i=>i.message).join('；')}（共 ${issues.length} 项）`);
}
const pretty=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
function prose(values:Record<string,unknown>,labels:Record<string,string>){return Object.entries(labels).map(([k,l])=>`### ${l}\n\n${values[k]}\n`).join('\n');}
const labels={...filmFields,...contextFields,...shotFields,...captureFields,capture:'摄影机与成像介质设计',...actorFields,...lightFields,...beatFields};
function readable(value:unknown,depth=2):string {
  if(value===null||value===undefined)return '没有\n';
  if(typeof value!=='object')return ({none:'没有',pending:'未填写',present:'有'}[String(value)]??String(value))+'\n';
  if(Array.isArray(value))return value.length?value.map((v,i)=>`${'#'.repeat(Math.min(depth,6))} ${i+1}\n\n${readable(v,depth+1)}`).join('\n'):'没有\n';
  return Object.entries(value).map(([k,v])=>`${'#'.repeat(Math.min(depth,6))} ${(labels as Record<string,string>)[k]??k}\n\n${readable(v,depth+1)}`).join('\n');
}
/** Build only from the frozen export document and exact rendered samples. */
export async function writeDeliveryPackage(dir:string,spec:DeliveryExportSpec,frames:CameraFrame[],encode:(args:string[])=>Promise<void>,cancelled:()=>boolean,onProgress:(done:number,total:number)=>void=()=>{}){
  assertDeliveryExport(spec);const selectedShots=deliveryShots(spec.camera,spec.duration,spec.cameraPlan);
  const doc={...spec.delivery!,shots:Object.fromEntries(selectedShots.map(shot=>[shot.key,spec.delivery!.shots[shot.key]]))};
  if(frames.length!==Math.ceil(spec.duration*spec.fps-1e-8))throw new Error('交付帧数不完整');
  frames.forEach(f=>validateDeliveryWorld(f.world));
  const staging=path.join(dir,'delivery-files');await fs.mkdir(staging,{recursive:true});
  const files:Record<string,string>={};
  const add=async(name:string,body:string)=>{if(cancelled())throw new Error('导出已取消');const file=path.join(staging,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,body);files[name]=file;};
  const put=async(name:string,value:unknown)=>add(name,pretty(value));

  await add('film.md',`# 影片与场景说明\n\n${prose(doc.film,filmFields)}\n${prose(doc.context,contextFields)}`);
  const output={width:spec.width,height:spec.height,fps:spec.fps,durationSeconds:spec.duration};
  const common={referenceOutput:referenceOutput(spec,'delivery'),referenceRendering:fastReferenceRendering,schemaVersion:1,sourceHash:spec.sourceHash,film:doc.film,sceneContext:doc.context,output,units:{position:'米，世界坐标；北 -Z、东 +X、Y 向上',time:'秒；timeline 为成片时间、local 为镜头内时间',quaternion:'xyzw',lightIntensity:'Three.js 原始强度值，单位依光源类型而定；不推断 lux 或色温',lightAngle:'实际 angle 为弧度；设计角度按字段注明参照系'},interpretation:'design 是最终画面要求，actual 是白模实测。没有实现的神态、服装、色彩等不得宣称已在白模中实现。缺少光学元数据时保留 FOV，不推断焦距或光圈。'};
  const index=[];
  for(const [i,shot] of selectedShots.entries()){
    if(cancelled())throw new Error('导出已取消');
    const prefix=`shots/${String(i+1).padStart(3,'0')}`,b=doc.shots[shot.key],sampled=frames.filter(f=>f.timeSeconds>=shot.start&&f.timeSeconds<shot.end);
    if(!sampled.length)throw new Error(`${shot.label}没有渲染帧`);
    const first=sampled[0],last=sampled.at(-1)!;
    const prompts=resolveShotPrompts(doc,shot,output,first.camera);doc.shots[shot.key]={...b,prompts};
    await add(`${prefix}/image-prompt.txt`,prompts.image.text);await add(`${prefix}/video-prompt.txt`,prompts.video.text);await put(`${prefix}/prompts.json`,prompts);
    const requested=[{time:shot.start,reason:'起始状态'},...b.beats.items.map((beat,n)=>({time:shot.start+beat.time,reason:`动作节点 ${n+1}`})),{time:shot.end,reason:'结束状态（最后可渲染帧）'}];
    const keyframes=[];
    for(const [n,request] of requested.entries()){
      const f=sampled.reduce((a,c)=>Math.abs(c.timeSeconds-request.time)<Math.abs(a.timeSeconds-request.time)?c:a,first);
      const name=`keyframe-${String(n+1).padStart(3,'0')}.png`;
      files[`${prefix}/${name}`]=path.join(dir,'frames',String(f.frame).padStart(6,'0')+'.png');
      keyframes.push({image:name,reason:request.reason,requestedTimelineSeconds:request.time,timelineSeconds:f.timeSeconds,localSeconds:f.timeSeconds-shot.start,frame:f.frame,actual:{camera:f.camera,world:f.world},designNode:b.beats.items.find(beat=>Math.abs(shot.start+beat.time-request.time)<1e-8)??null});
    }
    const image={...common,shot,promptFile:'image-prompt.txt',design:{capture:b.capture,details:b.details,actors:b.actors,lights:b.lights},keyframes,note:'每张图按所标时间理解。designNode 是该关键节点的设计要求，实测画面时间可能按帧率取近邻；没有 designNode 时以起止状态和镜头说明为依据，不臆测中间表情。'};
    const video={...common,shot,promptFile:'video-prompt.txt',design:b,referenceVideo:'reference.mp4',referenceTimeline:{startSeconds:first.timeSeconds,endSeconds:(last.frame+1)/spec.fps,frameCount:sampled.length,durationSeconds:sampled.length/spec.fps},actualFrames:sampled,keyframeFiles:keyframes.map(k=>k.image)};
    await put(`${prefix}/image.json`,image);const {actualFrames,...videoHeader}=video;const videoPath=path.join(staging,prefix,'video.json');await writeFrameJSON(videoPath,videoHeader,'actualFrames',actualFrames,cancelled);files[`${prefix}/video.json`]=videoPath;
    await add(`${prefix}/image.md`,`# ${shot.label} · 生图资料\n\n${readable(image)}`);
    await add(`${prefix}/video.md`,`# ${shot.label} · 视频资料\n\n${readable({...video,actualFrames:'逐帧摄影机、灯光与对象参数见同目录 video.json。'})}`);
    const clip=path.join(dir,`shot-${i+1}.mp4`);
    await encode(['-i',path.join(dir,'reference.mp4'),'-ss',String(first.timeSeconds),'-t',String(sampled.length/spec.fps),'-c:v','libx264','-pix_fmt','yuv420p','-preset','ultrafast','-crf','28','-c:a','aac','-movflags','+faststart',clip]);files[`${prefix}/reference.mp4`]=clip;
    index.push({key:shot.key,label:shot.label,start:shot.start,end:shot.end,image:`${prefix}/image.json`,video:`${prefix}/video.json`,reference:`${prefix}/reference.mp4`,imagePrompt:`${prefix}/image-prompt.txt`,videoPrompt:`${prefix}/video-prompt.txt`});
  }
  if(cancelled())throw new Error('导出已取消');
  await put('delivery.json',doc);
  await put('index.json',{...common,shots:index});
  await add('README.md','# 导演完整交付包\n\nfilm.md 为影片理念和场景上下文。index.json 按成片顺序关联各镜头。\n\n每个 shots/序号 目录包含 image-prompt.txt（生图提示词）、video-prompt.txt（视频提示词）、prompts.json（版本依据）、image.md / image.json（生图资料）、video.md / video.json（动态过程）、关键帧白模 PNG 和该镜头白模 reference.mp4。根目录 reference.mp4 是整片白模；cameras.json 是整片逐帧摄影记录；source.zip 是本地复现快照，包含私人模型，不是公开发行包。\n\n参考视频与包内关键帧使用长边不超过 640 像素的快速白模渲染，不应用景深、对焦模糊或阴影。output 是最终影片目标，referenceOutput 是参考文件尺寸；摄影参数中的景深配置仅作设计记录，不表示参考视频呈现该效果。静态资料区分设计要求与实测参数。动作节点时间相对镜头起点；实际图像与片段按输出帧率采样，精确时间见 JSON。明示没有的列表以 state: none、空 items 保存；未填写资料无法生成此包。\n');
  for(const name of ['reference.mp4','cameras.json','source.zip'])files[name]=path.join(dir,name);
  await put('manifest.json',{version:1,status:'complete',sourceHash:spec.sourceHash,output,referenceOutput:referenceOutput(spec,'delivery'),referenceRendering:fastReferenceRendering,shots:index,files:Object.keys(files).concat('manifest.json')});
  await streamZip(path.join(dir,'delivery.zip'),files,cancelled,onProgress);
  await fs.rm(staging,{recursive:true,force:true});
  await Promise.all(selectedShots.map((_,i)=>fs.rm(path.join(dir,`shot-${i+1}.mp4`),{force:true})));
}
