import * as T from 'three';
import {createWhiteStage,createMannequin,createBox,addCameraPreset,createCameraPresetConfig,cameraPresetDefinitions,sampleCameraPreset,type StageScene} from '@vibestage/core';
import {lessons} from '../shared/lessons';

/** A complete, editable learning project. Shared models and presets remain in core. */
export function createScene():StageScene {
 const base=createWhiteStage({width:26,depth:26});
 const set=new T.Group();set.name='教学布景';base.scene.add(set);
 const a=createMannequin({name:'人物 A · 行走',color:'#c59d68'}),b=createMannequin({name:'人物 B · 等候',color:'#7f9796'});
 const prop=createBox({name:'棕色道具',width:.3,height:.3,depth:.3,color:'#aa8061'});prop.position.set(1.5,.9,-.5);
 const panel=createBox({name:'前景遮挡板',width:.65,height:2.6,depth:.15,color:'#868f91'});panel.position.set(-1.03,1.3,2.3);
 set.add(a.root,b.root,prop,panel);
 for(const z of [-7,-10])for(const x of [-6,-3,0,3,6]){const column=createBox({name:'纵深立柱',width:.4,height:3,depth:.4,color:z===-7?'#9da8a6':'#bdc3bc'});column.position.set(x,1.5,z);set.add(column);}
 const stage:StageScene={name:'32 种镜头 · 运镜学习样板',description:'每个镜头独立演示 12 秒。按播放观察，使用上／下一个镜头从头逐项学习；右侧查看用途、观察重点与动手练习。01–16 为基础，17–30 为进阶，31–32 为连续编排；列表末尾是全景和俯视路径。',initialView:'shot',scene:base.scene,cameras:{},cameraLessons:{...lessons},subjects:{教学布景:set,人物A:a.root,人物B:b.root,线索道具:prop,前景遮挡:panel},durationSeconds:12,output:{width:1280,height:720,fps:24},update(t){a.resetPose();a.root.position.set(-.6,0,-t*.06);a.root.rotation.y=0;a.sampleWalk({distanceMeters:t*.06,weight:.35});b.setPose('stand');b.root.position.set(.8,0,-3);b.root.rotation.y=Math.PI;},dispose:base.dispose};
 stage.update(0);
 const pathLines=new T.Group();pathLines.name='镜头路径总览';
 for(const [index,def] of cameraPresetDefinitions.entries()){
  const head=['reaction','pov','over-shoulder','rack-focus'].includes(def.id);
  const config=createCameraPresetConfig(stage,def.id,{
   subject:def.id==='establishing'?{subject:'教学布景'}:def.id==='insert'?{subject:'线索道具'}:{subject:'人物A',anchor:head?'anchor:head':'anchor:chest'},
   ...('secondary' in def?{secondary:{subject:'人物B',anchor:'anchor:head'}}:{}),
   ...('occluder' in def?{occluder:{subject:'前景遮挡'}}:{}),
  },def.id==='rack-focus'?{focalLengthMm:50,distance:4}:def.id==='handoff-oner'?{frame:'world',travel:2}:{});
  if(def.id==='pov')config.lookTarget={subject:'人物B',anchor:'anchor:head'};
  if(def.id==='handoff-oner')config.eventTarget={subject:'线索道具'};
  if(def.id==='flythrough'){config.path={points:[[-4,4,7],[-3,2.5,3],[-2,1.4,-2],[2,2,-5],[4,4,-7]],lookAheadMeters:3};config.parameters.rollDegrees=8;}
  const camera=addCameraPreset(stage,def.id,config);camera.name=`${String(index+1).padStart(2,'0')} · ${def.name}`;
  (stage.cameraMetadata??={})[def.id]={label:camera.name,focalLengthMm:config.parameters.focalLengthMm,sensor:config.parameters.sensor,aperture:config.parameters.aperture};
  const positions:T.Vector3[]=[];
  for(let i=0;i<=64;i++){const t=stage.durationSeconds*i/64;stage.update(t);positions.push(sampleCameraPreset(stage,config,t).camera.position);}
  const color=index<16?'#a87c39':index<30?'#577b80':'#835d84';
  const line=new T.Line(new T.BufferGeometry().setFromPoints(positions),new T.LineBasicMaterial({color}));line.layers.set(1);pathLines.add(line);
  const start=new T.Points(new T.BufferGeometry().setFromPoints([positions[0]]),new T.PointsMaterial({color,size:.15}));start.layers.set(1);pathLines.add(start);
  stage.update(0);
 }
 base.scene.add(pathLines);
 const overview=new T.PerspectiveCamera(48,16/9,.05,150);overview.name='布景全景 · 空间关系';overview.position.set(11,9,13);overview.lookAt(0,1,-2);
 const paths=new T.PerspectiveCamera(48,16/9,.05,150);paths.name='俯视路径 · 三批对照';paths.position.set(0,24,0);paths.up.set(0,0,-1);paths.lookAt(0,0,0);paths.layers.enable(1);
 stage.cameras.overview=overview;stage.cameras.paths=paths;
 stage.cameraLessons!.overview={purpose:'看清共用布景，理解人物、道具与纵深立柱的位置。',observe:'A 慢慢走向北方，B 等候；前景板用于揭示，立柱用于比较背景透视。',tryThis:'切换自由观察绕场查看，再回到拍摄画面对比同一空间的不同取景。'};
 stage.cameraLessons!.paths={purpose:'从上方比较机位的实际路线。',observe:'金色是第一批，青色是第二批，紫色是第三批；圆点表示起点，固定机位只有点。',tryThis:'对照推进与变焦：推进有路径，固定机位变焦没有位移。这里的线是初始代码路径，手动改参后需由 Agent 重新生成。'};
 return stage;
}
