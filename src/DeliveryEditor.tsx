import {CapturePresetPicker} from './CapturePresetPicker';
import {PromptEditor} from './PromptEditor';
import {promptSourceSignature,type DeliveryShot,type OutputSettings} from '@vibestage/core';
import {useState} from 'react';
import {filmFields,contextFields,shotFields,captureFields,actorFields,lightFields,beatFields,blankFields,emptyShotBrief,sceneDeliveryShots,deliveryIssues,type DeliveryDocument,type ShotBrief,type DeclaredList,type StageScene,type CameraSnapshot} from '@vibestage/core';
import './delivery.css';
function Fields({labels,values,onChange,essential=[]}:{labels:Record<string,string>;values:Record<string,string>;onChange:(key:string,value:string)=>void;essential?:string[]}){
  return <div className="delivery-fields">{Object.entries(labels).map(([key,label])=><label key={key}><span>{label}{essential.includes(key)&&' · 必填'}</span><select aria-label={`${label}填写状态`} value={!values[key]?'pending':values[key]==='没有'?'none':'present'} onChange={e=>onChange(key,e.target.value==='none'?'没有':e.target.value==='pending'?'':' ')}><option value="pending">未填写</option><option value="present">填写内容</option>{!essential.includes(key)&&<option value="none">没有</option>}</select>{values[key]!=='没有'&&<textarea aria-label={label} rows={2} maxLength={12000} value={values[key]??''} placeholder="填写具体要求" onChange={e=>onChange(key,e.target.value)}/>}</label>)}</div>;
}
function ListEditor<T extends Record<string,string|number>>({title,labels,value,onChange,create,timeMax,essential=[]}:{title:string;labels:Record<string,string>;value:DeclaredList<T>;onChange:(value:DeclaredList<T>)=>void;create:()=>T;timeMax?:number;essential?:string[]}){
  return <details><summary>{title} · {value.state==='none'?'没有':value.state==='pending'?'未填写':`${value.items.length} 项`}</summary><label>{title}状态<select aria-label={`${title}状态`} value={value.state} onChange={e=>onChange({state:e.target.value as DeclaredList<T>['state'],items:e.target.value==='present'?value.items:[]})}><option value="pending">未填写</option><option value="none">没有</option><option value="present">有，逐项描述</option></select></label>{value.state==='present'&&<>{value.items.map((item,index)=><fieldset className="delivery-entry" key={index}><legend>{title} {index+1}</legend>{timeMax!==undefined&&<label>镜头内时间（秒）<input aria-label={`动作节点 ${index+1} 时间`} type="number" min={0} max={timeMax} step="any" value={item.time} onChange={e=>{if(!e.target.value||!Number.isFinite(e.target.valueAsNumber))return;onChange({...value,items:value.items.map((x,i)=>i===index?{...x,time:e.target.valueAsNumber}:x)});}}/></label>}<Fields labels={labels} values={item as Record<string,string>} essential={essential} onChange={(key,text)=>onChange({...value,items:value.items.map((x,i)=>i===index?{...x,[key]:text}:x)})}/><button onClick={()=>onChange({...value,items:value.items.filter((_,i)=>i!==index)})}>移除此{title}</button></fieldset>)}<button onClick={()=>onChange({...value,items:[...value.items,create()]})} disabled={value.items.length>=100}>添加{title}</button></>}</details>;
}
export function DeliveryEditor({scene,camera,time,info,value,disabled,readOnly,dirty,saving,error,onChange,onSave,onDiscard,onSeek,output,getPromptCamera}:{output:OutputSettings;getPromptCamera:(shot:DeliveryShot)=>CameraSnapshot;scene:StageScene;camera:string;time:number;info:CameraSnapshot|null;value:DeliveryDocument;disabled:boolean;readOnly:boolean;dirty:boolean;saving:boolean;error:string;onChange:(doc:DeliveryDocument)=>void;onSave:()=>void;onDiscard:()=>void;onSeek:(time:number)=>void}){
  const shots=sceneDeliveryShots(scene,camera),current=shots.find(s=>time>=s.start&&time<s.end)??shots.at(-1)!;
  const [chosen,setChosen]=useState('');const shot=shots.find(s=>s.key===chosen)??current,b=value.shots[shot.key]??emptyShotBrief();
  const issues=deliveryIssues(value,shots,Object.keys(scene.subjects??{}));
  for(const s of shots)for(const [kind,p] of Object.entries(value.shots[s.key]?.prompts??{}))if(!p.text.trim()||p.sourceSignature!==promptSourceSignature(value,s,output))issues.push({path:`shots.${s.key}.prompts.${kind}`,message:`${s.label}的${kind==='image'?'生图':'视频'}提示词为空或已过期，请生成或复核`});
  const patch=(patch:Partial<ShotBrief>)=>onChange({...value,shots:{...value.shots,[shot.key]:{...b,...patch}}});
  const allKeys=new Set(Object.keys(scene.cameras).flatMap(c=>sceneDeliveryShots(scene,c).map(s=>s.key))),orphans=Object.keys(value.shots).filter(k=>!allKeys.has(k));
  return <section className="delivery-editor" aria-label="导演交付信息">
    <div className="delivery-heading"><div><h2>导演交付信息</h2><p>当前分镜组：{camera} · {shots.length} 个镜头 · {issues.length?`${issues.length} 项待完善`:'信息完整'}</p></div><div className="delivery-buttons"><button disabled={disabled||readOnly||!dirty} onClick={onDiscard}>放弃未保存</button><button className="primary" disabled={disabled||readOnly||!dirty} onClick={onSave}>{saving?'正在保存…':'保存交付资料'}</button></div></div>
    <p>{readOnly?'内置样板只读；请复制为自己的项目后填写。':'影片说明在项目内共享；镜头说明按分镜 ID 保存。空白表示未填写，确实没有时请明确选择“没有”。'}</p>
    {dirty&&<p role="status">有未保存修改，保存后才能切换场景或导出。</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <details className="delivery-validation"><summary>完整性检查 · {issues.length} 项</summary>{issues.length?<ul>{issues.map((x,i)=><li key={i}>{x.message}<small>{x.path}</small></li>)}</ul>:<p>当前分镜组的交付资料已完整。导出时还会检查实际帧与技术参数。</p>}</details>
    <fieldset disabled={disabled||readOnly}>
      <details><summary>影片说明 · 项目共享</summary><Fields labels={filmFields} values={value.film} essential={['concept','story','style']} onChange={(key,text)=>onChange({...value,film:{...value.film,[key]:text}})}/></details>
      <details><summary>场景上下文</summary><Fields labels={contextFields} values={value.context} essential={['context']} onChange={(key,text)=>onChange({...value,context:{...value.context,[key]:text}})}/></details>
      <label className="delivery-shot-picker">镜头<select aria-label="交付镜头" value={shot.key} onChange={e=>{setChosen(e.target.value);const s=shots.find(s=>s.key===e.target.value)!;onSeek(s.start);}}>{shots.map(s=><option key={s.key} value={s.key}>{s.label} · {s.start.toFixed(2)}–{s.end.toFixed(2)} s</option>)}</select></label>
      <p>实际机位：{shot.cameraId} · 时长 {(shot.end-shot.start).toFixed(2)} 秒</p>
      <details open><summary>叙事、画面与连续性</summary><Fields labels={Object.fromEntries(Object.entries(shotFields).filter(([k])=>!['palette','skin','saturation','contrast','grade'].includes(k)))} values={b.details} essential={['purpose','content','composition','startState','endState']} onChange={(key,text)=>patch({details:{...b.details,[key]:text}})}/></details>
      <details><summary>摄影机与成像介质</summary><CapturePresetPicker key={shot.key} value={b.capture} onChange={capture=>patch({capture})}/><p>填写最终画面的摄影方案。数字拍摄也需明确胶片相关项为“没有”；胶片模拟请写明模拟目标。未知内容保持未填写，不自动指定机型或胶卷。快门注明角度或时间，感光度注明 ISO／EI，画幅注明单位。</p><Fields labels={captureFields} values={b.capture??blankFields(captureFields)} onChange={(key,text)=>patch({capture:{...blankFields(captureFields),...b.capture,[key]:text}})}/></details>
      <ListEditor title="人物" labels={actorFields} value={b.actors} onChange={actors=>patch({actors})} create={()=>blankFields(actorFields)} essential={['subjectId','appearance']}/>
      <p>可用人物／对象 ID：{Object.keys(scene.subjects??{}).join('、')||'没有登记对象'}</p>
      <ListEditor title="动作节点" labels={beatFields} value={b.beats} onChange={beats=>patch({beats})} create={()=>({...blankFields(beatFields),time:Math.min(shot.end-shot.start,(b.beats.items.at(-1)?.time??-1)+1)})} timeMax={shot.end-shot.start}/>
      <details><summary>色彩设计</summary><Fields labels={Object.fromEntries(Object.entries(shotFields).filter(([k])=>['palette','skin','saturation','contrast','grade'].includes(k)))} values={b.details} onChange={(key,text)=>patch({details:{...b.details,[key]:text}})}/></details>
      <ListEditor title="光源" labels={lightFields} value={b.lights} onChange={lights=>patch({lights})} create={()=>blankFields(lightFields)} essential={['id','type','role']}/>
      <p>以上是最终画面设计要求。导出会另存白模实际摄影机、灯光参数；未实现的设计不会被标为已实现。</p>
      <button onClick={()=>patch({reviewedSignature:shot.signature})} disabled={b.reviewedSignature===shot.signature}>{b.reviewedSignature===shot.signature?'已复核当前切点、机位与表演':'确认已复核当前切点、机位与表演'}</button>
      <PromptEditor key={shot.key} document={value} shot={shot} output={output} getCamera={()=>getPromptCamera(shot)} onChange={prompts=>patch({prompts})}/>
      {orphans.length>0&&<details><summary>已失去镜头关联的档案 · {orphans.length}</summary><p>删除或重命名镜头后保留的内容，不进入当前交付。</p>{orphans.map(key=><p key={key}>{key}<button onClick={()=>{const shots={...value.shots};delete shots[key];onChange({...value,shots});}}>删除此档案</button></p>)}</details>}
    </fieldset>
    <details><summary>当前播放头的实际摄影参数 · 自动读取</summary><pre>{JSON.stringify(info,null,2)}</pre></details>
  </section>;
}
