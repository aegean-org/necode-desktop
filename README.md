# NeCode Desktop

NeCode Desktop 是面向开发者的 AI Coding Agent 桌面端工作台。它基于 OpenCode 开源项目构建，当前重点是提供更接近桌面工作流的项目、会话、模型、MCP、技能和本地文档能力。

## 下载

请从 GitHub Releases 下载最新测试版：

- Windows：下载 `necode-desktop-win-x64.exe`
- macOS Apple Silicon：下载 `necode-desktop-mac-arm64.dmg`
- macOS Intel：下载 `necode-desktop-mac-x64.dmg`

Release 页面：<https://github.com/liangwei/opencode/releases>

## 安装

### Windows

下载 `.exe` 安装包后直接运行。当前 Windows 包未做微软代码签名，首次安装时可能出现系统安全提示。

### macOS

下载 `.dmg` 后打开，把 NeCode 拖入 Applications。如果下载的是未签名测试包，macOS 可能需要在“系统设置 -> 隐私与安全性”中手动允许打开。

## 主要能力

- 项目工作台：按项目组织会话和任务。
- 多会话工作流：会话列表、详情区和上下文面板组成固定桌面布局。
- 模型与提供商：在设置中配置提供商、模型、MCP 和技能。
- Agent 执行：保留 OpenCode 的编码执行、文件操作、终端/工具调用能力。
- 本地文档：支持导入本地文档并在会话中通过 `@doc` 引用，当前优先围绕 PDF 和 NE embedding 能力迭代。

## 当前状态

这是早期测试版，主要用于验证桌面端产品形态、安装包、macOS 签名/公证、Windows 安装体验和核心 Agent 工作流。遇到问题时，请反馈系统版本、安装包文件名、复现步骤和错误截图。

## 开发

```bash
cd packages/desktop
bun install
bun run dev
```

## 打包

```bash
cd packages/desktop
bun run build
bun run package:win
bun run package:mac
```

GitHub Actions 中的 `desktop-package` 工作流可以生成 Windows 安装包和 macOS DMG。填写 `release_tag` 后，工作流会把 `.exe` 和 `.dmg` 上传到对应 GitHub Release。

## 开源来源

NeCode Desktop 基于 OpenCode 构建，并在桌面端 UI、产品工作流、品牌、RAG 和发布流程上做了定制。
