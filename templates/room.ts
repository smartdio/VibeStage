import * as THREE from 'three';
import {FULL_FRAME, focalLengthFromFov} from '@vibestage/core';
import { createWhiteStage,createWall,createTable,createChair,createMannequin,type StageScene } from '@vibestage/core';
export function createScene():StageScene {
  const stage=createWhiteStage({width:10,depth:8});
  const wall=createWall({width:7,height:2.8});wall.position.z=-3;
  const table=createTable();table.position.z=-0.6;
  const chair=createChair();chair.position.set(0,0,0.3);chair.rotation.y=Math.PI;
  const actor=createMannequin({name:'人物 A'});actor.root.position.set(-1.6,0,0);actor.root.rotation.y=-Math.PI/2;
  stage.scene.add(wall,table,chair,actor.root);
  const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100);camera.position.set(6,4,7);camera.lookAt(0,1,-0.5);
  return {name:'室内白模',scene:stage.scene,cameras:{main:camera},cameraMetadata:{main:{focalLengthMm:focalLengthFromFov(camera.fov,FULL_FRAME,16/9),sensor:FULL_FRAME,aperture:5.6,focus:{distanceMeters:8},shotSize:"全景",movement:"固定机位"}},subjects:{人物A:actor.root,桌子:table,椅子:chair},durationSeconds:6,output:{width:1280,height:720,fps:24},update(){actor.setPose('stand');},dispose:stage.dispose};
}
