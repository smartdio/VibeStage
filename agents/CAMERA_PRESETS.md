# 电影镜头预设：Agent 调用与扩展

首批 16 项已实现，入口为 `@vibestage/core`。先阅读根目录 AGENTS.md 和 AGENT_GUIDE.md；创建前检查私人项目的 `settings/<scene>.camera.json`，保留无关机位与分镜。

## 选择与调用

`cameraPresetDefinitions` 是可执行清单，`CameraPresetId` 是有效 ID 类型。不要将研究目录里的 P1/P2 名称当成可调用 API。

| ID | 镜头 | 必需绑定 | 首版行为 |
| --- | --- | --- | --- |
| establishing | 环境建立 | subject，可用 @scene | 按参考包围盒适配输出画幅 |
| two-shot | 双人关系 | subject、secondary | 参考双人包围盒共同入画 |
| over-shoulder | 过肩 | subject 为前景 A，secondary 为 B | 从 A 后侧看 B；默认对焦 B |
| reaction | 反应近景 | subject，建议头部锚点 | 固定近景 |
| insert | 细节插入 | subject，建议道具或手部锚点 | 固定细节构图 |
| pov | 人物主观 | subject，建议头部锚点 | 眼位向前偏移；跟随主体；默认向主体前方看 |
| push-in | 缓慢推进 | subject | 固定焦距，靠近参考点 |
| pull-out | 拉远揭示 | subject | 固定焦距，远离参考点 |
| pan | 水平摇镜 | subject | 默认世界框架下固定位置、转动水平角 |
| tilt | 上下摇镜 | subject | 默认世界框架下固定位置、转动俯仰角 |
| rear-follow | 背后跟拍 | subject | 后方保持相对位置 |
| lead-follow | 正面引导 | subject | 前方保持相对位置，朝向人物 |
| side-follow | 侧向跟拍 | subject | 侧面保持相对位置 |
| arc | 短弧环绕 | subject | 绕参考点转过指定角度 |
| reveal-slide | 遮挡后揭示 | subject、occluder | 横移；检查指定遮挡物在首尾是否挡住主体锚点 |
| rack-focus | A/B 拉焦 | subject、secondary | 保持构图，按焦平面倒数从 A 插值到 B |

下面代码放在已构建模型、定义 update 的 `createScene()` 内、`return stage` 前。`人物A`、`人物B` 是 `stage.subjects` 的稳定键。

```ts
import {
  addCameraPreset, createCameraPresetConfig,
  resolveShotCamera,
} from '@vibestage/core';

// stage.subjects = {人物A: actorA.root, 人物B: actorB.root, ...};
stage.update(0); // 先把人物摆到参考时刻
const follow = createCameraPresetConfig(stage, 'rear-follow', {
  subject: {subject: '人物B', anchor: 'anchor:chest'},
}, {
  startSeconds: 0, endSeconds: stage.durationSeconds,
  distance: 3, height: 0.35, sideOffset: 0.4,
  focalLengthMm: 35, aperture: 4, frame: 'subject',
}, 0);
follow.lookTarget = {subject: '人物A', anchor: 'anchor:head'};
follow.focusTarget = {subject: '人物B', anchor: 'anchor:head'};
addCameraPreset(stage, 'followB', follow);

// 独立采样或调试：先更新人物，再获得实际拍摄机位。
stage.update(2);
const shot = resolveShotCamera(stage, 'followB', 2, 16 / 9);
console.log(shot.info.positionMeters, shot.info.focus, shot.info.preset);
stage.update(0);
```

`addCameraPreset(stage, cameraId, config)` 注册独立透视机位和 `stage.cameraPresets[cameraId]`，拒绝已有 ID。它不接管人物动画，不启动渲染循环。渲染器在场景 update 与手动设置之后采样预设；`stage.cameras[id]` 是注册入口，并非每帧最终机位。读取拍摄结果用 `resolveShotCamera`；单独求值用 `sampleCameraPreset(stage, config, t, aspect)`，前提同样是场景已经更新到 t。不要再在 update 中写同一个预设的 camera.position 争夺控制权。

创建配置时不会自动调用 update；最后一个参数只是参考时刻记录。先 `stage.update(referenceTime)`，再创建配置，两者必须一致。新增或调整配置后可调用 `validateCameraPreset` 做结构检查；缺失对象及锚点在采样时抛错。完整类型和默认值以 `lib/core/camera-presets.ts` 为准。

## 绑定、坐标与参数

绑定形如 `{subject:'人物A', anchor:'anchor:head', offset:[0,0.05,0]}`。subject 优先匹配 `stage.subjects` 键，再查找场景内唯一同名对象；`@scene` 表示整个场景。anchor 是该对象子树内唯一的 Object3D.name；未填时取包围盒中心，没有几何体时取对象世界位置。offset 是锚点局部偏移，会经过旋转与缩放。内置人偶锚点名为 `anchor:head`、`anchor:chest`、`anchor:leftHand`、`anchor:rightHand`。

跟随主体、观看目标、对焦目标分开：subject 控制基准，lookTarget 控制视线，focusTarget 控制清晰平面。过肩默认看 B、对焦 B；POV 默认沿人物前向看、对焦观看点。拉焦使用 A/B 锚点，不能另外填写 focusTarget。两人同焦平面时拉焦不明显；应调整纵深，不能只把光圈开大。

