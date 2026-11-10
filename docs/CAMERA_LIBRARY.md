# VibeStage 电影镜头与运镜库 · 调研与预设设计

2026-11-11 · 研究与实现目录 v0.3 · 32 项镜头条目，8 个组合配方。

三批共 32 项均已提供代码调用与工作台参数编辑；复杂镜头支持可编辑路径、交接与确定性抖动。实现用法见 [Agent 镜头预设指南](../agents/CAMERA_PRESETS.md)，公共示例见 `examples/camera-lab/scenes/presets.ts` 与 `advanced.ts`。下表保留研究阶段的起步参数；实际默认值与支持边界以调用指南和代码为准。

## 研究结论与分类

“镜头”需要同时描述景别、角度、构图关系、摄影机路径、观看目标、光学参数和节奏。术语的使用存在重叠，例如 tracking 有时泛指移动镜头，有时特指跟随主体；库中的 ID 以明确行为为准。基础摇镜和平移的区别参考[香港教育局电影教学资料](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf)，镜头分类参照[哥伦比亚大学 Camera Movement](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/)。

Pan/Tilt 改变朝向；Dolly/Truck/Pedestal 改变位置；Zoom 改变焦距；Rack Focus 改变焦平面。过肩、双人、主观镜头是取景关系；手持、稳定器是运动质感或设备语境；长镜头指持续拍摄的组织方式。它们可以组合，不能当成互斥按钮。

景别另设 EWS/WS/FS/MS/MCU/CU/ECU 等标签。景别按主体在画面中的大小描述，不由焦距单独决定。项目采用“全身／腰部以上／胸部以上／面部”等可读说明，避免不同教学体系对 MLS 等边界的差异。有关景别、主观和反应镜头的定义参考[Pitzer College 课程术语](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html)。

情绪作用是创作选择，不是固定因果：仰拍不一定代表强大，环绕不一定浪漫，手持也不必然真实。目录的“用途”是 VibeStage 的建议，需结合表演、场景和剪辑判断。

## 完整目录

P0＝首批基础镜头，P1＝第二批进阶镜头，P2＝第三批连续编排；均已有运行时实现。所有焦距、光圈、时间、距离与幅度均是本项目原创起步建议，以 36×24 mm 传感器和 16:9 为参考，不代表电影原片参数或行业标准。16:9 有效高度为 20.25 mm；换画幅、人物大小或场景尺度后要重新适配。以下来源只支持术语与技法说明，不背书数值建议。

### 取景与角度

