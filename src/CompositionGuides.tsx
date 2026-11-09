import {useEffect,useRef,useState} from 'react';
export type GuideSettings={pattern:'none'|'thirds'|'golden'|'cross'|'diagonal';crop:string;safe:boolean;action:number;title:number;opacity:number;color:string};
export const defaultGuides:GuideSettings={pattern:'thirds',crop:'original',safe:false,action:90,title:80,opacity:.55,color:'#ffffff'};
export function readGuides():GuideSettings{try{const p=JSON.parse(localStorage.getItem('vibestage:guides')??'null');if(p&&typeof p.safe==='boolean'&&p.title<=p.action&&['none','thirds','golden','cross','diagonal'].includes(p.pattern)&&['original','2.39','1.85','1','0.5625'].includes(p.crop)&&[p.action,p.title].every(n=>Number.isFinite(n)&&n>=50&&n<=100)&&Number.isFinite(p.opacity)&&p.opacity>=.1&&p.opacity<=1&&['#ffffff','#d9b780','#15171a'].includes(p.color))return {...defaultGuides,...p};}catch{}return {...defaultGuides};}
/** Guides fit the same letterboxed output rectangle as StageRuntime.renderShot. */
export function CompositionGuides({aspect,settings}:{aspect:number;settings:GuideSettings}){
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({w:1,h:1});
 useEffect(()=>{const el=ref.current!;const observer=new ResizeObserver(()=>setSize({w:el.clientWidth,h:el.clientHeight}));observer.observe(el);return()=>observer.disconnect();},[]);
 const w=Math.min(size.w,size.h*aspect),h=w/aspect,ratio=settings.crop==='original'?aspect:Number(settings.crop),cw=Math.min(w,h*ratio),ch=cw/ratio;
 const x=(w-cw)/2,y=(h-ch)/2,lines=settings.pattern==='thirds'?[1/3,2/3]:settings.pattern==='golden'?[.38196601125,.61803398875]:settings.pattern==='cross'?[.5]:[];
 return <div ref={ref} className="composition-guides" aria-hidden="true"><div className="guide-output" style={{width:w,height:h,left:(size.w-w)/2,top:(size.h-h)/2}}>
   {settings.crop!=='original'&&<svg className="crop-mask" width={w} height={h}><path d={`M0 0H${w}V${h}H0Z M${x} ${y}V${y+ch}H${x+cw}V${y}Z`} fillRule="evenodd" fill="rgba(0,0,0,.48)"/></svg>}
   <svg className="guide-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{left:x,top:y,width:cw,height:ch,color:settings.color,opacity:settings.opacity}}>
     {lines.map(n=><g key={n}><line x1={n*1000} y1="0" x2={n*1000} y2="1000"/><line x1="0" y1={n*1000} x2="1000" y2={n*1000}/></g>)}
     {settings.pattern==='diagonal'&&<><line x1="0" y1="0" x2="1000" y2="1000"/><line x1="1000" y1="0" x2="0" y2="1000"/></>}
     {settings.safe&&[settings.action,settings.title].map((n,i)=><rect key={i} x={(100-n)*5} y={(100-n)*5} width={n*10} height={n*10} strokeDasharray={i?'4 5':undefined}/>)}
     {settings.crop!=='original'&&<rect x="0" y="0" width="1000" height="1000"/>}
   </svg>
   <div className="finder-corners"><i/><i/><i/><i/></div>
 </div></div>;
}
export function GuideOptions({value,onChange}:{value:GuideSettings;onChange:(next:GuideSettings)=>void}){
 const patch=(p:Partial<GuideSettings>)=>onChange({...value,...p});
 return <div className="guide-options"><label>构图方式<select aria-label="构图参考线" value={value.pattern} onChange={e=>patch({pattern:e.target.value as GuideSettings['pattern']})}><option value="none">关闭构图线</option><option value="thirds">三分法</option><option value="golden">黄金分割 · 0.382 / 0.618</option><option value="cross">中心十字</option><option value="diagonal">对角线</option></select></label><label>画幅参考<select aria-label="画幅参考" value={value.crop} onChange={e=>patch({crop:e.target.value})}><option value="original">当前输出画幅</option><option value="2.39">2.39:1 · 宽银幕</option><option value="1.85">1.85:1</option><option value="1">1:1</option><option value="0.5625">9:16</option></select></label><label className="guide-check"><input aria-label="显示安全框" type="checkbox" checked={value.safe} onChange={e=>patch({safe:e.target.checked})}/>安全框</label>{value.safe&&<div className="guide-safe"><label>动作范围<select aria-label="动作安全范围" value={value.action} onChange={e=>patch({action:Number(e.target.value),title:Math.min(value.title,Number(e.target.value))})}>{[80,85,90,95,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><label>字幕范围<select aria-label="字幕安全范围" value={value.title} onChange={e=>patch({title:Number(e.target.value)})}>{[70,75,80,85,90].filter(n=>n<=value.action).map(n=><option key={n} value={n}>{n}%</option>)}</select></label></div>}<label>线条透明度 · {Math.round(value.opacity*100)}%<input aria-label="参考线透明度" type="range" min="0.1" max="1" step="0.05" value={value.opacity} onChange={e=>patch({opacity:Number(e.target.value)})}/></label><label>线条颜色<select aria-label="参考线颜色" value={value.color} onChange={e=>patch({color:e.target.value})}><option value="#ffffff">白色</option><option value="#d9b780">琥珀色</option><option value="#15171a">深色</option></select></label><p>实线为动作范围，虚线为字幕范围。画幅参考仅遮罩预览，不改变导出尺寸。</p></div>;
}
