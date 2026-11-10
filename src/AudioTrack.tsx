import {useEffect,useRef,useState} from 'react';
import {AudioLines,Upload,Volume2,VolumeX,Trash2,Check} from 'lucide-react';
import type {AudioTrack as Track} from '../lib/core/audio';
import type {CameraCut} from '../lib/core/cameras';
import './audio.css';
function NumberField({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void}){
  const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
  return <input type="number" aria-label={label} min={min} max={max} step={step} value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{const n=Number(text);if(text.trim()&&Number.isFinite(n)&&n>=min&&n<=max)onChange(n);else setText(String(value));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>;
}
export function AudioTrack({track,peaks,time,duration,cuts,disabled,saving,dirty,error,onImport,onChange,onSave,onRemove,onSeek}:{track:Track|null;peaks:number[];time:number;duration:number;cuts:CameraCut[];disabled:boolean;saving:boolean;dirty:boolean;error:string;onImport:(file:File)=>void;onChange:(track:Track)=>void;onSave:()=>void;onRemove:()=>void;onSeek:(time:number)=>void}){
  const input=useRef<HTMLInputElement>(null);
  const bars=track?peaks.map((peak,i)=>{const x=(track.offsetSeconds+(i+.5)*track.durationSeconds/peaks.length)/duration*1000;return `M${x.toFixed(2)} ${(24-peak*22).toFixed(2)}v${Math.max(.5,peak*44).toFixed(2)}`;}).join(''):'';
  return <div className="audio-track">
    {cuts.length>0&&<div className="audio-cut-strip" aria-label="分镜时间标记">{cuts.map((cut,i)=><button key={cut.id} disabled={disabled} style={{left:`${cut.start/duration*100}%`,width:`${(cut.end-cut.start)/duration*100}%`}} title={`${cut.label??cut.id} · ${cut.start.toFixed(2)}–${cut.end.toFixed(2)} 秒`} onClick={()=>onSeek(cut.start)}>{i+1}<span>{cut.label??cut.id}</span>{cut.performance?.mode==='independent'&&<small>跳切</small>}</button>)}</div>}
    <div className="audio-heading"><AudioLines size={16}/><span className="audio-name" title={track?.name}>{track?track.name:'参考音轨'}{track&&<small>{track.durationSeconds.toFixed(2)} s</small>}</span><span className="audio-status" role="status">{saving?'正在保存…':dirty?'修改未保存':track?'已保存':''}</span><button disabled={disabled||saving} onClick={()=>input.current?.click()}><Upload size={13}/>{track?'替换音频':'导入音频'}</button><input ref={input} type="file" aria-label="选择音频文件" accept=".wav,.mp3,.m4a,.aac,.ogg,.flac" hidden onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)onImport(file);}}/></div>
    {track?<>
      <div className={'audio-wave'+(track.muted?' is-muted':'')}>
        <svg viewBox="0 0 1000 48" preserveAspectRatio="none" aria-hidden="true"><path d={bars}/>{cuts.slice(1).map(cut=><line key={cut.id} x1={cut.start/duration*1000} x2={cut.start/duration*1000} y1="0" y2="48"/>)}<line className="audio-playhead" x1={time/duration*1000} x2={time/duration*1000} y1="0" y2="48"/></svg>
        <input className="audio-wave-seek" aria-label="音频波形定位" type="range" min={0} max={duration} step={.01} value={time} disabled={disabled} onChange={e=>onSeek(Number(e.target.value))}/>
      </div>
      <fieldset disabled={disabled||saving} className="audio-settings"><label>起始偏移 <NumberField label="音频起始偏移（秒）" value={track.offsetSeconds} min={-300} max={300} step={.01} onChange={offsetSeconds=>onChange({...track,offsetSeconds})}/><span>s</span></label><label>音量 <NumberField label="音频音量（百分比）" value={Math.round(track.volume*100)} min={0} max={200} step={1} onChange={volume=>onChange({...track,volume:volume/100})}/><span>%</span></label><button className="icon-button" aria-label={track.muted?'取消音频静音':'音频静音'} title="静音也会应用到导出" aria-pressed={track.muted} onClick={()=>onChange({...track,muted:!track.muted})}>{track.muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button><button className="audio-save" disabled={!dirty} onClick={onSave}><Check size={13}/>保存音频设置</button><button className="icon-button" aria-label="移除音轨" title="移除此场景的音轨，保留本地素材" onClick={onRemove}><Trash2 size={14}/></button></fieldset>
      <p className="audio-help">正偏移延后声音，负偏移跳过片头 · 点击波形定位，右侧调整分镜时间{(track.offsetSeconds>=duration||track.offsetSeconds+track.durationSeconds<=0)?' · 音轨在场景范围外，当前无声':''}</p>
    </>:<p className="audio-help">导入已配好的声音，对照波形调整分镜。WAV / MP3 / M4A / AAC / OGG / FLAC，最大 64 MB、300 秒。</p>}
    {error&&<p className="audio-error" role="alert">{error}</p>}
  </div>;
}
