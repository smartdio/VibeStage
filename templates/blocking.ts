import {emptyDelivery} from '@vibestage/core';
import * as THREE from 'three';
import {FULL_FRAME, focalLengthFromFov} from '@vibestage/core';
import {createWhiteStage,createWall,createBox,createCylinder,createTable,createChair,createVehicle,createMannequin,type StageScene} from '@vibestage/core';

/** Edit this module freely. No scene schema or engine changes are required. */
export function createScene():StageScene {
  const stage=createWhiteStage({width:13,depth:10});
  const back=createWall({width:6.6,height:2.6,color:'#e3e1d9'});back.position.set(1,0,-3);
  const side=createWall({width:3.6,height:2.6,color:'#d9d9d1'});side.rotation.y=Math.PI/2;side.position.set(4.3,0,-1.2);
  const door=createWall({width:1.3,height:2.6});door.position.set(-4.3,0,-3);
  const lintel=createBox({width:1.3,height:0.35,depth:0.15});lintel.position.set(-3,2.425,-3);
  const table=createTable({width:1.8,depth:0.85});table.position.set(0,0,-0.7);
  const chair=createChair({color:'#9ca29b'});chair.position.set(1.35,0,-0.7);chair.rotation.y=Math.PI/2;
  const actor=createMannequin({name:'人物 A · 行走',color:'#c59d68'});
  const partner=createMannequin({name:'人物 B · 坐姿',color:'#7f9796'});partner.root.position.copy(chair.position);partner.root.rotation.y=Math.PI/2;
  const car=createVehicle({color:'#b6bbb4'});car.position.set(-4.6,0,1.1);car.rotation.y=0.15;
  const cup=createCylinder({radius:0.06,height:0.12,color:'#8d8069'});cup.position.set(0.2,0.81,-0.7);cup.name='桌面杯子';
  // Procedural object outside the shared library: a ring sculpture on a plinth.
  const plinth=createBox({width:0.7,height:0.7,depth:0.7});plinth.position.set(2.8,0.35,-2);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.055,12,48),new THREE.MeshStandardMaterial({color:'#9e9688',roughness:0.6}));ring.position.set(2.8,1.18,-2);ring.castShadow=true;ring.name='程序化环形装置';
  stage.scene.add(back,side,door,lintel,table,chair,actor.root,partner.root,car,cup,plinth,ring);
  const route=new THREE.CatmullRomCurve3([new THREE.Vector3(-3,0,-2.5),new THREE.Vector3(-2.7,0,-0.1),new THREE.Vector3(-1.35,0,-0.7)]);
  const routeLength=route.getLength();const target=new THREE.Vector3();
  const wide=new THREE.PerspectiveCamera(43,16/9,0.1,100);wide.name='全景 · 空间关系';wide.position.set(7.8,6,10);wide.lookAt(-0.7,0.8,-0.6);
  const close=new THREE.PerspectiveCamera(38,16/9,0.1,100);close.name='跟拍 · 人物 A';
  return {delivery:emptyDelivery(),name:'会面 · 双人走位',description:'人物 A 从门口走向桌边，人物 B 坐在桌旁。两个机位共享同一段表演。',scene:stage.scene,cameras:{wide,close},cameraMetadata:{
      wide:{focalLengthMm:focalLengthFromFov(43,FULL_FRAME,16/9),sensor:FULL_FRAME,aperture:5.6,shotSize:'全景',focus:{target:actor.anchors.chest,label:'人物 A · 胸口'},movement:'固定机位'},
      close:{focalLengthMm:focalLengthFromFov(38,FULL_FRAME,16/9),sensor:FULL_FRAME,aperture:2.8,shotSize:'跟拍中景',focus:{target:actor.anchors.chest,label:'人物 A · 胸口'},movement:'摄影机缓慢推进，朝向跟随人物 A'},
    },subjects:{人物A:actor.root,人物B:partner.root,桌子:table,椅子:chair,车辆:car,装置:ring},durationSeconds:6,output:{width:1280,height:720,fps:24},
    update(timeSeconds:number){
      const t=THREE.MathUtils.clamp(timeSeconds,0,6),progress=Math.min(t/4,1);
      actor.root.position.copy(route.getPointAt(progress));const tangent=route.getTangentAt(progress);actor.root.rotation.y=Math.atan2(-tangent.x,-tangent.z);
      actor.resetPose();actor.sampleWalk({distanceMeters:routeLength*progress,weight:Math.min(t/0.25,1)*THREE.MathUtils.clamp((4-t)/0.35,0,1)});
      partner.setPose('sit');partner.joints.head.rotation.y=-0.2*Math.sin(t/6*Math.PI);partner.joints.rightForearm.rotation.x=0.5+0.5*Math.min(t/3,1);
      ring.rotation.y=t*0.15;
      close.position.set(2.5-t*0.12,2.1,4.5-t*0.1);stage.scene.updateMatrixWorld(true);actor.anchors.chest.getWorldPosition(target);close.lookAt(target);
    },dispose:stage.dispose};
}
