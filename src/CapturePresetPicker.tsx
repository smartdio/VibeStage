import {useState} from 'react';
import {applyCapturePreset,capturePresets,matchingCapturePreset,captureFields,type CaptureBrief,type CapturePresetKind} from '@vibestage/core';
const names:Record<CapturePresetKind,string>={body:'机身参考',lens:'镜头参考',film:'胶片参考'};
export function CapturePresetPicker({value,onChange}:{value:CaptureBrief|undefined;onChange:(capture:CaptureBrief)=>void}){
 const [notice,setNotice]=useState('');
 return <div className="capture-preset-picker">
  <p>选择后立即填入下方文字，可继续手动修改。只更新该类预设列出的字段，不改变白模机位、运镜、光圈或渲染效果。</p>
  <div className="delivery-fields capture-preset-selects">{(['body','lens','film'] as const).map(kind=>{
   const presets=capturePresets[kind],selected=matchingCapturePreset(value,kind),preset=presets.find(p=>p.id===selected);
   return <label key={kind}><span>{names[kind]}</span><select aria-label={`${names[kind]}预设`} value={selected} onChange={e=>{
    const p=presets.find(p=>p.id===e.target.value);if(!p)return;
    onChange(applyCapturePreset(value,kind,p.id));setNotice(`已填入 ${p.label}。原有提示词需重新生成或复核，再保存交付资料。`);
   }}><option value="" disabled>自定义／尚未选择</option>{[...new Set(presets.map(p=>p.group))].map(group=><optgroup key={group} label={group}>{presets.filter(p=>p.group===group).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>)}</select><small>{preset?`已填入：${Object.keys(preset.values).map(k=>captureFields[k as keyof CaptureBrief]).join('、')}`:'保留当前手填内容；选预设会替换对应字段。'}</small></label>;
  })}</div>
  <p>机身、镜头和胶片可独立组合。数字机搭配胶片参考表示最终画面的胶片风格意图；实际胶片规格、镜头版本和画幅仍需核对。预设不会自动选择焦段、增加变焦或修改输出格式。</p>
  {notice&&<p role="status">{notice}</p>}
 </div>;
}
