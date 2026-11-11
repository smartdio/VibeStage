import {DeliveryEditor} from './DeliveryEditor';
import {emptyDelivery,validateDelivery,type DeliveryDocument} from '@vibestage/core';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Box,Camera,ChevronRight,Clapperboard,Code2,Copy,Download,FileCode2,FolderPlus,Grid3X3,Maximize,Minimize,Pause,Play,Plus,RefreshCw,SkipBack,SkipForward,UserRound,X,Check,Film,Image,Layers,ArrowLeft,ExternalLink,LockKeyhole} from 'lucide-react';
import {validateScene,createCameraEditSession,emptyCameraEdits,FULL_FRAME,focalLengthFromFov,type CameraEdits,type CameraEditSession,type CameraSnapshot,type StageScene} from '@vibestage/core';
import {StageRuntime,api,type JobResult} from './runtime';
import './style.css';
import {CameraPanel} from './CameraPanel';
import {useViewportFullscreen} from './useViewportFullscreen';
import {PilotBar} from './PilotBar';
import {CameraEditor} from './CameraEditor';
import {AudioTrack} from './AudioTrack';
import type {AudioTrack as Soundtrack} from '../lib/core/audio';
import {adjacentShot} from './shot-navigation';
import {initialScene,type SceneSelection} from './initial-scene';
import {assertWritableProject,isBuiltinProject} from '../lib/core/builtins';
type Project={id:string;name:string;readOnly?:boolean;scenes:{id:string;path:string}[]};
type Catalog={projects:Project[];sourceHash:string};
type Selection={project:string;scene:string};
type ExportKind='still'|'sequence'|'video'|'delivery';
declare global { interface Window {vibeStage:{getState:()=>unknown;seek:(time:number)=>void;camera:(id:string)=>void;load:(project:string,scene:string)=>Promise<void>;export:(kind:ExportKind)=>Promise<JobResult>;cancel:()=>void} } }
const sceneLabels:Record<string,string>={meeting:'会面 · 双人走位',room:'室内白模',empty:'空场景',showroom:'32 种镜头 · 学习样板'};
export default function App(){
  const host=useRef<HTMLDivElement>(null),monitor=useRef<HTMLDivElement>(null),runtime=useRef<StageRuntime|null>(null),abort=useRef<AbortController|null>(null),dialog=useRef<HTMLDialogElement>(null);
  const viewport=useRef<HTMLDivElement>(null);
  const fullscreen=useViewportFullscreen(viewport,()=>{const rt=runtime.current;if(rt){rt.stopPilotInput();rt.suppressPilotEscapeUntil=performance.now()+500;}});
  const [catalog,setCatalog]=useState<Project[]>([]),[selected,setSelected]=useState<Selection>({project:'demo',scene:'meeting'}),[data,setData]=useState<StageScene|null>(null),[source,setSource]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[dirty,setDirty]=useState(false);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[loop,setLoop]=useState(true),[camera,setCamera]=useState(''),[mode,setMode]=useState<'free'|'shot'>('free'),[grid,setGrid]=useState(true),[tab,setTab]=useState<'preview'|'source'|'delivery'>('preview'),[object,setObject]=useState<THREE.Object3D|null>(null);
  const [size,setSize]=useState('1280x720'),[fps,setFps]=useState(24),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[status,setStatus]=useState(''),[result,setResult]=useState<JobResult|null>(null),[copied,setCopied]=useState(false),[cloning,setCloning]=useState(false),[creating,setCreating]=useState(false),[createError,setCreateError]=useState('');
  const [edits,setEdits]=useState<CameraEdits>(emptyCameraEdits),[editDirty,setEditDirty]=useState(false),[saving,setSaving]=useState(false),[editError,setEditError]=useState('');
  const editSession=useRef<CameraEditSession|null>(null),savedEdits=useRef<CameraEdits>(emptyCameraEdits()),editRevision=useRef('missing'),editDirtyRef=useRef(false),savingRef=useRef(false);
  const [audioTrack,setAudioTrack]=useState<Soundtrack|null>(null),[audioDirty,setAudioDirty]=useState(false),[audioError,setAudioError]=useState('');
  const audioRevision=useRef('missing'),audioDirtyRef=useRef(false),savedAudio=useRef<Soundtrack|null>(null);
  const [delivery,setDelivery]=useState<DeliveryDocument>(emptyDelivery),[deliveryDirty,setDeliveryDirty]=useState(false),[deliveryError,setDeliveryError]=useState('');
  const deliveryRef=useRef<DeliveryDocument>(emptyDelivery()),savedDelivery=useRef<DeliveryDocument>(emptyDelivery()),deliveryRevision=useRef('missing'),deliveryDirtyRef=useRef(false);
  const [piloting,setPiloting]=useState(false),[pilotSpeed,setPilotSpeed]=useState(1);
  const [cameraInfo,setCameraInfo]=useState<CameraSnapshot|null>(null);
  const [newProject,setNewProject]=useState('demo'),[projectSlug,setProjectSlug]=useState(''),[projectName,setProjectName]=useState(''),[sceneSlug,setSceneSlug]=useState(''),[template,setTemplate]=useState('blocking');
  const current=useRef(selected),sourceHash=useRef(''),generation=useRef(0),dirtyRef=useRef(false);
  current.current=selected;
  async function load(project:string,scene:string){
    const rt=runtime.current;if(!rt||rt.busy||savingRef.current)return;if(rt.pilot)throw new Error('请先应用或取消机位操控');if(editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current)throw new Error('请先保存摄影机、音频或交付资料修改，再切换场景');const openNewScene=!rt.instance||current.current.project!==project||current.current.scene!==scene;const version=++generation.current;setLoading(true);setError('');setResult(null);setObject(null);setSelected({project,scene});current.current={project,scene};try{sessionStorage.setItem('vibestage:selection',JSON.stringify({project,scene}));}catch{}rt.playing=false;
    let candidate:StageScene|undefined;
    try{
      const cat=await api<Catalog>('/projects?project='+encodeURIComponent(project));setCatalog(cat.projects);const path=cat.projects.find(p=>p.id===project)?.scenes.find(s=>s.id===scene)?.path;if(!path)throw new Error('场景文件不存在，请选择其他场景或新建场景');
      const code=await api<{source:string}>(`/source?project=${project}&scene=${scene}`);
      const settings=await api<{edits:CameraEdits;revision:string}>(`/camera-settings?project=${project}&scene=${scene}`);
      const audio=await api<{track:Soundtrack|null;revision:string}>(`/audio?project=${project}&scene=${scene}`);
      const deliverySettings=await api<{document:DeliveryDocument|null;film:DeliveryDocument['film']|null;revision:string}>(`/delivery-settings?project=${project}&scene=${scene}`);
      const module=await import(/* @vite-ignore */'/'+path+'?v='+cat.sourceHash);
      if(typeof module.createScene!=='function')throw new Error('场景模块必须导出 createScene()');candidate=await module.createScene();const session=createCameraEditSession(candidate!,settings.edits);validateScene(candidate!);
      const deliveryDocument=structuredClone(deliverySettings.document??candidate!.delivery??emptyDelivery());if(deliverySettings.film)deliveryDocument.film=deliverySettings.film;validateDelivery(deliveryDocument);
      const after=await api<Catalog>('/projects?project='+encodeURIComponent(project));if(after.sourceHash!==cat.sourceHash)throw new Error('加载期间源代码发生变化，请重新加载');
      if(version!==generation.current){candidate?.dispose();return;}rt.load(candidate!);if(openNewScene&&candidate!.initialView){rt.mode=candidate!.initialView;setMode(rt.mode);rt.draw();}setCameraInfo(rt.cameraInfo);await rt.audio.load(audio.track,`/__vs/audio-file?project=${project}&scene=${scene}`);if(version!==generation.current)return;setAudioTrack(audio.track);savedAudio.current=audio.track;audioRevision.current=audio.revision;audioDirtyRef.current=false;setAudioDirty(false);setAudioError('');editSession.current=session;savedEdits.current=settings.edits;editRevision.current=settings.revision;editDirtyRef.current=false;setEdits(settings.edits);setEditDirty(false);setEditError('');deliveryRef.current=deliveryDocument;savedDelivery.current=structuredClone(deliveryDocument);deliveryRevision.current=deliverySettings.revision;deliveryDirtyRef.current=false;setDelivery(deliveryDocument);setDeliveryDirty(false);setDeliveryError('');setData(candidate!);setSource(code.source);sourceHash.current=cat.sourceHash;setCamera(rt.cameraId);setSize(`${rt.output.width}x${rt.output.height}`);setFps(rt.output.fps);setTime(0);setPlaying(false);setDirty(false);dirtyRef.current=false;
    }catch(e){candidate?.dispose();if(version===generation.current){rt.clear();setData(null);setCameraInfo(null);setError((e as Error).stack??String(e));}}
    finally{if(version===generation.current)setLoading(false);}
  }
  async function exportScene(kind:ExportKind){const rt=runtime.current;if(!rt?.instance)throw new Error('场景尚未加载');if(rt.pilot)throw new Error('请先应用或取消机位操控');if(rt.busy)throw new Error('已有导出进行中');if(editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current||savingRef.current)throw new Error('请先保存摄影机、音频与交付资料再导出');setBusy(true);setPlaying(false);setProgress(0);setStatus('正在保存源代码快照');setError('');setResult(null);const controller=new AbortController();abort.current=controller;
    try{const output=await rt.export({kind,...current.current,sourceHash:sourceHash.current,...(kind==='delivery'?{delivery:structuredClone(deliveryRef.current)}:{})},(p,s)=>{setProgress(p);setStatus(s);},controller.signal);setResult(output);return output;}
    catch(e){const cancelled=controller.signal.aborted;setStatus(cancelled?'导出已取消':'导出失败');if(!cancelled)setError((e as Error).message);throw e;}
    finally{abort.current=null;setBusy(false);if(dirtyRef.current)setDirty(true);}
  }
  useEffect(()=>{
    let rt:StageRuntime;try{rt=new StageRuntime(host.current!,monitor.current!);}catch(e){setError('无法初始化 WebGL 2：'+(e as Error).message);setLoading(false);return;}
    runtime.current=rt;setPiloting(false);setMode(rt.mode);let last=0;rt.onTime=(t,p)=>{if(performance.now()-last>80){setTime(t);setPlaying(p);if(rt.pilot)setPilotSpeed(rt.pilot.speed);setCameraInfo(previous=>JSON.stringify(previous)===JSON.stringify(rt.cameraInfo)?previous:rt.cameraInfo);last=performance.now();}};rt.onSelect=setObject;rt.onPilotCancel=()=>{rt.endPilot();setPiloting(false);setMode(rt.mode);setCameraInfo(rt.cameraInfo);};
    rt.onAudioError=e=>{setAudioError(e.message);setPlaying(false);};
    rt.onError=e=>{setError(e.stack??e.message);rt.clear();setPiloting(false);setData(null);setCameraInfo(null);};
    let initial:SceneSelection|null=null;try{const saved=JSON.parse(sessionStorage.getItem('vibestage:selection')??'null');if(saved?.project&&saved?.scene)initial=saved;}catch{}
    void (async()=>{
      try{
        const cat=await api<Catalog>('/projects');setCatalog(cat.projects);
        const target=initialScene(cat.projects,initial);
        if(target)await load(target.project,target.scene);
        else{setSelected({project:'',scene:''});setLoading(false);}
      }catch(e){setError((e as Error).message);setLoading(false);}
    })();
    let debounce:ReturnType<typeof setTimeout>;const changed=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{void (async()=>{try{const cat=await api<Catalog>('/projects?project='+encodeURIComponent(current.current.project));if(cat.sourceHash===sourceHash.current)return;dirtyRef.current=true;setDirty(true);if(!rt.busy&&!rt.pilot&&!editDirtyRef.current&&!audioDirtyRef.current&&!deliveryDirtyRef.current&&!savingRef.current)await load(current.current.project,current.current.scene);}catch(e){setEditError((e as Error).message);}})();},400);};
    import.meta.hot?.on('vibestage:changed',changed);
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current||rt.pilot){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
    const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,select,textarea,button,dialog')||rt.busy||rt.pilot||savingRef.current||!rt.instance)return;if(e.code==='Space'){e.preventDefault();if(!rt.playing&&rt.time>=rt.instance!.durationSeconds)rt.time=0;rt.playing=!rt.playing;setPlaying(rt.playing);}if(e.key==='ArrowRight')rt.seek(rt.time+1/rt.output.fps);if(e.key==='ArrowLeft')rt.seek(rt.time-1/rt.output.fps);};window.addEventListener('keydown',key);
    window.vibeStage={getState:()=>({selection:current.current,ready:!!rt.instance,time:rt.time,camera:rt.cameraId,duration:rt.instance?.durationSeconds,sourceHash:sourceHash.current,busy:rt.busy,piloting:!!rt.pilot,cameraInfo:rt.cameraInfo,hasUnsavedCameraEdits:editDirtyRef.current,audio:rt.audio.track,audioClock:rt.audio.position(),playing:rt.playing,hasUnsavedAudioEdits:audioDirtyRef.current,hasUnsavedDeliveryEdits:deliveryDirtyRef.current}),seek:t=>rt.seek(t),camera:id=>{if(rt.pilot)throw new Error('请先应用或取消机位操控');if(rt.busy)throw new Error('导出期间不能切换机位');if(!rt.instance?.cameras[id])throw new Error('机位不存在');rt.cameraId=id;rt.draw();setCameraInfo(rt.cameraInfo);setCamera(id);},load,export:exportScene,cancel:()=>abort.current?.abort()};
    return()=>{generation.current++;abort.current?.abort();clearTimeout(debounce);import.meta.hot?.off('vibestage:changed',changed);window.removeEventListener('keydown',key);window.removeEventListener('beforeunload',beforeUnload);rt.dispose();runtime.current=null;};
  },[]);
  function applyEdits(next:CameraEdits){
    assertWritableProject(current.current.project);
    const rt=runtime.current,session=editSession.current;if(!rt?.instance||!session||rt.busy||savingRef.current)throw new Error('当前不能编辑机位');
    session.setEdits(next);if(!rt.instance.cameras[rt.cameraId])rt.cameraId=Object.keys(rt.instance.cameras)[0];rt.seek(rt.time);
    const changed=JSON.stringify(next)!==JSON.stringify(savedEdits.current);editDirtyRef.current=changed;setEditDirty(changed);setEdits(structuredClone(next));setCamera(rt.cameraId);setCameraInfo(rt.cameraInfo);setEditError('');setPlaying(false);setResult(null);
  }
  async function saveEdits(){
    if(isBuiltinProject(current.current.project))return;
    if(runtime.current?.pilot||savingRef.current||!editDirtyRef.current)return;savingRef.current=true;setSaving(true);setEditError('');
    try{const result=await api<{edits:CameraEdits;revision:string;sourceHash:string}>('/camera-settings',{...current.current,edits:editSession.current!.getEdits(),revision:editRevision.current,sourceHash:sourceHash.current},'PUT');savedEdits.current=result.edits;editRevision.current=result.revision;sourceHash.current=result.sourceHash;editDirtyRef.current=false;dirtyRef.current=false;setEditDirty(false);setDirty(false);}
    catch(e){setEditError((e as Error).message);}finally{savingRef.current=false;setSaving(false);}
  }
  function discardEdits(){applyEdits(savedEdits.current);}
  function beginPilot(){if(isBuiltinProject(current.current.project))return;const rt=runtime.current;if(!rt)return;try{if(rt.cameraInfo?.preset)throw new Error('运动机位请调整预设参数，或复制为固定机位后操控');rt.beginPilot();setPiloting(true);setMode('shot');setTab('preview');setPlaying(false);setPilotSpeed(rt.pilot!.speed);setCameraInfo(rt.cameraInfo);setError('');requestAnimationFrame(()=>{if(window.matchMedia('(max-width:760px)').matches)host.current?.parentElement?.scrollIntoView({block:'start'});});}catch(e){setError((e as Error).message);}}
  function finishPilot(apply:boolean){const rt=runtime.current;if(!rt?.pilot)return;try{if(apply){const patch=rt.pilot.patch();if(Object.keys(patch).length){const next=editSession.current!.getEdits();next.cameras[rt.pilot.id]={...next.cameras[rt.pilot.id],...patch};applyEdits(next);}}rt.endPilot(apply);setPiloting(false);setMode(rt.mode);setCameraInfo(rt.cameraInfo);}catch(e){setError((e as Error).message);}}
  function captureView(){
    const rt=runtime.current!;rt.free.updateWorldMatrix(true,false);const p=rt.free.getWorldPosition(new THREE.Vector3()),q=rt.free.getWorldQuaternion(new THREE.Quaternion()),e=new THREE.Euler().setFromQuaternion(q,'YXZ');
    return {position:p.toArray() as [number,number,number],rotationDegrees:[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg) as [number,number,number],focalLengthMm:focalLengthFromFov(rt.free.getEffectiveFOV(),FULL_FRAME,rt.output.width/rt.output.height),sensor:{...FULL_FRAME}};
  }
  function changeCamera(id:string){if(runtime.current&&!runtime.current.busy&&!runtime.current.pilot){runtime.current.cameraId=id;runtime.current.draw();setCameraInfo(runtime.current.cameraInfo);setCamera(id);}}
  function changeMode(m:'free'|'shot'){if(runtime.current)runtime.current.mode=m;setMode(m);}
  function resize(value:string){setSize(value);const [width,height]=value.split('x').map(Number);if(runtime.current)runtime.current.output={...runtime.current.output,width,height};}
  function seek(t:number){runtime.current?.seek(t);setTime(t);setPlaying(false);}
  function jumpShot(direction:-1|1){
    const rt=runtime.current;if(!rt?.instance||rt.pilot||rt.busy||loading||saving)return;
    const target=adjacentShot(rt.instance,rt.cameraId,rt.time,direction);if(!target)return;
    rt.cameraId=target.cameraId;rt.mode='shot';rt.seek(target.time,{preservePlayback:true});
    setCamera(rt.cameraId);setMode('shot');setTime(rt.time);setPlaying(rt.playing);setCameraInfo(rt.cameraInfo);
  }
  function changeAudio(track:Soundtrack){
    if(isBuiltinProject(current.current.project))return;
    const rt=runtime.current;if(!rt||savingRef.current)return;rt.playing=false;rt.audio.configure(track);setAudioTrack(track);setPlaying(false);setResult(null);
    const changed=JSON.stringify(track)!==JSON.stringify(savedAudio.current);audioDirtyRef.current=changed;setAudioDirty(changed);setAudioError('');
  }
  async function saveAudio(track:Soundtrack|null,file?:File){
    if(isBuiltinProject(current.current.project))return;
    const rt=runtime.current;if(!rt||rt.busy||rt.pilot||savingRef.current)return;
    savingRef.current=true;setSaving(true);setAudioError('');rt.playing=false;setPlaying(false);setResult(null);
    try{
      const query=new URLSearchParams({...current.current,revision:audioRevision.current,sourceHash:sourceHash.current,...(file?{name:file.name}:{})});
      const result=await api<{track:Soundtrack|null;revision:string;sourceHash:string}>('/audio?'+query,file??{track},file?'POST':'PUT');
      if(file||!result.track)await rt.audio.load(result.track,`/__vs/audio-file?project=${current.current.project}&scene=${current.current.scene}`);else rt.audio.configure(result.track);
      audioRevision.current=result.revision;sourceHash.current=result.sourceHash;savedAudio.current=result.track;audioDirtyRef.current=false;dirtyRef.current=false;
      setAudioTrack(result.track);setAudioDirty(false);setDirty(false);
    }catch(e){setAudioError((e as Error).message);}finally{savingRef.current=false;setSaving(false);}
  }
  function changeDelivery(document:DeliveryDocument){
    assertWritableProject(current.current.project);if(runtime.current?.busy||savingRef.current)return;
    deliveryRef.current=document;setDelivery(document);deliveryDirtyRef.current=JSON.stringify(document)!==JSON.stringify(savedDelivery.current);setDeliveryDirty(deliveryDirtyRef.current);setDeliveryError('');setResult(null);
  }
  async function saveDelivery(){
    if(isBuiltinProject(current.current.project)||savingRef.current||runtime.current?.busy||!deliveryDirtyRef.current)return;
    savingRef.current=true;setSaving(true);setDeliveryError('');
    try{const result=await api<{document:DeliveryDocument;revision:string;sourceHash:string}>('/delivery-settings',{...current.current,document:deliveryRef.current,revision:deliveryRevision.current,sourceHash:sourceHash.current},'PUT');
      savedDelivery.current=structuredClone(result.document);deliveryRef.current=result.document;setDelivery(result.document);deliveryRevision.current=result.revision;sourceHash.current=result.sourceHash;deliveryDirtyRef.current=false;setDeliveryDirty(false);dirtyRef.current=false;setDirty(false);
    }catch(e){setDeliveryError((e as Error).message);}finally{savingRef.current=false;setSaving(false);}
  }
  async function copyTeachingProject(){if(cloning||busy||loading)return;setCloning(true);setError('');try{const copy=await api<SceneSelection>('/clone-builtin',{project:selected.project});await load(copy.project,copy.scene);}catch(e){setError((e as Error).message);}finally{setCloning(false);}}
  async function create(){setCreating(true);setCreateError('');try{const p=newProject==='__new'?projectSlug:newProject;await api('/scenes',{project:p,scene:sceneSlug,template,projectName:newProject==='__new'?projectName:undefined});dialog.current?.close();await load(p,sceneSlug);}catch(e){setCreateError((e as Error).message);}finally{setCreating(false);}}
  const currentProject=catalog.find(p=>p.id===selected.project),readOnly=!!currentProject?.readOnly,path=currentProject?.scenes.find(s=>s.id===selected.scene)?.path??'',duration=data?.durationSeconds??6;
  const subjects=Object.entries(data?.subjects??{});
  const previousShot=data?adjacentShot(data,camera,time,-1):undefined,nextShot=data?adjacentShot(data,camera,time,1):undefined;
  return <div className="app">
    <header className="topbar"><a className="brand" href="/" aria-label="VibeStage 首页"><span className="brandmark"><Clapperboard size={20}/></span>VibeStage<span className="version">0.2</span></a><div className="breadcrumb"><span>{currentProject?.name??'本地项目'}</span><ChevronRight size={14}/><strong>{data?.name??selected.scene}</strong></div><div className="top-actions"><span className={'connection '+(error?'warning':'')}><i/>{loading?'加载中':error?'需要修正':busy?'正在导出':dirty?'代码已更新':'本地运行'}</span><button disabled={piloting||busy||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void load(selected.project,selected.scene)} title="重新加载源文件"><RefreshCw size={15}/><span>重新加载</span></button><button className="primary" disabled={piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>{setSceneSlug('');setNewProject(readOnly?'__new':selected.project||'__new');setCreateError('');dialog.current?.showModal();}}><Plus size={16}/>新建场景</button></div></header>
    <aside className="left-panel">
      <div className="panel-title"><span>项目场景</span><button className="icon-button" aria-label="新建项目" disabled={piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>{setNewProject('__new');setSceneSlug('');setCreateError('');dialog.current?.showModal();}}><FolderPlus size={17}/></button></div>
      <select aria-label="项目" value={selected.project} disabled={piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onChange={e=>{const p=catalog.find(p=>p.id===e.target.value);if(p?.scenes[0])void load(p.id,p.scenes[0].id);}}>{catalog.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {readOnly&&<section className="builtin-project" aria-label="内置项目保护"><strong><LockKeyhole size={14}/>内置样板 · 只读</strong><p>可观看和导出，不能修改或删除。复制后再动手练习。</p><button disabled={cloning||loading||busy} onClick={()=>void copyTeachingProject()}><Copy size={14}/>{cloning?'正在复制…':'复制为我的项目'}</button></section>}
      <nav className="scene-list" aria-label="场景列表">{currentProject?.scenes.map((s,i)=><button key={s.id} className={'scene-item '+(s.id===selected.scene?'selected':'')} disabled={piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void load(selected.project,s.id)}><FileCode2 size={17}/><span>{sceneLabels[s.id]??s.id}<small>{s.id}.ts</small></span><span className="scene-number">{String(i+1).padStart(2,'0')}</span></button>)}</nav>
      <div className="panel-title tree-title"><span>场景对象</span><span className="count">{subjects.length}</span></div>
      <div className="object-list">{subjects.length?subjects.map(([label,o])=><button key={label} className={object===o?'active':''} disabled={piloting||busy} onClick={()=>runtime.current?.select(o)}>{label.startsWith('人物')?<UserRound size={15}/>:<Box size={15}/>}<span>{label}</span><small>{o.name}</small></button>):<p className="empty-note">在代码中添加对象，即可在场景里查看。</p>}</div>
      <div className="library-note"><Layers size={18}/><div>共享模型库<small>几何体 · 桌椅 · 车辆 · 关节人偶</small></div><span>v0.1</span></div>
      <div className="code-note"><Code2 size={16}/><p>{readOnly?'内置教学原版由框架提供。你的练习与改动保存在独立副本中。':'动作由场景代码定义；机位和分镜摆位可手动调整并保存。'}</p></div>
    </aside>
    <main className={'workspace'+(piloting?' is-piloting':'')}>
      <div className="viewport-toolbar"><div className="tabs"><button className={tab==='preview'?'active':''} onClick={()=>setTab('preview')}><Box size={15}/>场景预览</button><button disabled={piloting} className={tab==='source'?'active':''} onClick={()=>setTab('source')}><Code2 size={15}/>场景代码</button><button disabled={piloting} className={tab==='delivery'?'active':''} onClick={()=>{setTab('delivery');if(runtime.current)runtime.current.playing=false;setPlaying(false);}}>交付信息{deliveryDirty?' · 未保存':''}</button></div><div className="view-actions"><span>1 单位 = 1 米</span><button className={'icon-button '+(grid?'active':'')} aria-label="切换网格" disabled={piloting||busy} onClick={()=>{setGrid(!grid);if(runtime.current)runtime.current.grid=!grid;}}><Grid3X3 size={16}/></button><button className="icon-button" aria-label="重置观察视角" disabled={piloting||busy} onClick={()=>runtime.current?.home()}><Maximize size={16}/></button></div></div>
      <div ref={viewport} className={'viewport-wrap'+(fullscreen.active?' is-fullscreen':'')} style={{display:tab==='preview'?'block':'none'}}><div ref={host} className="viewport" data-testid="viewport"/>
        {!piloting&&<div className="viewport-screen-actions">{fullscreen.active&&!readOnly&&data&&!cameraInfo?.preset&&cameraInfo?.projection==='perspective'&&<button disabled={busy||loading||saving} onClick={beginPilot}><Camera size={16}/>操控机位</button>}<button className="viewport-fullscreen" aria-label={fullscreen.active?'退出全屏':'进入全屏'} title={fullscreen.active?'退出全屏（Esc）':'全屏预览'} disabled={fullscreen.pending} onClick={()=>void fullscreen.toggle()}>{fullscreen.active?<Minimize size={17}/>:<Maximize size={17}/>}<span>{fullscreen.active?'退出全屏':'全屏'}</span></button></div>}
        <div className="view-switch"><button className={mode==='free'?'active':''} disabled={piloting||busy} onClick={()=>changeMode('free')}>自由观察</button><button className={mode==='shot'?'active':''} disabled={piloting||busy} onClick={()=>changeMode('shot')}><Camera size={14}/>拍摄画面</button></div>
        <div className="viewport-bottom"><span>{piloting?'按住拖动转向 · 点击画面后使用键盘移动':mode==='free'?'拖动旋转 · 右键平移 · 滚轮缩放':'输出机位 · 按画幅显示'}</span></div>
      {piloting&&cameraInfo&&<PilotBar fullscreen={fullscreen.active} fullscreenPending={fullscreen.pending} onFullscreen={()=>void fullscreen.toggle()} info={cameraInfo} speed={pilotSpeed} onSpeed={n=>{if(runtime.current?.pilot){runtime.current.pilot.speed=n;setPilotSpeed(n);}}} onLens={(key,n)=>{const rt=runtime.current;if(rt?.pilot){rt.pilot.lens(key,n);rt.draw();setCameraInfo(rt.cameraInfo);}}} onMotion={motion=>runtime.current?.setPilotMotion(motion)} onApply={()=>finishPilot(true)} onCancel={()=>finishPilot(false)}/>}
        {loading&&<div className="loading-cover"><RefreshCw className="spin" size={22}/>正在构建场景</div>}
        {!data&&!loading&&<div className="loading-cover">{catalog.some(p=>p.scenes.length)?'场景未加载，请修正下方错误后重新加载。':'点击新建场景，开始创建你的项目。'}</div>}
      </div>

      {tab==='delivery'&&data&&<DeliveryEditor output={{width:Number(size.split('x')[0]),height:Number(size.split('x')[1]),fps}} getPromptCamera={shot=>runtime.current!.promptCamera(shot)} scene={data} camera={camera} time={time} info={cameraInfo} value={delivery} disabled={piloting||busy||loading||saving} readOnly={readOnly} dirty={deliveryDirty} saving={saving} error={deliveryError} onChange={changeDelivery} onSave={()=>void saveDelivery()} onDiscard={()=>changeDelivery(structuredClone(savedDelivery.current))} onSeek={seek}/>}
      {tab==='source'&&<div className="source-panel"><div><FileCode2 size={16}/><code>{path}</code><button onClick={async()=>{try{await navigator.clipboard.writeText(path);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setError('无法复制路径，请从上方手动复制。');}}}>{copied?<Check size={14}/>:<Copy size={14}/>}复制路径</button></div><p>{readOnly?'内置样板代码只供阅读；请先复制为自己的项目，再使用编辑器或 Agent 修改副本。':'使用编辑器或 Agent 修改此文件。这里显示当前加载的代码。'}</p><pre>{source||'场景代码未加载'}</pre></div>}
      {error&&<div className="error-panel" role="alert"><div><strong>需要修正</strong><button className="icon-button" aria-label="收起错误" onClick={()=>setError('')}><X size={15}/></button></div><pre>{error}</pre></div>}
      {editDirty&&<div className="notice">摄影机修改正在预览，保存到项目后才能导出或切换场景。</div>}
      {dirty&&busy&&<div className="notice">源文件已修改，本次导出继续使用开始时的版本。完成后请重新加载。</div>}
      <section className="timeline" aria-label="时间预览"><div className="transport"><div className="transport-buttons"><button className="icon-button" aria-label="上一个镜头" title="上一个镜头" disabled={piloting||busy||loading||saving||!previousShot} onClick={()=>jumpShot(-1)}><SkipBack size={17}/></button><button className="play-button" aria-label={playing?'暂停':'播放'} disabled={piloting||busy||loading||saving||!data} onClick={()=>{const r=runtime.current;if(r){if(r.time>=duration)r.time=0;r.playing=!r.playing;setPlaying(r.playing);}}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><button className="icon-button" aria-label="下一个镜头" title="下一个镜头" disabled={piloting||busy||loading||saving||!nextShot} onClick={()=>jumpShot(1)}><SkipForward size={17}/></button></div><span className="timecode">{time.toFixed(2)}<small> / {duration.toFixed(2)} s</small></span><label className="loop"><input type="checkbox" checked={loop} disabled={piloting||busy} onChange={e=>{setLoop(e.target.checked);if(runtime.current)runtime.current.loop=e.target.checked;}}/>循环</label><span className="timeline-caption">成片时间 · {fps} fps</span></div><div className="ruler-labels">{Array.from({length:7},(_,i)=><span key={i}>{(duration*i/6).toFixed(1)} s</span>)}</div><input aria-label="场景时间" type="range" min="0" max={duration} step={1/fps} value={time} disabled={piloting||busy||!data} onChange={e=>seek(Number(e.target.value))}/>{!readOnly&&<AudioTrack track={audioTrack} peaks={runtime.current?.audio.peaks??[]} time={time} duration={duration} cuts={data?.cameraCuts?.[camera]??[]} disabled={piloting||busy||loading||saving||!data} saving={saving} dirty={audioDirty} error={audioError} onImport={file=>void saveAudio(null,file)} onChange={changeAudio} onSave={()=>void saveAudio(audioTrack)} onRemove={()=>void saveAudio(null)} onSeek={seek}/>}</section>
    </main>
    <aside className="right-panel"><div className="panel-title"><span>摄影机监看</span><Camera size={16}/></div><div ref={monitor} className="camera-monitor"/><div className="camera-controls"><select aria-label="拍摄机位" value={camera} disabled={piloting||busy||!data} onChange={e=>changeCamera(e.target.value)}>{Object.entries(data?.cameras??{}).map(([id,c])=><option key={id} value={id}>{data?.cameraMetadata?.[id]?.label||c.name||id}</option>)}</select><span>{size.replace('x',' × ')}<span>{fps} fps</span></span><CameraPanel info={cameraInfo} readOnly={readOnly} lesson={cameraInfo?data?.cameraLessons?.[cameraInfo.cameraId]:undefined} cuts={data?.cameraCuts?.[camera]} onSeek={seek} disabled={piloting||busy||loading||saving}/>{!readOnly&&data&&cameraInfo&&<CameraEditor key={piloting?'piloting':'editing'} onPilot={beginPilot} scene={data} info={cameraInfo} edits={edits} time={time} selected={camera} disabled={piloting||busy||loading||saving} dirty={editDirty} saving={saving} error={editError} onApply={applyEdits} onSave={()=>void saveEdits()} onDiscard={discardEdits} onSelect={changeCamera} onSeek={seek} captureView={captureView}/>}</div>
      <div className="panel-title"><span>{object?'对象信息':'场景说明'}</span>{object?<Box size={15}/>:<FileCode2 size={15}/>}</div><div className="inspector">{object?<><strong>{object.name||'未命名对象'}</strong><span className="muted">位置 · 米</span><div className="coordinates">{['x','y','z'].map(axis=><div key={axis}><span>{axis.toUpperCase()}</span><code>{object.position[axis as 'x'|'y'|'z'].toFixed(2)}</code></div>)}</div><p>{readOnly?'内置样板的位置只供观察；复制为自己的项目后可修改。':'初始位置在代码中修改；分镜摆位可在右侧编辑。'}</p></>:<p>{data?.description??'引用共享模型，用 Three.js 代码构建你的拍摄参考场景。'}</p>}</div>
      <div className="export-section"><div className="panel-title"><span>导出参考</span><Download size={16}/></div><label>画幅与尺寸<select aria-label="输出画幅" value={size} disabled={piloting||busy||!data} onChange={e=>resize(e.target.value)}>{!['1280x720','720x1280','1920x1080','1080x1920'].includes(size)&&<option value={size}>{size} · 场景设置</option>}<option value="1280x720">16:9 · 1280 × 720</option><option value="720x1280">9:16 · 720 × 1280</option><option value="1920x1080">16:9 · 1920 × 1080</option><option value="1080x1920">9:16 · 1080 × 1920</option></select></label><label>帧率<select aria-label="输出帧率" value={fps} disabled={piloting||busy||!data} onChange={e=>{const n=Number(e.target.value);setFps(n);if(runtime.current)runtime.current.output.fps=n;}}>{![24,25,30,60].includes(fps)&&<option value={fps}>{fps} fps</option>}{[24,25,30,60].map(n=><option key={n} value={n}>{n} fps</option>)}</select></label><div className="export-actions"><button disabled={piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('still').catch(()=>{})}><Image size={16}/>当前帧 PNG</button><button disabled={piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('sequence').catch(()=>{})}><Layers size={16}/>图片序列 ZIP</button><button className="primary" disabled={piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('video').catch(()=>{})}><Film size={16}/>导出参考视频</button></div><button className="primary" disabled={piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('delivery').catch(()=>{setTab('delivery');})}>导出完整交付包</button><p className="export-hint">白模视频及交付包参考画面：长边最高 640 像素，不模拟景深、对焦模糊或阴影。保留原帧率；上方尺寸仍用于目标影片与单独图片导出。</p><p className="export-hint">使用选中机位 · 固定时间采样<br/>自动保存源码、摄影机记录与导出清单</p>
      {(busy||status)&&<div className="export-progress" role="status"><span>{status}</span>{busy&&<button onClick={()=>abort.current?.abort()}>取消</button>}<progress max="1" value={progress}/></div>}
      {result&&<div className="export-result"><strong><Check size={15}/>已保存到本地</strong>{result.files.map(f=><a key={f.name} href={f.url} download><Download size={13}/>{f.name}<ExternalLink size={12}/></a>)}<code>{result.directory}</code></div>}
      </div>
    </aside><footer className="statusbar"><span><Code2 size={12}/>{path}</span><span>Three.js · Y 向上 · 米 / 秒</span></footer>
    <dialog ref={dialog} className="create-dialog"><div className="dialog-title"><h2>创建场景工程</h2><button className="icon-button" aria-label="关闭新建场景" disabled={creating} onClick={()=>dialog.current?.close()}><X size={18}/></button></div><p>生成可编辑的 TypeScript 源文件，共享基础模型与运行工具。</p><form onSubmit={e=>{e.preventDefault();void create();}}><label>项目<select value={newProject} onChange={e=>setNewProject(e.target.value)}>{catalog.filter(p=>!p.readOnly).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new">创建新项目…</option></select></label>{newProject==='__new'&&<><label>项目名称<input required value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="例如：夜行 MV"/></label><label>项目目录<input required pattern="[a-z0-9][a-z0-9_-]{0,47}" value={projectSlug} onChange={e=>setProjectSlug(e.target.value)} placeholder="night-walk"/></label></>}<label>场景文件名<input autoFocus required pattern="[a-z0-9][a-z0-9_-]{0,47}" value={sceneSlug} onChange={e=>setSceneSlug(e.target.value)} placeholder="shot-01"/><small>小写英文、数字、横线或下划线，不含 .ts</small></label><label>起始模板<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="blocking">双人走位 · 动作与动态机位</option><option value="room">室内白模 · 桌椅与人物</option><option value="empty">空场景 · 地面、灯光与摄影机</option></select></label>{createError&&<p className="form-error" role="alert">{createError}</p>}<div className="dialog-footer"><button type="button" disabled={creating} onClick={()=>dialog.current?.close()}><ArrowLeft size={14}/>取消</button><button className="primary" disabled={creating} type="submit"><Plus size={15}/>{creating?'正在生成…':'创建源文件'}</button></div></form></dialog>
  </div>;
}
