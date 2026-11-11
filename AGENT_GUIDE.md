# 场景 Agent 使用说明

VibeStage 提供共享模型与运行工具。外部 Agent 直接编写场景代码，不需要提交 JSON 动作协议。先阅读根目录 `AGENTS.md`、`templates/blocking.ts` 和 `lib/core/types.ts`，再新建自己的场景，避免覆盖演示工程。

## 工作目录与版本管理

`examples/`、`templates/` 和 `lib/` 属于公开框架。`projects/<project>/` 是用户自己的工程，`user-models/` 是用户自己的复用模型库，两者均由 Git 忽略。场景专属辅助代码和资产留在其项目内，跨项目的私人模型或模型构造函数放在 user-models，不为加载方便而搬进公开目录。

`npm run dev` 会先初始化本地目录；只在 projects 不存在时从公开 examples 复制示例，不覆盖已有工作。`npm test`、`npm run build` 检查公开框架；`npm run check:projects` 单独检查用户场景。不要使用强制添加把私人工作目录提交到框架仓库。

## 内置教学项目

`vibestage-camera-school / showroom` 是固定置顶的只读学习项目，包含全部 32 项预设。默认初次打开进入拍摄画面；有效的上次项目选择优先。可观看、读取代码与导出，但不能写入机位、分镜或音频设置，也不能在其中创建场景。个人练习先通过界面“复制为我的项目”或 POST `/__vs/clone-builtin`（`{project:"vibestage-camera-school"}`，带 `X-VibeStage: 1`）取得新的 project/scene，再修改私人副本。源文件在 `examples/camera-school/`，不为私人场景修改或删除。

可选 `StageScene.initialView` 为首次切入场景选择 free/shot，热重载保留当前视图。`cameraLessons[cameraId]` 可提供 purpose、observe、tryThis 三段教学文字，随实际机位显示，不进入导出画面。

## 最小接口

场景模块导出 `createScene(): StageScene | Promise<StageScene>`，返回 `name`、`scene`、`cameras`、`durationSeconds`、`output`、`update(timeSeconds)`、`dispose()`。`subjects` 可选，用于界面对象列表，不登记也能渲染自定义对象。

`scene` 是原生 Three.js Scene。`cameras` 是 ID 到原生 Camera 的映射。`output` 包含 width、height、fps；尺寸需为 16–1920 之间的偶数。`update(t)` 必须能直接跳到任意时间，并完整设置该帧的动态状态，不能依赖上一次调用。复杂、有历史状态的模拟需自行重置并固定步长重放或预计算。

不要在场景中启动自己的渲染循环。不要用 `Date.now()` 或未固定种子的随机数决定拍摄状态。摄影机的朝向计算应放在人物更新及世界矩阵更新之后。渲染器会按输出画幅适配透视机位的 aspect，支持场景中的摄影机挂在其他对象下。

## 共享模型

从 `@vibestage/core` 导入：

```ts
import {
  createWhiteStage, createMannequin, createBox, createPlane,
  createSphere, createCylinder, createWall, createTable,
  createChair, createVehicle, loadModel, type StageScene,
} from '@vibestage/core';
```

统一单位为米和秒，Y 向上，正面朝 -Z，Three.js 旋转使用弧度。场景方位固定为北 −Z、南 +Z、东 +X、西 −X；用户描述“往东”时增加 X，“往北”时减小 Z。自由观察视图在场景地面边界外侧的四个方向平铺淡灰色方位文字和箭头，导出仍为纯拍摄画面。方块、球、圆柱原点在几何中心；平面位于 XZ 平面；墙、桌、椅、车及人偶原点以地面为基准。桌面锚点为 `table.getObjectByName('surface')`，默认高度 0.75；椅子座面锚点为 `seat`，默认高度 0.47。椅背在 +Z，车头在 -Z。

几何体参数见 `lib/core/models.ts`。`createBox({width,height,depth,color,name})` 可搭建任意布景，`createTable` 接受 width、height、depth，`createWall` 接受 width、height、thickness。也可以直接使用原生 Mesh、Group、曲线或第三方加载器，无需注册新模型类型。

`createMannequin({name,color,height,rig:'basic'})` 返回 root、joints、anchors、resetPose、setPose、sampleWalk。默认身高约 1.78 米；root 控制整体布局。具名关节为 pelvis、spine、head，以及 left/right 前缀的 UpperArm、Forearm、Hand、Thigh、Shin、Foot。人物朝 -Z 时，解剖学左侧为 +X。关节局部旋转零值为站姿，X 正转可使下垂肢体朝 -Z 抬起；合理活动范围需要作者自行控制。

