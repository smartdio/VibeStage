# VibeStage

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Three.js，用户明确指定。已有的基础工程文件不代表技术栈及功能范围已经全部确认；用户已确认按更新后的需求实现首版。

## Users
制作 MV 的导演与视频生成 Agent，可接入外部自动编导与视频生成流程。

## Product Purpose
提供共享基础模型、人体骨架、可编辑场景模板及预览导出工具。具体使用时，由外部 Agent 直接编写和修改 Three.js 场景源代码，表达布局、人物动作、复杂动态及机位，输出拍摄与视频生成参考。

## Operating Context
首版已可运行。用户计划通过 GitHub 分发框架，让其他用户拉取后由各自 Agent 接管。公开框架与示例保存在 lib、templates、examples 等目录，个人工程保存在 Git 忽略的 projects，私人模型库保存在 Git 忽略的 user-models。跨机器 Agent 通信方式尚未指定。

## Capabilities and Constraints
共享模型库提供概括化场景、基础几何体、桌椅、低面数车辆及不同精度的人体骨架。新建场景生成可编辑的 JavaScript 或 TypeScript 模块，引用共享资源，允许外部 Agent 直接使用 Three.js 对象与自定义逻辑。复杂布局、对象层级及场景动态不受预设 JSON 字段限制。用户主要审阅，后续可局部调整精细关节。已有图片、序列和 MP4 导出；新增 GLB/glTF 加载及私人模型库代码引用。任意人物骨架适配、精细关节编辑和图形化模型导入仍属后续能力。

## Open Decisions
需求与建议分期见 REQUIREMENTS.md。建议首版交付基础模型与骨架、场景代码模板、最小运行接口、预览和导出；精细资源、可视化微调及通用辅助工具分阶段扩展。外部 Agent 直接编辑具体工程，不要求内置 Agent、固定场景 DSL 或版本提交服务。当前运行接口和模型加载约定见 AGENT_GUIDE.md、MODEL_GUIDE.md；跨机器传输、精细资源和后续辅助工具范围仍待确定。

## Product Principles
场景源代码是编排依据，基础库提供便利而不限制表达能力。共享资源与具体拍摄工程分离。自由观察视角和输出摄影机分离。预览和导出使用同一时间逻辑。参考画面用于表达生成意图，不承诺生成模型严格遵循。
