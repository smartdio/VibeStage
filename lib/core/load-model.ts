import {Box3,Group,Mesh,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeTree} from './models';

export interface LoadModelOptions {
  name?:string;
  /** Uniform multiplier for source units; e.g. centimeters to meters = 0.01. */
  scale?:number;
  /** Center X/Z and place the lowest point at ground level. Default true. */
  ground?:boolean;
  /** Configure local Draco/KTX2/Meshopt decoders when required by the asset. */
  configureLoader?:(loader:GLTFLoader)=>void;
}

/** Import a private or project-local GLB/glTF without altering the shared model library. */
export async function loadModel(url:string,options:LoadModelOptions={}){
  if(options.scale!==undefined&&(!Number.isFinite(options.scale)||options.scale<=0))throw new Error('模型 scale 必须是正数');
  const loader=new GLTFLoader();options.configureLoader?.(loader);
  const gltf=await loader.loadAsync(url);
  const root=new Group();root.name=options.name??gltf.scene.name??'导入模型';
  const content=new Group();content.add(gltf.scene);content.scale.setScalar(options.scale??1);root.add(content);
  if(options.ground!==false){
    const bounds=new Box3().setFromObject(content);
    if(!bounds.isEmpty()){const center=bounds.getCenter(new Vector3());content.position.set(-center.x,-bounds.min.y,-center.z);}
  }
  root.traverse(object=>{if(object instanceof Mesh){object.castShadow=true;object.receiveShadow=true;}});
  let disposed=false;
  return {root,content,source:gltf.scene,animations:gltf.animations,
    // If root is added to a white stage, its stage.dispose() owns these resources.
    dispose(){if(disposed)return;disposed=true;disposeTree(root);},
  };
}
