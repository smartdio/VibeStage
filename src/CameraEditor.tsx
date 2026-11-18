import {Aperture,Route,Users,BookOpen} from 'lucide-react';
import {cutContainsTime} from '../lib/core/cut-time';
import {FramingTimingSelect,type TimingProps} from './FramingTiming';
import {applyControlledCamera,copyCameraForShot} from './camera-workspace';
import {CutPerformanceEditor} from './CutPerformanceEditor';
import {CameraPresetEditor} from './CameraPresetEditor';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Euler,Quaternion,MathUtils} from 'three';
import {FULL_FRAME,focalLengthFromFov,type CameraEdit,type CameraEdits,type CameraSnapshot,type StageScene} from '@vibestage/core';

type Props=TimingProps & {onPresetPending:(pending:boolean)=>void;onPlaybackPreparation:(prepare:(()=>boolean)|undefined)=>void;feedback:string;presetRequest?:{cameraId:string;serial:number};section:EditorSection;onSection:(s:EditorSection)=>void;narrative:ReactNode;onPause:()=>void;deliveryDirty:boolean;scene:StageScene;info:CameraSnapshot;edits:CameraEdits;time:number;selected:string;disabled:boolean;dirty:boolean;saving:boolean;error:string;onApply:(edits:CameraEdits)=>void;onSave:()=>void;onDiscard:()=>void;onSelect:(id:string)=>void;onSeek:(t:number)=>void;captureView:()=>CameraEdit};
export type EditorSection='closed'|'camera'|'motion'|'performance'|'story';
const round=(n:number)=>Number(n.toFixed(3));
function unique(prefix:string,used:string[]){let n=1;while(used.includes(`${prefix}_${n}`))n++;return `${prefix}_${n}`;}
function fromSnapshot(info:CameraSnapshot):CameraEdit{
 const e=new Euler().setFromQuaternion(new Quaternion(...info.quaternion as [number,number,number,number]),'YXZ');
 return {label:info.label,focalLengthMm:info.focalLengthMm??focalLengthFromFov(info.verticalFovDegrees??40,FULL_FRAME,info.outputAspect),sensor:info.sensor??{...FULL_FRAME},aperture:info.aperture??4,focusDistanceMeters:(info.focus?.planeDistanceMeters??info.focus?.distanceMeters)||5,position:[...info.positionMeters] as [number,number,number],rotationDegrees:[e.x,e.y,e.z].map(MathUtils.radToDeg) as [number,number,number],shotSize:info.shotSize??'',movement:info.movement??'固定机位'};
}
export function CameraEditor(props:Props){
 const {scene,info,edits,disabled,dirty,saving,error,onApply,onSelect,onSeek}=props;
 const [open,setOpen]=useState(true),[invalid,setInvalid]=useState(false),[localError,setLocalError]=useState(''),[reset,setReset]=useState(0);
 const [scope,setScope]=useState<'shot'|'shared'>('shot');
 const [presetScope,setPresetScope]=useState<'shot'|'shared'>('shot');
 // Sharing is an explicit choice within one editing entry, not a workspace preference.
 useLayoutEffect(()=>{if(props.section!=='camera'||disabled)setScope('shot');},[props.section,disabled]);
 const localCamera=useRef(info.cameraId);
 useEffect(()=>{if(localCamera.current!==info.cameraId){setReset(n=>n+1);setScope('shot');setPresetScope('shot');localCamera.current=info.cameraId;}},[info.cameraId]);
 const [performanceInvalid,setPerformanceInvalid]=useState<Record<string,boolean>>({});
 const reportPerformanceInvalid=useCallback((id:string,bad:boolean)=>setPerformanceInvalid(previous=>previous[id]===bad?previous:{...previous,[id]:bad}),[]);
 const hasInvalid=invalid||Object.values(performanceInvalid).some(Boolean);
 const presetPreparation=useRef<(()=>boolean)|undefined>(undefined);
 const [presetPending,setPresetPending]=useState(false);
 const registerPresetPreparation=useCallback((prepare:(()=>boolean)|undefined)=>{presetPreparation.current=prepare;setPresetPending(!!prepare);props.onPresetPending(!!prepare);},[props.onPresetPending]);
 const playbackInvalid=useRef(hasInvalid);playbackInvalid.current=hasInvalid;
 useLayoutEffect(()=>{props.onPlaybackPreparation(()=>!playbackInvalid.current&&(presetPreparation.current?.()??true));return()=>props.onPlaybackPreparation(undefined);},[props.onPlaybackPreparation]);
 const seqId=props.selected;
 const cuts=scene.cameraCuts?.[seqId];
 const activeIndex=cuts?.findIndex(c=>cutContainsTime(c,props.time))??-1;
 const index=activeIndex<0?(cuts?.length??1)-1:activeIndex;
 const shared=Object.values(scene.cameraCuts??{}).flat().filter(c=>c.cameraId===info.cameraId).length;
 const protectedCamera=cuts?shared>1:shared>0;
 function isolate(){if(!cuts)return;const preset=edits.cameras[info.cameraId]?.preset??scene.cameraPresets?.[info.cameraId];if(!preset){const result=applyControlledCamera(scene,edits,seqId,props.time,info.cameraId,{},fromSnapshot(info));if(apply(result.edits)){onSelect(result.selection);onSeek(props.time);}return;}const next=structuredClone(edits),id=unique('camera',Object.keys(scene.cameras));next.cameras[id]={...structuredClone(edits.cameras[info.cameraId]??{}),preset:structuredClone(preset),focalLengthMm:info.focalLengthMm,aperture:info.aperture,sensor:info.sensor,created:true,label:(cuts[index].label||cuts[index].id)+' · 独立机位'};next.sequences[seqId]=cuts.map((c,i)=>i===index?{...c,cameraId:id}:c);if(apply(next)){onSelect(seqId);onSeek(props.time);}}
 const physical=Object.entries(scene.cameras).filter(([id,c])=>!scene.cameraCuts?.[id]&&(c as {isPerspectiveCamera?:boolean}).isPerspectiveCamera);
 function apply(next:CameraEdits){try{onApply(next);setLocalError('');return true;}catch(e){setLocalError((e as Error).message);return false;}}
 function patchCamera(patch:CameraEdit){
   const framing={...fromSnapshot(info),...edits.cameras[info.cameraId]};
   // A local edit must not invent aperture/focus for legacy cameras.
   if(info.aperture===undefined)delete framing.aperture;
   if(!info.focus)delete framing.focusDistanceMeters;
   const result=applyControlledCamera(scene,edits,seqId,props.time,info.cameraId,patch,framing,scope,props.timing,info.outputAspect);
   // Keep the active input mounted when its first edit detaches a shared camera.
   const previous=localCamera.current;localCamera.current=result.cameraId;
   if(!apply(result.edits))localCamera.current=previous;
   else if(result.selection!==seqId)onSelect(result.selection);
 }
 function addCamera(){try{const copy=copyCameraForShot(scene,edits,seqId,props.time,fromSnapshot(info));if(apply(copy.edits)){onSelect(copy.selection);onSeek(props.time);setOpen(true);}}catch(e){setLocalError((e as Error).message);}}
 function newSequence(){const next=structuredClone(edits),id=unique('sequence',Object.keys(scene.cameras));next.sequences[id]=[{id:'shot_1',label:'镜头 1',cameraId:info.cameraId,start:0,end:scene.durationSeconds}];if(apply(next))onSelect(id);}
 function addCut(){if(!cuts)return;const next=structuredClone(edits),list=structuredClone(cuts);let index=list.findIndex(c=>cutContainsTime(c,props.time));if(index<0)index=list.length-1;const current=list[index];const at=props.time>current.start+.01&&props.time<current.end-.01?props.time:(current.start+current.end)/2;
   const id=unique('shot',list.map(c=>c.id));list.splice(index,1,{...current,end:at},{id,label:'新镜头',cameraId:info.cameraId,start:at,end:current.end});next.sequences[seqId]=list;if(apply(next)){onSelect(seqId);onSeek(at);props.onSection('camera');}}
 return <section className="shot-workbench camera-editor" aria-label="当前镜头工作区" onFocusCapture={e=>{if(!e.target.closest('.shot-editor-tabs'))props.onPause();}}>
   <div className="shot-editor-toolbar"><div className="shot-editor-tabs">{([['camera','构图与机位',Aperture],['motion','运镜',Route],['performance','表演与摆位',Users],['story','叙事与衔接',BookOpen]] as const).map(([id,label,Icon])=><button key={id} aria-expanded={props.section===id} className={props.section===id?'active':''} onClick={()=>props.onSection(props.section===id?'closed':id)}><Icon size={15}/>{label}</button>)}</div><div className="shot-editor-actions">{cuts&&<button disabled={disabled||presetPending} onClick={addCut}>分割镜头</button>}<button disabled={disabled||presetPending||info.projection!=='perspective'} onClick={newSequence}>新建分镜组</button></div></div>
   <div className="shot-editor-body" hidden={props.section==='closed'}>
<div className="sequence-editor" hidden={props.section!=='camera'&&props.section!=='performance'}>
     {cuts?.map((c,i)=>i!==index?null:<div className="cut-editor" key={seqId+':'+c.id}>
       <div hidden={props.section!=='camera'}><div className="cut-editor-heading"><button disabled={disabled||presetPending} onClick={()=>{onSelect(seqId);onSeek(c.start);}}>{i+1}. {c.label||c.id}</button><button aria-label={`删除分镜 ${i+1}`} disabled={disabled||presetPending||cuts.length===1} onClick={()=>{const list=structuredClone(cuts);if(i===0)list[1].start=0;else list[i-1].end=c.end;list.splice(i,1);const next=structuredClone(edits);next.sequences[seqId]=list;apply(next);}}>删除</button></div>
       <label>片段名称<input aria-label={`分镜 ${i+1} 名称`} value={c.label??c.id} maxLength={300} disabled={disabled||presetPending} onChange={e=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,label:e.target.value}:cut);apply(next);}}/></label>
       <label>机位<select aria-label={`分镜 ${i+1} 机位`} value={c.cameraId} disabled={disabled||presetPending} onChange={e=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,cameraId:e.target.value}:cut);apply(next);}}>{physical.map(([id,cam])=><option key={id} value={id}>{scene.cameraMetadata?.[id]?.label||cam.name||id}</option>)}</select></label>
       <div className="cut-time"><span>开始 {round(c.start)} s</span><label>结束（s）<input key={c.id+':'+c.end} aria-label={`分镜 ${i+1} 结束时间`} type="number" step="0.01" defaultValue={round(c.end)} disabled={disabled||presetPending||i===cuts.length-1} onBlur={e=>{const end=Number(e.target.value);if(!e.target.value||!Number.isFinite(end)||end<=c.start||end>=cuts[i+1].end){setLocalError('切点必须在相邻两个片段的范围内');e.target.value=String(c.end);return;}const list=structuredClone(cuts);list[i].end=end;list[i+1].start=end;const next=structuredClone(edits);next.sequences[seqId]=list;apply(next);}}/></label></div>
       </div><div hidden={props.section!=='performance'}><CutPerformanceEditor key={c.id+':'+reset} onInvalid={reportPerformanceInvalid} cut={c} index={i} scene={scene} disabled={disabled||presetPending} onStart={()=>{onSelect(seqId);onSeek(c.start);}} onPatch={performance=>{const next=structuredClone(edits);next.sequences[seqId]=cuts.map((cut,j)=>j===i?{...cut,performance}:cut);const success=apply(next);if(success){onSelect(seqId);onSeek(c.start);}return success;}}/></div>
     </div>)}
     {!cuts&&<p>当前为单独机位。新建分镜组后可设置分镜表演与切点。</p>}<div className="sequence-actions">{edits.sequences[seqId]&&<button disabled={disabled||presetPending} onClick={()=>{const next=structuredClone(edits);delete next.sequences[seqId];apply(next);}}>撤销此组手动设置</button>}</div>
     <p hidden={props.section!=='performance'} className="lens-note">添加时拆分当前片段；播放头在边界时取片段中点。删除后相邻片段接续，整体时长保持不变。每段可延续表演，也可独立指定动作与摆位。</p>
   </div>
   {(props.section==='camera'||props.section==='motion')&&<p className="shared-camera-note">{(cuts||shared>0)?(scope==='shared'?`共用调整 · 会影响 ${shared} 个镜头`:'只调整当前镜头 · 其他镜头不变'):shared>1?`此机位被 ${shared} 个镜头共用，机位调整会影响这些镜头。`:'当前机位：'+info.label}{cuts&&<button disabled={disabled||presetPending} onClick={isolate}>{'保留运镜并独立调整'}</button>}</p>}
   {props.section==='camera'&&<div className="parameter-scope">
     <FramingTimingSelect timing={props.timing} onTiming={props.onTiming} disabled={disabled||presetPending}/>
     {props.timing==='key'&&<>
       <button disabled={disabled||presetPending} onClick={()=>patchCamera({})}>记录当前构图 · {props.time.toFixed(2)} s</button>
       <p>首个关键帧之前沿用原构图，两个关键帧之间平滑过渡。可先记录过渡起点，再到终点调整位置、角度或焦距。</p>
       {edits.cameras[info.cameraId]?.framingKeys?.filter(k=>!cuts||k.time>=cuts[index].start&&(k.time<cuts[index].end||k.time===scene.durationSeconds)).map(k=><button key={k.time} disabled={disabled||presetPending} onClick={()=>onSeek(k.time)}>跳至关键帧 {k.time.toFixed(2)} s</button>)}
     </>}
   </div>}
   {props.section==='camera'&&protectedCamera&&<label className="parameter-scope">调整范围<select aria-label="参数调整范围" value={scope} disabled={disabled||presetPending} onChange={e=>setScope(e.target.value as 'shot'|'shared')}><option value="shot">只调整当前镜头</option><option value="shared">调整共用机位（{shared} 个镜头）</option></select></label>}
   <div hidden={props.section!=='motion'}>
   <CameraPresetEditor selected={seqId} scope={presetScope} onScope={setPresetScope} onPlaybackPreparation={registerPresetPreparation} openRequest={props.presetRequest} key={info.cameraId+':'+reset} scene={scene} info={info} edits={edits} time={props.time} disabled={disabled} onApply={onApply} onSelect={onSelect}/></div>
   <div hidden={props.section!=='camera'}><div className="camera-edit-actions"><button disabled={disabled||presetPending||info.projection!=='perspective'} onClick={()=>{onSeek(props.time);setOpen(!open);}}>{open?'收起调节':'调节当前机位'}</button><button disabled={disabled||presetPending||info.projection!=='perspective'} title={cuts?'复制当前构图并替换本镜头机位；其他镜头不变，原运镜改为固定构图':'复制当前构图为独立机位'} onClick={addCamera}>{'转为固定机位'}</button></div>
   {edits.cameras[info.cameraId]?.created&&<button className="delete-manual-camera" disabled={disabled||presetPending} onClick={()=>{if(Object.values(scene.cameraCuts??{}).some(cuts=>cuts.some(c=>c.cameraId===info.cameraId))){setLocalError('该机位仍被分镜引用，请先更换对应片段的机位。');return;}const next=structuredClone(edits);delete next.cameras[info.cameraId];apply(next);}}>删除自建机位</button>}
   {open&&<LensForm key={reset+':'+props.timing} keyed={props.timing==='key'} time={props.time} resetSharedBlocked={protectedCamera&&scope==='shot'} info={info} edit={edits.cameras[info.cameraId]} disabled={disabled||presetPending} onInvalid={setInvalid} onPatch={patchCamera} onClearField={field=>{if(protectedCamera&&scope==='shot'){setLocalError('恢复共用机位的场景对焦，请先明确选择调整共用机位。');return;}const next=structuredClone(edits);if(next.cameras[info.cameraId])delete next.cameras[info.cameraId][field];apply(next);setReset(n=>n+1);}} onView={()=>{patchCamera({...props.captureView(),movement:'保留原运镜 · 手动构图偏移'});setReset(n=>n+1);}} onReset={()=>{const next=structuredClone(edits);if(next.cameras[info.cameraId]?.created){setLocalError('新增机位没有场景初始值，可用“放弃未保存”撤回本次新增。');return;}delete next.cameras[info.cameraId];if(apply(next))setReset(n=>n+1);}}/>}
   </div><div hidden={props.section!=='story'}>{props.narrative}</div></div>
   {(error||localError||hasInvalid)&&<p className="camera-edit-error" role="alert">{error||localError||(hasInvalid?'请修正标出的数值后再播放或保存':'')}</p>}
   <div className="camera-save" hidden={props.section==='closed'&&!dirty&&!props.deliveryDirty&&!presetPending&&!props.feedback&&!saving}>{props.section!=='closed'&&<strong className="save-target">{info.shot?.label||info.shot?.id||info.label}</strong>}<span role="status">{presetPending&&<>预设参数待应用 · 保存工作区会先应用<br/></>}{props.feedback&&<>{props.feedback}<br/></>}{dirty||props.deliveryDirty||presetPending?`待保存：${[presetPending?'预设参数':'',dirty?'机位与分镜':'',props.deliveryDirty?'交付资料':''].filter(Boolean).join('、')}`:'已与项目同步'}</span><button className="primary" disabled={disabled||!(dirty||props.deliveryDirty||presetPending)||hasInvalid||!!localError} onClick={props.onSave}>{saving?'保存中…':'保存工作区'}</button><button disabled={disabled||!(dirty||props.deliveryDirty||presetPending)} onClick={()=>{props.onDiscard();setScope('shot');setPresetScope('shot');setLocalError('');setReset(n=>n+1);}}>放弃未保存</button></div>

 </section>;
}
function LensForm({keyed,time,resetSharedBlocked,info,edit,disabled,onPatch,onInvalid,onView,onReset,onClearField}:{keyed:boolean;time:number;resetSharedBlocked:boolean;info:CameraSnapshot;edit?:CameraEdit;disabled:boolean;onPatch:(patch:CameraEdit)=>void;onInvalid:(bad:boolean)=>void;onView:()=>void;onReset:()=>void;onClearField:(field:keyof CameraEdit)=>void}){
 const initial=fromSnapshot(info);const [fields,setFields]=useState<Record<string,string>>({}),[bad,setBad]=useState<Record<string,boolean>>({});
 useLayoutEffect(()=>{onInvalid(Object.values(bad).some(Boolean));return()=>onInvalid(false);},[bad,onInvalid]);
 useLayoutEffect(()=>{setFields({});setBad({});},[time]);
 function input(key:string,label:string,value:number,patch:(n:number)=>CameraEdit,positive=false,step=.1){return <label key={key}>{label}<input aria-label={label} type="number" step={step} min={positive ? 0.001 : undefined} value={fields[key]??round(value)} disabled={disabled||(keyed&&!['pX','pY','pZ','rX','rY','rZ','focal'].includes(key))} onChange={e=>{const raw=e.target.value,n=Number(raw),invalid=raw===''||!Number.isFinite(n)||positive&&n<=0;setFields(f=>({...f,[key]:raw}));setBad(b=>({...b,[key]:invalid}));if(!invalid)onPatch(patch(n));}}/></label>;}
 const position=initial.position!,rotation=initial.rotationDegrees!,sensor=edit?.sensor??initial.sensor!;
 return <div className="lens-form">

   <label>机位名称<input aria-label="机位名称" defaultValue={info.label} maxLength={300} disabled={disabled||keyed} onChange={e=>onPatch({label:e.target.value})}/></label>
   <div className="lens-input-grid">{input('focal','焦距（mm）',initial.focalLengthMm!,n=>({focalLengthMm:n}),true,1)}{input('aperture','光圈 f/',edit?.aperture??initial.aperture!,n=>({aperture:n}),true,.1)}{input('sw','传感器宽（mm）',sensor.widthMm,n=>({sensor:{...sensor,widthMm:n}}),true)}{input('sh','传感器高（mm）',sensor.heightMm,n=>({sensor:{...sensor,heightMm:n}}),true)}</div>
   <label>对焦方式<select aria-label="对焦方式" disabled={disabled||keyed} value={edit?.focusDistanceMeters!==undefined?'manual':'scene'} onChange={e=>e.target.value==='scene'?onClearField('focusDistanceMeters'):onPatch({focusDistanceMeters:(info.focus?.planeDistanceMeters??info.focus?.distanceMeters)||5})}><option value="scene">沿用场景对焦</option><option value="manual">手动距离</option></select></label>
   {edit?.focusDistanceMeters!==undefined&&input('focus','对焦距离（m）',edit.focusDistanceMeters,n=>({focusDistanceMeters:n}),true)}
   <fieldset disabled={disabled}><legend>位置 · 世界坐标（m）</legend><div className="pose-input-grid">{(['X','Y','Z'] as const).map((axis,i)=>input('p'+axis,`位置 ${axis}`,position[i],n=>{const v=[...position] as [number,number,number];v[i]=n;return {position:v};}))}</div></fieldset>
   <fieldset disabled={disabled}><legend>朝向（°）· 俯仰 / 水平 / 横滚</legend><div className="pose-input-grid">{(['X','Y','Z'] as const).map((axis,i)=>input('r'+axis,`角度 ${axis}`,rotation[i],n=>{const v=[...rotation] as [number,number,number];v[i]=n;return {rotationDegrees:v};},false,1))}</div></fieldset>
   <div className="camera-edit-actions"><button disabled={disabled} onClick={onView}>采用自由观察视角</button><button title={resetSharedBlocked?'恢复共用机位的代码设置，需先明确选择调整共用机位':undefined} disabled={disabled||keyed||edit?.created||resetSharedBlocked} onClick={onReset}>恢复代码设置</button></div>
   <p className="lens-note">调整构图会保留原运镜。</p>
 </div>;
}
