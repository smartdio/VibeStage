import {blankFields,captureFields,type CaptureBrief} from './delivery';

/** Text references only. Never apply these values to cameras, renderers or output settings. */
export type CapturePresetKind='body'|'lens'|'film';
export interface CapturePreset {id:string;label:string;group:string;values:Partial<CaptureBrief>}
const body=(id:string,label:string,group:string,medium:string,format:string):CapturePreset=>({id,label,group,values:{cameraBody:`${label}；作为最终画面拍摄参考`,recordingMedium:medium,captureFormat:format}});
const lens=(id:string,label:string,group:string,note:string):CapturePreset=>({id,label,group,values:{lensModel:`${label}；${note}；具体焦段、光圈和对焦按本镜头摄影设计，未指定的版本不推断`}});
const film=(id:string,label:string,ei:number,balance:string):CapturePreset=>({id,label,group:'Kodak VISION3 电影负片',values:{filmStock:`${label}；${balance}平衡电影彩色负片参考`,sensitivity:`EI ${ei} 为参考起点；没有额外曝光补偿`,filmProcessing:'标准 ECN-2 冲洗参考；没有增感或减感；扫描交由后续制作确定',imageTexture:'保留所选负片的颗粒与高光层次参考；不额外叠加划痕、漏光或夸张晕光'}});
export const capturePresets:Record<CapturePresetKind,readonly CapturePreset[]>={
 body:[
  {id:'body-none',label:'没有指定机身',group:'不指定',values:{cameraBody:'没有'}},
  body('alexa-35','ARRI ALEXA 35','数字电影机','数字','Super 35；有效区域按所选录制模式确定'),
  body('alexa-mini-lf','ARRI ALEXA Mini LF','数字电影机','数字','大画幅数字；有效区域按所选录制模式确定'),
  body('venice-2','Sony VENICE 2','数字电影机','数字','全画幅数字；传感器版本与有效区域按录制模式确定'),
  body('fx6','Sony FX6','数字电影机','数字','全画幅数字；有效区域按录制模式确定'),
  body('fx3','Sony FX3','数字电影机','数字','全画幅数字；有效区域按录制模式确定'),
  body('arricam-lt','ARRICAM LT','胶片电影机','胶片','35 mm 电影胶片；片门与画幅按拍摄方案确定'),
  body('arricam-st','ARRICAM ST','胶片电影机','胶片','35 mm 电影胶片；片门与画幅按拍摄方案确定'),
  body('arriflex-435','ARRIFLEX 435','胶片电影机','胶片','35 mm 电影胶片；片门与画幅按拍摄方案确定'),
  body('arriflex-sr3','ARRIFLEX 16SR 3','胶片电影机','胶片','16 mm／Super 16；具体片门按拍摄方案确定'),
  body('millennium-xl2','Panavision Millennium XL2','胶片电影机','胶片','35 mm 电影胶片；片门与画幅按拍摄方案确定'),
  body('r5-ii','Canon EOS R5 Mark II','数字照相机','数字','全画幅数字；有效区域按照片或视频模式确定'),
  body('xt5','Fujifilm X-T5','数字照相机','数字','APS-C 数字；有效区域按照片或视频模式确定'),
  body('gfx100-ii','Fujifilm GFX100 II','数字照相机','数字','中画幅数字；有效区域按照片或视频模式确定'),
  body('leica-m3','Leica M3','胶片照相机','胶片','135 胶片，24 × 36 mm 静态摄影参考'),
  body('leica-m6','Leica M6','胶片照相机','胶片','135 胶片，24 × 36 mm 静态摄影参考'),
  body('nikon-f3','Nikon F3','胶片照相机','胶片','135 胶片，24 × 36 mm 静态摄影参考'),
  body('nikon-fm2','Nikon FM2','胶片照相机','胶片','135 胶片，24 × 36 mm 静态摄影参考'),
  body('hasselblad-500cm','Hasselblad 500C/M','胶片照相机','胶片','中画幅胶片；画幅与胶卷规格按所配后背确定'),
  body('vx1000','Sony DCR-VX1000','经典摄像机','数字磁带（MiniDV）','标清 DV 摄像参考；PAL／NTSC 制式与场序需按交付要求明确'),
  body('dvx100','Panasonic AG-DVX100','经典摄像机','数字磁带（MiniDV）','标清 DV 摄像参考；制式、逐行／隔行和帧率需按交付要求明确'),
  body('dvx100a','Panasonic AG-DVX100A','经典摄像机','数字磁带（MiniDV）','标清 DV 摄像参考；制式、逐行／隔行和帧率需按交付要求明确'),
 ],
 lens:[
  {id:'lens-none',label:'没有指定镜头型号',group:'不指定',values:{lensModel:'没有'}},
  lens('cooke-s4','Cooke S4/i','现代电影定焦','球面电影定焦系列参考'),
  lens('supreme-prime','ZEISS Supreme Prime','现代电影定焦','大画幅球面电影定焦系列参考'),
  lens('speed-panchro','Cooke Speed Panchro','经典电影定焦','经典原版系列参考；具体年代与改壳版本需另行注明'),
  lens('panchro-classic','Cooke Panchro/i Classic','经典电影定焦','现代经典设计系列参考；S35／FF 版本需另行注明'),
  lens('super-speed','ZEISS Super Speed','经典电影定焦','经典高速定焦系列参考；具体代际需另行注明'),
  lens('panavision-c','Panavision C Series','变形宽银幕','变形宽银幕系列参考；压缩倍率、散景与眩光要求按具体镜头注明，不自动改变白模画幅'),
  lens('optimo-24-290','Angénieux Optimo 24–290','电影变焦','24–290 mm 变焦系列参考；不自动添加变焦动作'),
  lens('optimo-ultra-12x','Angénieux Optimo Ultra 12x','电影变焦','12 倍变焦系列参考；配置与焦段范围需注明，不自动添加变焦动作'),
  lens('summilux-35','Leica Summilux-M 35 mm','摄影镜头','35 mm 静态摄影镜头参考'),
  lens('summilux-50','Leica Summilux-M 50 mm','摄影镜头','50 mm 静态摄影镜头参考'),
  lens('summicron-50','Leica Summicron-M 50 mm','摄影镜头','50 mm 静态摄影镜头参考'),
  lens('canon-fd55','Canon FD 55 mm f/1.2 AL','摄影镜头','经典 55 mm 非球面摄影镜头参考；f/1.2 为型号规格，实际拍摄光圈另行指定'),
 ],
 film:[
  {id:'film-none',label:'没有胶片／胶片风格',group:'不使用',values:{filmStock:'没有',filmFormat:'没有',filmProcessing:'没有',imageTexture:'没有额外胶片颗粒、划痕、漏光或胶片风格处理'}},
  film('vision3-50d','Kodak VISION3 50D',50,'日光'),
  film('vision3-250d','Kodak VISION3 250D',250,'日光'),
  film('vision3-200t','Kodak VISION3 200T',200,'钨丝灯'),
  film('vision3-500t','Kodak VISION3 500T',500,'钨丝灯'),
 ],
};
export function applyCapturePreset(capture:CaptureBrief|undefined,kind:CapturePresetKind,id:string):CaptureBrief {
 const preset=capturePresets[kind].find(p=>p.id===id);if(!preset)throw new Error('摄影参考预设不存在');
 return {...blankFields(captureFields),...capture,...preset.values};
}
export function matchingCapturePreset(capture:CaptureBrief|undefined,kind:CapturePresetKind):string {
 return capturePresets[kind].find(p=>Object.entries(p.values).every(([k,v])=>capture?.[k as keyof CaptureBrief]===v))?.id??'';
}
