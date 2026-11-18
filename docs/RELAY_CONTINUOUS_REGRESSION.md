# 风扇／阶庭：双层动态非均匀缩放与导出后连续调整回归

2026-11-15。私人项目 relay-stress；Ego TaskSpace 36；所有业务编辑、播放、保存和导出通过界面，getState仅只读。写报告前原有未提交文件逐项SHA256核对保持不变；仅向UI_HANDOFF追加本轮交接，既有内容保留。未提交或推送。

## 结果

本轮未发现新增框架状态缺陷，未改框架代码。新两场四组十六镜完成创建、共用／独立调整、父子摆位、隐藏恢复、快速切镜、分割删除、取消放弃及跨场景保存重载。三轮十二包共4608帧，240次预览／导出相机数据比较通过；完整对象矩阵与有效显隐逐帧独立计算核验误差小于1e-8。

第一/三轮每包导出后立即继续播放、切镜、调整焦距、分割成两片并共用引用；连续35mm共用、29mm独立、33mm共用，每步回放、核对邻片修改范围，再输入44mm取消验证不回退上一步应用。随后再分割、取消共用草稿并放弃全部修改，完整预览状态恢复。八次连续链路共144状态记录。随后在导出页直接持久化父子旋转、道具恢复和焦距，跨场景重载确认，再播放并复核资料，第二轮导出。第三轮在第二轮后继续调整／取消／放弃，再次导出，实际逐帧记录和导演设计与第二轮全部16镜一致；第一轮到第二轮仅预期8镜变化，其余8镜逐帧不变。第二/三轮全部1536帧的原始PNG及解码像素完全一致，第一/二轮未调整镜头的768张原始PNG字节也完全一致。未调整镜头中有528个解码视频帧存在压缩像素差异：server/plugin.ts先以libx264 CRF28编码整片，server/delivery-export.ts再从整片截取并有损重编码，前镜变化会影响后镜的压缩参考；原始渲染和实际数据未变化。此项不判为修改范围串改，也不要求有损视频在前镜变化后逐像素相同。最终第三轮导出后继续播放、切镜及取消新草稿，dirty均false，浏览器错误为空。

## 新场景与覆盖

风扇为八段扇形立板，阶庭为八段高低台阶。舞台祖先三轴动态非均匀缩放（最高22%振幅）和三轴旋转，人物父组同时三轴非均匀缩放（最高12%振幅）及旋转，道具组独立缩放与旋转。三个角色、箱体、信标与两级父组组合。主组五镜为背跟、下降入场、双主体拉焦、祖先隐藏时场外C侧跟、主体固定恢复；备组三镜为三层重摆等待、正反曲线路径穿行、人物父组隐藏后C上下摇镜。正反源时间跳转与独立表演源起点不同。

66个状态点、70次快速切镜通过。包括参数/HUD/预设范围隔离、预设取消保留摆位草稿、放弃恢复父子姿态和显隐、删除独立表演来源后继承变化、恢复后原机位引用。四组连续播放16个面板衔接未中断。逐镜首中尾实际回放截图已查看；风扇末镜前景遮挡通过UI调整并回放确认。两轮持久化状态均重新播放查看；每轮导出五点/镜抽帧已查看，共240帧。

导出核验包含plannedShots、cameraId、独立表演take/source/origin、8个动态对象完整列主序matrixWorld与有效显隐、单位四元数、主体固定机位世界米偏移、24fps/640×360参考视频、每镜帧数、资料/提示词、source.zip与当轮保存源码和设置一致。第二/三轮设计与实际数据相同；不要求ZIP字节相同（任务ID和打包元数据不同）。

115项测试、npm run build、npm run check:projects及git diff --check通过。证据位于artifacts/relay-stress/，包含UI操作脚本、状态、截图、独立NumPy变换计算、逐帧审计和三轮档案。

## 导演包

第1轮：

- [fans / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/f529057c-3d3d-454a-969e-4c2a82ef0b12/delivery.zip)；SHA256 `db3fa4f698f6c97129cffa6917aaa8d0a8f2187a91e794c66056a648ef7baff3`。
- [fans / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/d1c88189-5157-46e9-8cb7-263fc2ba122a/delivery.zip)；SHA256 `567fab915d766bb0326ec940f0fb46ab374d7e5d1351901d2b79fc3d17315be7`。
- [terraces / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/286bb3bc-f382-4bf1-8576-0bea30a535e2/delivery.zip)；SHA256 `4a2b119356e8e60d217ea141903f2fb3a59b131a134d0723924f4b521f5a1899`。
- [terraces / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/349eb6ba-dcf1-4d1a-b408-0ff02bbeeffd/delivery.zip)；SHA256 `be95b1eb05a4331b4153d7675d2bab9b27ced2ce77a08cd6f8ca06cb2e6a0837`。

第2轮：

- [fans / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/b3835c14-308a-44f4-8d63-6189b669262c/delivery.zip)；SHA256 `e5a68029cec1230f583cb486f1bb83cd7da3b9204180971e16405deb728e9d94`。
- [fans / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/052a3d6b-a03d-4b61-a16f-c72c12aeea99/delivery.zip)；SHA256 `bd9e923036ae98ce7f5a110ac78e970e5d1d0dce43f8f5510190e1e2f78d2df4`。
- [terraces / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/4640a63f-6ac2-4f53-86fb-9eb57da5e5c0/delivery.zip)；SHA256 `08da0e92cdf859b20c039c6674e2a8ce9622cb649fde17e63ec036c0b168ad9a`。
- [terraces / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/cf7b9174-ddf2-4601-9b47-14633026ec42/delivery.zip)；SHA256 `874f1d01dcd358748f6b3ec14e2ae7464033daa4636499a90b036a5f6c6a0978`。

第3轮：

- [fans / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/710c46bd-c780-4895-a142-053bfa2cdbbd/delivery.zip)；SHA256 `3485cfae4eca3c1876cccc7b5f1ee8c398765ff98bb3d9d9bd043a76b606438b`。
- [fans / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/bb1df300-2118-48c8-9421-9502c8fec93c/delivery.zip)；SHA256 `5dfd890172f61617807ecd107e4c321c142b69f59285f3e7106c44ed46b66783`。
- [terraces / sequence_1](/Users/tingcongmai/workspace/VibeStage/exports/bd37cbd9-8f92-4564-9c93-0999275244fa/delivery.zip)；SHA256 `2ec2b23bb87e2e5f4217bec3dcdb1a52e8c14ae7882022936829e32c0d77686a`。
- [terraces / sequence_2](/Users/tingcongmai/workspace/VibeStage/exports/bdc7b85e-acca-4199-8d51-85a556facd55/delivery.zip)；SHA256 `22f1c11a89bd25a74ba3dbd2eb6ce495b1083c6dc194ab3375e3cca10318ca4a`。

## 边界

数值比较是相同采样时刻的相机与对象变换；实际预览和导出抽帧已人工查看，但不宣称预览与快速参考视频像素完全相同。快速参考视频不模拟景深/阴影。非均匀缩放、父级倾斜导致的造型拉伸和离地是故意压力条件，未做脚底接触求解。本轮没有音轨、外部模型或跨浏览器测试。旧无完整矩阵记录的兼容性沿用现有测试。
