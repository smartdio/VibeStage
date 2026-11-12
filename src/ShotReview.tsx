import {useEffect,useMemo,useState} from 'react';
import {Quaternion,Vector3} from 'three';
import {sceneDeliveryShots,linkedStoryNodes,cuesAt,targetText,transitionKinds,type ShotBrief,type DeliveryDocument,type StageScene} from '@vibestage/core';
import type {StageRuntime} from './runtime';
import {shotSamples,cutPlaybackRange} from './shot-review';
import './shot-review.css';
import './staging.css';
type Frame=ReturnType<StageRuntime['reviewFrame']>;
type Entry={first?:Frame;last?:Frame;error?:string};
const pageSize=12;
export function ShotReview({scene,camera,document,runtime,revision,disabled,onSeek,onPlay,onDelivery}:{scene:StageScene;camera:string;document:DeliveryDocument;runtime:StageRuntime;revision:unknown;disabled:boolean;onSeek:(t:number)=>void;onPlay:(start:number,end:number)=>void;onDelivery:(time:number)=>void}){
  const shots=useMemo(()=>sceneDeliveryShots(scene,camera),[scene,camera,revision]);
  const [selected,setSelected]=useState(0),[page,setPage]=useState(0),[seconds,setSeconds]=useState(1),[entries,setEntries]=useState<Record<string,Entry>>({}),[refresh,setRefresh]=useState(0);
  const fps=runtime.output.fps,dimensions=`${runtime.output.width}x${runtime.output.height}`;
  const left=shots[Math.min(selected,Math.max(0,shots.length-2))],right=shots[shots.indexOf(left)+1];
  const visible=shots.slice(page*pageSize,(page+1)*pageSize);
  const requested=useMemo(()=>Array.from(new Set([...visible.map(s=>s.key),left?.key,right?.key].filter((s):s is string=>!!s))),[shots,page,left?.key,right?.key]);
  useEffect(()=>{setSelected(0);setPage(0);},[scene,camera]);
  useEffect(()=>{setPage(p=>Math.min(p,Math.max(0,Math.ceil(shots.length/pageSize)-1)));},[shots.length]);
  useEffect(()=>{
    setEntries({});if(disabled)return;let cancelled=false,timer:ReturnType<typeof setTimeout>;
    const queue=shots.filter(s=>requested.includes(s.key));let i=0;
    const next=()=>{if(cancelled||i>=queue.length)return;const shot=queue[i++];const samples=shotSamples(shot,fps);let value:Entry;
      try{value=samples?{first:runtime.reviewFrame(camera,samples.first),last:runtime.reviewFrame(camera,samples.last)}:{error:'此镜头短于输出采样间隔，没有可输出帧'};}catch(e){value={error:(e as Error).message};}
      if(!cancelled){setEntries(old=>({...old,[shot.key]:value}));timer=setTimeout(next,0);}
    };timer=setTimeout(next,0);return()=>{cancelled=true;clearTimeout(timer);};
  },[scene,camera,revision,fps,dimensions,disabled,refresh,requested,runtime]);
  function choose(index:number){setSelected(Math.min(index,Math.max(0,shots.length-2)));}
  const a=entries[left?.key],b=entries[right?.key];
  const pair=(right?[a?.last,b?.first]:[a?.first,a?.last]).filter((x):x is Frame=>!!x);
  const points=pair.flatMap(f=>[f.camera.positionMeters,...Object.values(f.world.subjects).filter(s=>s.visible).map(s=>s.positionMeters)]);
  const minX=Math.min(-1,...points.map(p=>p[0]))-2,maxX=Math.max(1,...points.map(p=>p[0]))+2,minZ=Math.min(-1,...points.map(p=>p[2]))-2,maxZ=Math.max(1,...points.map(p=>p[2]))+2;
  const span=Math.max(maxX-minX,maxZ-minZ),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const project=(p:number[])=>[160+(p[0]-cx)*260/span,160+(p[2]-cz)*260/span];
  function relations(brief:ShotBrief|undefined,local:number){const s=brief?.staging;if(!s)return <p>尚无结构化场面关系</p>;return <div className="review-relations">{brief&&linkedStoryNodes(document,brief).map(n=><div key={n.id}><h4>{n.label||'未命名剧情节点'}</h4><p>情节变化：{n.change||'未填写'}</p><p>观众信息：{n.audience||'未填写'}</p></div>)}<h4>此帧场面关系 · 导演意图</h4>{s.gazes.state==='present'?<>{cuesAt(s.gazes.items,local).map(r=><p key={r.subjectId}>{r.subjectId} 看向 {targetText(r.target)}</p>)}{!cuesAt(s.gazes.items,local).length&&<p>此时视线未声明</p>}</>:<p>视线：{s.gazes.state==='none'?'没有':'未填写'}</p>}{s.props.state==='present'?<>{cuesAt(s.props.items,local).map(r=><p key={r.propId}>{r.propId}：{targetText(r.holder,true)}</p>)}{!cuesAt(s.props.items,local).length&&<p>此时道具归属未声明</p>}</>:<p>道具归属：{s.props.state==='none'?'没有':'未填写'}</p>}</div>;}
  function layout(frame:Frame){const c=project(frame.camera.positionMeters),direction=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(frame.camera.quaternion));
    return <svg viewBox="0 0 320 320" role="img" aria-label="俯视布局：北向上，东向右"><path d="M20 160H300M160 20V300" stroke="#45494e"/><text x="160" y="17" textAnchor="middle">北 −Z</text><text x="275" y="155">东 +X</text>
      {Object.entries(frame.world.subjects).filter(([,s])=>s.visible).map(([id,s],i)=>{const p=project(s.positionMeters),v=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(s.quaternion));return <g key={id}><circle cx={p[0]} cy={p[1]} r="5" fill="#d9b780"/><path d={`M${p[0]} ${p[1]}l${v.x*18} ${v.z*18}`} stroke="#d9b780" strokeWidth="2"/><text x={p[0]+8} y={p[1]-8-(i%2)*12}>{id}</text><title>{id} · X {s.positionMeters[0].toFixed(2)} / Z {s.positionMeters[2].toFixed(2)} m</title></g>;})}
      <rect x={c[0]-5} y={c[1]-5} width="10" height="10" fill="#9ec5db"/><path d={`M${c[0]} ${c[1]}l${direction.x*32} ${direction.z*32}`} stroke="#9ec5db" strokeWidth="2"/><text x={c[0]+8} y={c[1]+15}>机位</text><text x="20" y="307">同尺度 · 图宽 { (span*320/260).toFixed(1)} m</text></svg>;
  }
  return <section className="shot-review" aria-label="分镜审看">
    <header className="review-heading"><div><h2>分镜审看</h2><p>{camera} · {shots.length} 个镜头 · {fps} fps</p></div><button disabled={disabled} onClick={()=>setRefresh(n=>n+1)}>刷新画面</button></header>
    {shots.length===1&&<p className="review-note">当前为单机位，显示全时长首尾状态。选择右侧分镜组可查看相邻镜头衔接。</p>}
    <div className="review-strip" aria-label="分镜总览">{visible.map((shot,n)=>{const index=page*pageSize+n,entry=entries[shot.key],brief=document.shots[shot.key];return <button key={shot.key} disabled={disabled} aria-pressed={shot===left||shot===right} onClick={()=>choose(index)}>
      {entry?.first?<img src={entry.first.image} alt={`${shot.label}首帧`}/>:<span className="review-placeholder">{entry?.error??'正在采样…'}</span>}
      <strong>{String(index+1).padStart(2,'0')} · {shot.label}</strong><small>{shot.start.toFixed(2)}–{shot.end.toFixed(2)} s · {shot.cameraId}</small><span>{brief?.details.purpose||'叙事目的未填写'}</span>{brief?.staging&&<span className="review-story">{linkedStoryNodes(document,brief).map(n=>n.label).join(' · ')||'未关联剧情节点'}</span>}
    </button>;})}</div>
    {shots.length>pageSize&&<nav className="review-pagination" aria-label="分镜分页"><button disabled={disabled||page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page+1} / {Math.ceil(shots.length/pageSize)}</span><button disabled={disabled||(page+1)*pageSize>=shots.length} onClick={()=>setPage(p=>p+1)}>下一页</button></nav>}
    <div className="review-cut-controls"><label>审看切点<select aria-label="审看切点" disabled={disabled||!right} value={left?.key??''} onChange={e=>{const index=shots.findIndex(s=>s.key===e.target.value);choose(index);setPage(Math.floor(index/pageSize));}}>{(right?shots.slice(0,-1):shots).map((s,i)=><option key={s.key} value={s.key}>{right?`${s.end.toFixed(2)} s · ${s.label} → ${shots[i+1].label}`:s.label}</option>)}</select></label>
      <label>切点两侧时长<select aria-label="切点两侧时长" value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[.5,1,2,3].map(s=><option key={s} value={s}>各 {s} 秒</option>)}</select></label>
      <button className="primary" disabled={disabled||!right||!a?.last||!b?.first} onClick={()=>{const range=cutPlaybackRange(left,right,seconds);onPlay(range.start,range.end);}}>播放切点前后</button>
    </div>
    <div className="review-pair">{[0,1].map(side=>{const shot=side===0?left:right??left,entry=entries[shot.key],frame=right?(side===0?entry?.last:entry?.first):(side===0?entry?.first:entry?.last),samples=shotSamples(shot,fps),t=samples?(right?(side===0?samples.last:samples.first):(side===0?samples.first:samples.last)):null,brief=document.shots[shot.key];return <article key={side}><h3>{right?(side===0?'上一镜 · 尾帧':'下一镜 · 首帧'):(side===0?'首帧':'尾帧')}<small>{t?.toFixed(3)} s</small></h3><button className="review-frame" disabled={disabled||t===null} onClick={()=>t!==null&&onSeek(t)} aria-label={`定位${side===0?'左':'右'}侧画面`}>{frame?<img src={frame.image} alt={`${shot.label} · ${t?.toFixed(3)} 秒`}/>:<span className="review-placeholder">{entry?.error??'正在采样…'}</span>}</button><strong>{shot.label}</strong><p>{(right?(side===0?brief?.details.endState:brief?.details.startState):(side===0?brief?.details.startState:brief?.details.endState))||'状态未填写'}</p>{frame&&layout(frame)}{t!==null&&relations(brief,t-shot.start)}</article>;})}</div>
    <p className="review-note">俯视图为已登记对象的世界位置与本地 −Z 朝向，方点为当前机位；不代表眼神或模型实际正面。两侧共用比例，不包含未登记布景轮廓。点击画面可定位预览。</p>
    <div className="review-context"><h3>衔接意图{document.shots[left.key]?.staging?` · ${transitionKinds[document.shots[left.key].staging!.transition]}`:''}</h3><p>{document.shots[left.key]?.details.transition||'尚未填写镜头衔接。'}</p><button disabled={disabled} onClick={()=>onDelivery(left.start)}>查看交付档案</button></div>
  </section>;
}
