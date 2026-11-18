---
name: VibeStage
description: 深色导演预演工作台，围绕当前镜头组织编辑。
colors:
  background: "#12191d"
  panel: "#1c262b"
  border: "#37454b"
  text: "#eff3f1"
  muted: "#b2bfc3"
  accent: "#f3bd78"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
    fontSize: "13px"
  code:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
rounded:
  input: "4px"
  control: "5px"
spacing:
  unit: "4px"
  panel: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#252119"
    rounded: "{rounded.control}"
    padding: "8px 11px"
---

# Design System: VibeStage

## Overview

**Creative North Star: "导演预演工作台"**

中心 3D 场景承担主要任务，深色工具界面与较亮白模画面区分操作区和拍摄内容。工作区使用冷调深灰和系统字体。没有装饰性入场动画。

## Colors

琥珀色指示时间、当前镜头和主操作。青绿色区分机位工具和已展开的面板。浅色文字呈现当前值，次文字承载标签与说明。颜色以 frontmatter 为准，工作台覆盖规则见 src/shot-workspace.css。

## Typography

系统无衬线字体服务紧凑操作，常规控件使用 12–13px，辅助标签使用 10–11px。文件代码、坐标与时间使用系统等宽字体或等宽数字。图标延续 lucide-react。

## Layout

左侧保留项目与对象，在时间线上选择镜头，中央预览上方显示镜头名、时段和可切换的机位，下方是“构图与机位”“运镜”“表演与摆位”“叙事与衔接”四个可收起页签。镜头色块时间线和音轨位于编辑器下方，始终表达成片时间。工具栏的“导出”和“辅助”共用右栏。普通拍摄预览默认收起右栏，教学样板默认展开观察重点，自由观察保留辅助监看。

桌面三栏宽度为 200px、可变中央区、250px；1600px 起侧栏为 216px 和 270px。761–1100px 使用 175px、可变中央区、220px。760px 以下改为纵向排列，预览高度 340px，编辑区内部滚动。常规桌面编辑内容最大高度 190px，1600px 起为 240px，窄屏为 360px。以 src/shot-workspace.css 的最终覆盖规则为准。

## Elevation & Depth

常规工作区以明暗面板和细分隔线建立层次。创建场景对话框使用阴影（0 18px 60px #0005）和暗色遮罩；不将对话框浮层效果扩展到每个编辑区域。

## Shapes

控制器延续小圆角，输入与按钮使用 frontmatter 中的对应半径。间隔以 4px 为基础，页面保持紧凑工具密度。摄影机 HUD 的方向盘和摇杆保留其功能性圆形。

## Components

主按钮采用琥珀色底和深色文字，普通按钮使用深灰底。交互焦点为 2px 琥珀色轮廓，禁用状态降低对比。编辑页签配有图标，展开状态使用青绿色底与亮边框。当前镜头在时间线使用琥珀色底边。

“叙事与衔接”和“交付信息”共用原有交付资料，不建立第二份文档。工作区保存状态明确区分待保存的机位与分镜、交付资料；保存按顺序执行，不能显示成原子保存保证。音轨保留独立保存操作。多个镜头共享机位时，编辑区域提示影响范围，并提供当前镜头的独立机位副本。

对象坐标仍为只读，场景源代码是动作依据。表演与摆位可选择延续或独立表演，并编辑动作起点、起始位置、朝向与显示状态。自由观察与输出摄影机保持分离；导出提供进度、取消、文件与源快照下载。

## Do's and Don'ts

保留中央画面、当前镜头上下文和明确的保存状态；表单收起后仍能定位镜头与播放头。保留已有项目资料和手动机位设置，不为布局改动复制私人资产。不要把主要机位编辑放回右栏，也不要在拍摄模式重复展示同一监看画面。
