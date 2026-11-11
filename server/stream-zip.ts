import {createReadStream,createWriteStream,promises as fs} from 'node:fs';
import {Zip,ZipPassThrough} from 'fflate';
import {once} from 'node:events';

/** One input chunk at a time; honor disk backpressure and leave no partial archive. */
export async function streamZip(destination:string,files:Record<string,string|Uint8Array>,cancelled:()=>boolean=()=>false,onProgress:(done:number,total:number)=>void=()=>{}){
  const output=createWriteStream(destination+'.partial');
  let failure:Error|undefined;
  output.on('error',e=>{failure=e;});
  const zip=new Zip((error,data,final)=>{if(error){failure=error;return;}output.write(data);if(final)output.end();});
  const check=()=>{if(failure)throw failure;if(cancelled())throw new Error('导出已取消');};
  const drain=async()=>{check();if(output.writableNeedDrain)await once(output,'drain');check();};
  try{
    const entries=Object.entries(files);let done=0;
    for(const [name,source] of entries){
      check();const entry=new ZipPassThrough(name);zip.add(entry);
      if(typeof source==='string'){
        for await(const chunk of createReadStream(source,{highWaterMark:64*1024})){check();entry.push(chunk as Buffer);await drain();}
      }else{for(let offset=0;offset<source.length;offset+=65536){entry.push(source.subarray(offset,offset+65536));await drain();}}
      entry.push(new Uint8Array(),true);await drain();onProgress(++done,entries.length);
      // Allow cancellation even with many tiny files.
      await new Promise<void>(resolve=>setImmediate(resolve));
    }
    check();const finished=once(output,'finish');zip.end();await finished;check();
    await fs.rename(destination+'.partial',destination);
  }catch(error){zip.terminate();const closed=output.closed?Promise.resolve():once(output,'close').catch(()=>{});output.destroy();await closed;await fs.rm(destination+'.partial',{force:true});throw error;}
}
