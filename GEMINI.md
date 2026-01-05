# Gemini 开发日志

## 2025-12-22 AI 助手 Markdown 支持

### 变更目标
为 AI 助手聊天界面增加 Markdown 渲染支持，提升用户体验，使其能够预览格式化的文本、代码块、表格等内容。

### 核心变更内容
1.  **依赖安装**:
    *   `react-markdown`: 用于解析和渲染 Markdown。
    *   `remark-gfm`: 增加对 GitHub 风格 Markdown (如表格、任务列表) 的支持。
    *   `rehype-highlight`: 增加对代码块的高亮支持。
    *   `highlight.js`: 提供代码高亮的主题样式。
    *   `@tailwindcss/typography`: 引入 Tailwind 的 `prose` 类，用于美化渲染后的 HTML 内容。

2.  **配置文件更新**:
    *   `tailwind.config.js`: 引入了 `@tailwindcss/typography` 插件。

3.  **组件更新**:
    *   `src/components/AIAssistant.tsx`:
        *   将原始的 `whitespace-pre-wrap` 文本显示替换为 `<ReactMarkdown>` 组件。
        *   应用了 Tailwind 的 `prose` 样式，并根据发送者身份（用户/AI）切换 `prose-invert` 和 `prose-slate`。
        *   集成了代码高亮和 GFM 插件。

### 代码清理 (进行中)
在构建过程中发现了多处未使用的变量和导入（TS6133 错误），正在逐步清理以下文件中的冗余代码以通过生产构建：
*   `electron/main.ts`
*   `src/App.tsx`
*   `src/components/DailyPlanner.tsx`
*   `src/components/HabitTracker.tsx`
*   `src/components/AIAssistant.tsx` (修复了 ReactMarkdown 的类型错误)
*   `src/components/PomodoroTimer.tsx`
*   `src/components/TimelineView.tsx`
*   `src/components/WeeklyReport.tsx`
*   `src/stores/useAppStore.ts`

### 后续建议
*   可以考虑为代码块增加“一键复制”功能。
*   根据用户反馈调整 Markdown 的样式细节。
