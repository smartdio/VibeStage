# 折翼／棱柱：非均匀祖先缩放与导出后编辑回归

日期：2026-11-15。私人项目 `affine-stress`，浏览器 TaskSpace 34。现有未提交修改保留，未提交或推送。

## 结论与修复

发现并修复两处非均匀层级变换问题。A01：祖先非均匀缩放叠加子节点旋转形成斜切，Three.js 分解得到的四元数可能不是单位长度；主体固定机位直接用它旋转世界米偏移，使固定参数下的距离随姿态漂移。折翼实际回放的首／中／尾距离为5.03527255、5.03224160、5.02756627米，预期sqrt(5²+.6²)=5.03587132米。camera-presets现为主体框架、主体固定和交接的分解四元数归一化。修复后两场六个真实播放样本最大误差1.78e-15米。

A02：导演包实际对象只记录positionMeters/quaternion/visible，没有完整缩放和斜切；修复前实际导出3.5秒的A四元数长度0.99248643，变换基向量非正交偏差0.43578079，不能从原有记录还原预览。delivery-sampling现保存同帧16项列主序matrixWorld，四元数归一化作为近似分解朝向，完整变换以矩阵为准。服务端校验可选矩阵字段，包内units与DELIVERY指南说明约定。旧的无matrixWorld记录仍可读取。

新增tests/delivery-affine.test.ts，三项修复前均失败、修复后均通过，覆盖非均匀斜切矩阵及顶点还原、隐藏祖先、采样快照独立、旧记录兼容／非法矩阵拒绝、主体固定世界米偏移不漂移。全套115测试、build、check:projects通过。

## 真实界面场景

新建折翼和棱柱两场，北侧分别为七段灰紫倾斜折翼和七段灰青旋转棱柱；三人物、舞台祖先、动态人物组、动态道具组、箱体及信标。折翼祖先XYZ缩放基准为[1.35,.85,.8]，棱柱为[.85,1.3,1.1]，各轴叠加不同正弦变化；道具组另有[1.15,1+.03sin(u),.85]缩放。人物父组随时间平移、上下浮动、俯仰并转向。UI同时重摆父组与子项，形成三维旋转、各轴缩放及斜切的复合变换。

两场各五镜主组与三镜备选，共四组十六镜，每组16秒24fps。组合世界方位引导、倾斜构图、正反锁向垂直升降、场外侧跟、主体固定、正反滑动变焦及上下摇镜。主组含独立双层摆位与继承、隐藏祖先仅拍场外C、恢复祖先为张臂示意；备选含三层摆位等待、延续、只隐藏人物子组而保留道具。通过UI修正折翼首镜B遮挡及主体固定镜C遮挡，再看首中尾确认主体可见。

66个主流程／父子草稿／结构恢复／HUD检查点通过，30次下拉快切和40次保持播放的前后切镜通过；修复后追加10个HUD点及40次保持播放的切镜。取消预设保留既有摆位草稿，显式共用后重新进入默认独立，分割后的继续段保留来源，删除独立起点后正确继承前段，放弃恢复原引用及显隐。保存重载后连续播放，面板切换不中断；修复后两轮共32次播放衔接已查看。

添加回归测试时触发一次源码版本保护，交付保存被正确拒绝。当前测试草稿的DOM字段另存conflict-draft.json，随后通过界面放弃该未保存副本、刷新源码版本并重填；最终16镜保存内容逐字段与设计计划一致。没有绕过冲突检查或直接写设置JSON。

## 导出后继续编辑

修复后第一轮四包，每次完成后不刷新就继续播放、切面板、切镜、把当前预设基准焦距改33mm并回放、分割、共用41mm草稿后取消，再放弃未保存修改。导出前后完整cameraInfo和时间恢复一致，取消／放弃后恢复原保存状态，浏览器无异常。

第四包后继续在原页面持久化两场修改：主组第二镜父组俯仰12°、A转向-45°、道具组恢复显示、倾斜机位焦距27mm；备选第一镜祖先横滚7°、人物组俯仰-8°、道具组恢复显示、引导镜焦距31mm。跨场景保存重载10点通过，未改镜头引用保留。重看全部16镜并修改8镜说明，复核剪辑链后续6个内容未变独立段，再导出四个最终包。

