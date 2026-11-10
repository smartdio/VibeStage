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
   const needsB=['two-shot','over-shoulder','rack-focus','handoff-oner'].includes(id),head=['reaction','pov','over-shoulder','rack-focus'].includes(id);
   const occluder=id==='reveal-slide'?{subject:keys.find(k=>k!==subject&&k!=='@scene'&&!/人物/.test(k))??second}:undefined;
   return createCameraPresetConfig(scene,id,{subject:defaultCameraBinding(scene,subject,head),secondary:needsB?defaultCameraBinding(scene,second,head):undefined,occluder},{},time);
 }
 function start(create:boolean){try{setCreating(create);setRecapture(create);setDraft(create?make('push-in'):structuredClone(current!));setRaw({});setError('');}catch(e){setError((e as Error).message);}}
 function patch(key:keyof CameraPresetParameters,value:CameraPresetParameters[typeof key]){setDraft(d=>d?{...d,parameters:{...d.parameters,[key]:value}}:d);}
 function number(key:keyof CameraPresetParameters,label:string,step=.1){const defaults:Partial<Record<keyof CameraPresetParameters,number>>={endFocalLengthMm:70,rise:3,rollDegrees:0,shakeMeters:.015,shakeDegrees:.35,shakeFrequencyHz:1.4,seed:7,maxSpeedMps:12,maxAngularSpeedDeg:120,clearanceMeters:.15,handoffStartSeconds:scene.durationSeconds*.35,handoffEndSeconds:scene.durationSeconds*.65};const value=(draft!.parameters[key]??defaults[key]??0) as number;return <label key={key}>{label}<input aria-label={`预设${label}`} type="number" step={step} value={raw[key]??Number(value.toFixed(4))} onChange={e=>{const v=e.target.value;setRaw(r=>({...r,[key]:v}));if(v!==''&&Number.isFinite(Number(v)))patch(key,Number(v));}}/></label>;}
 function bind(key:'subject'|'secondary'|'lookTarget'|'focusTarget'|'occluder'|'eventTarget',label:string,optional=false){
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
     <label>镜头类型<select aria-label="镜头预设类型" value={draft.presetId} onChange={e=>{try{setDraft(make(e.target.value as CameraPresetId));setRecapture(true);setRaw({});setError('');}catch(err){setError((err as Error).message);}}}>{['构图','跟拍','运动','光学','编排'].map(group=><optgroup key={group} label={group}>{cameraPresetDefinitions.filter(d=>d.group===group).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}</select></label>
     <p className="preset-purpose">{active.description}</p>
     {bind('subject',draft.presetId==='over-shoulder'?'前景人物 A':'主体 A')}
     {'secondary' in active&&bind('secondary',draft.presetId==='over-shoulder'?'被摄人物 B':'主体 B')}
     {'occluder' in active&&bind('occluder','前景遮挡物')}
     <div className="preset-parameter-group"><h4>镜头与路径</h4><div className="preset-grid">{number('focalLengthMm','焦距（mm）',1)}{number('aperture','光圈 f/',.1)}{draft.presetId!=='flythrough'&&<>{number('distance',draft.presetId==='pov'?'眼位前移（m）':draft.presetId==='top-down'?'顶拍高度（m）':'机位距离（m）')}{draft.presetId!=='top-down'&&number('height','相对高度（m）')}{number('headingDegrees','方位角（°）',1)}{draft.presetId!=='top-down'&&number('sideOffset','侧向偏移（m）')}</>}{['push-in','pull-out','reveal-slide','pedestal','crane-up','crane-down','dolly-zoom','handoff-oner'].includes(draft.presetId)&&number('travel','移动距离（m）')}{['pan','tilt','arc','whip-pan'].includes(draft.presetId)&&number('angleDegrees','转动角度（°）',1)}{['zoom','snap-zoom'].includes(draft.presetId)&&number('endFocalLengthMm','结束焦距（mm）',1)}{['crane-up','crane-down'].includes(draft.presetId)&&number('rise','升降幅度（m）')}{['dutch-angle','flythrough'].includes(draft.presetId)&&number('rollDegrees','横滚角度（°）',1)}</div>
     {draft.presetId==='pedestal'&&<label className="preset-check"><input type="checkbox" checked={draft.parameters.lockOrientation??false} onChange={e=>patch('lockOrientation',e.target.checked)}/>锁定起始朝向</label>}
     {draft.presetId==='orbit-360'&&<label>环绕方向<select aria-label="预设环绕方向" value={draft.parameters.angleDegrees<0?'reverse':'forward'} onChange={e=>patch('angleDegrees',e.target.value==='reverse'?-360:360)}><option value="forward">从南侧向东侧</option><option value="reverse">从南侧向西侧</option></select></label>}
     {draft.presetId==='dolly-zoom'&&<p className="lens-note">正位移向前推进，焦距自动缩短；负位移后退。以主体光轴深度约束画面大小。</p>}
     {['establishing','two-shot'].includes(draft.presetId)&&<label className="preset-check"><input type="checkbox" checked={draft.parameters.fitFrame} onChange={e=>patch('fitFrame',e.target.checked)}/>自动容纳参考边界（距离为下限）</label>}
     {!['subject-mounted','flythrough'].includes(draft.presetId)&&<label>位置与方向<select aria-label="预设坐标框架" value={draft.parameters.frame} onChange={e=>patch('frame',e.target.value as 'world'|'subject')}><option value="world">世界方向 · 0° 朝南</option><option value="subject">主体方向 · 0° 在背后</option></select></label>}
     <p className="lens-note">{draft.presetId==='subject-mounted'?'绑定节点的完整姿态；建议选择胸口，避免头部快速摆动。':draft.presetId==='flythrough'?'路径使用世界坐标；下方控制点决定实际机位位置。':'高度相对锚点；侧移沿机位右侧。跟拍始终跟随主体位置。'}</p></div>
     {draft.presetId==='handheld'&&<div className="preset-parameter-group"><h4>手持质感</h4><div className="preset-grid">{number('shakeMeters','位移幅度（m）',.005)}{number('shakeDegrees','抖动角度（°）',.05)}{number('shakeFrequencyHz','频率（Hz）',.1)}{number('seed','随机种子',1)}</div><p className="lens-note">相同种子和时间得到相同抖动；无需连续播放预热。</p></div>}
     {draft.presetId==='handoff-oner'&&<div className="preset-parameter-group"><h4>连续交接</h4><div className="preset-grid">{number('handoffStartSeconds','交接开始（s）')}{number('handoffEndSeconds','交接结束（s）')}</div>{bind('eventTarget','交接中的事件目标',true)}<p className="lens-note">从 A 连续转向 B；结束后按移动距离拉远。独立观看目标会覆盖交接视线。</p><label className="preset-check"><input type="checkbox" checked={!!draft.path} onChange={e=>{const path=e.target.checked?createCameraPresetConfig(scene,'flythrough',{subject:draft.subject},{},time).path:undefined;setDraft(d=>d?{...d,path}:d);setRaw({});}}/>使用自定义世界路径</label></div>}
     {draft.path&&<div className="preset-parameter-group"><h4>穿行路径 · 世界坐标</h4><p className="lens-note">按顺序经过控制点，自动平滑曲线。X 东、Y 上、Z 南，单位米；相邻点不能重合。</p>
       {draft.path.points.map((point,i)=><div className="preset-path-point" key={i}><div className="preset-path-heading"><span>控制点 {i+1}</span><div><button type="button" aria-label={`在控制点 ${i+1} 后插入`} disabled={draft.path!.points.length>=32} onClick={()=>{setDraft(d=>{if(!d?.path)return d;const points=structuredClone(d.path.points),next=points[i+1];const added=point.map((v,j)=>next?(v+next[j])/2:v+(j===2?-1:0)) as [number,number,number];points.splice(i+1,0,added);return {...d,path:{...d.path,points}};});setRaw({});}}>插入</button><button type="button" aria-label={`删除控制点 ${i+1}`} disabled={draft.path!.points.length<=2} onClick={()=>{setDraft(d=>d?.path?{...d,path:{...d.path,points:d.path.points.filter((_,j)=>i!==j)}}:d);setRaw({});}}>删除</button></div></div>
       <div className="preset-coordinate-grid">{point.map((v,axis)=>{const key=`path-${i}-${axis}`;return <label key={axis}>{['X','Y','Z'][axis]}<input aria-label={`控制点 ${i+1} ${['X','Y','Z'][axis]}`} type="number" step="0.1" value={raw[key]??Number(v.toFixed(4))} onChange={e=>{const value=e.target.value;setRaw(r=>({...r,[key]:value}));if(value!==''&&Number.isFinite(Number(value)))setDraft(d=>{if(!d?.path)return d;const points=structuredClone(d.path.points);points[i][axis]=Number(value);return {...d,path:{...d.path,points}};});}}/></label>;})}</div></div>)}
       {draft.presetId==='flythrough'&&<label>前视／默认对焦距离（m）<input aria-label="路径前视距离" type="number" step="0.1" value={raw.lookAhead??draft.path.lookAheadMeters} onChange={e=>{const value=e.target.value;setRaw(r=>({...r,lookAhead:value}));if(value!==''&&Number.isFinite(Number(value)))setDraft(d=>d?.path?{...d,path:{...d.path,lookAheadMeters:Number(value)}}:d);}}/></label>}
       <div className="preset-grid">{number('maxSpeedMps','速度警戒（m/s）')}{number('maxAngularSpeedDeg','转向警戒（°/s）',1)}{number('clearanceMeters','近物警戒（m）')}</div><p className="lens-note">超限和靠近物体会提示，不会自动改变路径。应用后逐段检查。</p>
     </div>}
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
