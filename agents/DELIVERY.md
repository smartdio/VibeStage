# 导演交付规范（新建、修改镜头时必读）

## 必须履行的约束

Agent 新建或修改镜头时，必须同时维护交付档案，不能只完成白模。最终完成声明之前，当前交付分镜组的 deliveryIssues 必须为空，并检查实际预览。无法确定的内容留空并向用户说明缺失；不得把未知、未实现、未填写自动填成“没有”。确实没有时显式填写字符串 `没有`，列表填写 `{state:'none',items:[]}`。核心字段不能写没有或不适用。空模板只用于草稿，不能被宣称已完整。

影片必填理念、故事背景与前因后果、人物关系、视觉风格、整体色彩、连续性、禁止内容。场景必填上下文、前情、后续、约束。每镜头必须有叙事目的、画面内容、观众感受、构图空间、起止状态、衔接、色彩、肤色、饱和度、对比度、调色、环境道具、摄影设计、保持内容、禁止内容、声音。

人物逐个描述稳定 subjectId、身份外形服装、神态情绪、视线、姿态、动作、交互与反应。人物须登记在 StageScene.subjects，名称不得用来替代稳定引用。多人互动写清谁对谁做什么、对方如何反应。

动作节点使用镜头内秒数 time，严格递增，范围 0 到镜头时长；逐个交代人物动作交互、表情视线、环境道具、光线、运镜焦点的变化。节点时刻是关键帧意图；导出图像取该镜头内最近的实际帧，末端取最后可渲染帧。没有变化才可以声明没有动作过程。不得将动作时间与成片时间混用。

每个光源单独描述 id、类型、用途、位置、照射目标、方位角、俯仰角、参照系、颜色或色温、强度单位、软硬、阴影、变化。设计角度用度，明确世界／摄影机／人物参照；世界北 -Z、东 +X、Y 向上。环境光、点光源等无定向照射属性写“不适用”，不能捏造方向。Three.js 实测 angle 使用弧度，导出 units 会说明。

区分 design（最终画面设计）与 actual（白模真实采样）。文字可以描述白模尚未实现的表情或美术，但不得声称白模已经实现；导出的实际灯光强度使用 Three.js 原始值，不虚构摄影曝光、色温或照度。物理镜头元数据缺失时使用真实 FOV，不反推不存在的传感器、光圈。

## 数据与保存

类型及统一校验函数在 `lib/core/delivery.ts`。StageScene.delivery 可提供代码初稿。`emptyDelivery()`、`emptyShotBrief()`、`blankFields()` 仅生成未填写草稿。`sceneDeliveryShots(scene,cameraId)` 返回实际镜头键与复核签名。无分镜组时，选定机位的全时长视为一个镜头。

项目手动资料保存在 `projects/<project>/delivery.json`：

```ts
{version:1, film: { /* filmFields 的全部字符串字段 */ }, scenes: {
  'scene-id': {context: { /* contextFields */ }, shots: {
    // JSON.stringify([sequenceId, cutId])，不要自己拼接容易冲突的分隔符。
    '["edit","approach"]': {
      reviewedSignature: '由 sceneDeliveryShots 返回，复核后填写',
      details: { /* shotFields 全部字段 */ },
      actors: {state:'present', items:[ /* actorFields 全部字段 */ ]},
      lights: {state:'present', items:[ /* lightFields 全部字段 */ ]},
      beats: {state:'present', items:[ /* time + beatFields 全部字段 */ ]}
    }
  }}
}}
```

同一项目 film 共享，context 与 shots 按场景隔离。存在已保存场景档案时，它覆盖该场景代码初稿；共享 film 也覆盖代码 film。改代码前先读取现有 delivery.json，保留其他场景、用户资料、摄影机与音频设置；不要用 emptyDelivery 覆盖已完成档案。手动保存采用项目级 revision 检查和原子替换，防止另一个场景覆盖共享说明。