`resetPose()` 重置骨架局部姿态，不改变 root 的位置、旋转或比例。`setPose('stand'|'sit')` 应用静态姿势。坐姿降低骨盆并弯曲膝髋，需作者摆好椅子与人物；不自动吸附座面。

`sampleWalk({distanceMeters,weight})` 只控制骨架循环，不移动 root。先 resetPose，再采样行走，再叠加需要的特殊关节调整。停止阶段应把 weight 平滑降至零。它是参考级循环，没有脚底接触求解。anchors 包含 chest、head、leftHand、rightHand，使用 getWorldPosition 获取拍摄目标。

工厂创建的模型资源彼此独立；实例内可以共享材质。`createWhiteStage()` 返回 scene 和 dispose，dispose 会遍历该场景释放几何体、材质、贴图与灯光阴影，适用于场景独占的资源。若跨场景共享 GPU 资源，需要自定义引用计数及 dispose；事件监听器、外部资源缓存也需自行清理。工厂抛错前创建的资源由场景作者自行释放。

## 摄影机参数与自动分镜

仅在需要选用、调整或扩展电影镜头预设时，读取 [Agent 镜头预设指南](agents/CAMERA_PRESETS.md)；需要研究更多镜头语言时，再沿指南中的链接读取研究库或机器可读目录。无关任务无需预先加载这些文档。

`cameras` 保留原生 Three.js Camera 映射；可选的 `cameraMetadata` 为透视机位指定物理镜头参数。右侧监看面板显示当前值，并可通过“调节当前机位”手动修改。场景代码提供初始设置，项目内保存的手动设置优先生效。没有配置元信息的旧机位继续使用原有 FOV；不会为它们虚构焦距、传感器或光圈。

```ts
cameraMetadata: {
  wide: {
    label: '巷口全景', shotSize: '双人全景',
    focalLengthMm: 25,
    sensor: {widthMm: 36, heightMm: 24},
    aperture: 5.6,
    focus: {target: actor.anchors.chest, label: '人物 A · 胸口'},
    movement: '固定机位',
  },
},
```

焦距与传感器尺寸单位为 mm，光圈填写 f 值。`focus` 可写为 `{distanceMeters: 5}`，也可以绑定 Object3D，使用目标的世界坐标实时计算摄影机到目标的直线距离。目标可附 `offset: [x,y,z]`，偏移使用目标的局部坐标。对焦不会改变摄影机朝向；跟拍仍由场景在 `update(t)` 中调用 `lookAt()`。景深由薄透镜模型实时计算，光圈不改变曝光。目标对焦使用目标在镜头前向上的投影距离作为清晰平面；记录仍保留直线距离，并新增 `focus.planeDistanceMeters`。手动 `distanceMeters` 是沿光轴的焦平面距离。目标位于镜头后方、焦平面距离不大于焦距、缺少光圈或对焦时，本帧不启用景深。

输出画幅按传感器中心裁切：36 × 24 mm 的传感器输出 16:9 时有效画幅为 36 × 20.25 mm，输出 9:16 时为 13.5 × 24 mm。垂直 FOV = `2 * atan(有效高度 / (2 * 焦距))`。配置镜头元信息后，焦距驱动投影，原摄影机的 FOV、zoom、filmOffset 和 view offset 不再控制输出构图；位置、朝向和裁剪平面仍来自原摄影机。用 `focalLengthFromFov(camera.fov, sensor, aspect)` 可将原有无 zoom 的构图换算成焦距。

变焦可在 `update(t)` 中确定性地修改对应元信息的 `focalLengthMm`；元信息对象应由每个场景实例独立创建。正交摄影机继续按原方式使用，不支持物理焦距元信息。

自动分镜用 `cameraCuts` 声明，键名对应 `cameras` 中的自动分镜入口；它的 Camera 仅作选择入口，运行时按时间使用实际子机位。分镜必须从 0 连续覆盖整个场景，不可重叠、留空或嵌套，ID 在该列表内唯一。每段为左闭右开，场景末端预览停在最后一段。

```ts
cameraCuts: {
  edit: [
    {id: 'approach', label: '接近', cameraId: 'wide', start: 0, end: 2},
    {id: 'reaction', label: '避让', cameraId: 'side', start: 2, end: 5},
    {id: 'sorry', label: '道歉', cameraId: 'reverse', start: 5, end: 8},
  ],
},
```

