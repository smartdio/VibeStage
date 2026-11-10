import {readAudioSettings,saveAudioSettings,importAudio,audioAsset,audioFilter} from './audio';
import {validateAudioTrack,type AudioTrack} from '../lib/core/audio';
import {readCameraSettings,saveCameraSettings} from './camera-settings';
import {buildCameraRecording,validateCameraPlan} from './camera-records';
import type {CameraCut} from '../lib/core/cameras';
import type {Plugin} from 'vite';
import {promises as fs,createReadStream,watch} from 'node:fs';
import path from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {initializeWorkspace} from './workspace';
import {createSceneFiles,listProjects,sourceSnapshot,slug,sceneEntryPath,cloneBuiltinProject} from './projects';
interface ExportSpec {kind:'still'|'sequence'|'video';project:string;scene:string;camera:string;sourceHash:string;width:number;height:number;fps:number;duration:number;time:number;cameraPlan?:CameraCut[];audio?:AudioTrack|null}
interface Job {id:string;dir:string;spec:ExportSpec;expected:number;received:number;status:'rendering'|'encoding'|'complete'|'failed'|'cancelled';error?:string;files:string[];process?:ChildProcess;cameraRecording?:ReturnType<typeof buildCameraRecording>}
async function body(req:IncomingMessage,limit=1024*1024){const buffers:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('请求内容过大');buffers.push(chunk);}return Buffer.concat(buffers);}
function json(res:ServerResponse,value:unknown,status=200){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));}
function view(job:Job){return {id:job.id,status:job.status,error:job.error,received:job.received,expected:job.expected,directory:job.dir,files:job.files.map(name=>({name,url:`/__vs/exports/${job.id}/${name}`}))};}
export function validateExport(x:ExportSpec){
  slug(x.project);slug(x.scene);validateCameraPlan(x.cameraPlan,x.duration);
  if(!['still','sequence','video'].includes(x.kind)||typeof x.camera!=='string'||x.camera.length>128)throw new Error('无效的导出类型或机位');
  if(![x.width,x.height,x.fps].every(Number.isInteger)||x.width<16||x.height<16||x.width>1920||x.height>1920||x.width%2||x.height%2||x.fps<1||x.fps>60)throw new Error('无效的输出尺寸或帧率');
  if(!Number.isFinite(x.duration)||x.duration<=0||x.duration>300||!Number.isFinite(x.time)||x.time<0||x.time>x.duration)throw new Error('无效的输出时间');
  if(x.kind!=='still'&&Math.ceil(x.duration*x.fps-1e-8)>1800)throw new Error('首版单次导出最多 1800 帧，请缩短时长或降低帧率');
}
export function stagePlugin():Plugin {
  const root=process.cwd(),jobs=new Map<string,Job>();
  async function manifest(job:Job){await fs.writeFile(path.join(job.dir,'manifest.json'),JSON.stringify({version:2,...job.spec,cameraRecords:job.cameraRecording?'cameras.json':undefined,cameraAtStart:job.cameraRecording?.frames[0]?.camera,shots:job.cameraRecording?.shots,id:job.id,status:job.status,error:job.error,frameCount:job.expected,received:job.received,frameInterval:'[0, duration)',files:job.files,createdWith:'VibeStage 0.2.0'},null,2));}
  async function finalize(job:Job){
    try{
      if(job.spec.kind==='video'){
        job.status='encoding';await manifest(job);
        await new Promise<void>((resolve,reject)=>{const proc=spawn('ffmpeg',['-y','-framerate',String(job.spec.fps),'-start_number','0','-i',path.join(job.dir,'frames','%06d.png'),...(job.spec.audio?['-i',path.join(job.dir,'soundtrack.wav'),'-map','0:v:0','-map','1:a:0','-af',audioFilter(job.spec.audio,job.expected/job.spec.fps),'-c:a','aac','-b:a','192k']:[]),'-t',String(job.expected/job.spec.fps),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(job.dir,'reference.mp4')],{stdio:['ignore','ignore','pipe']});job.process=proc;let error='';proc.stderr?.on('data',d=>error=(error+d).slice(-4000));proc.on('error',e=>reject(new Error('无法启动 FFmpeg，请安装 ffmpeg。'+e.message)));proc.on('close',code=>code===0?resolve():reject(new Error('FFmpeg 编码失败：'+error)));});
        job.files.push('reference.mp4');
      }else if(job.spec.kind==='sequence'){
        const files:Record<string,Uint8Array>={};for(let i=0;i<job.expected;i++){const name=String(i).padStart(6,'0')+'.png';files['frames/'+name]=await fs.readFile(path.join(job.dir,'frames',name));}
        files['manifest.json']=strToU8(JSON.stringify({version:2,...job.spec,frameCount:job.expected,status:'complete',cameraRecords:'cameras.json',cameraAtStart:job.cameraRecording?.frames[0]?.camera,shots:job.cameraRecording?.shots},null,2));
        if(job.spec.audio)files['soundtrack.wav']=await fs.readFile(path.join(job.dir,'soundtrack.wav'));
        files['cameras.json']=await fs.readFile(path.join(job.dir,'cameras.json'));
        await fs.writeFile(path.join(job.dir,'frames.zip'),zipSync(files,{level:0}));job.files.push('frames.zip');
      }else{await fs.copyFile(path.join(job.dir,'frames','000000.png'),path.join(job.dir,'reference.png'));job.files.push('reference.png');}
      if(job.status==='cancelled')return;
      job.status='complete';job.files.push('manifest.json','cameras.json','source.zip');await manifest(job);
    }catch(e){if(job.status!=='cancelled'){job.status='failed';job.error=(e as Error).message;await manifest(job);}}
    finally{job.process=undefined;}
  }
  return {name:'vibestage-local',
    async configureServer(server){
      await initializeWorkspace(root);
      // Own scene watching: Vite's default add/unlink reload would interrupt exports.
      let reloadStamp=Date.now();
      const watchers=['projects','user-models','lib','templates'].map(folder=>watch(path.join(root,folder),{recursive:true},(_event,file)=>{
        reloadStamp=Math.max(Date.now(),reloadStamp+1);
        const changed=path.join(root,folder,String(file));
        for(const mod of server.moduleGraph.getModulesByFile(changed)??[])server.moduleGraph.invalidateModule(mod,new Set(),reloadStamp,true);
        server.moduleGraph.invalidateAll();
        server.ws.send({type:'custom',event:'vibestage:changed',data:{file:folder+'/'+String(file)}});
      }));
      server.httpServer?.once('close',()=>watchers.forEach(w=>w.close()));
      server.httpServer?.once('close',()=>{for(const j of jobs.values())j.process?.kill('SIGTERM');});
      server.middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url??'/', 'http://localhost');if(!url.pathname.startsWith('/__vs/'))return next();
        try{
          if(req.method!=='GET'){
            if(req.headers['x-vibestage']!=='1')return json(res,{error:'需要 X-VibeStage 请求头'},403);
            if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,{error:'不允许跨来源修改'},403);
          }
          if(url.pathname==='/__vs/projects'&&req.method==='GET'){const snapshot=await sourceSnapshot(root,{project:url.searchParams.get('project')??undefined});return json(res,{projects:await listProjects(root),sourceHash:snapshot.hash});}
          if(url.pathname==='/__vs/camera-settings'){
            if(req.method==='GET')return json(res,await readCameraSettings(root,slug(url.searchParams.get('project')),slug(url.searchParams.get('scene'))));
            if(req.method==='PUT'){
              const x=JSON.parse((await body(req)).toString());
              if([...jobs.values()].some(j=>j.status==='rendering'||j.status==='encoding'))throw new Error('导出期间不能保存摄影机设置');
              const before=await sourceSnapshot(root,{project:slug(x.project)});
              if(before.hash!==x.sourceHash)throw new Error('源文件已改变，请重新加载后再保存摄影机设置');
              const result=await saveCameraSettings(root,x.project,x.scene,x.revision,x.edits);
              return json(res,{...result,sourceHash:(await sourceSnapshot(root,{project:x.project})).hash});
            }
          }
          if(url.pathname==='/__vs/audio'){
            const project=slug(url.searchParams.get('project')),scene=slug(url.searchParams.get('scene'));
            if(req.method==='GET')return json(res,await readAudioSettings(root,project,scene));
            if(req.method==='POST'||req.method==='PUT'){
              if([...jobs.values()].some(j=>j.status==='rendering'||j.status==='encoding'))throw new Error('导出期间不能修改音频');
              if((await sourceSnapshot(root,{project})).hash!==url.searchParams.get('sourceHash'))throw new Error('源文件已改变，请重新加载后再修改音频');
              const revision=url.searchParams.get('revision')??'missing';
              const result=req.method==='POST'?await importAudio(root,project,scene,revision,url.searchParams.get('name')??'',await body(req,64*1024*1024),async()=>{if((await sourceSnapshot(root,{project})).hash!==url.searchParams.get('sourceHash'))throw new Error('导入期间源文件发生变化，请重新加载后再导入');}):await saveAudioSettings(root,project,scene,revision,JSON.parse((await body(req)).toString()).track);
              return json(res,{...result,sourceHash:(await sourceSnapshot(root,{project})).hash});
            }
          }
          if(url.pathname==='/__vs/audio-file'&&req.method==='GET'){
            const project=slug(url.searchParams.get('project')),scene=slug(url.searchParams.get('scene'));
            const {track}=await readAudioSettings(root,project,scene);if(!track)throw new Error('场景没有音频');
            const file=await audioAsset(root,project,track);res.setHeader('Content-Type','audio/wav');res.setHeader('Cache-Control','no-store');return createReadStream(file).pipe(res);
          }
          if(url.pathname==='/__vs/clone-builtin'&&req.method==='POST'){const x=JSON.parse((await body(req)).toString());return json(res,await cloneBuiltinProject(root,x.project),201);}
          if(url.pathname==='/__vs/scenes'&&req.method==='POST'){const x=JSON.parse((await body(req)).toString());return json(res,await createSceneFiles(root,x),201);}
          if(url.pathname==='/__vs/source'&&req.method==='GET'){const p=slug(url.searchParams.get('project')),s=slug(url.searchParams.get('scene'));const entry=sceneEntryPath(p,s);await server.transformRequest('/'+entry);return json(res,{source:await fs.readFile(path.join(root,entry),'utf8')});}
          if(url.pathname==='/__vs/exports'&&req.method==='POST'){
            if([...jobs.values()].some(j=>j.status==='rendering'||j.status==='encoding'))throw new Error('已有导出任务进行中，请完成或取消后再试');
            const spec=JSON.parse((await body(req)).toString()) as ExportSpec;validateExport(spec);const snapshot=await sourceSnapshot(root,{project:spec.project,includeFiles:true});
            if(spec.sourceHash!==snapshot.hash)throw new Error('源代码已改变，请重新加载场景后导出');
            await fs.access(path.join(root,sceneEntryPath(spec.project,spec.scene)));
            const audioSettings=snapshot.files[`projects/${spec.project}/settings/${spec.scene}.audio.json`];spec.audio=audioSettings?JSON.parse(Buffer.from(audioSettings).toString()):null;validateAudioTrack(spec.audio);
            if(spec.audio)await audioAsset(root,spec.project,spec.audio);
            const id=randomUUID(),dir=path.join(root,'exports',id);await fs.mkdir(path.join(dir,'frames'),{recursive:true});
            await fs.writeFile(path.join(dir,'source.zip'),zipSync(snapshot.files,{level:6}));
            if(spec.audio){const bytes=snapshot.files[`projects/${spec.project}/${spec.audio.asset}`];if(!bytes)throw new Error('音频未包含在源码快照中');await fs.writeFile(path.join(dir,'soundtrack.wav'),bytes);}
            const job:Job={id,dir,spec,expected:spec.kind==='still'?1:Math.ceil(spec.duration*spec.fps-1e-8),received:0,status:'rendering',files:spec.audio?['soundtrack.wav']:[]};jobs.set(id,job);await manifest(job);return json(res,view(job),201);
          }
          const match=url.pathname.match(/^\/__vs\/exports\/([a-f0-9-]+)(?:\/(.+))?$/);if(match){const job=jobs.get(match[1]);if(!job)return json(res,{error:'任务不存在；开发服务重启后请在 exports 目录读取已有文件'},404);const action=match[2];
            if(!action&&req.method==='GET')return json(res,view(job));
            if(action==='frame'&&req.method==='POST'){
              if(job.status!=='rendering'||job.received>=job.expected)throw new Error('任务不接受更多帧');
              const index=Number(url.searchParams.get('index'));if(index!==job.received)throw new Error('帧序号不连续');
              const png=await body(req,20*1024*1024);if(png.length<24||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==job.spec.width||png.readUInt32BE(20)!==job.spec.height)throw new Error('PNG 尺寸与导出设置不一致');
              await fs.writeFile(path.join(job.dir,'frames',String(index).padStart(6,'0')+'.png'),png,{flag:'wx'});job.received++;return json(res,{received:job.received});
            }
            if(action==='finish'&&req.method==='POST'){if(job.status!=='rendering'||job.received!==job.expected)throw new Error('导出帧尚未完整');const payload=JSON.parse((await body(req,16*1024*1024)).toString());job.cameraRecording=buildCameraRecording(job.spec,payload.cameraFrames);await fs.writeFile(path.join(job.dir,'cameras.json'),JSON.stringify(job.cameraRecording,null,2));job.status='encoding';void finalize(job);return json(res,view(job));}
            if(action==='cancel'&&req.method==='POST'){if(job.status==='rendering'||job.status==='encoding'){job.status='cancelled';job.process?.kill('SIGTERM');await manifest(job);}return json(res,view(job));}
            if(req.method==='GET'&&action&&job.status==='complete'&&job.files.includes(action)){res.setHeader('Content-Disposition',`attachment; filename="${action}"`);res.setHeader('Content-Type',action.endsWith('.wav')?'audio/wav':action.endsWith('.mp4')?'video/mp4':action.endsWith('.png')?'image/png':action.endsWith('.zip')?'application/zip':'application/json');return createReadStream(path.join(job.dir,action)).pipe(res);}
          }
          json(res,{error:'接口不存在'},404);
        }catch(e){json(res,{error:[(e as Error).message,(e as {frame?:string}).frame].filter(Boolean).join('\n')},400);}
      });
    }
  };
}
