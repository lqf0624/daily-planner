# Daily Planner

一个面向个人使用的桌面日程管理应用，围绕这条工作流组织：

`季度目标 -> 周计划 -> 日程任务 -> 番茄执行 -> 周报复盘 -> AI 辅助`

当前桌面端基于 Tauri 2、React、TypeScript 构建，重点是本地优先、可持续使用、任务与专注闭环。

## 核心能力

- 今日工作台：今日任务、当前关注、本周焦点、近期提醒
- 日历与排程：日 / 周 / 月 / 列表视图，支持拖拽改期、快捷完成、分类颜色区分
- 周计划：维护本周目标，关联任务与季度目标
- 周报：按周沉淀复盘，并支持历史周报查看
- 季度目标：作为上层目标，向周目标和任务联动
- 番茄钟：支持主界面、悬浮窗、迷你条，以及任务绑定
- AI 副驾：自然语言创建任务、生成计划建议、生成周报草稿
- 本地数据：支持导入 / 导出备份
- 自动更新：应用内检查更新、下载并安装

## 技术栈

- 前端：React 18、TypeScript、Vite、Zustand、FullCalendar
- 桌面端：Tauri 2
- 测试：Node unit tests + Playwright E2E

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发：

```bash
npm run dev
```

构建前端：

```bash
npm run build
```

构建桌面安装包：

```bash
npm run build:tauri
```

## 测试

单元测试：

```bash
npm run test:unit
```

端到端测试：

```bash
npm run test:e2e
```

代码检查：

```bash
npm run lint
```

Rust 编译检查：

```bash
cargo check
```

## 数据兼容

当前版本兼容上一版正式 Tauri 安装版的数据升级：

- 仍使用同一个 Tauri `identifier`
- 支持旧版 `daily-planner-storage-v5` 持久化数据读取
- 支持旧 Zustand `{ state, version }` 包装结构迁移

不再兼容更早的废弃 Electron 版本数据。

## 自动更新

应用内自动更新依赖这条链路：

1. 在 GitHub 上创建 `v*` tag
2. GitHub Actions 生成正式 release
3. Release 产出安装包和 `latest.json`
4. 桌面应用内“检查更新”读取 `latest.json`

注意：

- 必须是正式 release，不能是 draft
- 本地直接打包的 `.exe` 不会自行更新到一个不存在的线上版本

## GitHub Release

工作流文件：

- [.github/workflows/release.yml](./.github/workflows/release.yml)

当前触发条件：

- `push` 一个形如 `v0.2.4` 的 tag

发布建议流程：

1. 在开发分支完成改动并验证
2. 合并回 `main`
3. 更新版本号
4. 打 `vX.Y.Z` tag
5. push `main` 和 tag
6. 等 GitHub Action 生成 release
7. 用旧版本实际点一次“检查更新”验证

## macOS 说明

如果 macOS 端出现图标显示异常，仓库内提供了自检脚本：

```bash
./scripts/verify-macos-icon.sh /Applications/daily-planner.app
```

当前 mac 打包会合并：

- `CFBundleIconFile`
- `CFBundleIconName`

对应文件：

- [src-tauri/Info.plist](./src-tauri/Info.plist)

## 项目结构

```text
daily-planner-ai/
├── src/                    # React 前端
├── src-tauri/              # Tauri 后端与打包配置
├── e2e/                    # Playwright E2E
├── tests/                  # Node 单元测试
├── scripts/                # 辅助脚本
└── .github/workflows/      # CI / Release
```

## 许可证

MIT