不用再在 `update(t)` 复制摄影机来切镜；预览、监看和导出使用 `sampleScene()` 求值分镜表演，再用 `resolveShotCamera()` 解析机位。直接选择 `wide` 等机位仍可完整观看同一段表演。面板的分镜计划可跳到每段起点，浏览器 `window.vibeStage.getState().cameraInfo` 返回当前实际机位及可序列化参数。

导出 `manifest.json` 的版本为 2，`cameraAtStart` 记录首个导出样本，`shots` 记录实际切镜区间，`cameraRecords` 指向 `cameras.json`。后者保留 `plannedShots` 和逐帧 `frames`：帧号、绝对时间、实际机位、镜头参数、有效画幅、对焦距离与目标位置、摄影机世界位置和四元数、FOV；`cameras.json` 的 `schemaVersion` 为 2，逐帧 `depthOfFieldEnabled` 记录是否启用景深，`depthOfField` 保留模型、焦平面距离、归一化散焦半径系数与半径上限。顶层 `depthOfFieldEnabled` 表示至少一帧启用，混合机位请读取逐帧状态。未对齐帧率的切点以首个落入该分镜的采样帧生效，计划时间与实际采样区间都保留。单图记录所选时刻，序列 ZIP 内也包含摄影机记录。元信息与像素在同一次 `update(t)` 后采样，无需事后推断。

分镜的播放时间连续不代表人物表演连续。需要跳切、独立动作或独立摆位时，按需读取 [分镜表演指南](agents/PERFORMANCES.md)。

## 手动机位与分镜

“操控机位”使用独立临时摄影机，在暂停的场景时刻进行第一人称构图。鼠标或触摸拖动转向；画面获得键盘焦点后，W/S 前后、A/D 左右、Q/E 升降，方向键缓慢转向，Esc 取消。前后沿镜头方向移动，升降沿世界 Y 轴，转向时保持地平线水平。离开画面焦点、窗口失焦或隐藏页面时停止移动。滚轮调整速度，焦距通过 HUD 参数读数展开调整。左右控制盘支持长按方向箭头和拖动盘心，升降控件显示世界 Y 高度；松手、取消或失焦停止操作。所有控制位于预览窗口内，不占用独立底部面板。

全屏目标是包含 WebGL 画布与 HUD 的预览容器；不对 canvas 单独请求全屏。全屏变化通过 ResizeObserver 重新适配画面及参考线，不改变输出设置。原生全屏不可用时采用固定定位的窗口铺满模式。进入和退出时停止持续移动，Esc 优先退出全屏，保留临时机位；退出后仍可继续调整、应用或取消。

构图参考线是 DOM/SVG 预览辅助层，按与渲染器一致的 letterbox 输出矩形定位。三分法、黄金分割（0.381966 / 0.618034）、中心十字、对角线及安全框可选；安全框百分比为参考画幅的宽高比例，字幕范围不大于动作范围。可选画幅遮罩不改变渲染分辨率。设置保存在浏览器 localStorage 的 `vibestage:guides`，不写入用户场景或相机设置，也不进入导出像素。

临时机位不会修改场景代码或手动设置；“取消”保留进入前的全部手动草稿。“应用机位”合并到实际机位 ID，随后使用原有“保存到项目”持久化。同一机位被多个分镜引用时共享调整。仅改变镜头参数不会固定机位姿态；移动或转向后位置与朝向成为固定覆盖。对焦目标在未修改对焦距离时沿用，输入距离后改为固定距离。操控期间锁定时间轴、机位切换、场景切换和导出，场景源码热更新不会覆盖临时构图。

“调节当前机位”支持焦距、光圈、传感器宽高、固定对焦距离、世界位置 XYZ 和朝向角度 XYZ。角度单位为度，使用 YXZ 欧拉顺序，依次表示俯仰、水平和横滚。先在“自由观察”里拖动构图，再点击“采用自由观察视角”，可捕获当前观察位置与朝向。“新建机位”复制当前实际机位的构图创建独立固定机位；自建机位若未被分镜引用可以删除。

“编辑分镜”可创建分镜组，在播放头处分割片段，修改片段名称与机位，调整相邻片段之间的结束时间或删除片段。边界上的新增操作取当前片段中点；删除片段时相邻片段覆盖空出的时间。所有分镜组连续覆盖整个场景时长。每段可延续上一段表演，也可独立选择动作、动作起点以及人物／道具摆位。动作函数仍由场景代码定义。

