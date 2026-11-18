import {cutContainsTime} from '../lib/core/cut-time';
import type {FramingTiming} from './FramingTiming';
import {applyControlledCamera} from './camera-workspace';
import {ShotReview} from './ShotReview';
import {DeliveryEditor} from './DeliveryEditor';
import {emptyDelivery,validateDelivery,type DeliveryDocument} from '@vibestage/core';
import {useCallback,useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Box,Camera,PanelRight,ChevronRight,Clapperboard,Code2,Copy,Download,FileCode2,FolderPlus,Grid3X3,Maximize,Minimize,Pause,Play,Plus,RefreshCw,SkipBack,SkipForward,UserRound,X,Check,Film,Image,Layers,ArrowLeft,ExternalLink,LockKeyhole} from 'lucide-react';
import {validateScene,createCameraEditSession,emptyCameraEdits,FULL_FRAME,focalLengthFromFov,type CameraEdits,type CameraEditSession,type CameraSnapshot,type StageScene} from '@vibestage/core';
import {StageRuntime,api,type JobResult} from './runtime';
import './style.css';
import {CameraPanel} from './CameraPanel';
import {useViewportFullscreen} from './useViewportFullscreen';
import {PilotBar} from './PilotBar';
import {CameraEditor,type EditorSection} from './CameraEditor';
import {ShotNarrative} from './ShotNarrative';
import './shot-workspace.css';
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
  const [presetPending,setPresetPending]=useState(false),presetPendingRef=useRef(false);
  const registerPresetPending=useCallback((pending:boolean)=>{presetPendingRef.current=pending;setPresetPending(pending);},[]);
  const registerPlaybackPreparation=useCallback((prepare:(()=>boolean)|undefined)=>{if(runtime.current)runtime.current.preparePlayback=prepare;},[]);
  const [cameraFeedback,setCameraFeedback]=useState(''),[presetRequest,setPresetRequest]=useState<{cameraId:string;serial:number}|undefined>();
  const [editorSection,setEditorSection]=useState<EditorSection>('closed');
  const [rail,setRail]=useState<'details'|'export'|'closed'|null>(null);
  const fullscreen=useViewportFullscreen(viewport,()=>{const rt=runtime.current;if(rt){rt.stopPilotInput();rt.suppressPilotEscapeUntil=performance.now()+500;}});
  const [catalog,setCatalog]=useState<Project[]>([]),[selected,setSelected]=useState<Selection>({project:'demo',scene:'meeting'}),[data,setData]=useState<StageScene|null>(null),[source,setSource]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[dirty,setDirty]=useState(false);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[loop,setLoop]=useState(true),[camera,setCamera]=useState(''),[mode,setMode]=useState<'free'|'shot'>('free'),[grid,setGrid]=useState(true),[tab,setTab]=useState<'preview'|'source'|'delivery'|'review'>('preview'),[object,setObject]=useState<THREE.Object3D|null>(null);
  const [size,setSize]=useState('1280x720'),[fps,setFps]=useState(24),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[status,setStatus]=useState(''),[result,setResult]=useState<JobResult|null>(null),[copied,setCopied]=useState(false),[cloning,setCloning]=useState(false),[creating,setCreating]=useState(false),[createError,setCreateError]=useState('');
  const [edits,setEdits]=useState<CameraEdits>(emptyCameraEdits),[editDirty,setEditDirty]=useState(false),[saving,setSaving]=useState(false),[editError,setEditError]=useState('');
  const editSession=useRef<CameraEditSession|null>(null),savedEdits=useRef<CameraEdits>(emptyCameraEdits()),editRevision=useRef('missing'),editDirtyRef=useRef(false),savingRef=useRef(false);
  const [audioTrack,setAudioTrack]=useState<Soundtrack|null>(null),[audioDirty,setAudioDirty]=useState(false),[audioError,setAudioError]=useState('');
  const audioRevision=useRef('missing'),audioDirtyRef=useRef(false),savedAudio=useRef<Soundtrack|null>(null);
  const [delivery,setDelivery]=useState<DeliveryDocument>(emptyDelivery),[deliveryDirty,setDeliveryDirty]=useState(false),[deliveryError,setDeliveryError]=useState('');
  const deliveryRef=useRef<DeliveryDocument>(emptyDelivery()),savedDelivery=useRef<DeliveryDocument>(emptyDelivery()),deliveryRevision=useRef('missing'),deliveryDirtyRef=useRef(false);
  const [timing,setTiming]=useState<FramingTiming>('whole');
  const [pilotScope,setPilotScope]=useState<'shot'|'shared'>('shot');
  const [piloting,setPiloting]=useState(false),[pilotSpeed,setPilotSpeed]=useState(1);
  const [cameraInfo,setCameraInfo]=useState<CameraSnapshot|null>(null);
  const [newProject,setNewProject]=useState('demo'),[projectSlug,setProjectSlug]=useState(''),[projectName,setProjectName]=useState(''),[sceneSlug,setSceneSlug]=useState(''),[template,setTemplate]=useState('blocking');
  const current=useRef(selected),sourceHash=useRef(''),generation=useRef(0),dirtyRef=useRef(false);
  current.current=selected;
  async function load(project:string,scene:string){
    const rt=runtime.current;if(!rt||rt.busy||savingRef.current)return;if(rt.pilot)throw new Error('请先应用或取消机位操控');if(presetPendingRef.current||editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current)throw new Error('请先保存摄影机、音频或交付资料修改，再切换场景');const openNewScene=!rt.instance||current.current.project!==project||current.current.scene!==scene;const version=++generation.current;setLoading(true);setPresetRequest(undefined);setCameraFeedback('');setError('');setResult(null);setObject(null);setSelected({project,scene});current.current={project,scene};try{sessionStorage.setItem('vibestage:selection',JSON.stringify({project,scene}));}catch{}rt.playing=false;
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
    runtime.current=rt;setPiloting(false);setMode(rt.mode);let last=0;rt.onTime=(t,p)=>{if(performance.now()-last>80){setTime(t);setPlaying(p);if(rt.pilot)setPilotSpeed(rt.pilot.speed);setCameraInfo(previous=>JSON.stringify(previous)===JSON.stringify(rt.cameraInfo)?previous:rt.cameraInfo);last=performance.now();}};rt.onSelect=setObject;rt.onPilotCancel=()=>{rt.endPilot();setCameraFeedback('已取消本次操控，保留进入前的设置');setPiloting(false);setMode(rt.mode);setCameraInfo(rt.cameraInfo);};
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
    let debounce:ReturnType<typeof setTimeout>;const changed=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{void (async()=>{try{const cat=await api<Catalog>('/projects?project='+encodeURIComponent(current.current.project));if(cat.sourceHash===sourceHash.current)return;dirtyRef.current=true;setDirty(true);if(!rt.busy&&!rt.pilot&&!presetPendingRef.current&&!editDirtyRef.current&&!audioDirtyRef.current&&!deliveryDirtyRef.current&&!savingRef.current)await load(current.current.project,current.current.scene);}catch(e){setEditError((e as Error).message);}})();},400);};
    import.meta.hot?.on('vibestage:changed',changed);
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(presetPendingRef.current||editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current||rt.pilot){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
    const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,select,textarea,button,dialog')||rt.busy||rt.pilot||savingRef.current||!rt.instance)return;if(e.code==='Space'){e.preventDefault();if(!rt.playing&&rt.time>=rt.instance!.durationSeconds)rt.time=0;rt.playing=!rt.playing;setPlaying(rt.playing);}if(!presetPendingRef.current&&e.key==='ArrowRight')rt.seek(rt.time+1/rt.output.fps);if(!presetPendingRef.current&&e.key==='ArrowLeft')rt.seek(rt.time-1/rt.output.fps);};window.addEventListener('keydown',key);
    window.vibeStage={getState:()=>({selection:current.current,ready:!!rt.instance,time:rt.time,camera:rt.cameraId,duration:rt.instance?.durationSeconds,sourceHash:sourceHash.current,busy:rt.busy,piloting:!!rt.pilot,cameraInfo:rt.cameraInfo,hasUnsavedCameraEdits:editDirtyRef.current,audio:rt.audio.track,audioClock:rt.audio.position(),playing:rt.playing,hasUnsavedAudioEdits:audioDirtyRef.current,hasUnsavedDeliveryEdits:deliveryDirtyRef.current}),seek:t=>rt.seek(t),camera:id=>{if(rt.pilot)throw new Error('请先应用或取消机位操控');if(rt.busy)throw new Error('导出期间不能切换机位');if(!rt.instance?.cameras[id])throw new Error('机位不存在');rt.playing=false;rt.cameraId=id;rt.draw();setCameraInfo(rt.cameraInfo);setCamera(id);},load,export:exportScene,cancel:()=>abort.current?.abort()};
    return()=>{generation.current++;abort.current?.abort();clearTimeout(debounce);import.meta.hot?.off('vibestage:changed',changed);window.removeEventListener('keydown',key);window.removeEventListener('beforeunload',beforeUnload);rt.dispose();runtime.current=null;};
  },[]);
  function applyEdits(next:CameraEdits){
    assertWritableProject(current.current.project);
    const rt=runtime.current,session=editSession.current;if(!rt?.instance||!session||rt.busy||savingRef.current)throw new Error('当前不能编辑机位');
    session.setEdits(next);rt.invalidateCameraPath();rt.mode='shot';setMode('shot');setCameraFeedback('调整已应用到拍摄画面，尚未保存');if(!rt.instance.cameras[rt.cameraId])rt.cameraId=Object.keys(rt.instance.cameras)[0];rt.seek(rt.time);
    const changed=JSON.stringify(next)!==JSON.stringify(savedEdits.current);editDirtyRef.current=changed;setEditDirty(changed);setEdits(structuredClone(next));setCamera(rt.cameraId);setCameraInfo(rt.cameraInfo);setEditError('');setPlaying(false);setResult(null);
  }
  async function saveEdits(){
    if(isBuiltinProject(current.current.project))return;
    if(runtime.current?.pilot||savingRef.current||!editDirtyRef.current)return;savingRef.current=true;setSaving(true);setEditError('');
    try{const result=await api<{edits:CameraEdits;revision:string;sourceHash:string}>('/camera-settings',{...current.current,edits:editSession.current!.getEdits(),revision:editRevision.current,sourceHash:sourceHash.current},'PUT');savedEdits.current=result.edits;editRevision.current=result.revision;sourceHash.current=result.sourceHash;editDirtyRef.current=false;dirtyRef.current=false;setEditDirty(false);setDirty(false);}
    catch(e){setEditError((e as Error).message);}finally{savingRef.current=false;setSaving(false);}
  }
  function discardEdits(){applyEdits(savedEdits.current);setCameraFeedback('已恢复上次保存的机位与分镜');}
  function beginPilot(){if(presetPendingRef.current){setError('请先应用或取消预设参数，再控制镜头');return;}if(isBuiltinProject(current.current.project))return;const rt=runtime.current;if(!rt)return;try{setCameraFeedback('');setPilotScope('shot');rt.beginPilot();setPiloting(true);setMode('shot');setTab('preview');setPlaying(false);setPilotSpeed(rt.pilot!.speed);setCameraInfo(rt.cameraInfo);setError('');requestAnimationFrame(()=>{if(window.matchMedia('(max-width:760px)').matches)host.current?.parentElement?.scrollIntoView({block:'start'});});}catch(e){setError((e as Error).message);}}
  function finishPilot(apply:boolean){const rt=runtime.current;if(!rt?.pilot)return;try{if(apply){const patch=rt.pilot.patch();if(Object.keys(patch).length){const result=applyControlledCamera(rt.instance!,editSession.current!.getEdits(),rt.cameraId,rt.time,rt.pilot.id,patch,rt.pilot.framing(),pilotScope,timing,rt.output.width/rt.output.height);applyEdits(result.edits);rt.cameraId=result.selection;setCamera(result.selection);setCameraFeedback(timing==='key'?'已应用当前时间点的构图关键帧，尚未保存':pilotScope==='shared'?'已应用到共用机位及其关联镜头，尚未保存':'已应用到当前镜头，其他镜头不变，尚未保存');rt.traceControl('committed',{cameraId:result.cameraId,patch,stored:result.edits.cameras[result.cameraId]});}}rt.endPilot(apply);if(!apply)setCameraFeedback('已取消本次操控，保留进入前的设置');setPiloting(false);setMode(rt.mode);setCameraInfo(rt.cameraInfo);}catch(e){setError((e as Error).message);}}
  function captureView(){
    const rt=runtime.current!;rt.free.updateWorldMatrix(true,false);const p=rt.free.getWorldPosition(new THREE.Vector3()),q=rt.free.getWorldQuaternion(new THREE.Quaternion()),e=new THREE.Euler().setFromQuaternion(q,'YXZ');
    return {position:p.toArray() as [number,number,number],rotationDegrees:[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg) as [number,number,number],focalLengthMm:focalLengthFromFov(rt.free.getEffectiveFOV(),FULL_FRAME,rt.output.width/rt.output.height),sensor:{...FULL_FRAME}};
  }
  function changeCamera(id:string){setPresetRequest(undefined);if(runtime.current&&!runtime.current.busy&&!runtime.current.pilot){runtime.current.playing=false;runtime.current.cameraId=id;runtime.current.draw();setCameraInfo(runtime.current.cameraInfo);setCamera(id);setPlaying(false);}}
  function changeMode(m:'free'|'shot'){if(runtime.current)runtime.current.mode=m;setMode(m);}
  function resize(value:string){setSize(value);const [width,height]=value.split('x').map(Number);if(runtime.current)runtime.current.output={...runtime.current.output,width,height};}
  function seek(t:number){if(presetPendingRef.current){setError('请先应用或取消预设参数，再切换时间');return;}setPresetRequest(undefined);runtime.current?.seek(t);setTime(t);setPlaying(false);setCameraInfo(runtime.current?.cameraInfo??null);}
  function pauseEditing(){const rt=runtime.current;if(rt?.playing){rt.playing=false;setPlaying(false);setTime(rt.time);setCameraInfo(rt.cameraInfo);}}
  async function saveWorkspace(){pauseEditing();if(runtime.current?.preparePlayback?.()===false)return;await saveEdits();if(editDirtyRef.current)return;await saveDelivery();setCameraFeedback(deliveryDirtyRef.current?'机位与分镜已保存；交付资料保存失败，请重试':'工作区已保存到项目');}
  function jumpShot(direction:-1|1){
    const rt=runtime.current;if(!rt?.instance||rt.pilot||rt.busy||loading||saving||presetPendingRef.current)return;
    const target=adjacentShot(rt.instance,rt.cameraId,rt.time,direction);if(!target)return;
    rt.cameraId=target.cameraId;rt.seek(target.time,{preservePlayback:true});
    setCamera(rt.cameraId);setMode(rt.mode);setTime(rt.time);setPlaying(rt.playing);setCameraInfo(rt.cameraInfo);
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
  const activeCuts=data?.cameraCuts?.[camera]??[],activeCut=activeCuts.find(c=>cutContainsTime(c,time))??activeCuts.at(-1);
  const actualEdit=cameraInfo?edits.cameras[cameraInfo.cameraId]:undefined;
  const actualUnsaved=cameraInfo&&JSON.stringify(actualEdit)!==JSON.stringify(savedEdits.current.cameras[cameraInfo.cameraId]);
  const cameraReferences=Object.values(data?.cameraCuts??{}).flat().filter(c=>c.cameraId===cameraInfo?.cameraId);
  const activeRail=rail??(readOnly||mode==='free'?'details':'closed');
  const shotName=activeCut?.label||activeCut?.id;
  const cameraStatus=actualEdit?[actualUnsaved?'未保存':'已调整',!activeCut&&actualEdit.created&&!cameraReferences.length?'未加入分镜组':''].filter(Boolean).join(' · '):'';
  const sequences=Object.keys(data?.cameraCuts??{});
  function replaceShotCamera(cameraId:string){
    if(!activeCut)return;
    const next=structuredClone(edits);
    next.sequences[camera]=activeCuts.map(c=>c.id===activeCut.id?{...c,cameraId}:c);
    try{applyEdits(next);}catch(e){setEditError((e as Error).message);}
  }
  const changeRail=(next:'details'|'export')=>{
    const opening=activeRail!==next;
    setRail(opening?next:'closed');
    if(opening&&window.matchMedia('(max-width:760px)').matches){
      requestAnimationFrame(()=>document.getElementById('workspace-rail')?.scrollIntoView({block:'start'}));
    }
  };
  return <div className={'app shot-workspace-app'+(activeRail==='closed'?' output-collapsed':'')} onWheelCapture={event=>{
    // Scrolling a form must not silently step a focused numeric input.
    const target=event.target;
    if(target instanceof HTMLInputElement&&target.type==='number'&&target===document.activeElement)target.blur();
  }}>
    <header className="topbar"><a className="brand" href="/" aria-label="VibeStage 首页" onClick={event=>{if(presetPendingRef.current||runtime.current?.pilot||editDirtyRef.current||audioDirtyRef.current||deliveryDirtyRef.current||savingRef.current||runtime.current?.busy){event.preventDefault();setError(runtime.current?.pilot?'请先应用或取消镜头操控，再返回首页':runtime.current?.busy?'请等待导出完成或取消导出，再返回首页':'请先保存或放弃未保存修改，再返回首页');}}}><span className="brandmark"><Clapperboard size={20}/></span>VibeStage</a><div className="breadcrumb"><span>{currentProject?.name??'本地项目'}</span><ChevronRight size={14}/><strong>{data?.name??selected.scene}</strong></div><div className="top-actions"><span className={'connection '+(error?'warning':'')}><i/>{loading?'加载中':error?'需要修正':busy?'正在导出':dirty?'代码已更新':'本地运行'}</span><button disabled={presetPending||piloting||busy||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void load(selected.project,selected.scene)} title="重新加载源文件"><RefreshCw size={15}/><span>重新加载</span></button><button className="primary" disabled={presetPending||piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>{setSceneSlug('');setNewProject(readOnly?'__new':selected.project||'__new');setCreateError('');dialog.current?.showModal();}}><Plus size={16}/>新建场景</button></div></header>
    <aside className="left-panel">
      <div className="panel-title"><span>项目场景</span><button className="icon-button" aria-label="新建项目" disabled={presetPending||piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>{setNewProject('__new');setSceneSlug('');setCreateError('');dialog.current?.showModal();}}><FolderPlus size={17}/></button></div>
      <select aria-label="项目" value={selected.project} disabled={presetPending||piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onChange={e=>{const p=catalog.find(p=>p.id===e.target.value);if(p?.scenes[0])void load(p.id,p.scenes[0].id);}}>{catalog.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {readOnly&&<section className="builtin-project" aria-label="内置项目保护"><strong><LockKeyhole size={14}/>内置样板 · 只读</strong><button disabled={cloning||loading||busy} onClick={()=>void copyTeachingProject()}><Copy size={14}/>{cloning?'正在复制…':'复制为我的项目'}</button></section>}
      <nav className="scene-list" aria-label="场景列表">{currentProject?.scenes.map(s=><button key={s.id} title={s.path} className={'scene-item '+(s.id===selected.scene?'selected':'')} disabled={presetPending||piloting||busy||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void load(selected.project,s.id)}><FileCode2 size={17}/><span>{sceneLabels[s.id]??s.id}</span></button>)}</nav>
      <div className="panel-title tree-title"><span>场景对象</span><span className="count">{subjects.length}</span></div>
      <div className="object-list">{subjects.length?subjects.map(([label,o])=><button key={label} title={o.name} className={object===o?'active':''} disabled={presetPending||piloting||busy} onClick={()=>{runtime.current?.select(o);setRail('details');}}>{label.startsWith('人物')?<UserRound size={15}/>:<Box size={15}/>}<span>{label}</span></button>):<p className="empty-note">在代码中添加对象，即可在场景里查看。</p>}</div>
    </aside>
    <main className={'workspace'+(piloting?' is-piloting':'')}>
      <div className="viewport-toolbar"><div className="tabs"><button className={tab==='preview'?'active':''} onClick={()=>setTab('preview')}><Box size={15}/>场景预览</button><button disabled={presetPending||piloting||busy||loading} className={tab==='review'?'active':''} onClick={()=>{setTab('review');if(runtime.current)runtime.current.playing=false;setPlaying(false);}}>分镜审看</button><button disabled={presetPending||piloting} className={tab==='source'?'active':''} onClick={()=>setTab('source')}><Code2 size={15}/>场景代码</button><button disabled={presetPending||piloting} className={tab==='delivery'?'active':''} onClick={()=>{setTab('delivery');if(runtime.current)runtime.current.playing=false;setPlaying(false);}}>交付信息{deliveryDirty?' · 未保存':''}</button></div><div className="view-actions"><button className="rail-toggle" aria-controls="workspace-rail" aria-expanded={activeRail==='details'} onClick={()=>changeRail('details')}><PanelRight size={15}/>辅助</button><button className="rail-toggle export-toggle" aria-controls="workspace-rail" aria-expanded={activeRail==='export'} onClick={()=>changeRail('export')}><Download size={15}/>导出</button><button className={'icon-button '+(grid?'active':'')} aria-label="切换网格" disabled={presetPending||piloting||busy} onClick={()=>{setGrid(!grid);if(runtime.current)runtime.current.grid=!grid;}}><Grid3X3 size={16}/></button><button className="icon-button" aria-label="重置观察视角" disabled={presetPending||piloting||busy} onClick={()=>runtime.current?.home()}><Maximize size={16}/></button></div></div>
      {tab==='preview'&&<div className="current-shot-bar" onFocusCapture={pauseEditing}>
        {activeCut&&<strong className="current-shot-title" title={shotName}>{shotName}</strong>}
        <span className="shot-range">{activeCut?`${Number(activeCut.start.toFixed(2))}–${Number(activeCut.end.toFixed(2))} 秒`:`${duration} 秒`}</span>
        {activeCut&&cameraInfo&&<label>机位<select aria-label="当前镜头机位" value={activeCut.cameraId} disabled={readOnly||presetPending||piloting||busy||loading||saving}
          onChange={e=>replaceShotCamera(e.target.value)}>
          {Object.entries(data?.cameras??{}).filter(([id,c])=>id===activeCut.cameraId||(!data?.cameraCuts?.[id]&&c instanceof THREE.PerspectiveCamera)).map(([id,c])=><option key={id} value={id}>{data?.cameraMetadata?.[id]?.label||c.name||id}</option>)}
        </select></label>}
        <label className="source-picker">{activeCut?'预览':'机位'}<select aria-label="拍摄机位" value={camera} disabled={presetPending||piloting||busy||loading||saving||!data} onChange={e=>changeCamera(e.target.value)}>
          {Object.entries(data?.cameras??{}).map(([id,c])=><option key={id} value={id}>{data?.cameraMetadata?.[id]?.label||(sequences.includes(id)?`分镜组 ${sequences.indexOf(id)+1}`:c.name||id)}</option>)}
        </select></label>
        {cameraStatus&&<span className="shot-state" role="status">{cameraStatus}</span>}
        {activeCut&&!piloting&&<button className="shot-replay" disabled={presetPending||busy||loading||saving} onClick={()=>{runtime.current?.playReview(activeCut.start,activeCut.end,mode);setPlaying(runtime.current?.playing??false);}}><Play size={13}/>从本镜头回放</button>}
      </div>}
      <div ref={viewport} className={'viewport-wrap'+(fullscreen.active?' is-fullscreen':'')} style={{display:tab==='preview'?'block':'none'}}><div ref={host} className="viewport" data-testid="viewport"/>
        {!piloting&&<div className="viewport-screen-actions">{mode==='free'&&cameraInfo&&<button disabled={busy||loading} onClick={()=>runtime.current?.locateShotCamera()}><Camera size={16}/>定位机位</button>}{mode==='shot'&&data&&cameraInfo?.projection==='perspective'&&<button className="viewport-camera-control" disabled={readOnly||busy||loading||saving} title={readOnly?'内置样板只读，请先复制为自己的项目':'暂停播放，调整构图并保留原运镜'} onClick={beginPilot}><Camera size={16}/>控制镜头</button>}<button className="viewport-fullscreen" aria-label={fullscreen.active?'退出全屏':'进入全屏'} title={fullscreen.active?'退出全屏（Esc）':'全屏预览'} disabled={fullscreen.pending} onClick={()=>void fullscreen.toggle()}>{fullscreen.active?<Minimize size={17}/>:<Maximize size={17}/>}<span>{fullscreen.active?'退出全屏':'全屏'}</span></button></div>}
        <div className="view-switch"><button className={mode==='free'?'active':''} disabled={presetPending||piloting||busy} onClick={()=>changeMode('free')}>自由观察</button><button className={mode==='shot'?'active':''} disabled={presetPending||piloting||busy} onClick={()=>changeMode('shot')}><Camera size={14}/>拍摄画面</button></div>
        {!piloting&&cameraInfo&&<div className="shot-readouts"><button disabled={readOnly||busy||loading||saving} onClick={()=>{pauseEditing();setEditorSection('camera');}}>焦距 {cameraInfo.focalLengthMm?.toFixed(0)??'—'} mm</button><button disabled={readOnly||busy||loading||saving} onClick={()=>{pauseEditing();setEditorSection('camera');}}>光圈 f/{cameraInfo.aperture??'—'}</button><button disabled={readOnly||busy||loading||saving} onClick={()=>{pauseEditing();setEditorSection('camera');}}>对焦 {(cameraInfo.focus?.planeDistanceMeters??cameraInfo.focus?.distanceMeters)?.toFixed(2)??'—'} m</button><button disabled={readOnly||busy||loading||saving} onClick={()=>{pauseEditing();setEditorSection('motion');}} title={cameraInfo.movement}>运镜</button></div>}
        {(piloting||mode==='free')&&<div className="viewport-bottom"><span>{piloting?'按住拖动转向 · 点击画面后使用键盘移动':'拖动旋转 · 右键平移 · 滚轮缩放'}</span></div>}
      {piloting&&cameraInfo&&<PilotBar timing={timing} onTiming={setTiming} scope={pilotScope} onScope={setPilotScope} inSequence={!!data?.cameraCuts?.[camera]||Object.values(data?.cameraCuts??{}).flat().some(c=>c.cameraId===cameraInfo.cameraId)} changed={!!Object.keys(runtime.current?.pilot?.patch()??{}).length} shared={Object.values(data?.cameraCuts??{}).flat().filter(c=>c.cameraId===cameraInfo.cameraId).length} onNudge={motion=>{const rt=runtime.current;if(rt?.pilot){rt.pilot.nudge(motion);rt.draw();setCameraInfo(rt.cameraInfo);}}} fullscreen={fullscreen.active} fullscreenPending={fullscreen.pending} onFullscreen={()=>void fullscreen.toggle()} info={cameraInfo} speed={pilotSpeed} onSpeed={n=>{if(runtime.current?.pilot){runtime.current.pilot.speed=n;setPilotSpeed(n);}}} onLens={(key,n)=>{const rt=runtime.current;if(rt?.pilot){rt.pilot.lens(key,n);rt.draw();setCameraInfo(rt.cameraInfo);}}} onMotion={motion=>runtime.current?.setPilotMotion(motion)} onApply={()=>finishPilot(true)} onCancel={()=>finishPilot(false)}/>}
        {loading&&<div className="loading-cover"><RefreshCw className="spin" size={22}/>正在构建场景</div>}
        {!data&&!loading&&<div className="loading-cover">{catalog.some(p=>p.scenes.length)?'场景未加载，请修正下方错误后重新加载。':'点击新建场景，开始创建你的项目。'}</div>}
      </div>

      <div className="shot-editor-host" hidden={tab!=='preview'||piloting}>{!readOnly&&data&&cameraInfo&&<CameraEditor timing={timing} onTiming={setTiming} key={selected.project+':'+selected.scene+':'+(cameraInfo.shot?camera+':'+cameraInfo.shot.id:'standalone')} onPresetPending={registerPresetPending} onPlaybackPreparation={registerPlaybackPreparation} feedback={cameraFeedback} presetRequest={presetRequest} section={editorSection} onSection={setEditorSection} onPause={pauseEditing} deliveryDirty={deliveryDirty} narrative={<ShotNarrative scene={data} camera={camera} time={time} value={delivery} onChange={changeDelivery} disabled={presetPending||piloting||busy||loading||saving}/>}  scene={data} info={cameraInfo} edits={edits} time={time} selected={camera} disabled={piloting||busy||loading||saving} dirty={editDirty} saving={saving} error={[editError,deliveryError].filter(Boolean).join('；')} onApply={applyEdits} onSave={()=>void saveWorkspace()} onDiscard={()=>{setPresetRequest(undefined);discardEdits();changeDelivery(structuredClone(savedDelivery.current));}} onSelect={changeCamera} onSeek={seek} captureView={captureView}/>}</div>
      {data&&runtime.current&&<div className="review-host" style={{display:tab==='review'?'flex':'none'}}><ShotReview scene={data} camera={camera} document={delivery} runtime={runtime.current} revision={edits} disabled={tab!=='review'||piloting||busy||loading||saving} onSeek={t=>{changeMode('shot');seek(t);setTab('preview');}} onPlay={(start,end)=>{runtime.current!.playReview(start,end);setMode('shot');setTab('preview');setPlaying(true);}} onDelivery={t=>{seek(t);setTab('delivery');}}/></div>}
      {tab==='delivery'&&data&&<DeliveryEditor output={{width:Number(size.split('x')[0]),height:Number(size.split('x')[1]),fps}} getPromptCamera={shot=>runtime.current!.promptCamera(shot)} scene={data} camera={camera} time={time} info={cameraInfo} value={delivery} disabled={presetPending||piloting||busy||loading||saving} readOnly={readOnly} dirty={deliveryDirty} saving={saving} error={deliveryError} onChange={changeDelivery} onSave={()=>void saveDelivery()} onDiscard={()=>changeDelivery(structuredClone(savedDelivery.current))} onSeek={seek}/>}
      {tab==='source'&&<div className="source-panel"><div><FileCode2 size={16}/><code>{path}</code><button onClick={async()=>{try{await navigator.clipboard.writeText(path);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setError('无法复制路径，请从上方手动复制。');}}}>{copied?<Check size={14}/>:<Copy size={14}/>}复制路径</button></div><p>{readOnly?'内置样板代码只供阅读；请先复制为自己的项目，再使用编辑器或 Agent 修改副本。':'使用编辑器或 Agent 修改此文件。这里显示当前加载的代码。'}</p><pre>{source||'场景代码未加载'}</pre></div>}
      {error&&<div className="error-panel" role="alert"><div><strong>需要修正</strong><button className="icon-button" aria-label="收起错误" onClick={()=>setError('')}><X size={15}/></button></div><pre>{error}</pre></div>}
      {presetPending&&<div className="notice">预设参数待应用：请先应用并保存，或取消，再切换场景、分镜组或镜头。</div>}
      {editDirty&&<div className="notice">摄影机修改正在预览，保存到项目后才能导出或切换场景。</div>}
      {dirty&&busy&&<div className="notice">源文件已修改，本次导出继续使用开始时的版本。完成后请重新加载。</div>}
      <section className="timeline" aria-label="时间预览"><div className="transport"><div className="transport-buttons"><button className="icon-button" aria-label="上一个镜头" title="上一个镜头" disabled={presetPending||piloting||busy||loading||saving||!previousShot} onClick={()=>jumpShot(-1)}><SkipBack size={17}/></button><button className="play-button" aria-label={playing?'暂停':'播放'} disabled={piloting||busy||loading||saving||!data} onClick={()=>{const r=runtime.current;if(r){if(r.time>=duration)r.time=0;r.playing=!r.playing;setPlaying(r.playing);}}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><button className="icon-button" aria-label="下一个镜头" title="下一个镜头" disabled={presetPending||piloting||busy||loading||saving||!nextShot} onClick={()=>jumpShot(1)}><SkipForward size={17}/></button></div><span className="timecode">{time.toFixed(2)}<small> / {duration.toFixed(2)} s</small></span><label className="loop"><input type="checkbox" checked={loop} disabled={presetPending||piloting||busy} onChange={e=>{setLoop(e.target.checked);if(runtime.current)runtime.current.loop=e.target.checked;}}/>循环</label><span className="timeline-caption">{fps} fps</span></div>{activeCuts.length>0&&<div className="shot-timeline" aria-label="分镜时间线">{activeCuts.map((c,i)=><button key={c.id} aria-label={`选择镜头 ${i+1} ${c.label||c.id}`} aria-current={c.id===activeCut?.id?'true':undefined} style={{flexGrow:c.end-c.start}} disabled={presetPending||piloting||busy||loading||saving} onClick={()=>seek(c.start)} title={`${c.label||c.id} · ${c.start.toFixed(2)}–${c.end.toFixed(2)} s`}>{i+1}. {c.label||c.id}{edits.cameras[c.cameraId]?' · 已调整':''}</button>)}</div>}<div className="ruler-labels">{Array.from({length:7},(_,i)=><span key={i}>{(duration*i/6).toFixed(1)} s</span>)}</div><input aria-label="场景时间" type="range" min="0" max={duration} step={1/fps} value={time} disabled={presetPending||piloting||busy||!data} onChange={e=>seek(Number(e.target.value))}/>{!readOnly&&<AudioTrack track={audioTrack} peaks={runtime.current?.audio.peaks??[]} time={time} duration={duration} cuts={activeCuts} showCutStrip={false} disabled={piloting||busy||loading||saving||!data} saving={saving} dirty={audioDirty} error={audioError} onImport={file=>void saveAudio(null,file)} onChange={changeAudio} onSave={()=>void saveAudio(audioTrack)} onRemove={()=>void saveAudio(null)} onSeek={seek}/>}</section>
    </main>
    <aside id="workspace-rail" className="right-panel" aria-label="输出与辅助" hidden={activeRail==='closed'}><div hidden={activeRail!=='details'}><div className="monitor-section" hidden={mode==='shot'}><div className="panel-title"><span>拍摄画面对照</span><Camera size={16}/></div><div ref={monitor} className="camera-monitor"/></div><details key={selected.project} className="camera-controls" open={readOnly}><summary>机位信息与教学</summary><CameraPanel info={cameraInfo} readOnly={readOnly} lesson={cameraInfo?data?.cameraLessons?.[cameraInfo.cameraId]:undefined} cuts={data?.cameraCuts?.[camera]} onSeek={seek} disabled={presetPending||piloting||busy||loading||saving}/></details>
      <div className="panel-title"><span>{object?'对象信息':'场景说明'}</span>{object?<Box size={15}/>:<FileCode2 size={15}/>}</div><div className="inspector">{object?<><strong>{object.name||'未命名对象'}</strong><span className="muted">位置 · 米</span><div className="coordinates">{['x','y','z'].map(axis=><div key={axis}><span>{axis.toUpperCase()}</span><code>{object.position[axis as 'x'|'y'|'z'].toFixed(2)}</code></div>)}</div><p>{readOnly?'内置样板的位置只供观察；复制为自己的项目后可修改。':'初始位置在代码中修改；分镜摆位可在画面下方编辑。'}</p></>:<p>{data?.description??'引用共享模型，用 Three.js 代码构建你的拍摄参考场景。'}</p>}</div>
      </div><div className="export-section" hidden={activeRail!=='export'}><div className="panel-title"><span>导出参考</span><Download size={16}/></div><label>画幅与尺寸<select aria-label="输出画幅" value={size} disabled={presetPending||piloting||busy||!data} onChange={e=>resize(e.target.value)}>{!['1280x720','720x1280','1920x1080','1080x1920'].includes(size)&&<option value={size}>{size} · 场景设置</option>}<option value="1280x720">16:9 · 1280 × 720</option><option value="720x1280">9:16 · 720 × 1280</option><option value="1920x1080">16:9 · 1920 × 1080</option><option value="1080x1920">9:16 · 1080 × 1920</option></select></label><label>帧率<select aria-label="输出帧率" value={fps} disabled={presetPending||piloting||busy||!data} onChange={e=>{const n=Number(e.target.value);setFps(n);if(runtime.current)runtime.current.output.fps=n;}}>{![24,25,30,60].includes(fps)&&<option value={fps}>{fps} fps</option>}{[24,25,30,60].map(n=><option key={n} value={n}>{n} fps</option>)}</select></label><div className="export-actions"><button disabled={presetPending||piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('still').catch(()=>{})}><Image size={16}/>当前帧 PNG</button><button disabled={presetPending||piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('sequence').catch(()=>{})}><Layers size={16}/>图片序列 ZIP</button><button className="primary" disabled={presetPending||piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('video').catch(()=>{})}><Film size={16}/>导出参考视频</button><button disabled={presetPending||piloting||busy||!data||loading||editDirty||audioDirty||deliveryDirty||saving} onClick={()=>void exportScene('delivery').catch(()=>{setTab('delivery');})}><Layers size={16}/>导出完整交付包</button></div><p className="export-hint">视频与交付包参考画面最长边 640 px，省略景深与阴影。单独导图使用所选尺寸。</p>
      {(busy||status)&&<div className="export-progress" role="status"><span>{status}</span>{busy&&<button onClick={()=>abort.current?.abort()}>取消</button>}<progress max="1" value={progress}/></div>}
      {result&&<div className="export-result"><strong><Check size={15}/>已保存到本地</strong>{result.files.map(f=><a key={f.name} href={f.url} download><Download size={13}/>{f.name}<ExternalLink size={12}/></a>)}<code>{result.directory}</code></div>}
      </div>
    </aside>
    <dialog ref={dialog} className="create-dialog"><div className="dialog-title"><h2>创建场景工程</h2><button className="icon-button" aria-label="关闭新建场景" disabled={creating} onClick={()=>dialog.current?.close()}><X size={18}/></button></div><form onSubmit={e=>{e.preventDefault();void create();}}><label>项目<select value={newProject} onChange={e=>setNewProject(e.target.value)}>{catalog.filter(p=>!p.readOnly).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new">创建新项目…</option></select></label>{newProject==='__new'&&<><label>项目名称<input required value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="例如：夜行 MV"/></label><label>项目目录<input required pattern="[a-z0-9][a-z0-9_-]{0,47}" value={projectSlug} onChange={e=>setProjectSlug(e.target.value)} placeholder="night-walk"/></label></>}<label>场景文件名<input autoFocus required pattern="[a-z0-9][a-z0-9_-]{0,47}" value={sceneSlug} onChange={e=>setSceneSlug(e.target.value)} placeholder="shot-01"/><small>小写英文、数字、横线或下划线，不含 .ts</small></label><label>起始模板<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="blocking">双人走位 · 动作与动态机位</option><option value="room">室内白模 · 桌椅与人物</option><option value="empty">空场景 · 地面、灯光与摄影机</option></select></label>{createError&&<p className="form-error" role="alert">{createError}</p>}<div className="dialog-footer"><button type="button" disabled={creating} onClick={()=>dialog.current?.close()}><ArrowLeft size={14}/>取消</button><button className="primary" disabled={creating} type="submit"><Plus size={15}/>{creating?'正在生成…':'创建源文件'}</button></div></form></dialog>
  </div>;
}
