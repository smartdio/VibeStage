import type {OutputSettings} from './types';
export type ExportKind='still'|'sequence'|'video'|'delivery';
/** Preserve design output and timing; reference pixels alone are reduced. */
export function referenceOutput(output:OutputSettings,kind:ExportKind):OutputSettings {
 if(kind!=='video'&&kind!=='delivery')return {...output};
 const scale=Math.min(1,640/Math.max(output.width,output.height));
 return {width:Math.max(16,Math.round(output.width*scale/2)*2),height:Math.max(16,Math.round(output.height*scale/2)*2),fps:output.fps};
}
export const fastReferenceRendering={profile:'fast-white-model',depthOfFieldApplied:false,shadowsApplied:false,cameraParameters:'摄影参数保留设计与采样值；参考画面不应用景深、对焦模糊或阴影模拟。'} as const;