镜头重命名标签不会丢失档案；ID 变更会失去关联。拆分的新镜头必须新建档案，原镜头切点变化必须复核；不自动复制旧动作节点。删除镜头后的旧档案保留在项目里，不进入当前交付，可由用户在“已失去镜头关联的档案”中清理。改变切点、机位引用或表演后 reviewedSignature 会失效，阅读、修正档案之后才更新签名。不能只刷新签名绕过复核。

编写方式：先创建场景与分镜，再给 scene.delivery 赋值；按 sceneDeliveryShots 遍历镜头填写 ShotBrief；确认动作时间、人物引用和实际画面后设置 reviewedSignature；运行 validateDelivery 检查结构，再运行 deliveryIssues(document, shots, Object.keys(scene.subjects ?? {})) 检查完整性。校验无误不代表文字与画面语义自动一致，Agent 仍须查看渲染结果。

## 界面与交付

“交付信息”页签编辑影片、场景和每个镜头。未填写资料可保存；有未保存修改时不能切换场景或导出。完整性面板显示路径与原因。内置相机学校仍只读，个人交付须复制后编辑。

完整导出：`await window.vibeStage.export('delivery')`，或点击“导出完整交付包”。使用当前选定的完整分镜组；若选择单机位，则输出该机位全时长。多个独立场景或多个剪辑版本分别交付，不自动拼接成一部影片。原 still / sequence / video 是参考导出，不要求完整档案。

完整包为 delivery.zip：影片说明 film.md、镜头索引 index.json、原始资料 delivery.json、整片 reference.mp4、cameras.json、source.zip。每镜头 shots/序号 下有 image.md/image.json、video.md/video.json、关键帧 PNG、独立 reference.mp4。生图资料提供时间点画面设计与实测构图；视频资料提供完整动作过程、衔接及逐帧摄影／灯光／对象位置。每个镜头都展开影片和场景上下文，附 sourceHash 关联同次快照。

导出按帧率量化，不允许完全没有采样帧的镜头。镜头 JSON 同时记录设计切点和实际视频时间段。视频与静态图都来自同一固定采样流程；独立表演仍用 sampleScene，音轨仍跟随成片时间。导出期间的代码变化不改变正在生成的快照，完成后重新加载。

当前不调用外部生图或视频模型，不自动创作缺失的导演意图，不承诺生成模型严格执行文字；交付资料是后续提示词生成的完整输入。所有包留在本地 exports，source.zip 含私人素材，禁止视为公开发行包。

## 生图与视频提示词

每镜头可选 `prompts: {image?: PromptDraft, video?: PromptDraft}`，PromptDraft 包含 `text`、`sourceSignature`、`technicalSignature`。保存在同一 delivery.json 中，沿用草稿保存、冲突检查和只读保护。旧档案无需迁移。

`generateShotPrompt(document, shot, output, cameraSnapshot, 'image'|'video')` 本地确定性地编排中文通用提示词，不调用外部模型。image 只描述首帧，使用起始状态和 0 秒节点，不把结束状态和未来节点揉成一张图；video 包含镜头内完整时间线、起止状态、互动、运镜、灯光变化和音声要求。两者展开影片／场景上下文、色彩、多光源、约束和实际首帧摄影参数，不推断未配置的光学参数。

实际摄影参数必须在 `ceil(shot.start * fps - 1e-8) / fps` 时使用 sampleScene 与 resolveShotCamera 获取，即镜头首个实际输出样本；不能使用当前播放头或别的镜头参数。工作台运行时通过 promptCamera 完成采样并恢复预览。

界面“生成生图／视频预览”不会覆盖现有文本，点击采用后再保存到项目。导演资料更新后，sourceSignature 失效；实际摄影参数变化后，technicalSignature 失效，导出会拒绝旧提示词。Agent 不得仅刷新签名掩盖内容过期；阅读并修正文案后才可使用“已核对当前资料和摄影参数，保留文本”。手动文本为空不允许完整导出。提示词只表明生成意图，无法保证外部模型执行。

