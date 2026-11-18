# 环栅／悬桥：双层动态非均匀缩放与连续再导出回归

2026-11-15。私人项目 cascade-stress；Ego TaskSpace 35；所有业务编辑、播放、保存和导出通过界面，getState仅只读。原有未提交文件逐项SHA256核对保持不变，未提交或推送。

## 结果

本轮未发现新增框架状态缺陷，未改框架代码。新两场四组十六镜完成创建、共用／独立调整、父子摆位、隐藏恢复、快速切镜、分割删除、取消放弃及跨场景保存重载。三轮十二包共4608帧，240次预览／导出相机数据比较通过；完整对象矩阵与有效显隐逐帧独立计算核验误差小于1e-8。

第一轮每包导出后立即继续播放、切镜、调整焦距、再播放、分割、共用草稿取消及放弃，完整预览状态恢复。随后在导出页直接持久化父子旋转、道具恢复和焦距，跨场景重载确认，再播放并复核资料，第二轮导出。第三轮在第二轮后继续调整／取消／放弃，再次导出，实际逐帧记录和导演设计与第二轮全部16镜一致；第一轮到第二轮仅预期8镜变化，其余8镜逐帧不变。第二/三轮全部1536帧的原始PNG及解码像素完全一致，第一/二轮未调整镜头的768张原始PNG字节也完全一致。四个未调整镜头的432个解码视频帧存在压缩像素差异：server/plugin.ts先以libx264 CRF28编码整片，server/delivery-export.ts再从整片截取并有损重编码，前镜变化会影响后镜的压缩参考；原始渲染和实际数据未变化。此项不判为修改范围串改，也不要求有损视频在前镜变化后逐像素相同。最终第三轮导出后继续播放、切镜及取消新草稿，dirty均false，浏览器错误为空。

## 新场景与覆盖

环栅为九段圆环阵列，悬桥为九段高低倾斜踏板。舞台祖先三轴动态非均匀缩放（最高18%振幅）和三轴旋转，人物父组同时三轴非均匀缩放（最高12%振幅）及旋转，道具组独立缩放与旋转。三个角色、箱体、信标与两级父组组合。主组五镜为引导、正反短弧、固定种子手持、祖先隐藏时场外C侧跟、主体固定恢复；备组三镜为三层重摆等待、A经信标交接B、人物父组隐藏后C上下摇镜。正反源时间跳转与独立表演源起点不同。

66个状态点、70次快速切镜通过。包括参数/HUD/预设范围隔离、预设取消保留摆位草稿、放弃恢复父子姿态和显隐、删除独立表演来源后继承变化、恢复后原机位引用。四组连续播放16个面板衔接未中断。逐镜首中尾实际回放截图已查看；环栅首镜前景遮挡及末镜方位通过UI调整并回放确认。两轮持久化状态均重新播放查看；每轮导出五点/镜抽帧已查看，共240帧。

导出核验包含plannedShots、cameraId、独立表演take/source/origin、8个动态对象完整列主序matrixWorld与有效显隐、单位四元数、主体固定机位世界米偏移、24fps/640×360参考视频、每镜帧数、资料/提示词、source.zip与当轮保存源码和设置一致。第二/三轮设计与实际数据相同；不要求ZIP字节相同（任务ID和打包元数据不同）。

115项测试、npm run build、npm run check:projects及git diff --check通过。证据位于artifacts/cascade-stress/，包含UI操作脚本、状态、截图、独立NumPy变换计算、逐帧审计和三轮档案。

## 导演包

第1轮：

- [rings / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/5f8a65e8-8bd9-4eba-86f9-b2425cd2e591/delivery.zip)；SHA256 `52869c6f7be1a2c1bd89b403bc2aca7d15d4e590cd68690f70b0d8f283f12bb1`。
- [rings / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/e04f6120-48e5-4403-9670-dfc49d2e4c28/delivery.zip)；SHA256 `5da1c3ae821acb91ee917bc3085b1ef1d4f9ede36a5cf8071ad76c5548becdda`。
- [bridges / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/c3425965-811f-40c7-9044-cede3283febe/delivery.zip)；SHA256 `c32ca6ee7d7fab5b1b80eb43892585c86c41d9793cf1933fa82cbc9e68db8685`。
- [bridges / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/da9a90c5-5543-4447-b4b4-ee14bc5a8c92/delivery.zip)；SHA256 `22301b502c32096f422bf4af9a5bb6c8d6d3eac2c6a70566b3b86ac313c564b3`。

第2轮：

- [rings / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/4d22577f-0776-40c4-b122-3236a43602da/delivery.zip)；SHA256 `9544a03a4de6621ca189be75d4d67d59aefea76da570dae0176c5685c699e56b`。
- [rings / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/3fc21df0-54a7-4c2b-bb54-4da4ffc0b095/delivery.zip)；SHA256 `a3953052e1011d5438b73a38af41544585badfd1637847d9e58b2e8185382e2c`。
- [bridges / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/bf29eee9-4a85-44e6-a679-f4dd513e3433/delivery.zip)；SHA256 `bf5eccd6918475a4bf57a42eb7fefcb7fc84cbe1107da81c113611cc57026a17`。
- [bridges / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/b94c5f12-657f-4338-b70b-b12e17e593e3/delivery.zip)；SHA256 `76cd48feef91824d82f41dc062c49481ac0d1ce464dcfb1261604327d0cc9e3f`。

第3轮：

- [rings / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/fb472c47-91fe-4db8-9f1d-77f8d1350621/delivery.zip)；SHA256 `2f21a5c93d8efcd90b862f4184475e0dfb3cd4ed8bebdc2b3ed92b315392f640`。
- [rings / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/090eee4b-dd5a-4824-9b6a-fdf1c25e6f6c/delivery.zip)；SHA256 `c3072ceb18251fb57f8de5d474c3bc51744b7eb356610e993a81e32ebbbb18be`。
- [bridges / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/0e531d1f-883a-4bf9-a444-36b1b184c74b/delivery.zip)；SHA256 `ebc89586a75b79034f19bca73bd1c35fc0e8e9712e51fbd1797a3e2e63afb35e`。
- [bridges / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/17c1ec86-793f-45eb-bdf0-928fc35d3324/delivery.zip)；SHA256 `1419118350588679d07c1dc84b2803697459e5e2035e7d3bf097f7d53f7dc2c5`。

## 边界

数值比较是相同采样时刻的相机与对象变换；实际预览和导出抽帧已人工查看，但不宣称预览与快速参考视频像素完全相同。快速参考视频不模拟景深/阴影。非均匀缩放、父级倾斜导致的造型拉伸和离地是故意压力条件，未做脚底接触求解。本轮没有音轨、外部模型或跨浏览器测试。旧无完整矩阵记录的兼容性沿用现有测试。
