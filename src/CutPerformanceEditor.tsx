import {useCallback,useEffect,useId,useState} from 'react';
import {Euler,MathUtils} from 'three';
import type {CameraCut,ShotPerformance,StageScene,SubjectPlacement} from '@vibestage/core';
import './performances.css';
const round=(n:number)=>Number(n.toFixed(3));
function NumberField({name,value,min,max,onChange,onInvalid,step=.1}:{name:string;value:number;min?:number;max?:number;step?:number;onChange:(n:number)=>boolean;onInvalid:(name:string,bad:boolean)=>void}){
  const [text,setText]=useState(String(round(value))),[error,setError]=useState(''),errorId=useId();
  useEffect(()=>setText(String(round(value))),[value]);
  useEffect(()=>()=>onInvalid(name,false),[name,onInvalid]);
  function message(raw:string){const n=Number(raw);return !raw.trim()||!Number.isFinite(n)?'请输入有效数字':(min!==undefined&&n<min)||(max!==undefined&&n>max)?`范围：${min??'不限'}–${max??'不限'} 秒`:'';}
  function report(error:string){setError(error);onInvalid(name,!!error);}
  return <span className="performance-number"><input aria-label={name} aria-invalid={!!error} aria-describedby={error?errorId:undefined} type="number" step={step} min={min} max={max} value={text} onChange={e=>{setText(e.target.value);if(error)report(message(e.target.value));}} onBlur={()=>{const problem=message(text);if(problem){report(problem);return;}report(onChange(Number(text))?'':'未能应用，请检查分镜设置。');}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>{error&&<small id={errorId} role="alert">{error}</small>}</span>;
}
export function CutPerformanceEditor({cut,index,scene,disabled,onPatch,onStart,onInvalid}:{cut:CameraCut;index:number;scene:StageScene;disabled:boolean;onPatch:(p:ShotPerformance|undefined)=>boolean;onStart:()=>void;onInvalid:(id:string,bad:boolean)=>void}){
  const [subject,setSubject]=useState(''),[invalid,setInvalid]=useState<Record<string,boolean>>({});
  const reportInvalid=useCallback((name:string,bad:boolean)=>setInvalid(previous=>previous[name]===bad?previous:{...previous,[name]:bad}),[]);
  useEffect(()=>{onInvalid(cut.id,Object.values(invalid).some(Boolean));return()=>onInvalid(cut.id,false);},[cut.id,invalid,onInvalid]);
  const independent=cut.performance?.mode==='independent',p=cut.performance??{mode:'continue'},ids=Object.keys(scene.subjects??{}),available=ids.filter(id=>!p.subjects?.[id]),selected=available.includes(subject)?subject:available[0]??'';
  const label=`分镜 ${index+1}`;
  function change(patch:Partial<ShotPerformance>){return onPatch({...p,...patch,mode:'independent'});}
  function place(id:string,patch:Partial<SubjectPlacement>){return change({subjects:{...p.subjects,[id]:{...p.subjects?.[id],...patch}}});}
  function capturePlacement(id:string,fields:'all'|'position'|'rotationDegrees'){
    onStart();const object=scene.subjects![id],euler=new Euler().setFromQuaternion(object.quaternion,'YXZ');
    return place(id,{...(fields!=='rotationDegrees'?{position:object.position.toArray() as [number,number,number]}:{}),...(fields!=='position'?{rotationDegrees:[euler.x,euler.y,euler.z].map(MathUtils.radToDeg) as [number,number,number]}:{}),...(fields==='all'?{visible:object.visible}:{})});
  }
  return <fieldset className="cut-performance" disabled={disabled}>
    <label>表演衔接<select aria-label={`${label} 表演模式`} value={independent?'independent':'continue'} onChange={e=>onPatch(e.target.value==='independent'?{mode:'independent',sourceStartSeconds:0}:undefined)}><option value="continue">延续上一段表演</option><option value="independent">独立表演 · 允许跳切</option></select></label>
    {independent?<>
      <div className="performance-source"><label>动作<select aria-label={`${label} 动作`} value={p.takeId??''} onChange={e=>change({takeId:e.target.value||undefined})}><option value="">原场景动作</option>{Object.entries(scene.performances??{}).map(([id,take])=><option key={id} value={id}>{take.label||id}</option>)}</select></label><label>动作起点（s）<NumberField onInvalid={reportInvalid} name={`${label} 动作起点`} value={p.sourceStartSeconds??0} min={0} max={300} step={.01} onChange={sourceStartSeconds=>change({sourceStartSeconds})}/></label></div>
      <p className="lens-note">从动作起点重新表演。后续选择“延续”的分镜会继续这一段动作与摆位。</p>
      <details className="performance-placements"><summary>人物与道具摆位 · {Object.keys(p.subjects??{}).length}</summary>
        {Object.entries(p.subjects??{}).map(([id,v])=><div className="performance-placement" key={id}>
          <div className="placement-heading"><span>{id}</span><button aria-label={`${label} 移除 ${id} 摆位`} onClick={()=>{const subjects={...p.subjects};delete subjects[id];change({subjects});}}>恢复动作原位</button></div>
          {!v.position&&<button onClick={()=>capturePlacement(id,'position')}>设置起始位置</button>}
          {v.position&&<fieldset><legend>起始位置 · 父坐标（m）</legend><div className="pose-input-grid">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<NumberField onInvalid={reportInvalid} name={`${label} ${id} 位置 ${axis}`} value={v.position![i]} onChange={n=>{const position=[...v.position!] as [number,number,number];position[i]=n;return place(id,{position});}}/></label>)}</div></fieldset>}
          {!v.rotationDegrees&&<button onClick={()=>capturePlacement(id,'rotationDegrees')}>设置起始朝向</button>}
          {v.rotationDegrees&&<fieldset><legend>起始朝向 · 俯仰 / 水平 / 横滚（°）</legend><div className="pose-input-grid">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<NumberField onInvalid={reportInvalid} name={`${label} ${id} 角度 ${axis}`} value={v.rotationDegrees![i]} step={1} onChange={n=>{const rotationDegrees=[...v.rotationDegrees!] as [number,number,number];rotationDegrees[i]=n;return place(id,{rotationDegrees});}}/></label>)}</div></fieldset>}
          <label className="placement-visible"><input aria-label={`${label} ${id} 可见`} type="checkbox" checked={v.visible??scene.subjects?.[id]?.visible??true} onChange={e=>place(id,{visible:e.target.checked})}/>显示对象</label>
        </div>)}
        {available.length>0&&<div className="placement-add"><select aria-label={`${label} 摆位对象`} value={selected} onChange={e=>setSubject(e.target.value)}>{available.map(id=><option key={id} value={id}>{id}</option>)}</select><button onClick={()=>capturePlacement(selected,'all')}>添加摆位</button></div>}
        <p className="lens-note">摆位是动作的起始位置，保留之后的移动与关节动作。更复杂的姿态和路径由 Agent 编写动作。</p>
      </details>
    </>:<p className="lens-note">{index===0?'从原场景 0 秒开始。':'承接上一段动作、摆位与动作时间，只切换机位。'}</p>}
  </fieldset>;
}
