import {emptyDelivery} from '@vibestage/core';
import * as THREE from 'three';
import {FULL_FRAME, focalLengthFromFov} from '@vibestage/core';
import { createWhiteStage, type StageScene } from '@vibestage/core';
export function createScene(): StageScene {
  const stage=createWhiteStage();
  const camera=new THREE.PerspectiveCamera(40,16/9,0.1,100);
  camera.position.set(6,5,8);camera.lookAt(0,0,0);
  return {delivery:emptyDelivery(),name:'空场景',scene:stage.scene,cameras:{main:camera},cameraMetadata:{main:{focalLengthMm:focalLengthFromFov(camera.fov,FULL_FRAME,16/9),sensor:FULL_FRAME,aperture:5.6,focus:{distanceMeters:8},shotSize:"全景",movement:"固定机位"}},durationSeconds:6,output:{width:1280,height:720,fps:24},
    // Use absolute time for deterministic seeking and export. Add your own objects and modules.
    update(_timeSeconds:number){},dispose:stage.dispose};
}
