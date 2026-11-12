import type {DeclaredList,DeliveryDocument,DeliveryIssue,DeliveryShot,ShotBrief} from './delivery';
export interface StoryNode {id:string;label:string;change:string;audience:string}
export const transitionKinds={pending:'未指定',continuous:'动作连续',ellipsis:'时间省略',jump:'有意跳切',flashback:'闪回',parallel:'平行交叉',end:'段落结束',other:'其他'};
export const targetKinds={subject:'场内对象',place:'场内位置',offscreen:'画外目标',none:'没有目标／无人持有'};
export interface StageTarget {kind:keyof typeof targetKinds;subjectId:string;note:string}
export interface GazeCue {time:number;subjectId:string;target:StageTarget}
export interface PropCue {time:number;propId:string;holder:StageTarget}
/** Optional director annotations; never drive animation or claim rendered eye/hand contact. */
export interface ShotStaging {storyNodeIds:string[];transition:keyof typeof transitionKinds;gazes:DeclaredList<GazeCue>;props:DeclaredList<PropCue>}
export const emptyStaging=():ShotStaging=>({storyNodeIds:[],transition:'pending',gazes:{state:'pending',items:[]},props:{state:'pending',items:[]}});
export const emptyTarget=():StageTarget=>({kind:'subject',subjectId:'',note:''});
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown,max=12000):x is string=>typeof x==='string'&&x.length<=max;
const id=(x:unknown)=>text(x,128)&&x.trim().length>0&&!['__proto__','constructor','prototype'].includes(x);
export function validateStoryNodes(value:unknown){
  if(value===undefined)return;
  if(!Array.isArray(value)||value.length>200)throw new Error('剧情节点格式无效');
  const ids=new Set<string>();for(const n of value){if(!record(n)||!id(n.id)||!text(n.label,300)||!text(n.change)||!text(n.audience)||ids.has(n.id as string))throw new Error('剧情节点字段或 ID 无效');ids.add(n.id as string);}
}
export function validateStaging(value:unknown){
  if(value===undefined)return;
  if(!record(value)||!Array.isArray(value.storyNodeIds)||value.storyNodeIds.length>200||!value.storyNodeIds.every(id)||new Set(value.storyNodeIds).size!==value.storyNodeIds.length||!Object.hasOwn(transitionKinds,String(value.transition)))throw new Error('场面关系格式无效');
  for(const name of ['gazes','props']){
    const list=value[name];if(!record(list)||!['pending','none','present'].includes(String(list.state))||!Array.isArray(list.items)||list.items.length>100||(list.state!=='present'&&list.items.length))throw new Error('场面关系列表格式无效');
    for(const row of list.items){const target=record(row)?row[name==='gazes'?'target':'holder']:null;
      if(!record(row)||typeof row.time!=='number'||!Number.isFinite(row.time)||!text(row[name==='gazes'?'subjectId':'propId'],128)||!record(target)||!Object.hasOwn(targetKinds,String(target.kind))||!text(target.subjectId,128)||!text(target.note)||(target.kind!=='subject'&&target.subjectId!==''))throw new Error('视线或道具节点格式无效');
    }
  }
}
export function linkedStoryNodes(doc:DeliveryDocument,brief:ShotBrief){return (brief.staging?.storyNodeIds??[]).map(id=>doc.storyNodes?.find(n=>n.id===id)??{id,label:'【关联节点不存在】',change:'',audience:''});}
export function stagingIssues(doc:DeliveryDocument,shot:DeliveryShot,subjects?:string[]):DeliveryIssue[]{
  const s=doc.shots[shot.key]?.staging;if(!s)return [];
  const result:DeliveryIssue[]=[],base=`shots.${shot.key}.staging`,add=(path:string,message:string)=>result.push({path:`${base}.${path}`,message});
  for(const id of s.storyNodeIds){const n=doc.storyNodes?.find(n=>n.id===id);if(!n)add('storyNodeIds',`剧情节点不存在：${id}`);else if(!n.label.trim()||!n.change.trim()||!n.audience.trim())add('storyNodeIds',`剧情节点 ${n.label||id} 的名称、情节变化或观众信息未填写`);}
  if(s.transition==='pending')add('transition','与下一镜的衔接类型未指定');
  const checkSubject=(id:string,path:string)=>{if(!id.trim()||(subjects&&!subjects.includes(id)))add(path,`对象 ${id||'（未选择）'} 不在场景 subjects 中`);};
  for(const name of ['gazes','props'] as const){const list=s[name];if(list.state==='pending'||(list.state==='present'&&!list.items.length))add(name,`${name==='gazes'?'视线目标':'关键道具归属'}需填写或明确选择没有`);
    const seen=new Map<string,number>();
    list.items.forEach((row,i)=>{const source='subjectId' in row?row.subjectId:row.propId,target='target' in row?row.target:row.holder,path=`${name}.${i}`;
      checkSubject(source,path);if(row.time<0||row.time>shot.end-shot.start||(seen.has(source)&&row.time<=seen.get(source)!))add(path,'同一对象的关系节点时间须递增且位于镜头内');seen.set(source,row.time);
      if(target.kind==='subject'){checkSubject(target.subjectId,path);if(target.subjectId===source)add(path,'视线目标或道具持有者不能是其自身');}
      else if((target.kind==='place'||target.kind==='offscreen')&&!target.note.trim())add(path,'场内位置或画外目标需要具体说明');
    });
  }
  return result;
}
export function targetText(t:StageTarget,holder=false){if(t.kind==='none')return `${holder?'无人持有':'无特定目标'}${t.note.trim()?`（${t.note.trim()}）`:''}`;return `${t.kind==='subject'?t.subjectId||'【未选择对象】':targetKinds[t.kind]}${t.note.trim()?`（${t.note.trim()}）`:''}`;}
/** Last declaration for each source at t; no declaration means unknown, not none. */
export function cuesAt<T extends GazeCue|PropCue>(rows:T[],time:number):T[]{
  const latest=new Map<string,T>();for(const r of rows){const id='subjectId' in r?r.subjectId:r.propId;if(r.time<=time&&(!latest.has(id)||latest.get(id)!.time<r.time))latest.set(id,r);}return [...latest.values()];
}
export function stagingText(doc:DeliveryDocument,brief:ShotBrief,mode:'image'|'video',time=0){
  const s=brief.staging;if(!s)return '';
  const lines=['剧情与场面关系（导演意图，不代表白模已实现视线或持物）'];
  const nodes=linkedStoryNodes(doc,brief);if(nodes.length)lines.push('关联剧情节点（叙事上下文，不把全过程叠加到单帧）：',...nodes.map(n=>`${n.label}：情节变化 ${n.change}；观众获得信息 ${n.audience}`));
  if(mode==='video')lines.push(`与下一镜衔接类型：${transitionKinds[s.transition]}；具体意图：${brief.details.transition}`);
  for(const name of ['gazes','props'] as const){const list=s[name],label=name==='gazes'?'视线目标':'关键道具归属';
    if(list.state!=='present'){lines.push(`${label}：${list.state==='none'?'没有':'【未填写】'}`);continue;}
    const rows=mode==='image'?cuesAt<GazeCue|PropCue>(list.items,time):list.items;
    if(!rows.length)lines.push(`${label}：此时尚无声明，不推断`);
    for(const row of rows)lines.push(`${mode==='video'?`${row.time} 秒起（至该对象下一节点）`:'当前帧'}：${'subjectId' in row?`${row.subjectId} 看向 ${targetText(row.target)}`:`${row.propId} 归属／放置于 ${targetText(row.holder,true)}`}`);
  }
  return lines.join('\n');
}
