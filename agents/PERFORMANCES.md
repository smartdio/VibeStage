# 分镜表演与跳切（按需读取）

分镜的 start/end 是成片时间，从 0 连续覆盖 durationSeconds。连续的是播放时间，不要求人物位置、动作或事件连续。独立表演可在切点直接换姿态、跳到动作的其他时刻或重新摆放人物和道具。

## 分镜定义

```ts
cameraCuts: { edit: [
  {id:'approach', cameraId:'wide', start:0, end:2},
  {id:'passing', cameraId:'side', start:2, end:4},
  {id:'jump', cameraId:'wide', start:4, end:6,
    performance: {
      mode:'independent', takeId:'apology', sourceStartSeconds:0,
      subjects: {
        人物B: {position:[1,0,-3], rotationDegrees:[0,180,0]},
        道具箱: {position:[-1,.35,-2], visible:true},
      },
    },
  },
  {id:'reply', cameraId:'close', start:6, end:8},
]}
```

没有 performance 或 mode 为 continue，表示延续上一段。第一个片段默认使用原场景动作，动作时间从 0 开始。遇到 independent 后，延续片段继承最近独立片段的动作、摆位及动作时间；例如上述成片 6 秒对应 apology 动作 2 秒。再设置 independent 会开始新的一段，不继承前一段摆位。takeId 缺省时使用原场景 update 动作；sourceStartSeconds 缺省为 0，必须非负，整个继承段的采样时间不能超过 300 秒。

## 场景动作

动作仍由普通 Three.js 代码实现，不是固定动作 JSON。StageScene 可提供命名动作层，工作台下拉框自动列出：

```ts
performances: {
  apology: {label:'回头举手道歉', update(t, context) {
    actor.root.position.set(.5,0,-1);
    actor.root.rotation.y=Math.PI;
    actor.resetPose();
    actor.joints.rightForearm.rotation.x=-1.2;
    actor.joints.head.rotation.x=.15*Math.sin(t*2);
  }},
},
update(t, context) {
  // 每次完整求值基础动作。t 是当前选定表演的动作时间。
},
updateCameras(t, context) {
  // 这里看到的是完成动作与重新摆位后的最终人物位置。
  actor.anchors.chest.getWorldPosition(target);
  camera.lookAt(target);
},
```

context 包含 timelineTimeSeconds（成片时间）、sourceTimeSeconds（动作时间）、localTimeSeconds（当前分镜内时间）、sourceStartSeconds、shotId、originShotId、takeId、mode。延续动作使用 t/sourceTimeSeconds；不要用 localTimeSeconds 重启动作。成片计时、字幕等可使用 timelineTimeSeconds。

每次采样依次恢复场景初始变换及可见性，执行基础 update、命名动作、独立摆位、updateCameras，最后应用保存的手动摄影机覆盖。基础 update 保留灯光、环境等共同逻辑，命名动作层覆盖所需人物与道具。没有独立分镜的旧场景仍按原时间运行。

人物姿态、走路／奔跑／回头等动作由 Agent 使用人偶关节、sampleWalk 或自定义函数定义。这里不新增通用骨架动作库或任意模型自动重定向。回调必须能独立采样任意时刻，不可依赖前一帧或产生新资源。基础变换恢复不包含材质、灯光强度、morphTargetInfluences 或任意业务数据；使用这些属性时，基础 update 必须完整重设它们。模型与层级在 createScene 返回前准备完成；动态增删节点需要作者自行保证可重放与清理。

## 摆位坐标与移动

subjects 的键引用 StageScene.subjects。位置、朝向和缩放都在对象父节点的局部坐标中；直接挂在 Scene 下时就是场景坐标。rotationDegrees 是 YXZ 欧拉角（俯仰、水平、横滚），scale 要求三个正数。

摆位指定动作起点的变换，不是把对象每一帧锁死。引擎先采样 sourceStartSeconds，再把当前动作相对起点的移动、转动和缩放应用到新起点；新的朝向也会旋转移动方向。关节动画保留。visible 则在整段及其延续片段中覆盖可见性。需要固定位置时在命名动作中给出不随 t 改变的位置。重新设置缩放要求原动作起始缩放各轴非零。

有摆位时动作起点和当前时间可能分别求值一次，回调应保持纯求值。复杂自定义状态的恢复仍由作者负责。相机预设仍按成片时间运行，起止时间设为分镜的成片范围；跟拍目标使用重新摆位后的实际位置。手写 updateCameras 可用 t 或 context.timelineTimeSeconds 选择所需时间域。

## 预览、手动修改与导出

用 sampleScene(stage, selectedCameraId, timelineTime) 采样完整分镜，再调用 resolveShotCamera；只调用 update(t) 不会执行分镜动作层或摆位。运行时播放、暂停、跳转、循环、PNG、序列和视频共用 sampleScene。单独选择实体机位时预览原场景表演；要观看跳切效果请选择分镜组。

工作台“编辑分镜”支持每段选择延续／独立、动作与动作起点；“人物与道具摆位”支持起始位置、朝向及显示状态。修改写入既有 `projects/<project>/settings/<scene>.camera.json` 的 sequences，不修改 .ts。字段沿用 CameraCut.performance，设置文件仍为 version:1。动作函数只保存在场景代码里。先读取并保留用户手动设置，避免其覆盖新写的代码分镜。

拆分独立片段后，新片段默认延续，动作不会重新开始；调整切点会改变片段长度并重新计算继承时间；删除独立片段后，后续延续片段接续删除后的前一段。音轨始终按成片时间播放，不随动作起点跳跃。

cameras.json 每帧的 camera.performance 记录成片时间、动作时间与继承来源，plannedShots 保留摆位和动作选择。manifest 的 shots 及源码快照可用于复现。既有无表演配置的记录仍可读取；新表演配置的导出必须有对应逐帧记录。

可运行示例：examples/montage/scenes/edit.ts，展示连续走位、人物与道具跳切、继续新动作和更换机位。
