import {audioWindow,type AudioTrack} from '../lib/core/audio';
export class SceneAudio {
  context:AudioContext|null=null;
  buffer:AudioBuffer|null=null;
  track:AudioTrack|null=null;
  peaks:number[]=[];
  private source:AudioBufferSourceNode|null=null;
  private gain:GainNode|null=null;
  private anchor:{scene:number;clock:number}|null=null;
  private generation=0;
  onError:(e:Error)=>void=()=>{};
  async load(track:AudioTrack|null,url?:string){
    this.clear();if(!track||!url)return;const version=this.generation;
    const response=await fetch(url);if(!response.ok)throw new Error('无法加载项目音频，请重新导入');
    const bytes=await response.arrayBuffer();if(version!==this.generation)return;
    const context=this.context??=new AudioContext();const buffer=await context.decodeAudioData(bytes);
    if(version!==this.generation)return;
    this.buffer=buffer;this.track={...track};this.peaks=[];
    const bins=Math.min(1600,buffer.length),stride=Math.ceil(buffer.length/bins);
    for(let i=0;i<bins;i++){let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let j=i*stride;j<Math.min((i+1)*stride,samples.length);j++)peak=Math.max(peak,Math.abs(samples[j]));}this.peaks.push(peak);}
  }
  configure(track:AudioTrack|null){this.track=track?{...track}:null;if(this.gain)this.gain.gain.value=track&&!track.muted?track.volume:0;}
  play(time:number){
    this.pause();const ctx=this.context,buffer=this.buffer,track=this.track;if(!ctx||!buffer||!track)return;
    const anchor={scene:time,clock:ctx.currentTime};this.anchor=anchor;
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=track.muted?0:track.volume;source.connect(gain);gain.connect(ctx.destination);this.source=source;this.gain=gain;
    const window=audioWindow(time,track.offsetSeconds,buffer.duration);
    if(window.audible)source.start(anchor.clock+window.delay,window.position);
    void ctx.resume().catch(()=>{if(this.anchor===anchor){this.pause();this.onError(new Error('无法启用音频，请再次点击播放'));}});
  }
  position(){return this.anchor&&this.context?this.anchor.scene+this.context.currentTime-this.anchor.clock:null;}
  pause(){if(this.source){try{this.source.stop();}catch{/* source may not have started */}this.source.disconnect();}this.gain?.disconnect();this.source=null;this.gain=null;this.anchor=null;}
  clear(){this.generation++;this.pause();this.track=null;this.buffer=null;this.peaks=[];}
  dispose(){this.clear();void this.context?.close();this.context=null;}
}
