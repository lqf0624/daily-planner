# Daily Planner

一个面向个人知识工作者的桌面日程与专注执行系统。

它不是传统的待办清单，也不是全自动 AI 排程器，而是围绕 `Inbox / Today / Review` 三段式工作流组织：

`捕获想法 -> 定盘今天 -> 进入专注 -> 完成收尾`

当前桌面端基于 Tauri 2、React、TypeScript 构建，重点是本地优先、低负担输入、每日承诺和执行闭环。

## 产品定位

- 目标用户：产品、设计、开发、研究、内容、自由职业者等持续进行脑力工作的个人用户
- 核心问题：用户不缺记录任务的地方，缺的是一条每天都能稳定使用的定盘、执行、复盘流程
- 核心价值：降低输入负担，降低每日决策负担，形成从捕获到复盘的闭环
- AI 角色：流程内副驾，负责建议、澄清、复盘草稿，不直接替用户做最终决定

一句话定义：

> 不是只记录任务，而是帮你完成今天。

## 工作流与方法论

当前产品并非照搬单一方法，而是组合了几套成熟框架：

- `GTD`：Capture / Clarify / Reflect
- `Make Time`：每天收敛少量关键事项
- `Deep Work / Time Blocking`：以专注块驱动执行
- `Energy Management`：重视 60-90 分钟专注与恢复节律

对应到产品结构：

- `Inbox`：负责捕获与轻量澄清
- `Today`：负责确定今日承诺、安排时间块并进入专注
- `Review`：负责收尾、顺延、删除与日 / 周复盘

## 核心能力

- `Inbox / Today / Review` 主工作流
- Inbox 澄清：支持先编辑草稿，再确认落库，避免任务在澄清中途直接消失
- 日历与排程：支持安排具体时间、拖拽改期、列表与日历视图切换
- Today 工作台：`1 个 Highlight + 最多 2 个 Support`、今日溢出、稍后处理、专注块
- Review：每日收尾、按日期补复盘、历史复盘日期保留、每周回顾、季度目标联动
- 季度目标：作为方向层，与周重点和任务联动
- Focus block / 番茄钟：支持主界面、悬浮窗、迷你条，以及任务绑定
- AI 副驾：自然语言创建任务、Inbox 分拣、Today 定盘建议、Review 收尾草稿
- 本地数据：支持导入 / 导出备份
- 自动更新：应用内检查更新、下载并安装
- 浏览器预览兼容：非 Tauri 运行时下会自动降级桌面 API，便于 Web 预览和浏览器 QA

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

构建本地免签测试包：

```bash
npm run build:tauri:local
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

预览生产构建：

```bash
npm run preview
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
