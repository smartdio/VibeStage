import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {disposeTree,frameTimes,resolveShotCamera,type CameraFrame,type CameraSnapshot,type StageScene,type OutputSettings} from '@vibestage/core';
import type {PilotMotion} from './PilotBar';
import {ShotRenderer} from './ShotRenderer';
import {PilotCamera} from './pilot';
import {createDirectionMarkers} from './directions';
export type JobResult={id:string;status:string;error?:string;directory:string;received:number;expected:number;files:{name:string;url:string}[]};
export async function api<T>(url:string,body?:unknown,method?:string):Promise<T>{
  const res=await fetch('/__vs'+url,{method:method??(body===undefined?'GET':'POST'),headers:{'X-VibeStage':'1',...(body instanceof Blob?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'请求失败');return data;
}
export function renderer(){const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(Math.min(window.devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;r.outputColorSpace=T.SRGBColorSpace;return r;}
function canvasPNG(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法读取渲染画面')),'image/png'));}
export class StageRuntime {
  main=renderer();monitor=renderer();capture=renderer();
  private shotRenderers=new Map<T.WebGLRenderer,ShotRenderer>([this.main,this.monitor,this.capture].map(r=>[r,new ShotRenderer()]));
  free=new T.PerspectiveCamera(45,1,0.1,500);controls:OrbitControls;
  instance:StageScene|null=null;time=0;playing=false;mode:'free'|'shot'='free';cameraId='';grid=true;loop=true;busy=false;
  cameraInfo:CameraSnapshot|null=null;
  pilot:PilotCamera|null=null;private previousMode:'free'|'shot'='free';private pilotKeys=new Set<string>();private drag:{id:number;x:number;y:number}|null=null;
  suppressPilotEscapeUntil=0;onPilotCancel:()=>void=()=>{};private hudMotion:PilotMotion={right:0,up:0,forward:0,yaw:0,pitch:0};
  helpers=new T.Group();directions:T.Group|null=null;gridHelper=new T.GridHelper(24,24,'#7f8980','#a0a69e');selection:T.BoxHelper|null=null;selected:T.Object3D|null=null;
  private request=0;private last=performance.now();private observer:ResizeObserver;private alive=true;private width=1;private height=1;private monitorWidth=1;private monitorHeight=1;private down=[0,0];
  onTime:(t:number,playing:boolean)=>void=()=>{};onSelect:(o:T.Object3D|null)=>void=()=>{};onError:(e:Error)=>void=()=>{};
  output:OutputSettings={width:1280,height:720,fps:24};
  constructor(mainHost:HTMLElement,monitorHost:HTMLElement){
    mainHost.append(this.main.domElement);monitorHost.append(this.monitor.domElement);this.capture.setPixelRatio(1);
    this.free.position.set(10,8,12);this.controls=new OrbitControls(this.free,this.main.domElement);this.controls.target.set(0,0.6,0);this.controls.enableDamping=true;this.controls.minDistance=1;this.controls.maxDistance=60;
    this.gridHelper.position.y=0.006;this.helpers.add(this.gridHelper);this.helpers.name='预览辅助';
    this.observer=new ResizeObserver(()=>{this.width=Math.max(1,mainHost.clientWidth);this.height=Math.max(1,mainHost.clientHeight);this.main.setSize(this.width,this.height);this.free.aspect=this.width/this.height;this.free.updateProjectionMatrix();this.monitorWidth=Math.max(1,monitorHost.clientWidth);this.monitorHeight=Math.max(1,monitorHost.clientHeight);this.monitor.setSize(this.monitorWidth,this.monitorHeight);});this.observer.observe(mainHost);this.observer.observe(monitorHost);
    this.main.domElement.tabIndex=0;this.main.domElement.setAttribute('aria-label','场景画面');
    this.main.domElement.addEventListener('pointermove',this.pilotMove);this.main.domElement.addEventListener('pointercancel',this.stopPilotInput);this.main.domElement.addEventListener('lostpointercapture',this.stopPilotInput);this.main.domElement.addEventListener('wheel',this.pilotWheel,{passive:false});
    window.addEventListener('keydown',this.pilotKeyDown);window.addEventListener('keyup',this.pilotKeyUp);window.addEventListener('blur',this.stopPilotInput);document.addEventListener('visibilitychange',this.stopPilotInput);this.main.domElement.addEventListener('blur',this.stopPilotInput);
    this.main.domElement.addEventListener('pointerdown',this.pointerDown);this.main.domElement.addEventListener('pointerup',this.pointerUp);
    const tick=(now:number)=>{if(!this.alive)return;this.request=requestAnimationFrame(tick);const dt=Math.min((now-this.last)/1000,0.1);this.last=now;
      if(this.busy)return;
      if(this.pilot){this.playing=false;this.stepPilot(dt);}
      if(this.playing&&this.instance){this.time+=dt;if(this.time>=this.instance.durationSeconds){if(this.loop)this.time%=this.instance.durationSeconds;else{this.time=this.instance.durationSeconds;this.playing=false;}}}
      this.controls.enabled=this.mode==='free'&&!this.pilot;this.controls.update();try{this.draw();}catch(e){this.playing=false;this.onError(e as Error);}this.onTime(this.time,this.playing);
    };this.request=requestAnimationFrame(tick);
  }
  pointerDown=(e:PointerEvent)=>{this.down=[e.clientX,e.clientY];if(this.pilot&&e.button===0&&!this.drag){e.preventDefault();this.main.domElement.focus({preventScroll:true});this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.main.domElement.setPointerCapture(e.pointerId);}};
  pointerUp=(e:PointerEvent)=>{if(this.pilot){if(this.drag?.id===e.pointerId){this.drag=null;if(this.main.domElement.hasPointerCapture(e.pointerId))this.main.domElement.releasePointerCapture(e.pointerId);}return;}if(this.busy||!this.instance||Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>5)return;const rect=this.main.domElement.getBoundingClientRect();let x=e.clientX-rect.left,y=e.clientY-rect.top,w=rect.width,h=rect.height;
    if(this.mode==='shot'){const fit=Math.min(w/this.output.width,h/this.output.height),nw=this.output.width*fit,nh=this.output.height*fit;x-=(w-nw)/2;y-=(h-nh)/2;w=nw;h=nh;}
    if(x<0||y<0||x>w||y>h)return;const ray=new T.Raycaster();const camera=this.mode==='free'?this.free:this.shot().camera;ray.setFromCamera(new T.Vector2(x/w*2-1,1-y/h*2),camera);
    const hit=ray.intersectObjects(this.instance.scene.children,true).find(h=>{let p:T.Object3D|null=h.object;while(p){if(p===this.helpers)return false;p=p.parent;}return h.object instanceof T.Mesh;});let obj=hit?.object??null;while(obj?.parent&&obj.parent!==this.instance.scene)obj=obj.parent;this.select(obj);
  };
  shot(){if(!this.instance)throw new Error('场景尚未加载');if(this.pilot)return this.pilot.shot(this.instance,this.time,this.output.width/this.output.height);return resolveShotCamera(this.instance,this.cameraId,this.time,this.output.width/this.output.height);}
  beginPilot(){
    if(this.busy||this.pilot||!this.instance)throw new Error('当前不能操控机位');
    this.playing=false;this.draw();const info=this.cameraInfo!;
    this.pilot=new PilotCamera(info,this.instance.cameraMetadata?.[info.cameraId]);this.previousMode=this.mode;this.mode='shot';this.controls.enabled=false;this.stopPilotInput();this.main.domElement.style.touchAction='none';this.main.domElement.style.cursor='grab';this.main.domElement.focus({preventScroll:true});this.draw();
  }
  endPilot(applied=false){this.stopPilotInput();this.pilot=null;this.mode=applied?'shot':this.previousMode;this.main.domElement.style.cursor='';this.draw();}
  stopPilotInput=()=>{this.hudMotion={right:0,up:0,forward:0,yaw:0,pitch:0};this.pilotKeys.clear();const drag=this.drag;this.drag=null;if(drag&&this.main.domElement.hasPointerCapture(drag.id))this.main.domElement.releasePointerCapture(drag.id);};
  pilotMove=(e:PointerEvent)=>{if(!this.pilot||this.drag?.id!==e.pointerId)return;this.pilot.turn(-(e.clientX-this.drag.x)*.003,-(e.clientY-this.drag.y)*.003);this.drag.x=e.clientX;this.drag.y=e.clientY;};
  pilotWheel=(e:WheelEvent)=>{if(!this.pilot)return;e.preventDefault();this.pilot.speed=T.MathUtils.clamp(this.pilot.speed*Math.exp(-e.deltaY*.002),.1,10);};
  pilotKeyDown=(e:KeyboardEvent)=>{if(!this.pilot||document.activeElement!==this.main.domElement||e.metaKey||e.ctrlKey||e.altKey)return;if(e.code==='Escape'){if(document.fullscreenElement||performance.now()<this.suppressPilotEscapeUntil)return;e.preventDefault();this.onPilotCancel();return;}if(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();this.pilotKeys.add(e.code);}};
  pilotKeyUp=(e:KeyboardEvent)=>{this.pilotKeys.delete(e.code);};
  private stepPilot(dt:number){const p=this.pilot;if(!p)return;const k=(id:string)=>Number(this.pilotKeys.has(id));p.move(k('KeyD')-k('KeyA')+this.hudMotion.right,k('KeyE')-k('KeyQ')+this.hudMotion.up,k('KeyW')-k('KeyS')+this.hudMotion.forward,dt);const yaw=k('ArrowLeft')-k('ArrowRight')+this.hudMotion.yaw,pitch=k('ArrowUp')-k('ArrowDown')+this.hudMotion.pitch;if(yaw||pitch)p.turn(yaw*dt*.25,pitch*dt*.25);}
  setPilotMotion(motion:PilotMotion){if(this.pilot)this.hudMotion={...motion};}
  select(o:T.Object3D|null){if(this.selection){this.helpers.remove(this.selection);this.selection.geometry.dispose();(this.selection.material as T.Material).dispose();}this.selected=o;this.selection=o?new T.BoxHelper(o,'#b1813f'):null;if(this.selection)this.helpers.add(this.selection);this.onSelect(o);}
  load(instance:StageScene){this.playing=false;this.time=0;this.select(null);this.helpers.removeFromParent();this.instance?.dispose();this.instance=instance;this.cameraId=Object.keys(instance.cameras)[0];this.output={...instance.output};if(this.directions){this.directions.removeFromParent();disposeTree(this.directions);}this.directions=createDirectionMarkers(instance.scene.getObjectByName('场地'));this.helpers.add(this.directions);instance.scene.add(this.helpers);instance.update(0);this.home();this.draw();}
  clear(){this.pilot=null;this.stopPilotInput();this.playing=false;this.select(null);this.helpers.removeFromParent();this.instance?.dispose();this.instance=null;this.cameraInfo=null;this.main.clear();this.monitor.clear();}
  home(){this.free.position.set(10,8,12);this.controls.target.set(0,0.7,-0.3);this.controls.update();}
  seek(t:number){if(this.pilot||this.busy||!Number.isFinite(t)||!this.instance)return;this.time=T.MathUtils.clamp(t,0,this.instance.durationSeconds);this.playing=false;this.draw();this.onTime(this.time,false);}
  private renderShot(r:T.WebGLRenderer,w:number,h:number){if(!this.instance)return;const f=Math.min(w/this.output.width,h/this.output.height),vw=this.output.width*f,vh=this.output.height*f;
    r.setScissorTest(false);r.setClearColor('#15171a');r.clear();r.setViewport((w-vw)/2,(h-vh)/2,vw,vh);r.setScissor((w-vw)/2,(h-vh)/2,vw,vh);r.setScissorTest(true);const shot=this.shot();this.shotRenderers.get(r)!.render(r,this.instance.scene,shot.camera,shot.info,this.output.width,this.output.height);r.setScissorTest(false);
  }
  draw(){if(!this.instance)return;this.instance.update(this.time);this.cameraInfo=this.shot().info;this.helpers.visible=this.mode==='free';this.gridHelper.visible=this.grid;this.selection?.update();
    if(this.mode==='free'){this.main.setViewport(0,0,this.width,this.height);this.main.render(this.instance.scene,this.free);}else this.renderShot(this.main,this.width,this.height);
    this.helpers.visible=false;this.renderShot(this.monitor,this.monitorWidth,this.monitorHeight);
  }
  async export(spec:{kind:'still'|'sequence'|'video';project:string;scene:string;sourceHash:string},onProgress:(progress:number,status:string)=>void,signal:AbortSignal):Promise<JobResult>{
    if(this.pilot)throw new Error('请先应用或取消机位操控');
    if(!this.instance||this.busy)throw new Error('场景尚未准备好或正在导出');
    const instance=this.instance,originalTime=this.time;this.busy=true;this.playing=false;let job:JobResult|undefined;
    try{
      const body={...spec,...this.output,camera:this.cameraId,duration:instance.durationSeconds,time:originalTime,cameraPlan:instance.cameraCuts?.[this.cameraId]??[]};job=await api<JobResult>('/exports',body);
      this.capture.setSize(this.output.width,this.output.height);const times=spec.kind==='still'?[originalTime]:frameTimes(instance.durationSeconds,this.output.fps);const cameraFrames:CameraFrame[]=[];
      for(let i=0;i<times.length;i++){
        signal.throwIfAborted();instance.update(times[i]);this.helpers.visible=false;const shot=resolveShotCamera(instance,this.cameraId,times[i],this.output.width/this.output.height);this.shotRenderers.get(this.capture)!.render(this.capture,instance.scene,shot.camera,shot.info,this.output.width,this.output.height);cameraFrames.push({frame:i,timeSeconds:times[i],camera:shot.info});
        const png=await canvasPNG(this.capture.domElement);signal.throwIfAborted();await api(`/exports/${job.id}/frame?index=${i}`,png);onProgress((i+1)/times.length*0.9,`渲染 ${i+1} / ${times.length} 帧`);
      }
      signal.throwIfAborted();await api(`/exports/${job.id}/finish`,{cameraFrames});onProgress(0.93,'正在打包与编码');
      while(true){signal.throwIfAborted();const result=await api<JobResult>(`/exports/${job.id}`);if(result.status==='complete'){onProgress(1,'导出完成');return result;}if(['failed','cancelled'].includes(result.status))throw new Error(result.error??'导出已取消');await new Promise(r=>setTimeout(r,250));}
    }catch(e){if(job)await api(`/exports/${job.id}/cancel`,{}).catch(()=>{});throw e;}
    finally{this.busy=false;this.time=originalTime;this.draw();}
  }
  dispose(){window.removeEventListener('keydown',this.pilotKeyDown);window.removeEventListener('keyup',this.pilotKeyUp);window.removeEventListener('blur',this.stopPilotInput);document.removeEventListener('visibilitychange',this.stopPilotInput);this.main.domElement.removeEventListener('blur',this.stopPilotInput);this.main.domElement.removeEventListener('pointermove',this.pilotMove);this.main.domElement.removeEventListener('pointercancel',this.stopPilotInput);this.main.domElement.removeEventListener('lostpointercapture',this.stopPilotInput);this.main.domElement.removeEventListener('wheel',this.pilotWheel);this.alive=false;cancelAnimationFrame(this.request);this.observer.disconnect();this.main.domElement.removeEventListener('pointerdown',this.pointerDown);this.main.domElement.removeEventListener('pointerup',this.pointerUp);this.controls.dispose();this.clear();disposeTree(this.helpers);for(const r of [this.main,this.monitor,this.capture]){this.shotRenderers.get(r)!.dispose();r.dispose();r.forceContextLoss();r.domElement.remove();}}
}