长度用米，时间用场景绝对秒，焦距与传感器用毫米，角度参数用度。frame=world 时方位 0° 把机位放在基准点南侧（+Z），90° 在东侧（+X）；frame=subject 时叠加人物的水平朝向，人物默认前向 -Z，0° 在背后。height 相对所选锚点，不是离地高度。sideOffset 沿基准方位的右向；lead/side/POV 对 distance 的意义见上表。跟拍四项总是跟随主体平移；frame 只选择是否跟随主体转向。其他预设选择 subject 框架也会跟着主体移动，因而不再是纯固定机位。

`reference.target/bounds` 冻结创建时的构图。world 框架通常围绕该参考点运动；跟拍直接读取当前主体锚点。two-shot 的自动包围盒适配依据参考时刻，不承诺移动人物全程入画。fitFrame 仅用于 establishing/two-shot，启用时 distance 是下限，窄画幅会自动后退。不要给其他预设同时绑定无关 secondary，以免扩大参考边界。

`startSeconds/endSeconds` 使用场景时间，不随分镜切入重新从零播放。首尾停留由 `holdStartSeconds/holdEndSeconds` 控制；区间外锁定路径进度，但跟随目标仍会移动。停留之和必须小于区间长度。默认首尾各占场景时长 15%；缩短区间时同时缩短停留。smooth 为五次平滑起停，linear 为匀速进度。travel 是推拉/横移的有符号位移；angleDegrees 控制摇镜或环绕。负值可反向，推进终点不得越过目标。

## 用户调整、分镜与保存

工作台右侧“电影镜头预设 → 从预设新建”，选择类型、主体和锚点，调整距离、高度、方位、焦距、光圈、时间、观看与对焦目标，然后应用。调整不会实时写入代码；应用后播放或拖动时间检查，点击“保存到项目”持久化。未应用的表单是局部草稿，切换机位会丢弃；取消不改变已应用配置。

微调已有预设默认保留 reference。勾选“以当前时刻重新建立构图参考”才重取；更换主体或预设类型会自动勾选。预设机位不能直接进入固定姿态的第一人称操控；用“复制为固定机位”冻结当前拍摄姿态后再通过 HUD 调整，原预设仍保留。

手动预设保存为 `cameras[id].preset`，新增机位还带 `created:true`。保存设置继续采用 version:1。预设不能同时携带固定 position、rotationDegrees、focusDistanceMeters；手动 focalLengthMm/aperture/sensor 可覆盖预设光学参数。工作台应用预设参数会将光学值收回 preset.parameters。只修改相关机位，不能清空其他 cameras/sequences。对代码预设撤销覆盖时，只删除其对应手动记录并重新加载；私有 JSON 手动编辑后必须校验。

预设和普通机位都可放进 `cameraCuts`，或通过“编辑连续分镜”组合。分镜组仍须完整覆盖场景时间。预设不是切镜效果，也不会改变人物表演。

预览、监看、全屏与导出共用求值器和景深渲染。逐帧 `cameras.json` 保留实际位置、四元数、FOV、光学与景深参数，并新增 `camera.preset = {id, version:1, config, warnings}`；相同信息进入 manifest 的机位快照。camera recording schemaVersion 保持 2，字段为兼容性增补。source.zip 包含私人设置与公共实现，仍只保存在本地。

## 检查与边界

公共示例 `examples/camera-lab/scenes/presets.ts` 提供 16 个可选机位、双人、道具、遮挡板和背景墙。已存在 projects 的用户可以用 create-scene 创建新场景，再复制这个公共模板的内容进入新文件；不要覆盖现有场景。首次初始化会正常复制 camera-lab 项目。

每次检查开始、25%、50%、75%、结束时刻与实际切点；顺序播放、倒序 seek、横竖画幅、全屏和导出都要看。运行 `npm run check:projects` 检查私人项目。人物、墙面等必须由同一时刻更新，不能用上一帧插值或随机抖动。当前警告覆盖目标锚点出画、焦点无效、拉焦纵深不足和揭示首尾遮挡条件，不是完整构图评分或碰撞检测。

首版没有自动避墙、轴线检测、镜头路径可视化、自动路线规划、轨迹阻尼、运动模糊或多个预设叠加混合。遮挡揭示需要作者放好前景，库不会移动它。复杂场景继续使用普通 Three.js 解析路径或预计算轨迹；自定义机位不要登记 cameraPresets，避免被预设求值覆盖。

## 更多镜头的研究入口

[32 项研究目录](../docs/camera-library.catalog.json) 保留 P0/P1/P2、用途、参数建议、条件、来源及 8 个组合配方；[镜头语言说明](../docs/CAMERA_LIBRARY.md) 保留影片与资料链接。P0 的 runtimeImplemented=true，P1/P2=false。suggestedDefaults 是研究建议，runtime 默认值以代码为准。配方是叙事组合思路，不是已经实现的一键宏。

后续 Agent 可研究高低角度、顶拍、倾斜构图、升降、摇臂、变焦、滑动变焦、甩镜、手持、完整环绕、主体固定机位，以及长镜头交接和穿行。新增通用预设时补齐定义、配置校验、确定性求值、面板参数、保存/导出、公共白模示例和测试，再将目录条目标为 implemented。只完成研究或某个私人场景的定制代码时，保持 research-proposal，不能把设想列成已有功能。
