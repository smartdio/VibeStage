import {Vector3,Quaternion,Light,Color} from 'three';
import type {StageScene} from './types';
export interface RenderedLight {id:string;type:string;color:string;intensity:number;positionMeters:number[];direction?:number[];castShadow:boolean;parameters:Record<string,number|string>}
export interface DeliveryWorld {lights:RenderedLight[];subjects:Record<string,{positionMeters:number[];quaternion:number[];visible:boolean}>;background:string;environment:string}
/** Called after sampleScene, at the very frame used to render the white model. */
export function sampleDeliveryWorld(stage:StageScene):DeliveryWorld {
  const lights:RenderedLight[]=[];stage.scene.updateMatrixWorld(true);
  stage.scene.traverseVisible(o=>{if(!(o instanceof Light))return;
    const position=o.getWorldPosition(new Vector3()),item:RenderedLight={id:o.name||`light-${lights.length+1}`,type:o.type,color:'#'+o.color.getHexString(),intensity:o.intensity,positionMeters:position.toArray(),castShadow:o.castShadow,parameters:{}};
    const properties=o as unknown as Record<string,unknown>;
    for(const key of ['angle','penumbra','distance','decay','width','height'])if(typeof properties[key]==='number')item.parameters[key]=properties[key] as number;
    if(properties.groundColor instanceof Color)item.parameters.groundColor='#'+properties.groundColor.getHexString();
    if('target' in o){const target=(o as Light&{target:Light}).target;target.updateWorldMatrix(true,false);item.direction=target.getWorldPosition(new Vector3()).sub(position).normalize().toArray();}
    else if(o.type==='RectAreaLight')item.direction=o.getWorldDirection(new Vector3()).negate().toArray();
    lights.push(item);
  });
  const subjects:DeliveryWorld['subjects']={};for(const [id,o] of Object.entries(stage.subjects??{})){let visible=true;for(let node:typeof o|null=o;node;node=node.parent)visible=visible&&node.visible;subjects[id]={positionMeters:o.getWorldPosition(new Vector3()).toArray(),quaternion:o.getWorldQuaternion(new Quaternion()).toArray(),visible};}
  return {lights,subjects,background:stage.scene.background instanceof Color?'#'+stage.scene.background.getHexString():stage.scene.background?'纹理背景':'没有',environment:stage.scene.environment?'环境纹理（见 source.zip）':'没有'};
}
export function validateDeliveryWorld(value:unknown):asserts value is DeliveryWorld {
  const w=value as DeliveryWorld;const vec=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
  if(!w||!Array.isArray(w.lights)||w.lights.length>1000||!w.subjects||typeof w.subjects!=='object'||typeof w.background!=='string'||typeof w.environment!=='string')throw new Error('缺少实际场景参数');
  for(const l of w.lights)if(!l||typeof l.id!=='string'||typeof l.type!=='string'||typeof l.color!=='string'||!Number.isFinite(l.intensity)||!vec(l.positionMeters,3)||l.direction&&!vec(l.direction,3)||typeof l.castShadow!=='boolean'||!l.parameters||Object.values(l.parameters).some(v=>typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v))))throw new Error('实际光源记录无效');
  for(const s of Object.values(w.subjects))if(!s||!vec(s.positionMeters,3)||!vec(s.quaternion,4)||typeof s.visible!=='boolean')throw new Error('实际对象记录无效');
}
