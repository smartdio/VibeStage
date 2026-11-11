import {createWriteStream,promises as fs} from 'node:fs';
import {once} from 'node:events';
/** Serialize sampled records individually, keeping the event loop cancellable. */
export async function writeFrameJSON(file:string,header:Record<string,unknown>,key:string,frames:unknown[],cancelled:()=>boolean){
  const output=createWriteStream(file);let failure:Error|undefined;output.on('error',e=>{failure=e;});
  const write=async(text:string)=>{if(cancelled())throw new Error('导出已取消');if(failure)throw failure;if(!output.write(text))await once(output,'drain');};
  try{
    await write(JSON.stringify(header,null,2).replace(/\s*}$/,Object.keys(header).length?',\n':'\n')+JSON.stringify(key)+': [\n');
    for(let i=0;i<frames.length;i++){await write((i?',\n':'')+JSON.stringify(frames[i]));if(i%30===0)await new Promise<void>(r=>setImmediate(r));}
    await write('\n]}\n');const finished=once(output,'finish');output.end();await finished;
  }catch(e){const closed=output.closed?Promise.resolve():once(output,'close').catch(()=>{});output.destroy();await closed;await fs.rm(file,{force:true});throw e;}
}
