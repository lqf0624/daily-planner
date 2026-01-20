# Daily Planner

Daily Planner 是一个桌面端日程与专注管理应用，基于 Electron、React 和 TypeScript 构建。
它围绕“日计划-时间轴-周计划/回顾-习惯-番茄钟”组织工作流，让计划和执行更顺手。

## 功能概览

- 日计划与时间轴：创建任务、安排时间段、重叠任务自动分列显示
- 周计划与周回顾：未完成原因记录，按周持续跟进
- 习惯追踪：支持每日提醒时间
- 番茄钟：专注/休息结束弹窗提醒
- 现代 UI：细腻动效与清晰的视觉层次

## 本地开发

安装依赖：

```bash
npm install
```

启动桌面端（Electron + Vite）：

```bash
npm run dev
```

仅启动网页端（WSL 或调试界面用）：

```bash
npm run dev:web
```

## 打包发布

构建当前平台安装包：

```bash
npm run build
```

分别构建：

```bash
npm run build:win
npm run build:mac
```

产物输出到 `release/<version>/`。

## GitHub Actions 打包

推送带 `v*` 标签（例如 `v0.1.0`），或在 Actions 手动触发 `build-desktop`，
即可在 CI 中生成 Windows/Mac 安装包并下载。

## 安装说明

### Windows
下载 `.exe` 安装包直接运行即可。

### macOS
由于应用尚未在 Apple 开发者中心注册签名，安装后请执行以下操作：
0. **先安装到 Applications**：请将 `.app` 从 `.dmg` 拖到 `/Applications` 后再打开（不要直接在 `.dmg` 里运行）。  
   若你把 `.dmg` 内的应用拖到 Dock/桌面创建了快捷方式，推出 `.dmg` 后可能会出现“无图标/无法启动”；删除该快捷方式，再从 `/Applications` 重新拖一次即可。
1. **解除系统隔离**：若无法直接打开，请打开“终端”应用，输入以下命令并回车：
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/daily-planner.app
   ```
2. **右键打开**：首次运行建议在访达中“右键 -> 打开”，在弹出的提示中再次点击“打开”。
3. **图标自检（可选）**：在仓库根目录执行 `./scripts/verify-macos-icon.sh /Applications/daily-planner.app`。

## 核心功能


## 项目结构

```
daily-planner-ai/
├── electron/           # Electron 主进程代码
├── src/                # React 渲染进程代码
├── scripts/            # 本地开发脚本
├── dist/               # Vite 构建产物
├── dist-electron/      # Electron 构建产物
└── release/            # electron-builder 输出目录
```

## 许可证

MIT
