import type {CameraSnapshot} from './cameras';

/** Thin-lens circle of confusion, expressed as radius / image height. */
export interface DepthOfFieldSettings {
  model:'thin-lens-v1'; focusPlaneMeters:number; radiusScale:number; maxRadiusFraction:number;
}
export function depthOfFieldSettings(info:CameraSnapshot):DepthOfFieldSettings|undefined {
  const f=info.focalLengthMm,n=info.aperture,h=info.activeSensor?.heightMm,s=info.focus?.planeDistanceMeters??info.focus?.distanceMeters;
  if(info.projection!=='perspective'||!f||!n||!h||!s||![f,n,h,s].every(x=>Number.isFinite(x)&&x>0)||s*1000<=f)return;
  const radiusScale=f*f/(2*n*(s*1000-f)*h);
  if(!Number.isFinite(radiusScale))return;
  return {model:'thin-lens-v1',focusPlaneMeters:s,radiusScale,maxRadiusFraction:.03};
}
export function circleOfConfusionRadius(settings:DepthOfFieldSettings,depthMeters:number){
  return Math.min(settings.maxRadiusFraction,Math.abs(settings.radiusScale*(1-settings.focusPlaneMeters/depthMeters)));
}
