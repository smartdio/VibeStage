import * as THREE from 'three';
import {createWhiteStage,createMannequin,createBox,createWall,FULL_FRAME,type StageScene} from '@vibestage/core';

/** Original framework example: no private project or user assets are required. */
export function createScene():StageScene {
  const stage=createWhiteStage({width:10,depth:11});
  const left=createWall({width:9,height:2.5,color:'#d4d5d0'}),right=createWall({width:9,height:2.5,color:'#d4d5d0'});
  left.rotation.y=right.rotation.y=Math.PI/2;left.position.set(-2.8,0,-.5);right.position.set(2.8,0,-.5);
  const a=createMannequin({name:'人物 A',color:'#c6a578'}),b=createMannequin({name:'人物 B',color:'#819f9a'}),crate=createBox({name:'道具箱',width:.7,height:.7,depth:.7,color:'#b5aa92'});crate.position.set(-2,.35,1);
  stage.scene.add(left,right,a.root,b.root,crate);
  const wide=new THREE.PerspectiveCamera(45,16/9,.1,100),side=wide.clone(),close=wide.clone();wide.name='空间全景';side.name='侧面双人';close.name='道歉近景';
  wide.position.set(0,4.5,7);side.position.set(2.4,1.9,3);close.position.set(0,1.8,-.6);
  const edit=wide.clone();edit.name='分镜组 · 连续与跳切';
  const target=new THREE.Vector3();
  return {
    name:'连续走位 → 跳切道歉 → 延续动作',
    description:'前两镜连续行走；第 3 镜把人物和道具重新摆到远端并切换道歉动作；第 4 镜延续新的表演，只换机位。分镜时间轴连续，人物表演可跳切。',
    scene:stage.scene,cameras:{edit,wide,side,close},subjects:{人物A:a.root,人物B:b.root,道具箱:crate},
    cameraMetadata:{wide:{label:'空间全景',focalLengthMm:28,sensor:FULL_FRAME,aperture:8,focus:{distanceMeters:10}},side:{label:'侧面双人',focalLengthMm:32,sensor:FULL_FRAME,aperture:5.6,focus:{target:b.anchors.chest}},close:{label:'道歉近景',focalLengthMm:50,sensor:FULL_FRAME,aperture:4,focus:{target:b.anchors.chest}}},
    cameraCuts:{edit:[
      {id:'approach',label:'接近 · 连续',cameraId:'wide',start:0,end:2},
      {id:'passing',label:'经过 · 连续',cameraId:'side',start:2,end:3.5},
      {id:'jump',label:'远端道歉 · 跳切',cameraId:'wide',start:3.5,end:5.5,performance:{mode:'independent',takeId:'apology',sourceStartSeconds:0,subjects:{人物A:{position:[-.7,0,-2],rotationDegrees:[0,-70,0]},人物B:{position:[1.2,0,-2.7],rotationDegrees:[0,110,0]},道具箱:{position:[-1.8,.35,-2.5]}}}},
      {id:'reply',label:'继续道歉 · 换机位',cameraId:'close',start:5.5,end:8},
    ]},
    performances:{
      apology:{label:'回头举手道歉',update(t){
        a.root.position.set(-.6,0,0);a.root.rotation.y=Math.PI;a.resetPose();a.joints.head.rotation.y=-.2;
        b.root.position.set(.6,0,.5+Math.min(t,.6)*.2);b.root.rotation.y=-.4;b.resetPose();
        b.joints.rightUpperArm.rotation.z=-.7;b.joints.rightForearm.rotation.x=-1.3+.12*Math.sin(t*3);b.joints.head.rotation.x=.13*Math.sin(t*2);
      }},
      waiting:{label:'双人站定等待',update(){a.root.position.set(-.6,0,0);a.root.rotation.y=0;a.resetPose();b.root.position.set(.6,0,-1);b.root.rotation.y=Math.PI;b.resetPose();}},
    },
    durationSeconds:8,output:{width:1280,height:720,fps:24},
    update(t){
      a.root.position.set(-.6,0,.5-.12*t);a.root.rotation.y=0;a.resetPose();a.sampleWalk({distanceMeters:.12*t,weight:.5});
      b.root.position.set(.65,0,-3+Math.min(t,4)*1.2);b.root.rotation.y=Math.PI;b.resetPose();b.sampleWalk({distanceMeters:Math.min(t,4)*1.2,weight:t<4?1:0});
    },
    // Evaluate camera targets AFTER the chosen performance and independent placements.
    updateCameras(){wide.lookAt(0,.9,-.7);b.anchors.chest.getWorldPosition(target);side.lookAt(target);close.lookAt(target);},
    dispose:stage.dispose,
  };
}
