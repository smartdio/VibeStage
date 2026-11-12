import type {DeliveryShot} from '../lib/core/delivery';
/** Match export's global frame grid and half-open cut intervals. */
export function shotSamples(shot:Pick<DeliveryShot,'start'|'end'>,fps:number){
  const first=Math.ceil(shot.start*fps-1e-8),last=Math.ceil(shot.end*fps-1e-8)-1;
  return last<first?null:{first:Math.max(0,first)/fps,last:last/fps};
}
export function cutPlaybackRange(left:Pick<DeliveryShot,'start'|'end'>,right:Pick<DeliveryShot,'start'|'end'>,seconds:number){
  return {start:Math.max(left.start,left.end-seconds),end:Math.min(right.end,right.start+seconds)};
}