完整包各镜头新增 image-prompt.txt、video-prompt.txt 和 prompts.json，并在 index.json 关联。已保存提示词逐字保留；缺少的部分在导出快照中自动补齐，不回写项目文件。包内 delivery.json 包含最终提示词。source.zip 仍是导出前原始源码和项目快照。手动提示词中的附加要求由作者负责与导演资料保持一致。

### 运镜与手持描述

视频提示词通过 `camera-motion-description.ts` 从实际 CameraSnapshot.preset.config 翻译运镜，不只输出预设名称。手持描述必须分开基础跟随、世界 XYZ 位移、重新瞄准后的局部俯仰／偏航／横滚，注明单轴幅度上限、双频权重、相位、绝对时间与镜头内有效区间，以及独立观看／对焦目标。不可把 per-axis 附加幅度当成整机合位移或总转角。

当前手持实现是固定种子的连续双正弦叠加，65% 基频 + 35% 的 1.73 倍频，各轴相位不同。停留段锁定相位和偏移，不归零，不额外做振幅淡入淡出；基础跟随仍可移动。不能把它描述成随机逐帧抖动、步伐冲击、后期震屏、自动回中或防抖锁定。幅度为零时明示对应扰动关闭；旧版未填写可选参数时采用运行时同样的默认值。自定义代码机位没有可解析预设时只引用 movement、导演描述与白模视频，不从首帧猜测运动。

生图提示词只冻结首帧构图，不把抖动轨迹、重影或运动模糊画进静态图。生成规则升级后旧提示词需重新生成或人工复核，仍保留原手改文本；参数变化继续通过技术签名拦截过期内容。

### 其他运镜的过程与一致性

推进、拉远、水平／上下／快速摇镜、三种跟拍、短弧／完整环绕、平滑／快速／滑动变焦和 A/B 拉焦，均输出基础坐标框架、有效时间、动作过程、观看与对焦关系。除不依赖进度的跟拍外，给出本镜头起点、25%、50%、75% 和结束边界的进度，明确结束边界不是最后输出帧。切入运动中段时只描述该段进度，不重新执行整个动作。

描述与渲染共用 cameraPresetProgress。smooth 为 6u⁵−15u⁴+10u³，linear 为匀速参数进度；只描述参数速度，不保证移动主体叠加后的世界速度恒定。跟拍每帧直接读取主体，首尾停留不停止跟随，也没有自动阻尼、追赶或步伐震动。

推进／拉远区分有符号外向位移与观看光轴，负 travel 不能按镜头名称误写方向。摇镜采用 YXZ 欧拉偏移；上下摇镜保留俯仰限位，瞄准目标不保证仍在摇镜后画面中心。环绕的 sideOffset 沿基础右向保持，不跟着环绕角旋转，非零侧偏时不能宣称始终与主体等距；orbit-360 的零 angleDegrees 仍按 +360° 执行。

变焦区分焦距变化与机位移动，主体框架可能同时移动；不能将线性焦距写成线性视场角。滑动变焦基于每帧移动前的主体光轴深度补偿。拉焦按两个目标当前光轴深度的倒数插值，保持观看关系，不是摇向 B，也不保证纵深不足时明显交替虚化。

数值回归覆盖正负和零位移、切入中段、俯仰限位、运动主体的世界／主体框架、偏心环绕、零角度全环绕、正反变焦及移动目标拉焦。只扩展文字描述与提取共用进度函数，不改变原运镜参数、姿态或轨迹。

### 摄影机、胶片与成像介质

每个镜头必须填写 `capture`（`captureFields` 的全部字段）：摄影机品牌机型、记录介质、传感器或胶片画幅与有效区域、镜头型号特征、滤镜、ISO／EI 与曝光意图、快门角度或时间、白平衡、数字格式编码与色彩空间、胶片／胶卷品牌系列型号、胶片规格与片盒、冲洗增减感与扫描、颗粒晕光质感。尺寸和快门须注明单位。数字拍摄不使用胶片时，明确胶片项为“没有”；数字模拟胶片须明确为模拟并描述目标，不能冒充实拍胶卷。没有指定机型或滤镜时可明确“没有”，未知项留空待完善，不自动猜品牌、型号或技术规格。

