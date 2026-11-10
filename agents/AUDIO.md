# 音画同步（按需读取）

每个场景支持一条已混合音轨。工作台时间轴导入 WAV / MP3 / M4A / AAC / OGG / FLAC，单文件不超过 64 MB / 300 秒，依赖本地 FFmpeg 和 ffprobe。服务转换成 48 kHz 双声道 PCM WAV，内容哈希命名，保存在 `projects/<project>/assets/audio/<sha256>.wav`。不发布到公开框架。

设置文件 `projects/<project>/settings/<scene>.audio.json`：

```json
{
  "version": 1,
  "asset": "assets/audio/<64位SHA256>.wav",
  "name": "已混合配音.wav",
  "durationSeconds": 8,
  "offsetSeconds": 0,
  "volume": 1,
  "muted": false
}
```

`asset` 必须匹配上述哈希路径；建议通过导入接口生成，不手写素材哈希。`durationSeconds` 是音频实际时长；场景时长仍由 StageScene 决定。设置也可以为 `null`，表示移除音轨，保留素材文件。

`offsetSeconds` 为第一份音频样本的场景时间，范围 ±300 秒。场景 t 对应音频 t − offsetSeconds；音频范围之外静音。正值延后播放，负值裁掉开头。`volume` 范围 0–2，`muted` 同时影响预览与导出。改变人物动作和机位时保留这些设置，除非任务需要改变对齐。

调整分镜时保持 `cameraCuts` 从 0 连续覆盖 `durationSeconds`。用户保存的 `.camera.json` 会覆盖代码分镜，修改前读取它；UI 可在右侧“编辑连续分镜”调节。场景的 update(t) 仍须确定性，不在场景代码自行播放声音或创建时钟。播放中上下镜头跳转保留播放状态，暂停时停在目标帧；拖动波形定位会暂停。

本机接口（写入须 `X-VibeStage: 1`）：

- GET `/__vs/audio?project=<p>&scene=<s>` → `{track,revision}`。
- POST `/__vs/audio?project=<p>&scene=<s>&revision=<revision>&sourceHash=<hash>&name=<文件名>`，body 是原始文件字节，返回 `{track,revision,sourceHash}`。
- PUT 同一路径、同样 revision/sourceHash，JSON body `{track}` 更新设置或 `{track:null}` 移除。
- GET `/__vs/audio-file?project=<p>&scene=<s>` 获取当前规范化 WAV。

所有 query 参数需要 URL 编码。sourceHash 从 `/__vs/projects?project=<p>` 获取；revision 从 GET audio 获取。冲突应重新读取再处理，不能盲目覆盖。浏览器 `window.vibeStage.getState()` 含 audio、audioClock、playing、hasUnsavedAudioEdits。UI 有未保存草稿时先保存或放弃再操作文件。

MP4 导出从冻结源码快照读取音频和设置，按同样的有符号偏移、音量、静音合成 AAC；按实际导出帧数补静音／裁切。导出目录附 `soundtrack.wav`，这是未移位、未调音量的规范化原音频。序列 ZIP 附该 WAV；按 manifest.audio 对齐，不能直接把原音频从 0 秒贴上。PNG 无声。source.zip 包含项目音频与设置，仅用于私人复现。

预览调度参考 [AudioBufferSourceNode.start](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)。通过 AudioContext 同时驱动音频和场景时间，暂停／跳转时释放旧 source 并重新按时间调度。