| ID / 名称 | 叙事用途 | 摄影机行为 | 建议起点 | 适用条件／容易失败处 | 分期 |
|---|---|---|---|---|---|
| `establishing`<br>环境建立镜头 · Establishing shot | 交代地点、入口和人物方位 | 固定广角或极轻微移动，同时容纳主体和关键空间 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) [S3](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html) | 24–35 mm；4–6 秒；f/5.6 起 | 避免人物小到无法辨认；环境信息优先 | P0 |
| `two-shot`<br>双人关系镜头 · Two-shot | 让观众看清两人的距离和关系 | 同时构图 A、B，优先保持视线和行动轴线 [S3](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html) [S4](https://filmglossary.ccnmtl.columbia.edu/term/180-degree-rule/) | 35–50 mm；3–6 秒；f/4 起 | 有纵深差时不能假设两人都在景深内 | P0 |
| `over-shoulder`<br>过肩镜头 · Over-the-shoulder / OTS | 从一方的位置观察另一方 | 近景保留 A 肩背，B 面部为主要构图与对焦目标 [S11](https://www.adobe.com/creativecloud/video/production/cinematography/camera-shots-and-angles/over-the-shoulder-shot.html) [S4](https://filmglossary.ccnmtl.columbia.edu/term/180-degree-rule/) | 50–85 mm；3–6 秒；肩背占宽约 10–25% | 肩背不能遮住 B；反打需检查轴线 | P0 |
| `reaction`<br>反应近景 · Reaction shot | 强调受惊、迟疑、决定或倾听 | 固定或微推进，面部留出视线方向空间 [S3](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html) | 65–100 mm；2–4 秒；f/2.8 起 | 反应由表演产生；镜头本身不能生成表情 | P0 |
| `insert`<br>细节插入 · Insert / Detail shot | 交代钥匙、手势、物件等信息 | 锁定物件或手部，把信息放在可读区域 [S12](https://userhome.brooklyn.cuny.edu/anthro/jbeatty/COURSES/glossary.htm) | 50–100 mm；1.5–3 秒；按物件尺寸适配距离 | 模型细节不足时近拍会暴露精度；虚拟镜头没有真实微距限制模拟 | P0 |
| `pov`<br>人物主观镜头 · Point-of-view / POV | 让观众看到角色正在看什么 | 以眼位为机位，视线目标与头部朝向分别指定 [S3](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html) [S9](https://adobestock.adobe.com/rs/269-YNG-601/images/Adobe-Stock-Metadata-Field-Guide-v2.pdf) | 28–50 mm；3–6 秒；眼位绑定 | 隐藏或裁掉观察者头部，避免相机在头模型内 | P0 |
| `low-angle`<br>低角度仰拍 · Low-angle shot | 突出体量、压迫或英雄式出场 | 相机位于目标下方，向上取景；可叠加推进 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) | 24–50 mm；机位高度约 0.3–1 m | 效果依赖情境；超广角近拍会夸张身体比例 | P1 |
| `high-angle`<br>高角度俯拍 · High-angle shot | 展示处境、距离或人物在环境中的比例 | 高位向下看，仍保留空间线索 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) | 28–50 mm；机位高于目标 1–3 m | 不要把俯拍自动解释成弱小；先确认叙事意图 | P1 |
| `top-down`<br>垂直顶拍 · Top-down / Overhead | 展示走位、几何关系和舞蹈队形 | 视轴近乎竖直向下，明确画面中的北向 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 24–50 mm；4–6 秒；以场地范围确定高度 | 正上方 lookAt 需显式控制 up，防止突然翻转 | P1 |
| `dutch-angle`<br>倾斜构图 · Dutch / Canted angle | 表达失衡、异样或风格化状态 | 主要改变 roll，可保持固定角度 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) [S5](https://www.adobe.com/au/creativecloud/video/production/cinematography/camera-shots-and-angles/dolly-zoom-shot.html) | 35–65 mm；倾斜 5–15° 起 | 不是普通水平摇镜；角度过大会削弱可读性 | P1 |

### 摄影机运动

| ID / 名称 | 叙事用途 | 摄影机行为 | 建议起点 | 适用条件／容易失败处 | 分期 |
|---|---|---|---|---|---|
| `push-in`<br>缓慢推进 · Dolly / Push-in | 逐步强调人物、细节或心理变化 | 相机沿指定方向接近目标，焦距保持不变 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 35–65 mm；4–6 秒；前进约 0.5–2 m | 推进距离必须适配空间；不能穿模或进入近裁剪面 | P0 |
| `pull-out`<br>拉远揭示 · Dolly / Pull-out | 从局部信息扩展到人物处境 | 相机后退，逐渐纳入周围场景 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) [S9](https://adobestock.adobe.com/rs/269-YNG-601/images/Adobe-Stock-Metadata-Field-Guide-v2.pdf) | 28–50 mm；4–7 秒；后退约 1–4 m | 终点必须有值得展示的新信息 | P0 |
| `pan`<br>水平摇镜 · Pan | 跟随横向动作或连接两个关注点 | 相机位置不变，水平旋转 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) | 35–65 mm；20–60°；3–5 秒 | 旋转与横向平移不同；需在终点留停顿 | P0 |
| `tilt`<br>上下摇镜 · Tilt | 由脚到脸、由人物到高处信息 | 相机位置不变，俯仰角变化 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) | 28–50 mm；15–45°；3–5 秒 | 不能用机位升降代替；检查顶部与底部裁切 | P0 |
| `rear-follow`<br>背后跟拍 · Rear follow | 带观众随人物进入空间 | 相机在人物路线后方保持约定距离与高度 [S6](https://theasc.com/article/steadicam-shining-revisited/) | 28–40 mm；4–8 秒；后距 2–4 m | 人物转身不等于路线转弯；停步时保持稳定朝向 | P0 |
| `lead-follow`<br>正面引导跟拍 · Leading / Front tracking | 保留行进中的面部与反应 | 相机位于路线前方退行，持续观察人物 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 35–65 mm；4–8 秒；前距 2–4 m | 检查镜头后退空间；人物突然加速不能造成机位跳变 | P0 |
| `side-follow`<br>侧向平行跟拍 · Lateral tracking / Truck | 展示步态、并排行走和追逐 | 相机与人物沿路线并行，保留横向间距 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 35–50 mm；4–8 秒；侧距 2–4 m | 巷子太窄时应缩短侧距或改用前后跟拍 | P0 |
| `arc`<br>短弧环绕 · Arc | 改变观察关系、揭示人物另一侧 | 绕选定中心走短弧，同时维持主体构图 [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 35–65 mm；30–90°；4–6 秒 | 注意轴线变化；不是让人物原地旋转 | P0 |
| `reveal-slide`<br>遮挡后揭示 · Lateral reveal | 从墙边、门框或前景后露出人物 | 横向移动，按设计解除指定遮挡 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 35–65 mm；横移 0.5–1.5 m；3–5 秒 | 遮挡是本镜头意图；不能被自动避遮挡逻辑消除 | P0 |
| `pedestal`<br>垂直升降 · Pedestal | 跟随人物起身或越过低矮遮挡 | 整体机位沿 Y 移动，朝向是否固定须声明 [S1](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Resource%20Materials%20on%20Learning%20and%20Teaching%20of%20Film.pdf) | 35–50 mm；升降 0.5–2 m；3–5 秒 | 升降不是 Tilt；只改高度未必保持同一构图 | P1 |
| `crane-up`<br>升起拉远 · Crane-up reveal | 结尾扩展空间、显示环境规模 | 升高并后退，按目标补偿俯仰 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 24–35 mm；5–8 秒；升高 2–6 m | 需有上方空间；不是所有建筑都有可见屋顶 | P1 |
| `crane-down`<br>高处下降入场 · Crane-down approach | 从地点介绍落到具体人物 | 沿高位到低位曲线接近人物 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 24–40 mm；5–8 秒 | 路径要过屋檐和遮挡检查，终点不得撞入人物 | P1 |
| `whip-pan`<br>甩镜 · Whip / Swish pan | 快速转移关注、动作接续或转场 | 快速水平转向后停稳，可接另一镜头 [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 旋转段 0.25–0.5 秒；起终各留停顿 | 当前无运动模糊，先能验证轨迹，完整甩镜质感另需渲染支持 | P1 |

### 光学控制

| ID / 名称 | 叙事用途 | 摄影机行为 | 建议起点 | 适用条件／容易失败处 | 分期 |
|---|---|---|---|---|---|
| `rack-focus`<br>A/B 拉焦 · Rack focus | 在同一构图中转移注意力 | 改变焦平面距离；位置、朝向与焦距可保持固定 [S3](https://pzacad.pitzer.edu/~mma/teaching/MS50/MS50_keyterms.html) [S9](https://adobestock.adobe.com/rs/269-YNG-601/images/Adobe-Stock-Metadata-Field-Guide-v2.pdf) | 50–85 mm；f/1.4–2.8；总长 4–7 秒 | 两个主体深度接近或广角远距离时效果很弱 | P0 |
| `zoom`<br>平滑变焦 · Zoom | 有意改变画面范围或观察感 | 机位不移动，焦距连续变化 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) | 35→70 mm 或反向；3–5 秒 | 没有推轨的位移视差；不要混称为推进 | P1 |
| `snap-zoom`<br>快速变焦强调 · Snap / Crash zoom | 快速抓住表情、细节或喜剧节拍 | 短时间变焦并迅速稳定构图 [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 35→85 mm；变焦段 0.25–0.6 秒 | 注意目标跑出画面；速度感也依赖剪辑与声音 | P1 |

### 运动质感

| ID / 名称 | 叙事用途 | 摄影机行为 | 建议起点 | 适用条件／容易失败处 | 分期 |
|---|---|---|---|---|---|
| `handheld`<br>克制手持感 · Controlled handheld | 增加在场感、紧张感和呼吸感 | 在基础路径上叠加低幅平移及旋转扰动 [S6](https://theasc.com/article/steadicam-shining-revisited/) [S9](https://adobestock.adobe.com/rs/269-YNG-601/images/Adobe-Stock-Metadata-Field-Guide-v2.pdf) | 位移幅度 0.005–0.02 m；旋转 0.1–0.5° 起 | 不使用逐帧随机；高频抖动容易像故障或产生不适 | P1 |

### 复合与强风格镜头

| ID / 名称 | 叙事用途 | 摄影机行为 | 建议起点 | 适用条件／容易失败处 | 分期 |
|---|---|---|---|---|---|
| `dolly-zoom`<br>滑动变焦 · Dolly zoom / Vertigo effect | 表现惊觉、眩晕或空间失衡 | 移动机位并反向变焦，使主体画面大小近似不变 [S5](https://www.adobe.com/au/creativecloud/video/production/cinematography/camera-shots-and-angles/dolly-zoom-shot.html) | 35–85 mm 范围；3–5 秒；依纵深适配 | 需要有纵深的背景；不能只改 FOV 或单独平移 | P1 |
| `orbit-360`<br>完整环绕 · 360° orbit | 展示舞蹈、人物或物体的完整周围关系 | 围绕中心完成一圈，保持目标可见 [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 28–50 mm；8–12 秒；通常匀速 | 必然改变轴线关系；窄巷不适合作为默认示例 | P1 |
| `subject-mounted`<br>主体固定机位 · Subject-mounted / Snorricam-style | 让主体稳定而周围世界晃动 | 机位相对主体躯干固定偏移，朝向主体 [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 20–35 mm；3–6 秒 | 不要绑定头部高频摆动；不是普通手持跟拍 | P1 |
| `handoff-oner`<br>连续跟拍与交接 · Choreographed long take | 在一条连续镜头中串联人物与空间 | 分段跟随 A、转向事件、交给 B，再完成揭示 [S7](https://filmglossary.ccnmtl.columbia.edu/clip/copacabana/) | 24–40 mm；15–30 秒示范起 | 需要连续构图与表演编排；不能靠一次 lookAt 切换实现 | P2 |
| `flythrough`<br>穿行与俯冲 · Virtual fly-through / FPV-style | 快速穿越空间、制造尺度与速度变化 | 沿三维曲线移动，可带受控 roll 和俯仰 [S2](https://filmglossary.ccnmtl.columbia.edu/term/camera-movement/) [S10](https://www.studiobinder.com/camera-shots/camera-movements/) | 18–28 mm；5–10 秒 | 默认限制速度和翻滚；碰撞、路径平滑及运动模糊尚需完善 | P2 |

## 可组合的“导演配方”

这些是本项目提出的可复用编排，不是上述电影的逐镜复制。`cut-sequence` 是多镜头剪辑，`same-shot-combination` 是同一镜头内组合。

| 配方 | 组件 | 组织方式 | 作用与条件 |
|---|---|---|---|
| 进入巷子 | `establishing` + `rear-follow` + `reveal-slide` | cut-sequence | 先读懂空间，再随人物进入并揭示深处的人；跟拍路线沿巷子纵深，遮挡揭示单独检查 |
| 擦身与受惊 | `two-shot` + `side-follow` + `reaction` | cut-sequence | 先证明两人位置关系，再展示擦身，最后强调 A 的反应；侧跟空间不足改固定双人；保留运动方向 |
| 回头道歉 | `over-shoulder` + `push-in` | same-shot-combination | 从 A 肩后拍 B，B 回头后缓慢推进；先安排 B 转头再推进；关注 B 面部可见性 |
| 从 A 转向 B | `over-shoulder` + `rack-focus` | same-shot-combination | 同一画面内把注意力从前景 A 转到后景 B；沿用已制作的拉焦示例思路，焦点与注视目标独立 |
| MV 人物亮相 | `low-angle` + `arc` | same-shot-combination | 低位短弧移动，展示人物姿态与环境视差；先用短弧；不要默认 360° |
| 发现异常 | `reaction` + `dolly-zoom` | same-shot-combination | 在关键认知时刻改变人物背后的空间感；效果强，使用前确认背景纵深与主体大小约束 |
| 孤独离场 | `pull-out` + `crane-up` | same-shot-combination | 逐渐增加人物周围的空白与空间范围；一个复合路径统一控制位置，避免两个控制器相互覆盖 |
| 边走边聊 | `two-shot` + `lead-follow` | same-shot-combination | 两人行进时保持相互关系和面部可见；需要双目标构图，而非只看两人中点 |

## 经过核实的电影参考

| 电影／片段 | 可研究的技法 | 建议转成的库能力 | 资料 |
|---|---|---|---|
| 《迷魂记》Vertigo（1958） | 机位移动与反向变焦的组合 | `dolly-zoom`；主体大小约束、背景纵深变化 | [Yale Film Archive](https://web.library.yale.edu/film/notes/fn00030)、[Adobe 技法说明](https://www.adobe.com/au/creativecloud/video/production/cinematography/camera-shots-and-angles/dolly-zoom-shot.html) |
| 《闪灵》The Shining（1980） | 稳定器移动与低位跟随的现场实践 | `rear-follow`、路线框架和高度连续变化 | [ASC：Garrett Brown 的亲历记录](https://theasc.com/article/steadicam-shining-revisited/) |
| 《好家伙》Goodfellas（1990），Copacabana | 连续移动中组织人物和空间信息 | `handoff-oner` 的编排参考；不套用原片坐标 | [Columbia 的片段与讲解入口](https://filmglossary.ccnmtl.columbia.edu/clip/copacabana/) |
| 《切腹》Harakiri（1962）／《东京物语》Tokyo Story（1953） | 轴线连续性，以及有意改变视线与画面位置 | 过肩反打默认维持轴线；有意越轴须在镜头说明中标记 | [Columbia 180-Degree Rule](https://filmglossary.ccnmtl.columbia.edu/term/180-degree-rule/) |

电影链接用于观看与分析；库内示范应重新制作自有白模动画。不要把“某导演风格”作为唯一参数，也不把特定镜头包装成唯一正确的拍法。

## Agent 如何使用目录

推荐顺序：读取叙事任务 → 找到候选预设 → 检查空间与主体 → 绑定锚点和时间段 → 生成或修改场景代码 → 预览验证。用户说“跟着 B 从 A 身边过去”，Agent 应优先考虑前／后跟拍、固定双人或侧跟；狭巷侧面没有空间时说明原因并换候选，不能无条件穿墙。

自然语言示例：“从 A 的右肩后跟拍 B，先看 A，再把焦点拉到 B，缓慢推进。”需要拆成过肩构图、跟随的主体、机位路径、注视目标与拉焦计划；A 的肩侧属于人物局部方向，不是世界的东／西。对焦 A 不意味着摄影机必须转向 A。一个镜头同时启用多个组件时，必须由一个最终求值器统一得到机位和镜头参数，不能让多个函数先后覆盖 position。

完整条目建议长期保存：稳定 ID、中英文及俗称、用途标签、构图类型、必需对象、可调参数及单位、有效条件、失败原因、回退策略、确定性采样方式、示例预览、验证状态、版本和来源。本次 JSON 已保存核心检索字段、默认值建议、来源与配方；三批均已补充可执行函数与公共白模场景，示例起点不保证自动满足任意场景的构图条件。

角色关系建议使用独立字段：`followTarget` 决定跟谁移动，`lookTarget` 决定看谁，`focusTarget` 决定谁清晰，`foregroundSubject` 决定谁的肩背在前面。坐标空间明确标为 world、subject 或 route；“北”始终是世界 −Z，“左肩”按人物骨架解释，“路线左侧”按行进切线解释。对象停止或路线切线为零时需显式采用保持朝向或预定义朝向策略。

## 接入原则与后续扩展建议

保留普通 Three.js 场景代码。当前通过 `@vibestage/core` 的 `createCameraPresetConfig`、`addCameraPreset` 和 `sampleCameraPreset` 接入；本目录不是新的场景 DSL。Agent 仍可直接写 `update(timeSeconds)`，不必先把复杂镜头注册成目录项。

每次采样先更新人物与道具，再更新世界矩阵，然后计算摄影机路径／注视／光学参数，最后走现有 `resolveShotCamera()` 与景深渲染流程。阶段时间建议统一为起始停留、运动、末尾停留；转场按真实事件时刻触发，不把所有镜头机械地均分时长。

人物跟拍建议使用预先计算的路线框架或绝对时间的解析函数。带惯性和阻尼的跟随、手持噪声必须能在任意时间独立求值，或先固定步长预计算；不能依赖上一帧的 lerp，也不能每帧调用随机数。重复 seek 到同一时刻，应得到相同机位与焦点。

构图约束优先描述为主体占画面比例、头顶留白、视线方向留白、屏幕目标点和景别边界；同时考虑输出画幅、传感器、焦距和距离。双人构图不能只 `lookAt` 两人中点，还要检查两人的投影边界。一般镜头采用固定焦距，通过路径决定景别变化；只有 Zoom 或 Dolly Zoom 才默认变化焦距。

在主体平面、有效传感器和姿态近似不变时，Dolly Zoom 可从 `f(t)/d(t)≈常数` 出发求解，其中 d 为主体的光轴深度。三维主体、转头或非轴向路径会破坏这个近似，需检查投影包围框。焦距达到预设范围时应缩短路径或报告不满足条件，不静默钳制后声称主体大小不变。这是结合现有投影模型的工程推导，不是影片原始机位数据。

现有 `cameraMetadata` 承载光学信息，`cameraCuts` 承载切镜，新增 `cameraPresets` 存放预设配置。导出逐帧记录新增 `preset: {id, version, config, warnings}`，包含参数、绑定与参考构图。手持种子、交接事件与路径控制点保留在 config 中；逐帧实际摄影机记录仍是复现依据。

手动设置保存在项目的 `settings/<scene>.camera.json` 并在 `update(t)` 后覆盖代码。手动 position、rotationDegrees 或 focusDistanceMeters 可能固定掉运镜／拉焦。当前校验拒绝预设同时携带固定位置、朝向和对焦平面覆盖；界面将参数写入独立预设机位，不删除无关设置。后续“手动微调”更适合提供相对于预设路径的偏移层；当前还没有这一层。

路径检测应区分镜头碰撞、非预期遮挡和有意遮挡：普通跟拍可以报告遮挡，过肩允许肩背，遮挡揭示允许前半段看不见目标。首版不承诺自动避障或自动改好所有构图；检查失败时返回具体时刻及原因，由 Agent 调整代码。

## 建议分期与验收

第一批是表中的 16 项 P0：环境建立、双人、过肩、反应、细节、POV、推进、拉远、水平摇、上下摇、后跟、前跟、侧跟、短弧环绕、遮挡揭示、拉焦。这 16 项已完成通用预设、参数界面和公共白模演示。进阶示例提供俯视路径；通用路径可视化编辑器、自动避障与完整构图约束仍待扩展。

第二批 14 项 P1 已实现：高低角度、顶拍、倾斜构图、升降、升起／下降、平滑／快速变焦、滑动变焦、甩镜、手持、完整环绕与主体固定机位。快速动作当前缺少运动模糊支持，目录应显示“轨迹可预览，完整效果待补”，不把景深当成运动模糊。

第三批 2 项 P2 已实现：连续交接长镜头、穿行俯冲。提供连续交接、可选事件目标、世界坐标控制点、平滑曲线与路径框架，以及采样时刻的近物和路线速度警告；不提供自动避障、完整连续碰撞或自动构图。真实航拍飞行力学、器材负载、步态稳定器效果不属于当前白模工作台的精确仿真范围。

每项上线至少要有一个自有白模示例，包含环境和主体、俯视机位路径、拍摄画面及可回放参数。验收检查起点／25%／50%／75%／终点和危险转折；快速运动还需逐帧或更密采样。检查目标是否入画、景别、轴线、路径穿模、朝向连续、焦点有效和镜头范围。固定随机种子下，倒序 seek 与正序播放必须一致；横竖画幅、全屏和导出应得到相同构图规则与光学效果。端点按现有导出 `[0,duration)` 的采样约定验证。

建议示例使用单人走廊、双人对话、纵深人物与物件、开放舞台四套公共白模场景。用户现有巷子可作为私人验证案例，但不能未经明确授权复制进公共 examples 或发布到 GitHub。公开研究文档和通用预设与用户作品继续分开。

## 使用文件

`camera-library.catalog.json` 是本报告的机器可读目录，32 项均标记 `implemented`、`runtimeImplemented: true`。此标记表示已提供可执行预设，不代表精确物理仿真、运动模糊、自动避障或所有研究方向均已完成。Agent 应先筛选条目再调用 API；研究配方不是一键宏。用户原有场景保持独立。