最终导出后直接播放、切面板、保持播放跳到继承镜，并输入36mm新预设草稿后取消，恢复保存的31mm；结束时机位、交付、音频均无未保存修改。

## 导出核验

修复后两轮八包3,072帧，每包384帧、640×360、24fps。逐帧以独立NumPy局部摆位及完整矩阵乘法计算八对象，位置、matrixWorld、有效显隐、动作源时间与独立来源全部匹配，矩阵误差阈值1e-8，导出四元数单位长度校验通过。64个正反向精确预览样本加16个镜尾样本，每轮80次，共160次相机位置／旋转／焦距／对焦距离比较误差0，预设及表演配置一致。

两版逐帧比较确认仅预定8镜发生变化，另外8镜的完整世界和相机记录完全不变。160张导出抽帧与两轮逐镜首中尾、连续播放截图已查看。source.zip与当时私人场景、共享模块、两份设置、delivery.json及三份修复模块逐字节一致。新矩阵约定在包内units可读，实际服务端已使用新逻辑。

证据位于artifacts/affine-stress：before-fix保存修复前记录；before-fix-proof.json为缺失矩阵实证；tests-before.txt/tests-after.txt为红绿测试；mounted-after-fix.json为真实回放距离；initial为修复后第一版；各scene-sequence目录保存最终包解压、audit.json与export-contact.png；cross-phase-audit.json记录修改范围；final-live.json记录最后一次导出后操作。所有业务修改经UI，getState仅用于只读断言。

## 本地导演包

修复后第一版 wings / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/fe3532d6-8d24-42eb-9f2f-9dba828cfb44/delivery.zip)。SHA-256 `897c498d774576c83bd6c1c10975d5c10d8cf1a57948b5c2c261b0f21311a140`。

修复后第一版 wings / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/9ac4f1f1-9dee-49e1-beb6-538edf7604b4/delivery.zip)。SHA-256 `7d6e3c999e415a3217b872427028d934e9305db6a8a2b671f040d217c3752fcb`。

修复后第一版 prisms / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/38322bf5-10cd-42ac-bbcf-a15ce131b050/delivery.zip)。SHA-256 `e672c5b701043e71d5399c0c576f106ba4ae6c2c85ed7fd8bba1fb2e5bb1a7c0`。

修复后第一版 prisms / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/82cea775-6a90-4ea8-9e38-8de00f3a08ca/delivery.zip)。SHA-256 `cc56c97bd60e9ce1acf96761c5a963a54780096a14f0a8a61ab865bc5b74caf4`。

最终版 wings / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/a6ea6ff1-0c0d-4417-a6a0-0c619d75997f/delivery.zip)。SHA-256 `23b414492e8d8c56b78895e6da80ed68a082d0eacca13836208d34f4d03af38b`。

最终版 wings / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/36f0b606-6abf-4801-9c64-6744da921ab9/delivery.zip)。SHA-256 `bd05a0ea94b82c3fb82323f052b62b54cf516cd11d7e96e881b7d5810efee08b`。

最终版 prisms / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/8057279c-f739-4cda-aa1a-5a0dd1da9c1e/delivery.zip)。SHA-256 `ddd78643ddeb6d91071d03ce8c27d96b1c9b39681b34a280dd37ac90e0fa3217`。

最终版 prisms / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/80943c33-c7ad-42a2-bddb-9e3f8d0c234b/delivery.zip)。SHA-256 `0f3850f7b23c9581b7113a13e3132d13cd82f4eb76e9aa06358d18b0e18bba30`。

修复前复现包（不作为最终交付）：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/918f2ea5-b519-4b34-addc-e07a3374f34c/delivery.zip)。

## 边界

含斜切的对象不能由单个刚体旋转精确表示，摄影机使用归一化分解朝向作近似，仍是世界米的刚体机位；不声称摄影机随对象发生仿射拉伸。对象完整变形以matrixWorld记录。参考视频按fast-white-model输出，无景深、阴影；比较构图与状态，不声称逐像素相同。场景故意拉伸、倾斜及上下浮动，无脚底接触求解。本轮使用正尺度，没有覆盖零缩放、反射负尺度、非均匀祖先下的代码摄影机或音频工作流。
