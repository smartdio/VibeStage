import type {StageScene} from '@vibestage/core';

/** Walk the camera list with each sequence expanded into its individual cuts. */
export function adjacentShot(stage:Pick<StageScene,'cameras'|'cameraCuts'|'cameraPresets'>,cameraId:string,time:number,direction:-1|1){
  const cuts=stage.cameraCuts?.[cameraId];
  if(cuts?.length){
    const current=cuts.findIndex(c=>time>=c.start&&time<c.end);
    const index=current<0&&time===cuts[cuts.length-1].end?cuts.length-1:current;
    if(index<0)return undefined;
    const next=cuts[index+direction];
    if(next)return {cameraId,time:next.start};
  }
  const cameras=Object.keys(stage.cameras);
  const index=cameras.indexOf(cameraId);
  if(index<0)return undefined;
  const next=cameras[index+direction];
  if(!next)return undefined;
  const nextCuts=stage.cameraCuts?.[next];
  const entry=direction===1?nextCuts?.[0]:nextCuts?.at(-1);
  // An independent camera may also be used in an edit. Prefer that edit's
  // first occurrence, then the first registered occurrence in other edits.
  const linkedCut=cuts?.find(c=>c.cameraId===next)??Object.values(stage.cameraCuts??{}).flat().find(c=>c.cameraId===next);
  return {cameraId:next,time:entry?.start??linkedCut?.start??stage.cameraPresets?.[next]?.parameters.startSeconds??0};
}
