import * as T from 'three';
export type ModelOptions = { color?: T.ColorRepresentation; name?: string };
const white = '#dedbd2';
export function material(color: T.ColorRepresentation = white) { return new T.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 }); }
function mesh(geometry: T.BufferGeometry, options: ModelOptions = {}) {
  const m = new T.Mesh(geometry, material(options.color)); m.castShadow = true; m.receiveShadow = true; m.name = options.name ?? '模型'; return m;
}
export function createBox({ width = 1, height = 1, depth = 1, ...options }: ModelOptions & { width?: number; height?: number; depth?: number } = {}) { return mesh(new T.BoxGeometry(width, height, depth), {name:'方块',...options}); }
export function createSphere({ radius = 0.5, ...options }: ModelOptions & { radius?: number } = {}) { return mesh(new T.SphereGeometry(radius, 24, 16), {name:'球体',...options}); }
export function createCylinder({ radius = 0.3, height = 1, ...options }: ModelOptions & { radius?: number; height?: number } = {}) { return mesh(new T.CylinderGeometry(radius, radius, height, 24), {name:'圆柱',...options}); }
export function createPlane({ width = 10, depth = 10, ...options }: ModelOptions & { width?: number; depth?: number } = {}) { const m = mesh(new T.PlaneGeometry(width,depth),{name:'平面',...options}); m.rotation.x = -Math.PI/2; return m; }
export function createWall({ width = 5, height = 3, thickness = 0.15, ...options }: ModelOptions & { width?: number; height?: number; thickness?: number } = {}) { const g = new T.Group(); g.name=options.name??'墙面'; const m=createBox({width,height,depth:thickness,...options});m.position.y=height/2;g.add(m);return g; }
export function createTable({ width = 1.6, depth = 0.8, height = 0.75, ...options }: ModelOptions & { width?: number; depth?: number; height?: number } = {}) {
  const g=new T.Group();g.name=options.name??'桌子'; const top=createBox({width,height:0.08,depth,...options});top.position.y=height-0.04;g.add(top);
  for(const x of [-1,1]) for(const z of [-1,1]) { const leg=createBox({width:0.065,height:height-0.08,depth:0.065,...options});leg.position.set(x*(width/2-0.1),(height-0.08)/2,z*(depth/2-0.1));g.add(leg); }
  const anchor=new T.Object3D();anchor.name='surface';anchor.position.y=height;g.add(anchor);return g;
}
export function createChair(options: ModelOptions = {}) {
  const g=new T.Group();g.name=options.name??'椅子';const seat=createBox({width:0.48,height:0.07,depth:0.48,...options});seat.position.y=0.435;g.add(seat);
  for(const x of [-0.18,0.18])for(const z of [-0.18,0.18]){const leg=createBox({width:0.045,height:0.4,depth:0.045,...options});leg.position.set(x,0.2,z);g.add(leg);}
  const back=createBox({width:0.48,height:0.48,depth:0.06,...options});back.position.set(0,0.72,0.21);g.add(back);
  const a=new T.Object3D();a.name='seat';a.position.y=0.47;g.add(a);return g;
}
export function createVehicle(options: ModelOptions = {}) {
  const g=new T.Group();g.name=options.name??'车辆';const body=createBox({width:1.7,height:0.55,depth:3.6,...options});body.position.y=0.65;g.add(body);
  const cabin=createBox({width:1.45,height:0.6,depth:1.9,...options});cabin.position.set(0,1.2,0.2);g.add(cabin);
  const glass=createBox({width:1.3,height:0.4,depth:0.025,color:'#656e72'});glass.position.set(0,1.23,-0.76);g.add(glass);
  for(const x of [-0.84,0.84])for(const z of [-1.1,1.1]){const wheel=createCylinder({radius:0.32,height:0.2,color:'#454b50'});wheel.rotation.z=Math.PI/2;wheel.position.set(x,0.32,z);g.add(wheel);}return g;
}
/** Dispose only resources owned by this scene. Model factories create independent resources. */
export function disposeTree(root: T.Object3D) {
  const skeletons=new Set<T.Skeleton>();const images=new Set<ImageBitmap>();const geometries=new Set<T.BufferGeometry>();const materials=new Set<T.Material>();const textures=new Set<T.Texture>();
  root.traverse(o=>{ if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);const m=o as T.Mesh; if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>materials.add(v));if(o instanceof T.Light && 'shadow' in o)(o as T.DirectionalLight).shadow?.dispose(); });
  materials.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});m.dispose();});textures.forEach(t=>{const data=t.source?.data;for(const image of Array.isArray(data)?data:[data])if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap)images.add(image);t.dispose();});images.forEach(image=>image.close());skeletons.forEach(skeleton=>skeleton.dispose());geometries.forEach(g=>g.dispose());
  if(root instanceof T.Scene){ if(root.environment)root.environment.dispose();if(root.background instanceof T.Texture)root.background.dispose(); }
  root.clear();
}
export function createWhiteStage({width=12,depth=10}: {width?:number;depth?:number}={}) {
  const scene=new T.Scene();scene.background=new T.Color('#b6b8b4');
  const floor=createPlane({width,depth,color:'#c9cbc4',name:'场地'});floor.receiveShadow=true;scene.add(floor);
  const hemi=new T.HemisphereLight('#ffffff','#7d8588',2.2);scene.add(hemi);
  const key=new T.DirectionalLight('#fff7e9',3);key.position.set(3,8,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=0.025;key.shadow.bias=-0.0001;scene.add(key);
  const fill=new T.DirectionalLight('#c9dcf0',1);fill.position.set(-4,4,-3);scene.add(fill);
  return {scene,dispose:()=>disposeTree(scene)};
}
