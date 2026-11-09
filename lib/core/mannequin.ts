import * as T from 'three';
import { material } from './models';
export const jointNames=['pelvis','spine','head','leftUpperArm','leftForearm','leftHand','rightUpperArm','rightForearm','rightHand','leftThigh','leftShin','leftFoot','rightThigh','rightShin','rightFoot'] as const;
export type JointName=typeof jointNames[number];
/** 1.78 m jointed proxy; +X is anatomical left, facing -Z; all angles in radians. */
export function createMannequin({color='#bda585',name='人物',height=1.78,rig='basic'}:{color?:T.ColorRepresentation;name?:string;height?:number;rig?:'basic'}={}) {
  if(rig!=='basic')throw new Error('当前模型库仅包含 basic 骨架');
  const root=new T.Group();root.name=name;root.scale.setScalar(height/1.78);
  const joints={} as Record<JointName,T.Group>;const body=material(color),jointMat=material('#716d65');
  function shape(geo:T.BufferGeometry,parent:T.Object3D,position:[number,number,number],mat=body){const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;m.position.set(...position);parent.add(m);return m;}
  function joint(key:JointName,parent:T.Object3D,p:[number,number,number],radius=0.05){const j=new T.Group();j.name=key;j.position.set(...p);parent.add(j);joints[key]=j;shape(new T.SphereGeometry(radius,16,12),j,[0,0,0],jointMat);return j;}
  function limb(parent:T.Object3D,length:number,radius:number){shape(new T.CylinderGeometry(radius,radius*0.8,length,16),parent,[0,-length/2,0]);}
  const pelvis=joint('pelvis',root,[0,0.94,0],0.075);shape(new T.SphereGeometry(0.17,20,12),pelvis,[0,0,0]).scale.set(1,0.65,0.68);
  const spine=joint('spine',pelvis,[0,0.13,0],0.065);shape(new T.CylinderGeometry(0.21,0.14,0.34,20),spine,[0,0.17,0]).scale.z=0.62;
  const head=joint('head',spine,[0,0.4,0],0.055);shape(new T.SphereGeometry(0.13,24,16),head,[0,0.17,0]).scale.set(0.86,1.18,0.9);
  shape(new T.SphereGeometry(0.025,12,8),head,[0,0.17,-0.115],jointMat);
  for(const side of ['left','right'] as const){const sign=side==='left'?1:-1;
    const arm=joint(`${side}UpperArm`,spine,[sign*0.23,0.30,0],0.065);limb(arm,0.29,0.053);
    const fore=joint(`${side}Forearm`,arm,[0,-0.29,0],0.045);limb(fore,0.25,0.042);
    const hand=joint(`${side}Hand`,fore,[0,-0.25,0],0.033);shape(new T.SphereGeometry(0.05,16,12),hand,[0,-0.055,0]).scale.set(0.7,1.4,0.5);
    const thigh=joint(`${side}Thigh`,pelvis,[sign*0.105,-0.03,0],0.07);limb(thigh,0.42,0.073);
    const shin=joint(`${side}Shin`,thigh,[0,-0.42,0],0.05);limb(shin,0.41,0.052);
    const foot=joint(`${side}Foot`,shin,[0,-0.41,0],0.04);shape(new T.BoxGeometry(0.105,0.1,0.23),foot,[0,-0.03,-0.065]);
  }
  const anchors={chest:new T.Object3D(),head:new T.Object3D(),leftHand:new T.Object3D(),rightHand:new T.Object3D()};
  anchors.chest.position.set(0,0.22,0);spine.add(anchors.chest);anchors.head.position.y=0.17;head.add(anchors.head);joints.leftHand.add(anchors.leftHand);joints.rightHand.add(anchors.rightHand);
  Object.entries(anchors).forEach(([k,o])=>o.name=`anchor:${k}`);
  const rest=new Map(Object.values(joints).map(j=>[j,j.position.clone()]));
  function resetPose(){for(const j of Object.values(joints)){j.rotation.set(0,0,0);j.position.copy(rest.get(j)!);} }
  function setPose(preset:'stand'|'sit'){resetPose();if(preset==='sit'){pelvis.position.y=0.55;for(const side of ['left','right'] as const){joints[`${side}Thigh`].rotation.x=Math.PI/2;joints[`${side}Shin`].rotation.x=-Math.PI/2;joints[`${side}Forearm`].rotation.x=0.5;}}}
  function sampleWalk({distanceMeters,weight=1}:{distanceMeters:number;weight?:number}){const w=T.MathUtils.clamp(weight,0,1),phase=distanceMeters/(1.3*height/1.78)*Math.PI*2;
    for(const side of ['left','right'] as const){const s=side==='left'?1:-1,a=Math.sin(phase)*s;joints[`${side}Thigh`].rotation.x=a*0.48*w;joints[`${side}Shin`].rotation.x=-Math.max(0,-a)*0.65*w;joints[`${side}UpperArm`].rotation.x=-a*0.32*w;joints[`${side}Forearm`].rotation.x=0.12*w;}
    pelvis.position.y=0.94+Math.abs(Math.sin(phase))*0.025*w;
  }
  return {root,joints,anchors,resetPose,setPose,sampleWalk};
}
