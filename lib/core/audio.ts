/** One premixed soundtrack. offsetSeconds is the scene time of the first audio sample. */
export interface AudioTrack {
  version:1;
  asset:string;
  name:string;
  durationSeconds:number;
  offsetSeconds:number;
  volume:number;
  muted:boolean;
}
export function validateAudioTrack(value:unknown):asserts value is AudioTrack|null {
  if(value===null)return;
  const x=value as AudioTrack;
  if(!x||x.version!==1||typeof x.asset!=='string'||!/^assets\/audio\/[a-f0-9]{64}\.wav$/.test(x.asset)||typeof x.name!=='string'||!x.name.trim()||x.name.length>180||!Number.isFinite(x.durationSeconds)||x.durationSeconds<=0||x.durationSeconds>300||!Number.isFinite(x.offsetSeconds)||Math.abs(x.offsetSeconds)>300||!Number.isFinite(x.volume)||x.volume<0||x.volume>2||typeof x.muted!=='boolean')throw new Error('音频设置无效：偏移须在 ±300 秒内，音量须在 0–200% 内');
}
export function audioWindow(time:number,offset:number,duration:number){
  return {delay:Math.max(0,offset-time),position:Math.max(0,time-offset),audible:time-offset<duration};
}
