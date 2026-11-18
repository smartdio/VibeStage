# 手动构图保留运镜回归 · 2026-11-15

根因：画面拖动产生绝对 position/rotationDegrees，每帧在代码 update 后覆盖；共用机位默认独立调整又复制单帧。这两个入口均可冻结原运镜，之前的预设调参回归不足以覆盖它们。

现在保存 framingOffset（世界平移与摄影机局部旋转），重复调整累积偏移。独立普通机位保存 sourceCameraId，从每帧未经手动覆盖的代码机位复制运动；其他镜头的手动设置不会串入副本。运镜预设保留 preset 配置，统一求值器在预设采样后应用构图偏移。HUD、位置角度、自由观察采用均保留运动，显式“转为固定机位”才冻结。旧版绝对设置不自动迁移。

真实界面：Ego TaskSpace 37，仅通过界面写业务状态，getState 用于只读采样。使用 delivery-regression-r1/meeting 既有回归场景，测试前完整备份。首帧画面拖动后播放，机位从 [2.5,2.1,4.5] 移到 [2.248384,2.1,4.29032]；位置 Y=2.4、角度 Y=40 后保存并刷新，仍有水平推进。分镜内跟拍首帧控制并升高后，在 y=2.2 继续移动，前后切镜正常。预设推进调整 Y=0.9、角度 Y=2 后，Z 从 4.3 变为 3.641667；显式冻结后相同时间段位置保持不变，放弃后恢复推进。导出后再次操控取消、播放正常，无未保存状态；跨场景进入正常。

导出一：exports/3029966c-20b1-4e0f-837d-aaf242021660，四镜头 144 帧；8 个 UI 对应时刻的实际位置、四元数、焦距与 cameras.json 精确相同。导出二：exports/29d62a9f-0952-4b86-a832-8f2a4f5a5bf0，独立动态源机位 144 帧；0 秒、2 秒预览记录与导出完全一致。已查看实时预览截图和四镜头视频 12 格抽帧；本轮验证的是参考视频与摄影机记录，不是完整导演交付包。

证据在 artifacts/motion-offset：manual.json、cuts.json、preset.json、frozen.json、reloaded.json、export-preview.json、alias-export-preview.json、tested-camera.json 与截图。测试结束恢复 meeting.camera.json 到测试前备份，未改动已有交付档案；导出 source.zip 保留实际测试版本，不把临时测试镜头当作新的创作交付。

开发期间出现源码版本冲突保护及服务端旧校验缓存拒绝新字段，重启 Vite 后重新从首帧操作，保存重载与导出通过。117 项测试、npm run build、npm run check:projects 通过，git diff --check 通过。既有未提交修改保留，未提交或推送。
