import * as T from 'three';
import {createWhiteStage,createMannequin,createBox,addCameraPreset,createCameraPresetConfig,cameraPresetDefinitions,sampleCameraPreset,type StageScene} from '@vibestage/core';

/** Public P1/P2 lab. World-space paths are original, not copied from private projects. */
export function createScene():StageScene {
 const base=createWhiteStage({width:26,depth:26});
 const a=createMannequin({name:'人物 A',color:'#c59d68'}),b=createMannequin({name:'人物 B',color:'#7f9796'});
 const event=createBox({name:'交接事件 · 道具',width:.4,height:.4,depth:.4,color:'#a67c58'});event.position.set(1.3,1.2,-2.8);
 base.scene.add(a.root,b.root,event);
 for(const z of [-7,-10])for(const x of [-6,-3,0,3,6]){const column=createBox({name:'纵深立柱',width:.4,height:3,depth:.4,color:z===-7?'#9da8a6':'#bdc3bc'});column.position.set(x,1.5,z);base.scene.add(column);}
 const main=new T.PerspectiveCamera(48,16/9,.05,150);main.name='全景 · 开放舞台';main.position.set(11,9,13);main.lookAt(0,1,-2);
 const paths=new T.PerspectiveCamera(48,16/9,.05,150);paths.name='俯视 · 机位路径';paths.position.set(0,24,0);paths.up.set(0,0,-1);paths.lookAt(0,0,0);paths.layers.enable(1);
 const stage:StageScene={name:'进阶镜头实验室 · 第二、三批',description:'14 项进阶镜头与连续交接、穿行俯冲。选择俯视机位查看彩色路径；路径辅助线不进入其他拍摄机位。A/B 缓慢前行，背景立柱用于比较透视变化。',scene:base.scene,cameras:{overview:main,paths},subjects:{人物A:a.root,人物B:b.root,交接事件:event},durationSeconds:12,output:{width:1280,height:720,fps:24},update(t){a.resetPose();a.root.position.set(-1,0,-t*.06);a.root.rotation.y=0;a.sampleWalk({distanceMeters:t*.06,weight:.35});b.resetPose();b.root.position.set(2.4,0,-2-t*.06);b.root.rotation.y=.1;b.sampleWalk({distanceMeters:t*.06,weight:.35});},dispose:base.dispose};
 stage.update(0);
 for(const def of cameraPresetDefinitions.slice(16)){
  const config=createCameraPresetConfig(stage,def.id,{subject:{subject:'人物A',anchor:'anchor:chest'},...('secondary' in def?{secondary:{subject:'人物B',anchor:'anchor:chest'}}:{})});
  if(def.id==='handoff-oner'){config.eventTarget={subject:'交接事件'};config.parameters.travel=2;}
  if(def.id==='flythrough')config.path={points:[[-4,4,7],[-3,2.5,3],[-2,1.4,-2],[2,2,-5],[4,4,-7]],lookAheadMeters:3};
  addCameraPreset(stage,def.id,config);
  const positions:T.Vector3[]=[];
  for(let i=0;i<=96;i++){const t=stage.durationSeconds*i/96;stage.update(t);positions.push(sampleCameraPreset(stage,config,t).camera.position);}
  const line=new T.Line(new T.BufferGeometry().setFromPoints(positions),new T.LineBasicMaterial({color:def.id==='flythrough'?'#577b80':def.id==='handoff-oner'?'#a67737':'#b69e7b'}));line.name=`路径 · ${def.name}`;line.layers.set(1);base.scene.add(line);
  stage.update(0);
 }
 return stage;
}
