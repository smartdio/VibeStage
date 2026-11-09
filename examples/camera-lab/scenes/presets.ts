import * as T from 'three';
import {createWhiteStage,createMannequin,createBox,addCameraPreset,createCameraPresetConfig,cameraPresetDefinitions,type StageScene} from '@vibestage/core';

/** Public, independently authored lab for all sixteen presets. No private user scene imports. */
export function createScene():StageScene {
 const base=createWhiteStage({width:16,depth:16});
 const a=createMannequin({name:'人物 A',color:'#c59d68'}),b=createMannequin({name:'人物 B',color:'#7f9796'});
 const backdrop=createBox({name:'背景墙',width:8,height:3,depth:.2,color:'#bcbfb9'});backdrop.position.set(0,1.5,-5);
 const panel=createBox({name:'前景遮挡',width:.65,height:2.6,depth:.15,color:'#868f91'});panel.position.set(-1.03,1.3,2.3);
 const prop=createBox({name:'线索道具',width:.3,height:.3,depth:.3,color:'#aa8061'});prop.position.set(1.5,.9,-.5);
 base.scene.add(a.root,b.root,backdrop,panel,prop);
 const main=new T.PerspectiveCamera(45,16/9,.1,100);main.position.set(6,5,9);main.lookAt(0,1,-1);
 const stage:StageScene={name:'电影镜头实验室 · 16 项预设',description:'共用一组人物、墙面与道具。选择不同机位，播放或拖动 6 秒时间轴，比较构图、跟拍、摇移和拉焦。背景墙与前景用于观察视差及遮挡。',scene:base.scene,cameras:{overview:main},subjects:{人物A:a.root,人物B:b.root,线索道具:prop,前景遮挡:panel,背景墙:backdrop},durationSeconds:6,output:{width:1280,height:720,fps:24},update(t){a.resetPose();a.root.position.set(-.6,0,-t*.2);a.root.rotation.y=0;a.sampleWalk({distanceMeters:t*.2,weight:.5});b.setPose('stand');b.root.position.set(.8,0,-3);b.root.rotation.y=Math.PI;},dispose:base.dispose};
 stage.update(0);
 for(const def of cameraPresetDefinitions){
  const head=['reaction','pov','over-shoulder','rack-focus'].includes(def.id);
  const config=createCameraPresetConfig(stage,def.id,{subject:def.id==='establishing'?{subject:'@scene'}:def.id==='insert'?{subject:'线索道具'}:{subject:'人物A',anchor:head?'anchor:head':'anchor:chest'},secondary:{subject:'人物B',anchor:'anchor:head'},occluder:{subject:'前景遮挡'}},def.id==='rack-focus'?{focalLengthMm:50,distance:4}:{});
  if(def.id==='pov')config.lookTarget={subject:'人物B',anchor:'anchor:head'};
  addCameraPreset(stage,def.id,config);
 }
 return stage;
}
