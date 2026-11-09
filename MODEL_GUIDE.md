# 自定义模型库

`lib/core/` 是随框架公开的基础模型；`user-models/` 是本机用户模型库，整体由 Git 忽略。某个项目专用的模型也可以放在 `projects/<project>/assets/`，同样不会进入普通 Git 提交。目录由首次启动自动创建，不需要在公开仓库中放置真实私人资源。

## 放入模型

推荐每个模型一个子目录，例如 `user-models/chair/model.glb`。glTF 文件要连同 `.bin` 与纹理一起保留原有相对路径，例如 `user-models/room/model.gltf`、`room.bin`、`textures/`。GLB 通常更方便迁移。

当前内置 `loadModel()` 加载 GLB/glTF。其他格式可由场景代码自行引入对应 Three.js 加载器，或先转换格式。Draco、KTX2、Meshopt 压缩资源需要通过 `configureLoader` 配置对应解码器；默认不会下载或自动配置远程解码服务。

## 从场景加载

```ts
import * as THREE from 'three';
import {createWhiteStage, loadModel, type StageScene} from '@vibestage/core';
import chairUrl from '@vibestage/models/chair/model.glb?url';

export async function createScene(): Promise<StageScene> {
  // 先等待模型成功加载，避免失败时遗留已构建的场景资源。
  const chair = await loadModel(chairUrl, {name: '我的椅子', scale: 1});
  const stage = createWhiteStage();
  chair.root.position.set(1, 0, -1);
  stage.scene.add(chair.root);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  camera.position.set(5, 3, 7);
  camera.lookAt(0, 1, 0);
  return {
    name: '自己的模型', scene: stage.scene,
    subjects: {椅子: chair.root}, cameras: {main: camera},
    durationSeconds: 6, output: {width: 1280, height: 720, fps: 24},
    update(_timeSeconds: number) {}, dispose: stage.dispose,
  };
}
```

`scale` 用于单位换算，例如厘米模型设为 `0.01`。默认在 X/Z 居中并把模型底部放到地面；传入 `ground: false` 保留原始原点。`root` 用于整体摆放，`source` 是原始 glTF 场景，`animations` 保留导入的动画片段。加入 white stage 后由 `stage.dispose()` 释放资源；未加入场景的模型由调用者执行 `model.dispose()`。

项目专用资源可以用相对导入，例如 `import modelUrl from '../assets/model.glb?url'`。不要使用某台机器的绝对文件路径。框架只提供加载与定位便利，不会自动把任意导入人体骨架转换为内置人偶骨架。

## 自己编写模型

也可以在 `user-models/my-props.ts` 中导出 Three.js 构造函数，再使用 `import {createMyProp} from '@vibestage/models/my-props'`。这允许用户维护自己的可复用模型代码，无需改动公共 `lib/core`。修改模型代码或资源文件后，预览会重新加载当前场景。

## Git 与本地导出

`projects/`、`user-models/`、`exports/` 和 `artifacts/` 均由根目录 `.gitignore` 排除。用户模型没有被搬进公共示例或基础库。已在其他仓库被 Git 跟踪的旧文件不会因增加忽略规则而自动取消跟踪，迁移旧仓库时需单独检查。

导出的 `source.zip` 包含当前项目、整个 `user-models/` 以及公共框架，用于本机备份和复现；不包含其他用户项目。它也属于本地私人产物。首版源码快照上限为 256 MB；大量暂不用的模型可移到工作台外的存储目录。预览检查使用缓存的内容摘要，不会反复把整个模型库装入内存。
