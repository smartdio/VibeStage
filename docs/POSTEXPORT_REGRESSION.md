# 浮廊／斜台：动态层级与导出后继续编辑回归

日期：2026-11-15。私人项目 `postexport-stress`；浏览器 TaskSpace 33。保留现有未提交修改，未修改框架代码，未提交或推送。

## 结论

两场四组十六镜，经真实 UI 创建分镜、摆位、调整、取消／放弃、分割／删除、保存重载及两轮完整导演包导出。未发现新增状态串改、引用错乱、修改丢失或导出后锁住编辑／播放的问题。修正一处私人场景构图遮挡后重放。两轮八包共3,072帧，160个预览／导出相机与表演比较误差0，八对象世界变换与有效显隐逐帧核验通过；160张导出抽帧已查看。

## 新设计与界面操作

浮廊为六段悬浮横梁，斜台为六段高低倾斜台体。祖先舞台统一缩放为基准1.15或0.9乘(1+.03sin(u))；人物父组沿X平移并上下浮动，随时间俯仰、转向；道具组同时转向和动态缩放。A/B在人物组，箱体／信标在道具组，C位于祖先之外。摆位增加父组俯仰、横滚与子对象转向，验证三维旋转和缩放叠加。

两场各有五镜主组（3/6/9/12秒切点）与三镜备选（5/10秒切点）。组合正面引导、倾斜正反140°短弧、下降入场、场外侧跟、顶拍、正反滑动变焦、上下摇镜。主组双层摆位及继承、隐藏舞台只看C、恢复舞台示意；备选三层摆位等待及继承，再隐藏人物组。每组16秒24fps。

界面主流程26点、父子与预设交替12点、结构恢复6点、祖先隐藏／等待起点删除恢复12点、HUD及参数范围10点，共66个状态检查点。30次下拉快切和40次保持播放的前后切镜通过。包含播放中编辑、面板展开收起、显式共用与默认独立、取消保留已有摆位草稿、放弃恢复上次保存、分割独立表演后删除起点并恢复。两轮重载后连续播放共32次面板切换与镜头衔接，均没有中断；逐镜首中尾画面共两套96张截图，另有遮挡修正重放。

浮廊备选第一镜原方位使横梁遮挡主体下半身，经界面将该镜方位改为90°，重新查看首中尾确认主体完整。测试作者首次把短弧类型写为orbit，场景明确报未知预设，改为arc后恢复；不是框架状态缺陷。脚本还修正了隐藏的辅助栏导出按钮、无改动时禁用保存按钮，以及滑动变焦实时焦距不能与输入基准焦距直接相等的检查条件。

## 导出后完整闭环

第一轮每包完成后，不刷新、不重载，直接回到中央预览；导出前后完整cameraInfo与时间一致。随后播放、切面板、保持播放切下一镜、将预设基准焦距改33mm、应用并回放、分割、显式共用草稿41mm后取消，再放弃全部未保存修改，恢复完整导出前状态。四组均通过，浏览器无异常。

最后一个包结束后继续在原页面持久化新修改：两场主组第二镜父组俯仰12°、A转向-45°、恢复道具组显示、短弧基准焦距27mm；备选第一镜祖先横滚7°、人物组俯仰-8°、恢复道具组显示、引导镜焦距31mm。跨场景保存，再刷新及来回切场景，10个检查点通过；只有预定四个独立起点改变，其他引用保留。继承镜同步获得表演变化，其他独立段不受影响。

重放全部16镜及四组连续播放后，按实际新画面更新8个受影响镜头的交付文字并通过界面复核保存，并对剪辑链上后续6个已重看、内容未变的独立段完成衔接复核，再导出四个最终包。最终导出后又直接播放、切面板、保持播放跳到继承镜，并打开31mm预设输入36mm后取消；最终恢复31mm，机位、交付、音频均无未保存修改。

## 包内核验与证据

每包384帧、640×360、24fps；逐镜帧数、总帧数、计划切点及机位引用与已保存设置一致。初末两版逐帧比较还确认仅8个预期镜头变化，另外8镜的完整世界及相机记录完全不变。八对象的世界位置、旋转矩阵、有效显隐，以独立NumPy层级变换及局部重定公式逐帧计算，误差阈值1e-8；动作源时间和独立起点精确对应。128个正反跳转样本及32个镜尾样本，共160次相机位置／四元数／焦距／对焦距离比较误差0，预设配置及表演记录一致。每镜五张导出抽帧已查看，隐藏／恢复和画面构图与预览一致。

两轮source.zip分别与当时两个场景源、共享场景模块、两份机位设置及delivery.json字节一致；初版输入及证据保留在 artifacts/postexport-stress/initial，最终证据保留在 artifacts/postexport-stress。导出中的人物、三灯、动作节点、提示词及档案一致，无缺失内容。

主要脚本：build/performance/stress/interleave/structure/ancestor-structure/hud/transport/play-all/whole-play/exact，postexport-export/resume-postexport，after-export-save，final-live；核验expected.py、audit.py。postexport-log.json含一次重复的导出前检查，成功闭环为四组。

运行 npm test：112/112；npm run build、npm run check:projects、git diff --check通过。框架既有修改的文件哈希与本轮记录一致。

## 本地导演包

第一版 vault / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/a8ca7aa5-1de7-4d87-b845-c98ddeed133b/delivery.zip)。SHA-256 `5413e0f3980dbbc0550ac318d4d74f2c0d64984273509d180f9caec45c9fb250`。

第一版 vault / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/373171ae-1de3-4a29-a992-3dc69b7b4b81/delivery.zip)。SHA-256 `2089005a20c524f98fff6b86d327b689353735cc5848c015442ffb63181eccd1`。

第一版 steps / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/7ea25046-df8e-42c7-b625-850fd00da786/delivery.zip)。SHA-256 `0be129ecd5f988a98dc6b4633ce1cfe8fb8c7d5f2dff45a3bee16de2c45bbcc1`。

第一版 steps / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/e9c66e53-15ab-4c2e-bde3-750a1e20a5ef/delivery.zip)。SHA-256 `8d2348e5f8e0749550bce3d40897f1ffd201719de003ac5dc58a9ff77a5380ea`。

最终版 vault / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/943bd0bc-26c9-41dc-a5eb-849621cb1a01/delivery.zip)。SHA-256 `b9f9d162b569ceda22783d038e7659b6c8054adfef4811515aed5ff7100441cc`。

最终版 vault / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/5cff8a2c-8299-4649-989c-feac79ddaa88/delivery.zip)。SHA-256 `8fe4a67bf34ec583facace0e4f0b3aef8a9a0d3615c9c1f083ffb35cf1c33f78`。

最终版 steps / sequence_1：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/0791cca4-89ac-4fca-beeb-c4f9b2ba0bb5/delivery.zip)。SHA-256 `c4a56c8b2f2c98ba131948f8aca1f1ab3aac7a4f1379b83f3a0c211b37a088f7`。

最终版 steps / sequence_2：[delivery.zip](/Users/tingcongmai/workspace/VibeStage/exports/13058289-80a3-40e4-b61f-29770a277871/delivery.zip)。SHA-256 `756cd79c83207459e9ef50236639ba3b4addf72d38c6532d810bf1342c4484f8`。

## 边界

这是本地白模工作流验证。参考视频按fast-white-model输出，不含景深、阴影；对比的是构图、对象状态及摄影记录，不声称逐像素一致。祖先采用动态统一缩放，本轮没有测试非均匀缩放引起的剪切。测试场景允许人物因局部重摆、父组俯仰及缩放而浮离地面，没有脚底接触求解。没有音频导入或远程发布。
