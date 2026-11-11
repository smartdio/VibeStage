import {useState} from 'react';
import {deliveryIssues,generateShotPrompt,promptSourceSignature,promptTechnicalSignature,PROMPT_LIMIT,type DeliveryDocument,type DeliveryShot,type ShotPrompts,type PromptKind,type CameraSnapshot,type OutputSettings} from '@vibestage/core';
export function PromptEditor({document,shot,output,getCamera,onChange}:{document:DeliveryDocument;shot:DeliveryShot;output:OutputSettings;getCamera:()=>CameraSnapshot;onChange:(prompts:ShotPrompts)=>void}){
  const [preview,setPreview]=useState<ShotPrompts>({}),[error,setError]=useState('');
  const prompts=document.shots[shot.key]?.prompts??{},signature=promptSourceSignature(document,shot,output);
  function run(action:()=>void){try{setError('');action();}catch(e){setError((e as Error).message);}}
  function check(){const issues=deliveryIssues(document,[shot]);if(issues.length)throw new Error(`请先完善并复核本镜头资料：${issues[0].message}`);}
  function generate(kind:PromptKind){run(()=>{check();setPreview({...preview,[kind]:generateShotPrompt(document,shot,output,getCamera(),kind)});});}
  return <details className="prompt-editor" open><summary>生图与视频提示词</summary>
    <p>本地生成中文通用提示词。生图版对应首帧，视频版包含完整时间线；预览采用后，使用“保存交付资料”保存。旧项目未生成的部分会在导出时自动补齐。</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {(['image','video'] as const).map(kind=>{const label=kind==='image'?'生图':'视频',saved=prompts[kind],candidate=preview[kind],stale=saved&&saved.sourceSignature!==signature;
      return <section className="prompt-section" key={kind} aria-label={`${label}提示词编辑`}><h3>{label}提示词</h3>
        <p role="status">{!saved?'尚未生成':stale?'交付资料或输出设置已变化，请重新生成或复核。':'已有提示词；实际摄影参数将在导出时再次核验。'}</p>
        <div className="delivery-buttons"><button onClick={()=>generate(kind)}>生成{label}预览</button>{saved&&<button disabled={!saved.text.trim()} onClick={()=>run(()=>{check();onChange({...prompts,[kind]:{...saved,sourceSignature:signature,technicalSignature:promptTechnicalSignature(getCamera())}});})}>已核对当前资料和摄影参数，保留{label}文本</button>}</div>
        {saved&&<label>已采用的{label}提示词<textarea aria-label={`${label}提示词`} rows={12} maxLength={PROMPT_LIMIT} value={saved.text} onChange={e=>onChange({...prompts,[kind]:{...saved,text:e.target.value}})}/></label>}
        {candidate&&<div className="prompt-preview"><label>{label}生成预览<textarea aria-label={`${label}生成预览`} rows={10} readOnly value={candidate.text}/></label><button disabled={candidate.sourceSignature!==signature} onClick={()=>run(()=>{if(candidate.sourceSignature!==signature||candidate.technicalSignature!==promptTechnicalSignature(getCamera()))throw new Error('资料或摄影参数已变化，请重新生成预览');onChange({...prompts,[kind]:candidate});setPreview({...preview,[kind]:undefined});})}>{saved?`采用预览，替换${label}文本`:`采用${label}预览`}</button><button onClick={()=>setPreview({...preview,[kind]:undefined})}>关闭{label}预览</button></div>}
      </section>;
    })}
  </details>;
}
