import {CutPerformanceEditor} from './CutPerformanceEditor';
import {CameraPresetEditor} from './CameraPresetEditor';
import {useCallback,useEffect,useState} from 'react';
import {Euler,Quaternion,MathUtils} from 'three';
import {FULL_FRAME,focalLengthFromFov,type CameraEdit,type CameraEdits,type CameraSnapshot,type StageScene} from '@vibestage/core';

type Props={onPilot:()=>void;scene:StageScene;info:CameraSnapshot;edits:CameraEdits;time:number;selected:string;disabled:boolean;dirty:boolean;saving:boolean;error:string;onApply:(edits:CameraEdits)=>void;onSave:()=>void;onDiscard:()=>void;onSelect:(id:string)=>void;onSeek:(t:number)=>void;captureView:()=>CameraEdit};
const round=(n:number)=>Number(n.toFixed(3));
function unique(prefix:string,used:string[]){let n=1;while(used.includes(`${prefix}_${n}`))n++;return `${prefix}_${n}`;}
function fromSnapshot(info:CameraSnapshot):CameraEdit{
 const e=new Euler().setFromQuaternion(new Quaternion(...info.quaternion as [number,number,number,number]),'YXZ');
 return {label:info.label,focalLengthMm:info.focalLengthMm??focalLengthFromFov(info.verticalFovDegrees??40,FULL_FRAME,info.outputAspect),sensor:info.sensor??{...FULL_FRAME},aperture:info.aperture??4,focusDistanceMeters:(info.focus?.planeDistanceMeters??info.focus?.distanceMeters)||5,position:info.positionMeters.map(round) as [number,number,number],rotationDegrees:[e.x,e.y,e.z].map(v=>round(MathUtils.radToDeg(v))) as [number,number,number],shotSize:info.shotSize??'',movement:info.movement??'固定机位'};
}
export function CameraEditor(props:Props){
 const {scene,info,edits,disabled,dirty,saving,error,onApply,onSelect,onSeek}=props;
 const [open,setOpen]=useState(false),[invalid,setInvalid]=useState(false),[localError,setLocalError]=useState(''),[reset,setReset]=useState(0);
 const [performanceInvalid,setPerformanceInvalid]=useState<Record<string,boolean>>({});
 const reportPerformanceInvalid=useCallback((id:string,bad:boolean)=>setPerformanceInvalid(previous=>previous[id]===bad?previous:{...previous,[id]:bad}),[]);
 const hasInvalid=invalid||Object.values(performanceInvalid).some(Boolean);
 const seqIds=Object.keys(scene.cameraCuts??{}),seqId=seqIds.includes(props.selected)?props.selected:seqIds[0];
 const cuts=scene.cameraCuts?.[seqId];
 const physical=Object.entries(scene.cameras).filter(([id,c])=>!scene.cameraCuts?.[id]&&(c as {isPerspectiveCamera?:boolean}).isPerspectiveCamera);
 function apply(next:CameraEdits){try{onApply(next);setLocalError('');return true;}catch(e){setLocalError((e as Error).message);return false;}}
 function addCamera(){const next=structuredClone(edits),id=unique('camera',Object.keys(scene.cameras));next.cameras[id]={...fromSnapshot(info),created:true,label:'手动机位 '+id.split('_')[1]};if(apply(next)){onSelect(id);setOpen(true);}}
 function newSequence(){const next=structuredClone(edits),id=unique('sequence',Object.keys(scene.cameras));next.sequences[id]=[{id:'shot_1',label:'镜头 1',cameraId:info.cameraId,start:0,end:scene.durationSeconds}];if(apply(next))onSelect(id);}
 function addCut(){if(!cuts)return;const next=structuredClone(edits),list=structuredClone(cuts);let index=list.findIndex(c=>props.time>=c.start&&props.time<c.end);if(index<0)index=list.length-1;const current=list[index];const at=props.time>current.start+.01&&props.time<current.end-.01?props.time:(current.start+current.end)/2;
   const id=unique('shot',list.map(c=>c.id));list.splice(index,1,{...current,end:at},{id,label:'新镜头',cameraId:info.cameraId,start:at,end:current.end});next.sequences[seqId]=list;if(apply(next)){onSelect(seqId);onSeek(at);}}
 return <section className="camera-editor" aria-label="手动摄影机编辑">
   <CameraPresetEditor key={info.cameraId} scene={scene} info={info} edits={edits} time={props.time} disabled={disabled} onApply={onApply} onSelect={onSelect}/>
   <div className="camera-edit-actions"><button className="primary" disabled={disabled||!!info.preset||info.projection!=='perspective'} title={info.preset?'运动机位请调整预设参数，或复制为固定机位后操控':undefined} onClick={props.onPilot}>操控机位</button><button disabled={disabled||!!info.preset||info.projection!=='perspective'} onClick={()=>{onSeek(props.time);setOpen(!open);}}>{open?'收起调节':'调节当前机位'}</button><button disabled={disabled||info.projection!=='perspective'} onClick={addCamera}>{info.preset?'复制为固定机位':'新建机位'}</button></div>
   {edits.cameras[info.cameraId]?.created&&<button className="delete-manual-camera" disabled={disabled} onClick={()=>{if(Object.values(scene.cameraCuts??{}).some(cuts=>cuts.some(c=>c.cameraId===info.cameraId))){setLocalError('该机位仍被分镜引用，请先更换对应片段的机位。');return;}const next=structuredClone(edits);delete next.cameras[info.cameraId];apply(next);}}>删除自建机位</button>}
   {open&&!info.preset&&<LensForm key={info.cameraId+':'+reset} info={info} edit={edits.cameras[info.cameraId]} disabled={disabled} onInvalid={setInvalid} onPatch={patch=>{const next=structuredClone(edits);next.cameras[info.cameraId]={...next.cameras[info.cameraId],...patch};apply(next);}} onClearField={field=>{const next=structuredClone(edits);if(next.cameras[info.cameraId])delete next.cameras[info.cameraId][field];apply(next);setReset(n=>n+1);}} onView={()=>{const next=structuredClone(edits);next.cameras[info.cameraId]={...next.cameras[info.cameraId],...props.captureView(),movement:'固定机位 · 手动设置'};if(apply(next))setReset(n=>n+1);}} onReset={()=>{const next=structuredClone(edits);if(next.cameras[info.cameraId]?.created){setLocalError('新增机位没有场景初始值，可用“放弃未保存”撤回本次新增。');return;}delete next.cameras[info.cameraId];if(apply(next))setReset(n=>n+1);}}/>}
   <details className="sequence-editor"><summary>编辑分镜{cuts?` · ${cuts.length} 段`:''}</summary>
     {seqIds.length>0&&<label>分镜组<select aria-label="编辑分镜组" value={seqId} disabled={disabled} onChange={e=>onSelect(e.target.value)}>{seqIds.map(id=><option key={id} value={id}>{scene.cameras[id].name||id}</option>)}</select></label>}
     {cuts?.map((c,i)=><div className="cut-editor" key={seqId+':'+c.id}>
       <div className="cut-editor-heading"><button disabled={disabled} onClick={()=>{onSelect(seqId);onSeek(c.start);}}>{i+1}. {c.label||c.id}</button><button aria-label={`删除分镜 ${i+1}`} disabled={disabled||cuts.length===1} onClick={()=>{const list=structuredClone(cuts);if(i===0)list[1].start=0;else list[i-1].end=c.end;list.splice(i,1);const next=structuredClone(edits);next.sequences[seqId]=list;apply(next);}}>删除</button></div>
       <label>片段名称<input aria-label={`分镜 ${i+1} 名称`} value={c.label??c.id} maxLength={300} disabled={disabled} onChange={e=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,label:e.target.value}:cut);apply(next);}}/></label>
       <label>机位<select aria-label={`分镜 ${i+1} 机位`} value={c.cameraId} disabled={disabled} onChange={e=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,cameraId:e.target.value}:cut);apply(next);}}>{physical.map(([id,cam])=><option key={id} value={id}>{scene.cameraMetadata?.[id]?.label||cam.name||id}</option>)}</select></label>
       <div className="cut-time"><span>开始 {round(c.start)} s</span><label>结束（s）<input key={c.id+':'+c.end} aria-label={`分镜 ${i+1} 结束时间`} type="number" step="0.01" defaultValue={round(c.end)} disabled={disabled||i===cuts.length-1} onBlur={e=>{const end=Number(e.target.value);if(!e.target.value||!Number.isFinite(end)||end<=c.start||end>=cuts[i+1].end){setLocalError('切点必须在相邻两个片段的范围内');e.target.value=String(c.end);return;}const list=structuredClone(cuts);list[i].end=end;list[i+1].start=end;const next=structuredClone(edits);next.sequences[seqId]=list;apply(next);}}/></label></div>
       <CutPerformanceEditor key={c.id+':'+reset} onInvalid={reportPerformanceInvalid} cut={c} index={i} scene={scene} disabled={disabled} onStart={()=>{onSelect(seqId);onSeek(c.start);}} onPatch={performance=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,performance}:cut);const success=apply(next);if(success){onSelect(seqId);onSeek(c.start);}return success;}}/>
     </div>)}
     <div className="sequence-actions">{edits.sequences[seqId]&&<button disabled={disabled} onClick={()=>{const next=structuredClone(edits);delete next.sequences[seqId];apply(next);}}>撤销此组手动设置</button>}{cuts&&<button disabled={disabled} onClick={addCut}>在播放头处分镜</button>}<button disabled={disabled||info.projection!=='perspective'} onClick={newSequence}>新建分镜组</button></div>
     <p className="lens-note">添加时拆分当前片段；播放头在边界时取片段中点。删除后相邻片段接续，整体时长保持不变。每段可延续表演，也可独立指定动作与摆位。</p>
   </details>
   {(error||localError||hasInvalid)&&<p className="camera-edit-error" role="alert">{error||localError||(hasInvalid?'请修正标出的数值后再保存':'')}</p>}
   <div className="camera-save"><span>{dirty?'有未保存修改':'已与项目同步'}</span><button className="primary" disabled={disabled||!dirty||hasInvalid||!!localError} onClick={props.onSave}>{saving?'保存中…':'保存到项目'}</button><button disabled={disabled||!dirty} onClick={()=>{props.onDiscard();setLocalError('');setReset(n=>n+1);}}>放弃未保存</button></div>
   <p className="lens-note">手动设置优先于场景代码，保存后刷新仍保留。光圈与对焦实时影响镜头景深。</p>
 </section>;
}
function LensForm({info,edit,disabled,onPatch,onInvalid,onView,onReset,onClearField}:{info:CameraSnapshot;edit?:CameraEdit;disabled:boolean;onPatch:(patch:CameraEdit)=>void;onInvalid:(bad:boolean)=>void;onView:()=>void;onReset:()=>void;onClearField:(field:keyof CameraEdit)=>void}){
 const initial=fromSnapshot(info);const [fields,setFields]=useState<Record<string,string>>({}),[bad,setBad]=useState<Record<string,boolean>>({});
 useEffect(()=>{onInvalid(Object.values(bad).some(Boolean));return()=>onInvalid(false);},[bad,onInvalid]);
 function input(key:string,label:string,value:number,patch:(n:number)=>CameraEdit,positive=false,step=.1){return <label key={key}>{label}<input aria-label={label} type="number" step={step} min={positive ? 0.001 : undefined} value={fields[key]??round(value)} disabled={disabled} onChange={e=>{const raw=e.target.value,n=Number(raw),invalid=raw===''||!Number.isFinite(n)||positive&&n<=0;setFields(f=>({...f,[key]:raw}));setBad(b=>({...b,[key]:invalid}));if(!invalid)onPatch(patch(n));}}/></label>;}
 const position=edit?.position??initial.position!,rotation=edit?.rotationDegrees??initial.rotationDegrees!,sensor=edit?.sensor??initial.sensor!;
 return <div className="lens-form">
   <p className="edit-target">正在调节：{info.label}</p>
   <label>机位名称<input aria-label="机位名称" defaultValue={info.label} maxLength={300} disabled={disabled} onChange={e=>onPatch({label:e.target.value})}/></label>
   <div className="lens-input-grid">{input('focal','焦距（mm）',edit?.focalLengthMm??initial.focalLengthMm!,n=>({focalLengthMm:n}),true,1)}{input('aperture','光圈 f/',edit?.aperture??initial.aperture!,n=>({aperture:n}),true,.1)}{input('sw','传感器宽（mm）',sensor.widthMm,n=>({sensor:{...sensor,widthMm:n}}),true)}{input('sh','传感器高（mm）',sensor.heightMm,n=>({sensor:{...sensor,heightMm:n}}),true)}</div>
   <label>对焦方式<select aria-label="对焦方式" disabled={disabled} value={edit?.focusDistanceMeters!==undefined?'manual':'scene'} onChange={e=>e.target.value==='scene'?onClearField('focusDistanceMeters'):onPatch({focusDistanceMeters:(info.focus?.planeDistanceMeters??info.focus?.distanceMeters)||5})}><option value="scene">沿用场景对焦</option><option value="manual">手动距离</option></select></label>
   {edit?.focusDistanceMeters!==undefined&&input('focus','对焦距离（m）',edit.focusDistanceMeters,n=>({focusDistanceMeters:n}),true)}
   <fieldset disabled={disabled}><legend>位置 · 世界坐标（m）</legend><div className="pose-input-grid">{(['X','Y','Z'] as const).map((axis,i)=>input('p'+axis,`位置 ${axis}`,position[i],n=>{const v=[...position] as [number,number,number];v[i]=n;return {position:v};}))}</div></fieldset>
   <fieldset disabled={disabled}><legend>朝向（°）· 俯仰 / 水平 / 横滚</legend><div className="pose-input-grid">{(['X','Y','Z'] as const).map((axis,i)=>input('r'+axis,`角度 ${axis}`,rotation[i],n=>{const v=[...rotation] as [number,number,number];v[i]=n;return {rotationDegrees:v};},false,1))}</div></fieldset>
   <div className="camera-edit-actions"><button disabled={disabled} onClick={onView}>采用自由观察视角</button><button disabled={disabled||edit?.created} onClick={onReset}>恢复代码设置</button></div>
   <p className="lens-note">先在“自由观察”中拖动构图，再采用该视角；也可输入位置和角度微调。手动位置与朝向会覆盖该机位的代码运动。</p>
 </div>;
}