手动操作实时预览，点击“保存到项目”才写入 `projects/<project>/settings/<scene>.camera.json`。文件使用 `version: 1`、`cameras` 和 `sequences` 三个字段，结构定义见 `lib/core/camera-edits.ts`。原 `.ts` 文件不会被自动重写。设置作为私人项目的一部分随 source.zip 打包，重新加载时先执行场景 `update(t)`，再应用手动设置；预览、监看、导出共用最终状态。新建机位的位置、朝向和参数可以由 Agent 继续编辑这个 JSON 文件。

只覆盖手动改动的字段；手动位置和朝向覆盖代码定义的对应机位运动，未覆盖字段继续跟随代码。选择“沿用场景对焦”移除手动对焦距离；“恢复代码设置”移除当前机位覆盖；“撤销此组手动设置”恢复原分镜或移除手动创建的分镜组。恢复动作也要保存才永久生效。“放弃未保存”恢复上一次保存的状态。

有未保存修改时不能导出或切换场景，防止源码快照与画面不一致。外部文件变更不会覆盖未保存的手动草稿；保存会检查项目源版本与设置文件版本，遇到冲突需放弃草稿并重新加载后再操作。旧场景不需要改代码即可使用手动机位，正交或自定义投影目前不提供物理镜头调节。

## 工作流程

运行 `npm run create-scene -- project-id scene-id blocking` 创建可编辑源文件。布局使用 position、rotation、scale 和 Group 层级。动作写进 update(t)，自定义辅助函数可以拆分到项目的其他文件；scenes 目录直属的 .ts 文件作为场景入口，辅助模块请放在项目的 shared 目录或其他子目录。修改 `projects`、`user-models`、`lib`、`templates` 内的文件会触发场景重载；导出期间的更改延迟至导出完成后人工重新加载。

预览由 `npm run dev` 启动。除了界面，可在浏览器中调用：

```js
window.vibeStage.getState();
await window.vibeStage.load('my-mv', 'shot-01');
window.vibeStage.seek(2.5);
window.vibeStage.camera('wide');
const result = await window.vibeStage.export('video'); // still | sequence | video
window.vibeStage.cancel();
```

此 API 属于已打开的预览页面，可由 Agent 的浏览器工具调用。导出 Promise 直到文件完成才返回；失败会 reject。首版没有独立的无浏览器离线渲染命令。界面的新建、源文件读取、导出管理接口位于本机 `/__vs/`，写入要求 `X-VibeStage: 1` 请求头；它们不是场景表达协议。

将项目交给其他机器时保留共享库、场景工程、依赖锁文件和资源，或使用导出的 source.zip。该快照包含当前项目与整个 user-models，不含其他用户项目，不是框架的公开发布包。项目资源放在具体 projects 目录中，共享私人模型放在 user-models；通过相对导入或 `@vibestage/models/...` 引用。GLB/glTF 加载及自定义模型代码见 MODEL_GUIDE.md，不要依赖本机绝对路径。联网运行需自行配置访问与信任边界，此版默认仅监听 127.0.0.1。

## 景深渲染

`src/ShotRenderer.ts` 是拍摄预览、监看和导出的共同渲染路径，使用输出分辨率的线性色彩／深度目标，固定采样圆盘，最后统一色调映射与 sRGB 转换。全屏只改变显示区域，不改变光学参数或采样尺寸。屏幕空间景深不重建被遮挡区域；透明且不写入深度的材质按后方表面深度处理，前景遮挡边缘存在近似误差。自由观察、HUD 和构图线不参与虚化。

薄透镜散焦半径为 `f² / (2 × N × (1000s − f) × 有效传感器高度) × abs(1 − s/z)`，其中 f 为 mm，N 为 f 值，s/z 为米；半径以画面高度归一化并限制在 0.03。公式参考 [NVIDIA GPU Gems 3](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field)，固定采样保证任意时间跳转与导出可复现。

## 导演交付信息

新建或修改镜头必须阅读 [导演交付规范](agents/DELIVERY.md)，同步编写影片说明、人物、动作节点、色彩、多光源和连续性约束。使用交付信息页签保存；完整性检查通过后调用 `window.vibeStage.export('delivery')`，生成生图与视频两部分资料及逐镜头白模。空白不等于没有，草稿不得作为完整交付。项目共享说明与场景档案保存在 `projects/<project>/delivery.json`；现存手动档案优先于代码初稿。
