import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {slug} from './projects';
import {validateAudioTrack,type AudioTrack} from '../lib/core/audio';
const locks=new Map<string,Promise<unknown>>();
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function projectFolder(root:string,project:string){
  const base=path.join(root,'projects'),folder=path.join(base,slug(project));
  if(await fs.realpath(folder)!==path.join(await fs.realpath(base),project))throw new Error('不支持符号链接项目');
  return folder;
}
async function safeFile(folder:string,relative:string){
  const target=path.join(folder,relative),real=await fs.realpath(target);
  if(real!==path.join(await fs.realpath(folder),relative))throw new Error('音频路径不能包含符号链接');
  return target;
}
export async function readAudioSettings(root:string,project:string,scene:string){
  const folder=await projectFolder(root,project),relative=`settings/${slug(scene)}.audio.json`;
  try{const file=await safeFile(folder,relative),bytes=await fs.readFile(file);const track:unknown=JSON.parse(bytes.toString());validateAudioTrack(track);return {track,revision:hash(bytes)};}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {track:null,revision:'missing'};throw e;}
}
export async function audioAsset(root:string,project:string,track:AudioTrack){validateAudioTrack(track);return safeFile(await projectFolder(root,project),track.asset);}
export async function saveAudioSettings(root:string,project:string,scene:string,revision:string,track:unknown){
  validateAudioTrack(track);const folder=await projectFolder(root,project),target=path.join(folder,'settings',slug(scene)+'.audio.json');
  const previous=locks.get(target)??Promise.resolve();const pending=previous.catch(()=>{}).then(async()=>{
    await fs.access(path.join(folder,'scenes',scene+'.ts'));
    if((await readAudioSettings(root,project,scene)).revision!==revision)throw new Error('音频已被其他操作修改，请重新加载后再保存');
    if(track)await audioAsset(root,project,track);
    await fs.mkdir(path.dirname(target),{recursive:true});await safeFile(folder,'settings');
    const temp=target+'.'+randomUUID()+'.tmp';
    try{await fs.writeFile(temp,JSON.stringify(track,null,2)+'\n',{flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
    return readAudioSettings(root,project,scene);
  });locks.set(target,pending);try{return await pending;}finally{if(locks.get(target)===pending)locks.delete(target);}
}
function command(name:string,args:string[]){return new Promise<string>((resolve,reject)=>{
  const proc=spawn(name,args,{stdio:['ignore','pipe','pipe']});let output='',error='';
  const timer=setTimeout(()=>{proc.kill('SIGKILL');reject(new Error('音频处理超时，请使用较短的音频'));},60000);
  proc.stdout.on('data',d=>output=(output+d).slice(-20000));proc.stderr.on('data',d=>error=(error+d).slice(-1000));
  proc.on('error',()=>{clearTimeout(timer);reject(new Error('请安装 FFmpeg（包含 ffprobe）后再导入音频'));});
  proc.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error('无法读取音频，请检查文件格式。'+error));});
});}
export async function importAudio(root:string,project:string,scene:string,revision:string,name:string,bytes:Buffer,beforeCommit:()=>Promise<void>=async()=>{}){
  if(!/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(name)||bytes.length===0||bytes.length>64*1024*1024)throw new Error('请选择 WAV、MP3、M4A、AAC、OGG 或 FLAC 音频，最大 64 MB');
  const folder=await projectFolder(root,project);await fs.access(path.join(folder,'scenes',slug(scene)+'.ts'));
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'vibestage-audio-'));
  try{
    const input=path.join(temp,'input'+path.extname(name).toLowerCase()),output=path.join(temp,'audio.wav');await fs.writeFile(input,bytes);
    await command('ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-vn','-t','301','-ac','2','-ar','48000','-c:a','pcm_s16le',output]);
    const seconds=Number((await command('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',output])).trim());
    if(!Number.isFinite(seconds)||seconds<=0||seconds>300)throw new Error('首版音频时长须大于 0 且不超过 300 秒');
    await beforeCommit();
    const wav=await fs.readFile(output),asset=`assets/audio/${hash(wav)}.wav`;
    await fs.mkdir(path.join(folder,'assets'),{recursive:true});await safeFile(folder,'assets');
    await fs.mkdir(path.join(folder,'assets/audio'),{recursive:true});await safeFile(folder,'assets/audio');
    try{await fs.writeFile(path.join(folder,asset),wav,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
    const track:AudioTrack={version:1,asset,name:path.basename(name).slice(0,180),durationSeconds:seconds,offsetSeconds:0,volume:1,muted:false};
    return await saveAudioSettings(root,project,scene,revision,track);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
}
/** Same signed offset, gain and silence padding as the preview. */
export function audioFilter(track:AudioTrack,duration:number){
  validateAudioTrack(track);
  return `atrim=start=${Math.max(0,-track.offsetSeconds)},asetpts=PTS-STARTPTS,adelay=${Math.round(Math.max(0,track.offsetSeconds)*48000)}S:all=1,volume=${track.muted?0:track.volume},apad,atrim=duration=${duration}`;
}