`emptyShotBrief()` 创建空白 capture。旧档案缺少 capture 仍可读取、编辑、保存，完整导出会逐项提示缺失，不能自动补“没有”。Agent 新建或修改镜头必须同步维护这些字段。capture 是最终设计，白模实际 CameraSnapshot 仍独立保存；不要把这些文字当作已实现的胶片、曝光、快门模糊或机身仿真，也不覆盖实际运镜与光学参数。

生图和视频提示词均包含 capture，修改其中任意项会使已保存提示词过期，保留原文供重新生成或人工复核。image.json / video.json 的 design.capture、两类 Markdown 及包内 delivery.json 同步交付该信息。

### 摄影参考预设

`capturePresets` 提供机身 body、镜头 lens、胶片 film 三类独立文字预设，`applyCapturePreset(capture, kind, id)` 仅合并对应 capture 字段，不能用它改变白模摄影机、渲染器或输出参数。应用机身不会替换镜头／胶卷，应用镜头不会增加变焦运动。选择后仍应核对版本、焦段、规格及最终画幅，允许直接手改；手改后界面显示自定义。预设不会为未选择的字段伪造完整内容。数字机搭配胶片参考表示最终风格参考，不代表实体胶片拍摄或白模实现胶片效果。

不需要另存预设 ID，最终填写的 capture 文本是保存与交付依据，不随预设库更新自动改变。两种提示词均读取该文本；已保存提示词过期时需重新生成并采用或人工复核，不能暗中覆盖用户提示词。完整导出继续校验过期提示词。

预设资料参考（型号按已确认清单，不代表当前在售目录）：[ARRI 数字电影机](https://www.arri.com/en/camera-systems/cameras/alexa-35)、[ARRI 胶片机](https://www.arri.com/en/learn/legacy-analog-cameras/arriflex-435-series)、[Sony Cinema Line](https://sony-cinematography.com/camera-comparison/)、[Panavision](https://www.panavision.com/camera-and-optics/cameras/product-detail/pfxmxl-millennium-xl2)、[Canon 相机博物馆](https://global.canon/en/c-museum/)、[Nikon 历史](https://imaging.nikon.com/imaging/information/chronicle/history-f3/)、[Hasselblad](https://www.hasselblad.com/about/history/500-series)、[Cooke](https://cookeoptics.com/lenses/)、[ZEISS](https://www.zeiss.com/photonics-and-optics/en/cinematography/lenses/supreme-prime-lenses.html)、[Angénieux](https://www.angenieux.com/lenses/optimo-ultra-12x/)、[Kodak](https://www.kodak.com/en/motion/products/camera-films/?product-family=vision3)。增加具体传感器模式、片门尺寸或镜头代际参数时须另行核实，不从系列名称猜测。

白模视频与完整交付包的参考画面使用 fast-white-model：长边最高 640 像素，保留帧率，不应用景深、对焦模糊或阴影。最终 output 和参考 referenceOutput 分开保存，referenceRendering 说明实际效果开关。Agent 不得根据参考视频的清晰区域判断拉焦是否正确，也不得宣称参考视频呈现了记录中的景深效果；拉焦意图与焦点距离仍保留在提示词及摄影机记录中。独立图片导出不受此快速视频模式影响。

单次序列、视频和完整交付支持最长 300 秒、最高 60 fps（18,000 帧），不再限制为 1800 帧。浏览器逐帧上传 PNG，并按最多 30 帧／约 4 MB 分批上传摄影与场景记录；服务端校验批次连续性及完整数量，再编码、流式打包。导出全程保留进度和取消；取消或失败的任务不能宣称交付完成。
