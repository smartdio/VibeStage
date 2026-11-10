/** Reserved framework-owned teaching project; editable copies use ordinary project IDs. */
export const CAMERA_SCHOOL={id:'vibestage-camera-school',name:'内置 · 运镜学习样板',directory:'examples/camera-school',scene:'showroom'} as const;
export function isBuiltinProject(id:string){return id===CAMERA_SCHOOL.id;}
export function assertWritableProject(id:string){if(isBuiltinProject(id))throw new Error('内置教学项目为只读，请先复制为自己的项目');}
