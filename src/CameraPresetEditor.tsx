import {useState} from 'react';
import {Clapperboard,Plus,ArrowRight,Check,X} from 'lucide-react';
import {cameraPresetDefinitions,createCameraPresetConfig,defaultCameraBinding,listCameraSubjects,presetDefinition,resolveCameraBinding,validateCameraPreset,type CameraBinding,type CameraEdits,type CameraPresetConfig,type CameraPresetId,type CameraPresetParameters,type CameraSnapshot,type StageScene} from '@vibestage/core';

type Props={scene:StageScene;info:CameraSnapshot;edits:CameraEdits;time:number;disabled:boolean;onApply:(edits:CameraEdits)=>void;onSelect:(id:string)=>void};
export function CameraPresetEditor({scene,info,edits,time,disabled,onApply,onSelect}:Props){
 const current=edits.cameras[info.cameraId]?.preset??scene.cameraPresets?.[info.cameraId];
 const [draft,setDraft]=useState<CameraPresetConfig|null>(null),[creating,setCreating]=useState(false),[error,setError]=useState(''),[raw,setRaw]=useState<Record<string,string>>({}),[recapture,setRecapture]=useState(false);
 const subjects=listCameraSubjects(scene),keys=subjects.map(([key])=>key),first=keys.find(k=>k!=='@scene')??keys[0]??'@scene';
 const active=draft?presetDefinition(draft.presetId):undefined;
 function make(id:CameraPresetId){
   const previous=draft?.subject.subject,subject=id==='establishing'?'@scene':previous&&previous!=='@scene'?previous:first;
   const second=keys.find(k=>k!==subject&&k!=='@scene')??subject;
   const needsB=['two-shot','over-shoulder','rack-focus'].includes(id),head=['reaction','pov','over-shoulder','rack-focus'].includes(id);
   const occluder=id==='reveal-slide'?{subject:keys.find(k=>k!==subject&&k!=='@scene'&&!/人物/.test(k))??second}:undefined;
   return createCameraPresetConfig(scene,id,{subject:defaultCameraBinding(scene,subject,head),secondary:needsB?defaultCameraBinding(scene,second,head):undefined,occluder},{},time);
 }
 function start(create:boolean){try{setCreating(create);setRecapture(create);setDraft(create?make('push-in'):structuredClone(current!));setRaw({});setError('');}catch(e){setError((e as Error).message);}}
 function patch(key:keyof CameraPresetParameters,value:CameraPresetParameters[typeof key]){setDraft(d=>d?{...d,parameters:{...d.parameters,[key]:value}}:d);}
 function number(key:keyof CameraPresetParameters,label:string,step=.1){const value=draft!.parameters[key] as number;return <label key={key}>{label}<input aria-label={`预设${label}`} type="number" step={step} value={raw[key]??Number(value.toFixed(4))} onChange={e=>{const v=e.target.value;setRaw(r=>({...r,[key]:v}));if(v!==''&&Number.isFinite(Number(v)))patch(key,Number(v));}}/></label>;}
 function bind(key:'subject'|'secondary'|'lookTarget'|'focusTarget'|'occluder',label:string,optional=false){
   const binding=draft![key];let anchors:string[]=[];
   if(binding){try{const root=resolveCameraBinding(scene,{subject:binding.subject}).root,names:string[]=[];root.traverse(o=>{if(o.name)names.push(o.name);});anchors=names.filter((n,i)=>names.indexOf(n)===i&&names.lastIndexOf(n)===i);}catch{}}
   function change(value:CameraBinding|undefined){if(key==='subject'||key==='secondary')setRecapture(true);setDraft(d=>d?{...d,[key]:value}:d);}
   return <div className="preset-binding"><label>{label}<select aria-label={`预设${label}`} value={binding?.subject??''} onChange={e=>change(e.target.value?defaultCameraBinding(scene,e.target.value,['reaction','pov','over-shoulder','rack-focus'].includes(draft!.presetId)):undefined)}>{optional&&<option value="">沿用预设</option>}{binding&&!keys.includes(binding.subject)&&<option value={binding.subject}>{binding.subject}（当前绑定）</option>}{subjects.map(([id])=><option key={id} value={id}>{id==='@scene'?'整个场景':id}</option>)}</select></label>{binding&&<label>锚点<select aria-label={`预设${label}锚点`} value={binding.anchor??''} onChange={e=>change({...binding,anchor:e.target.value||undefined})}><option value="">包围盒中心</option>{anchors.map(a=><option key={a} value={a}>{a}</option>)}</select></label>}</div>;
 }
 let invalid='';if(draft){try{validateCameraPreset(draft);if(draft.parameters.endSeconds>scene.durationSeconds)invalid='结束时间不能超过场景时长';if(Object.values(raw).some(x=>x===''||!Number.isFinite(Number(x))))invalid='请补全有效数值';}catch(e){invalid=(e as Error).message;}}
 function refreshReference(config:CameraPresetConfig){const refreshed=createCameraPresetConfig(scene,config.presetId,{subject:config.subject,secondary:config.secondary,occluder:config.occluder},config.parameters,time);return {...config,reference:refreshed.reference};}
 function apply(){if(!draft||invalid)return;try{
   const next=structuredClone(edits);let id=info.cameraId;
   if(creating){let i=1;while(scene.cameras[`preset_${i}`])i++;id=`preset_${i}`;}
   const config=recapture?refreshReference(draft):structuredClone(draft),old=next.cameras[id]??{};
   const {position:_p,rotationDegrees:_r,focusDistanceMeters:_f,focalLengthMm:_l,aperture:_a,sensor:_s,...rest}=old;
   next.cameras[id]={...rest,created:creating?true:old.created,preset:config,label:creating?presetDefinition(config.presetId).name:old.label};
   onApply(next);onSelect(id);setDraft(null);setError('');
 }catch(e){setError((e as Error).message);}}
 return <section className="preset-editor" aria-label="电影镜头预设">
   <div className="preset-heading"><Clapperboard size={16}/><strong>电影镜头预设</strong><span>{cameraPresetDefinitions.length} 种</span></div>
   {current&&<div className="preset-active"><span>{presetDefinition(current.presetId).name}</span><small>{current.parameters.startSeconds}–{current.parameters.endSeconds} s</small></div>}
   {!draft&&<div className="preset-actions">{current&&<button disabled={disabled} onClick={()=>start(false)}>调整预设</button>}<button disabled={disabled} onClick={()=>start(true)}><Plus size={14}/>从预设新建</button></div>}
   {draft&&active&&<fieldset className="preset-form" disabled={disabled}>
     <label>镜头类型<select aria-label="镜头预设类型" value={draft.presetId} onChange={e=>{try{setDraft(make(e.target.value as CameraPresetId));setRecapture(true);setRaw({});setError('');}catch(err){setError((err as Error).message);}}}>{['构图','跟拍','运动','光学'].map(group=><optgroup key={group} label={group}>{cameraPresetDefinitions.filter(d=>d.group===group).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}</select></label>
     <p className="preset-purpose">{active.description}</p>
     {bind('subject',draft.presetId==='over-shoulder'?'前景人物 A':'主体 A')}
     {'secondary' in active&&bind('secondary',draft.presetId==='over-shoulder'?'被摄人物 B':'主体 B')}
     {'occluder' in active&&bind('occluder','前景遮挡物')}
     <div className="preset-parameter-group"><h4>镜头与路径</h4><div className="preset-grid">{number('focalLengthMm','焦距（mm）',1)}{number('aperture','光圈 f/',.1)}{number('distance',draft.presetId==='pov'?'眼位前移（m）':'机位距离（m）')}{number('height','相对高度（m）')}{number('headingDegrees','方位角（°）',1)}{number('sideOffset','侧向偏移（m）')}{['push-in','pull-out','reveal-slide'].includes(draft.presetId)&&number('travel','移动距离（m）')}{['pan','tilt','arc'].includes(draft.presetId)&&number('angleDegrees','转动角度（°）',1)}</div>
     {['establishing','two-shot'].includes(draft.presetId)&&<label className="preset-check"><input type="checkbox" checked={draft.parameters.fitFrame} onChange={e=>patch('fitFrame',e.target.checked)}/>自动容纳参考边界（距离为下限）</label>}
     <label>位置与方向<select aria-label="预设坐标框架" value={draft.parameters.frame} onChange={e=>patch('frame',e.target.value as 'world'|'subject')}><option value="world">世界方向 · 0° 朝南</option><option value="subject">主体方向 · 0° 在背后</option></select></label>
     <p className="lens-note">高度相对锚点；侧移沿机位右侧。跟拍始终跟随主体位置，方向由上方选项决定。</p></div>
     <details className="preset-advanced"><summary>时间与节奏</summary><div className="preset-grid">{number('startSeconds','开始（s）')}{number('endSeconds','结束（s）')}{number('holdStartSeconds','起始停留（s）')}{number('holdEndSeconds','结束停留（s）')}</div><label>速度曲线<select aria-label="预设速度曲线" value={draft.parameters.easing} onChange={e=>patch('easing',e.target.value as 'smooth'|'linear')}><option value="smooth">平滑起停</option><option value="linear">匀速进度</option></select></label></details>
     <details className="preset-advanced"><summary>独立观看与对焦目标</summary>{bind('lookTarget','观看目标',true)}{draft.presetId!=='rack-focus'?bind('focusTarget','对焦目标',true):<p className="lens-note">拉焦始终从 A 的焦平面移向 B。</p>}</details>
     <label className="preset-check"><input type="checkbox" checked={recapture} onChange={e=>setRecapture(e.target.checked)}/>以当前 {time.toFixed(2)} s 重新建立构图参考</label><p className="lens-note">未勾选时保留原构图参考。应用后播放或拖动时间轴检查运动。</p>
     {(invalid||error)&&<p role="alert" className="camera-edit-error">{invalid||error}</p>}
     <div className="preset-actions"><button className="primary" disabled={!!invalid} onClick={apply}><Check size={14}/>{creating?'新建预设机位':'应用预设参数'}</button><button onClick={()=>{setDraft(null);setError('');}}><X size={14}/>取消</button></div>
   </fieldset>}
   {!draft&&error&&<p role="alert" className="camera-edit-error">{error}</p>}
   {info.preset?.warnings.map(w=><p className="preset-warning" key={w}>{w}</p>)}
   {!draft&&<p className="lens-note"><ArrowRight size={12}/>选择镜头、绑定主体，再调节参数。应用后需保存到项目。</p>}
 </section>;
}
