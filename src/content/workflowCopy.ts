import { AppLocale } from '../i18n';

export type WorkflowGuideStep = {
  id: 'inbox' | 'today' | 'review';
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    label: string;
    text: string;
  }>;
  outcome: string[];
};

type WorkflowCopy = {
  app: {
    nav: {
      inbox: string;
      today: string;
      review: string;
    };
    title: string;
    description: string;
    guideAriaLabel: string;
    currentFocus: string;
    noActiveFocusTask: string;
    systemState: string;
    inboxCount: (count: number) => string;
    activeGoals: (count: number) => string;
  };
  guide: {
    header: string;
    title: string;
    description: string;
    typicalExample: string;
    produced: string;
    openInbox: string;
    openToday: string;
    openReview: string;
    back: string;
    next: string;
    gotIt: string;
    steps: WorkflowGuideStep[];
  };
  inbox: {
    eyebrow: string;
    title: string;
    description: string;
    itemsWaiting: string;
    capturePlaceholder: string;
    save: string;
    clarifyTitle: string;
    clarifyDescription: string;
    empty: string;
    estimate: string;
    taskType: string;
    keepInInbox: string;
    moveToToday: string;
    moveToLater: string;
    unsavedBadge: string;
    notesPlaceholder: string;
    todayButton: string;
    aiTitle: string;
    aiDescription: string;
    aiPlaceholder: string;
    laterQueue: string;
    laterQueueDescription: string;
    laterQueueEmpty: string;
    estimateMinutes: (minutes: number) => string;
    taskTypeOptions: Record<'deep' | 'shallow' | 'personal', string>;
  };
  today: {
    taskChip: {
      highlight: string;
      later: string;
      support: string;
      schedule: string;
      focus: string;
      delete: string;
    };
    calendarHeaderEyebrow: string;
    title: string;
    calendarHeaderDescription: string;
    planningBoard: string;
    calendar: string;
    headerEyebrow: string;
    headerDescription: string;
    committed: string;
    highlight: string;
    noHighlightChosen: string;
    aiPlanTitle: string;
    aiPlanDescription: string;
    aiPlanPlaceholder: string;
    highlightTitle: string;
    highlightDescription: string;
    doneCount: (count: number) => string;
    startFocus: string;
    restore: string;
    done: string;
    highlightNotesPlaceholder: string;
    highlightEmpty: string;
    supportTasksTitle: string;
    supportTasksDescription: string;
    supportTasksEmpty: string;
    overflowTasksTitle: string;
    overflowTasksDescription: string;
    overflowTasksEmpty: string;
    parkingLotTitle: string;
    parkingLotDescription: string;
    parkingLotEmpty: string;
    focusBlock: string;
    currentTask: string;
    noFocusTaskSelected: string;
    pause: string;
    start: string;
    aiFocusTitle: string;
    aiFocusDescription: string;
    aiFocusPlaceholder: (taskTitle?: string) => string;
    goalContext: string;
    noActiveGoals: string;
    taskTypeLabels: Record<'deep' | 'shallow' | 'personal', string>;
    planningStateLabels: Record<'inbox' | 'today' | 'later', string>;
    estimateMinutes: (minutes: number) => string;
    goalProgress: (progress: number) => string;
    scheduleDialogTitle: string;
    scheduleStart: string;
    scheduleEnd: string;
    scheduleSave: string;
  };
  review: {
    eyebrow: string;
    title: string;
    description: string;
    completedToday: string;
    needShutdown: string;
    shutdownTitle: string;
    shutdownDescription: string;
    shutdownEmpty: string;
    highlightBadge: string;
    estimateMinutes: (minutes: number) => string;
    done: string;
    later: string;
    drop: string;
    weeklyReview: string;
    weeklyPlan: string;
    quarterlyGoals: string;
    advancedAI: string;
    aiShutdownTitle: string;
    aiShutdownDescription: string;
    aiShutdownPlaceholder: string;
    aiNextWeekTitle: string;
    aiNextWeekDescription: string;
    aiNextWeekPlaceholder: string;
    activeGoals: string;
    noActiveGoals: string;
    reviewDate: string;
    reviewDateDescription: string;
    pendingReviewDates: string;
    pendingReviewDatesEmpty: string;
    selectedDateLabel: string;
    pendingCount: (count: number) => string;
    taskTypeLabels: Record<'deep' | 'shallow' | 'personal', string>;
    progress: (progress: number) => string;
  };
  aiAssistant: {
    suggestions: string[];
  };
};

const en: WorkflowCopy = {
  app: {
    nav: { inbox: 'Inbox', today: 'Today', review: 'Review' },
    title: 'AI Daily Planner',
    description: 'Inbox capture, one highlight, focused execution, and a clean review loop.',
    guideAriaLabel: 'Open workflow guide',
    currentFocus: 'Current Focus',
    noActiveFocusTask: 'No active focus task',
    systemState: 'System State',
    inboxCount: (count) => `${count} in inbox`,
    activeGoals: (count) => `${count} active goals`,
  },
  guide: {
    header: 'Workflow Guide',
    title: 'New workflow, less overhead',
    description: 'This planner now follows a guided flow: capture, clarify, commit less, then shut down cleanly. The cards on the right show what a typical pass looks like.',
    typicalExample: 'Typical Example',
    produced: 'What this produces',
    openInbox: 'Open Inbox',
    openToday: 'Open Today',
    openReview: 'Open Review',
    back: 'Back',
    next: 'Next',
    gotIt: 'Got it',
    steps: [
      {
        id: 'inbox',
        eyebrow: 'GTD Capture',
        title: 'Anything new starts in Inbox',
        description: 'Do not decide priority, date, and category up front. Capture first, then clarify with one light pass.',
        cards: [
          { label: 'You capture', text: 'Tomorrow prep investor notes, send March invoice this week, run tonight.' },
          { label: 'AI suggests', text: 'Split into 3 tasks with 60 / 15 / 30 minute estimates and today-or-later suggestions.' },
          { label: 'You confirm', text: 'Only adjust what matters. Everything else stays lightweight and movable.' },
        ],
        outcome: ['prep investor notes -> 60 min / deep / today', 'send March invoice -> 15 min / shallow / later', 'run tonight -> 30 min / personal / later'],
      },
      {
        id: 'today',
        eyebrow: 'Make Time + Deep Work',
        title: 'Today is only 1 highlight + 2 support tasks',
        description: 'The goal is not to pull everything into today. Pick one task that makes the day feel meaningful, then keep support work short.',
        cards: [
          { label: 'You review', text: 'From the clarified list, choose the one task that would make the day count.' },
          { label: 'AI suggests', text: 'Recommend 1 highlight, 2 support tasks, and a focus block instead of auto-writing your calendar.' },
          { label: 'You confirm', text: 'Keep only what fits. Overflow work goes to later instead of bloating today.' },
        ],
        outcome: ['1 highlight to anchor the day', '2 support tasks max', '1 real focus block with timer'],
      },
      {
        id: 'review',
        eyebrow: 'Shutdown Ritual',
        title: 'Close the day before you leave',
        description: 'Every unfinished today task gets one of three endings: done, later, or dropped. That keeps tomorrow clean.',
        cards: [
          { label: 'You review', text: 'Finish proposal, move invoice to later, drop a low-value follow-up.' },
          { label: 'AI suggests', text: 'Draft a clean shutdown summary and tomorrow carry-forward list for confirmation.' },
          { label: 'You confirm', text: 'Nothing is auto-moved or auto-deleted without approval.' },
        ],
        outcome: ['Done -> completed today', 'Later -> parked for another day', 'Drop -> intentionally archived'],
      },
    ],
  },
  inbox: {
    eyebrow: 'GTD Capture',
    title: 'Inbox',
    description: 'Capture first. Clarify later. Every new item lands here before it competes for today.',
    itemsWaiting: 'Items waiting',
    capturePlaceholder: 'Capture a task, thought, or commitment',
    save: 'Save',
    clarifyTitle: 'Clarify Inbox',
    clarifyDescription: 'Give each item just enough structure: duration, task type, and next destination.',
    empty: 'Your inbox is clear. Capture something new or use the ? guide if you want a quick workflow example.',
    estimate: 'Estimate',
    taskType: 'Task type',
    keepInInbox: 'Keep in inbox',
    moveToToday: 'Move to today',
    moveToLater: 'Move to later',
    unsavedBadge: 'Unsaved',
    notesPlaceholder: 'Definition of done, context, or supporting notes',
    todayButton: 'Today',
    aiTitle: 'AI Inbox Triage',
    aiDescription: 'Turn a rough note into structured tasks with suggested duration, task type, and destination.',
    aiPlaceholder: 'Example: tomorrow prep investor notes, send invoice this week, remember to run at night',
    laterQueue: 'Later Queue',
    laterQueueDescription: 'Tasks that are clarified but not committed to today.',
    laterQueueEmpty: 'Nothing parked for later right now.',
    estimateMinutes: (minutes) => `${minutes} min`,
    taskTypeOptions: { deep: 'deep', shallow: 'shallow', personal: 'personal' },
  },
  today: {
    taskChip: { highlight: 'Highlight', later: 'Later', support: 'Add To Support', schedule: 'Schedule', focus: 'Focus', delete: 'Delete' },
    calendarHeaderEyebrow: 'Deep Work',
    title: 'Today',
    calendarHeaderDescription: 'Switch between the planning board and the calendar without leaving today.',
    planningBoard: 'Planning Board',
    calendar: 'Calendar',
    headerEyebrow: '聚焦今日',
    headerDescription: 'Pick one highlight, support it with at most two tasks, then protect a real focus block.',
    committed: 'Committed',
    highlight: 'Highlight',
    noHighlightChosen: 'Not chosen yet',
    aiPlanTitle: 'AI Daily Plan',
    aiPlanDescription: 'Ask AI to choose one highlight and up to two support tasks from your current commitments.',
    aiPlanPlaceholder: 'Example: help me pick my highlight and two support tasks for today',
    highlightTitle: 'Highlight',
    highlightDescription: 'This is the one task you want today to feel anchored around.',
    doneCount: (count) => `${count} done`,
    startFocus: 'Start Focus',
    restore: 'Restore',
    done: 'Done',
    highlightNotesPlaceholder: 'What does done look like for this highlight?',
    highlightEmpty: 'No highlight yet. Promote one of today\'s tasks, ask AI to suggest one, or open the ? guide for a sample day.',
    supportTasksTitle: 'Support Tasks',
    supportTasksDescription: 'Keep this short. If there are more than two, most of them probably belong later.',
    supportTasksEmpty: 'No support tasks chosen yet.',
    overflowTasksTitle: 'Overflow From Today',
    overflowTasksDescription: 'These tasks are still marked for today, but they are outside the 1+2 commitment and should usually be moved or reduced.',
    overflowTasksEmpty: 'No extra today tasks right now.',
    parkingLotTitle: 'Later Queue',
    parkingLotDescription: 'These tasks are not part of today. Keep them here until you intentionally pull them back in.',
    parkingLotEmpty: 'Nothing is parked for later right now.',
    focusBlock: 'Focus Block',
    currentTask: 'Current task',
    noFocusTaskSelected: 'No focus task selected',
    pause: 'Pause',
    start: 'Start',
    aiFocusTitle: 'AI Focus Guide',
    aiFocusDescription: 'Use AI before a session to tighten the scope and after a session to decide the next move.',
    aiFocusPlaceholder: (taskTitle) => taskTitle ? `Example: define done for ${taskTitle}` : 'Select a focus task first',
    goalContext: 'Goal Context',
    noActiveGoals: 'No active quarterly goals right now.',
    taskTypeLabels: { deep: 'deep', shallow: 'shallow', personal: 'personal' },
    planningStateLabels: { inbox: 'inbox', today: 'today', later: 'later' },
    estimateMinutes: (minutes) => `${minutes} min`,
    goalProgress: (progress) => `${progress}% complete`,
    scheduleDialogTitle: 'Schedule Task',
    scheduleStart: 'Start time',
    scheduleEnd: 'End time',
    scheduleSave: 'Apply schedule',
  },
  review: {
    eyebrow: '复盘',
    title: 'Review',
    description: 'Close the day cleanly, review the week with context, and keep quarterly goals connected to execution.',
    completedToday: 'Completed today',
    needShutdown: 'Need shutdown',
    shutdownTitle: 'Shutdown Ritual',
    shutdownDescription: 'Resolve every remaining today task before you leave: finish it, move it later, or drop it intentionally.',
    shutdownEmpty: 'Today is already closed out. If you want a sample shutdown flow, open the ? guide.',
    highlightBadge: 'highlight',
    estimateMinutes: (minutes) => `${minutes} min`,
    done: 'Done',
    later: 'Later',
    drop: 'Drop',
    weeklyReview: 'Weekly Review',
    weeklyPlan: 'Weekly Plan',
    quarterlyGoals: 'Quarterly Goals',
    advancedAI: 'Advanced AI',
    aiShutdownTitle: 'AI Shutdown Assistant',
    aiShutdownDescription: 'Ask AI to review your unfinished today list and suggest what to finish, defer, or drop.',
    aiShutdownPlaceholder: 'Example: help me close today and draft tomorrow\'s carry-forward list',
    aiNextWeekTitle: 'AI Next Week Draft',
    aiNextWeekDescription: 'Use AI to turn this week\'s review into a short draft of next week\'s priorities.',
    aiNextWeekPlaceholder: 'Example: draft next week\'s top three priorities from this review',
    activeGoals: 'Active Goals',
    noActiveGoals: 'No active quarterly goals.',
    reviewDate: 'Review Date',
    reviewDateDescription: 'Daily shutdown now follows the selected day. Missed days stay here so you can come back and close them later.',
    pendingReviewDates: 'Reviewable Days',
    pendingReviewDatesEmpty: 'No daily review dates yet.',
    selectedDateLabel: 'Selected day',
    pendingCount: (count) => `${count} open`,
    taskTypeLabels: { deep: 'deep', shallow: 'shallow', personal: 'personal' },
    progress: (progress) => `${progress}% progress`,
  },
  aiAssistant: {
    suggestions: [
      'Help me organize one highlight and two support tasks for today.',
      'Review my unfinished tasks and suggest a shutdown ritual.',
      'Draft next week priorities from my current goals and weekly review.',
    ],
  },
};

const zhCN: WorkflowCopy = {
  app: {
    nav: { inbox: '收件箱', today: '今日', review: '复盘' },
    title: 'AI 日程规划',
    description: '先进入收件箱，再选一个重点任务，专注执行，最后干净收尾。',
    guideAriaLabel: '打开工作流说明',
    currentFocus: '当前专注',
    noActiveFocusTask: '暂无正在专注的任务',
    systemState: '系统状态',
    inboxCount: (count) => `收件箱中有 ${count} 项`,
    activeGoals: (count) => `${count} 个进行中的目标`,
  },
  guide: {
    header: '工作流说明',
    title: '新流程，更少负担',
    description: '现在的规划器遵循一条更固定的流程：先捕获，再澄清，少承诺，最后干净收尾。右侧卡片展示的是一个典型示例。',
    typicalExample: '典型示例',
    produced: '最后会得到',
    openInbox: '打开收件箱',
    openToday: '打开今日',
    openReview: '打开复盘',
    back: '上一步',
    next: '下一步',
    gotIt: '知道了',
    steps: [
      {
        id: 'inbox',
        eyebrow: 'GTD 捕获',
        title: '所有新事项先进入收件箱',
        description: '先别急着决定优先级、日期和分类。先记下来，再做一轮轻量澄清。',
        cards: [
          { label: '你输入', text: '明天准备投资人笔记、本周把三月发票发掉、今晚去跑步。' },
          { label: 'AI 建议', text: '拆成 3 个任务，并给出 60 / 15 / 30 分钟预估和今日 / 稍后去向建议。' },
          { label: '你确认', text: '只改真正重要的地方，其余保持轻量，后面还能继续调整。' },
        ],
        outcome: ['准备投资人笔记 -> 60 分钟 / 深度 / 今日', '发送三月发票 -> 15 分钟 / 浅层 / 稍后', '今晚跑步 -> 30 分钟 / 个人 / 稍后'],
      },
      {
        id: 'today',
        eyebrow: 'Make Time + 深度工作',
        title: '今日只保留 1 个重点任务 + 2 个支撑任务',
        description: '目标不是把所有事都塞进今天，而是选出一个让这一天有意义的重点，再配最多两个支撑任务。',
        cards: [
          { label: '你查看', text: '从已经澄清过的任务里，挑出那个最能代表今天产出的事项。' },
          { label: 'AI 建议', text: '推荐 1 个重点任务、2 个支撑任务，以及一个专注时段，而不是直接替你写进日历。' },
          { label: '你确认', text: '只保留真正装得下的内容，其余任务明确放到稍后，不让今天继续膨胀。' },
        ],
        outcome: ['1 个重点任务作为主轴', '最多 2 个支撑任务', '1 个真实的专注块和计时器'],
      },
      {
        id: 'review',
        eyebrow: '收尾仪式',
        title: '离开前把今天收干净',
        description: '今天没做完的任务只能有三种结局：完成、顺延、或放弃。这样明天才会干净。',
        cards: [
          { label: '你查看', text: '例如：完成提案、把发票顺延、删除一个低价值跟进。' },
          { label: 'AI 建议', text: '起草今天的收尾摘要和明天的顺延清单，仍然要等你确认。' },
          { label: '你确认', text: '没有任何任务会在你没确认前被自动移动或自动删除。' },
        ],
        outcome: ['完成 -> 记为今天已完成', '顺延 -> 停到稍后', '放弃 -> 明确归档'],
      },
    ],
  },
  inbox: {
    eyebrow: 'GTD 捕获',
    title: '收件箱',
    description: '先收集，再澄清。所有新事项都先落到这里，再决定是否进入今天。',
    itemsWaiting: '待处理项',
    capturePlaceholder: '记录一个任务、想法或承诺',
    save: '保存',
    clarifyTitle: '澄清收件箱',
    clarifyDescription: '每条任务只补足最少结构：时长、任务类型和下一步去向。',
    empty: '你的收件箱现在是空的。可以先记一条，或者点 ? 看一个快速示例。',
    estimate: '预估时长',
    taskType: '任务类型',
    keepInInbox: '继续留在收件箱',
    moveToToday: '移到今日',
    moveToLater: '移到稍后',
    unsavedBadge: '未保存',
    notesPlaceholder: '完成标准、上下文或补充说明',
    todayButton: '放到今天',
    aiTitle: 'AI 收件箱分拣',
    aiDescription: '把一段模糊输入拆成结构化任务，并给出时长、类型和去向建议。',
    aiPlaceholder: '例如：明天准备投资人笔记、本周发票发掉、晚上记得去跑步',
    laterQueue: '稍后队列',
    laterQueueDescription: '已经澄清，但还不承诺放进今天的任务。',
    laterQueueEmpty: '目前没有停放到稍后的任务。',
    estimateMinutes: (minutes) => `${minutes} 分钟`,
    taskTypeOptions: { deep: '深度', shallow: '浅层', personal: '个人' },
  },
  today: {
    taskChip: { highlight: '设为重点任务', later: '移到稍后', support: '加入支撑任务', schedule: '安排时间', focus: '开始专注', delete: '删除' },
    calendarHeaderEyebrow: '深度工作',
    title: '今日',
    calendarHeaderDescription: '不用离开今日，也能在规划面板和日历视图之间切换。',
    planningBoard: '规划面板',
    calendar: '日历',
    headerEyebrow: 'Make Time',
    headerDescription: '选 1 个重点任务，最多配 2 个支撑任务，然后保护一个真正的专注块。',
    committed: '已承诺',
    highlight: '重点任务',
    noHighlightChosen: '还没选定',
    aiPlanTitle: 'AI 今日定盘',
    aiPlanDescription: '让 AI 从当前任务里推荐 1 个重点任务和最多 2 个支撑任务。',
    aiPlanPlaceholder: '例如：帮我从今天的事项里选出一个重点任务和两个支撑任务',
    highlightTitle: '重点任务',
    highlightDescription: '这是今天最该成为主轴的那件事。',
    doneCount: (count) => `已完成 ${count} 项`,
    startFocus: '开始专注',
    restore: '恢复',
    done: '完成',
    highlightNotesPlaceholder: '这个重点任务的完成标准是什么？',
    highlightEmpty: '还没有重点任务。你可以从今天的任务里提一个上来、让 AI 推荐一个，或者点 ? 看一个样例日。',
    supportTasksTitle: '支撑任务',
    supportTasksDescription: '这里要尽量短。如果超过两个，说明大部分任务其实应该移到稍后。',
    supportTasksEmpty: '还没有选定支撑任务。',
    overflowTasksTitle: '今日溢出',
    overflowTasksDescription: '这些任务仍然挂在今天，但已经不属于 1+2 承诺，通常应该被下调、顺延或删减。',
    overflowTasksEmpty: '目前没有超出今日承诺的任务。',
    parkingLotTitle: '稍后处理',
    parkingLotDescription: '这里的任务不算今天的任务，只是暂时停放，等你明确再拉回今天。',
    parkingLotEmpty: '目前没有停放到稍后的任务。',
    focusBlock: '专注块',
    currentTask: '当前任务',
    noFocusTaskSelected: '还没有选择专注任务',
    pause: '暂停',
    start: '开始',
    aiFocusTitle: 'AI 专注护航',
    aiFocusDescription: '专注前让 AI 收窄范围，专注后让 AI 帮你决定下一步。',
    aiFocusPlaceholder: (taskTitle) => taskTitle ? `例如：帮我定义 ${taskTitle} 这一轮的完成标准` : '请先选择一个专注任务',
    goalContext: '目标关联',
    noActiveGoals: '当前没有进行中的季度目标。',
    taskTypeLabels: { deep: '深度', shallow: '浅层', personal: '个人' },
    planningStateLabels: { inbox: '收件箱', today: '今日', later: '稍后' },
    estimateMinutes: (minutes) => `${minutes} 分钟`,
    goalProgress: (progress) => `${progress}% 完成`,
    scheduleDialogTitle: '安排任务时间',
    scheduleStart: '开始时间',
    scheduleEnd: '结束时间',
    scheduleSave: '确认安排',
  },
  review: {
    eyebrow: 'Reflect',
    title: '复盘',
    description: '把今天收干净，再带着上下文回顾本周，让季度目标继续和执行保持连接。',
    completedToday: '今日已完成',
    needShutdown: '待收尾',
    shutdownTitle: '收尾仪式',
    shutdownDescription: '离开前，把所有剩余的今日任务处理干净：完成、顺延，或者主动放弃。',
    shutdownEmpty: '今天已经收尾完成。如果想看一个典型收尾示例，可以点 ?。',
    highlightBadge: '重点任务',
    estimateMinutes: (minutes) => `${minutes} 分钟`,
    done: '完成',
    later: '顺延',
    drop: '放弃',
    weeklyReview: '周复盘',
    weeklyPlan: '周计划',
    quarterlyGoals: '季度目标',
    advancedAI: '高级 AI',
    aiShutdownTitle: 'AI 收尾助手',
    aiShutdownDescription: '让 AI 看看你今天没做完的任务，并建议哪些该完成、顺延或删除。',
    aiShutdownPlaceholder: '例如：帮我把今天收尾，并起草明天的顺延清单',
    aiNextWeekTitle: 'AI 下周重点草案',
    aiNextWeekDescription: '让 AI 基于本周复盘，起草下周的重点方向。',
    aiNextWeekPlaceholder: '例如：基于这次复盘，起草下周 3 个重点',
    activeGoals: '进行中的目标',
    noActiveGoals: '当前没有进行中的季度目标。',
    reviewDate: '复盘日期',
    reviewDateDescription: '每日收尾现在只跟随所选日期。漏掉的日子会继续留在这里，之后也能回来补复盘。',
    pendingReviewDates: '待复盘日期',
    pendingReviewDatesEmpty: '暂时还没有可复盘的日期。',
    selectedDateLabel: '当前查看',
    pendingCount: (count) => `待收尾 ${count} 项`,
    taskTypeLabels: { deep: '深度', shallow: '浅层', personal: '个人' },
    progress: (progress) => `${progress}% 进度`,
  },
  aiAssistant: {
    suggestions: [
      '帮我从今天的任务里整理出 1 个重点任务和 2 个支撑任务。',
      '帮我检查今天没做完的任务，并建议一个收尾流程。',
      '根据我当前的目标和本周复盘，起草下周重点。',
    ],
  },
};

const de: WorkflowCopy = {
  app: {
    nav: { inbox: 'Inbox', today: 'Heute', review: 'Rückblick' },
    title: 'AI Daily Planner',
    description: 'Erst in den Inbox, dann ein Highlight wählen, fokussiert ausführen und den Tag sauber abschließen.',
    guideAriaLabel: 'Workflow-Hilfe öffnen',
    currentFocus: 'Aktueller Fokus',
    noActiveFocusTask: 'Keine aktive Fokus-Aufgabe',
    systemState: 'Systemstatus',
    inboxCount: (count) => `${count} im Inbox`,
    activeGoals: (count) => `${count} aktive Ziele`,
  },
  guide: {
    header: 'Workflow-Hilfe',
    title: 'Neuer Ablauf, weniger Overhead',
    description: 'Der Planer folgt jetzt einem geführten Ablauf: erfassen, klären, weniger zusagen und den Tag sauber abschließen. Die Karten rechts zeigen ein typisches Beispiel.',
    typicalExample: 'Typisches Beispiel',
    produced: 'Das entsteht daraus',
    openInbox: 'Inbox öffnen',
    openToday: 'Heute öffnen',
    openReview: 'Rückblick öffnen',
    back: 'Zurück',
    next: 'Weiter',
    gotIt: 'Verstanden',
    steps: en.guide.steps,
  },
  inbox: {
    eyebrow: 'GTD Capture',
    title: 'Inbox',
    description: 'Erst erfassen, dann klären. Alles Neue landet hier, bevor es mit heute konkurriert.',
    itemsWaiting: 'Wartende Einträge',
    capturePlaceholder: 'Eine Aufgabe, Idee oder Verpflichtung erfassen',
    save: 'Speichern',
    clarifyTitle: 'Inbox klären',
    clarifyDescription: 'Gib jedem Eintrag nur genug Struktur: Dauer, Aufgabentyp und nächstes Ziel.',
    empty: 'Dein Inbox ist leer. Erfasse etwas Neues oder nutze die ?-Hilfe für ein kurzes Beispiel.',
    estimate: 'Schätzung',
    taskType: 'Aufgabentyp',
    keepInInbox: 'Im Inbox lassen',
    moveToToday: 'Nach Heute verschieben',
    moveToLater: 'Nach Später verschieben',
    unsavedBadge: 'Ungespeichert',
    notesPlaceholder: 'Done-Kriterien, Kontext oder Notizen',
    todayButton: 'Heute',
    aiTitle: 'KI Inbox-Triage',
    aiDescription: 'Mache aus einer groben Notiz strukturierte Aufgaben mit Dauer-, Typ- und Zielvorschlägen.',
    aiPlaceholder: 'Beispiel: morgen Investorennotizen vorbereiten, Rechnung diese Woche senden, heute Abend laufen',
    laterQueue: 'Später-Liste',
    laterQueueDescription: 'Geklärte Aufgaben, die noch nicht für heute zugesagt sind.',
    laterQueueEmpty: 'Aktuell ist nichts für später geparkt.',
    estimateMinutes: (minutes) => `${minutes} Min`,
    taskTypeOptions: { deep: 'tief', shallow: 'leicht', personal: 'persönlich' },
  },
  today: {
    taskChip: { highlight: 'Highlight', later: 'Später', support: 'Zu Support', schedule: 'Planen', focus: 'Fokus', delete: 'Löschen' },
    calendarHeaderEyebrow: 'Deep Work',
    title: 'Heute',
    calendarHeaderDescription: 'Zwischen Planungsboard und Kalender wechseln, ohne Heute zu verlassen.',
    planningBoard: 'Planungsboard',
    calendar: 'Kalender',
    headerEyebrow: 'Make Time',
    headerDescription: 'Wähle ein Highlight, höchstens zwei Unterstützungsaufgaben und schütze einen echten Fokusblock.',
    committed: 'Zugesagt',
    highlight: 'Highlight',
    noHighlightChosen: 'Noch nicht gewählt',
    aiPlanTitle: 'KI Tagesplan',
    aiPlanDescription: 'Lass die KI ein Highlight und bis zu zwei Unterstützungsaufgaben aus deinen aktuellen Zusagen wählen.',
    aiPlanPlaceholder: 'Beispiel: hilf mir, mein Highlight und zwei Support Tasks für heute zu wählen',
    highlightTitle: 'Highlight',
    highlightDescription: 'Diese eine Aufgabe soll den Tag tragen.',
    doneCount: (count) => `${count} erledigt`,
    startFocus: 'Fokus starten',
    restore: 'Wiederherstellen',
    done: 'Erledigt',
    highlightNotesPlaceholder: 'Woran erkennst du, dass dieses Highlight fertig ist?',
    highlightEmpty: 'Noch kein Highlight. Hebe eine Aufgabe hervor, lass die KI eine vorschlagen oder öffne die ?-Hilfe.',
    supportTasksTitle: 'Support Tasks',
    supportTasksDescription: 'Halte diese Liste kurz. Mehr als zwei gehören meist eher in später.',
    supportTasksEmpty: 'Noch keine Unterstützungsaufgaben gewählt.',
    overflowTasksTitle: 'Überhang von heute',
    overflowTasksDescription: 'Diese Aufgaben sind noch für heute markiert, gehören aber nicht mehr zur 1+2-Zusage und sollten meist reduziert oder verschoben werden.',
    overflowTasksEmpty: 'Aktuell gibt es keinen heutigen Überhang.',
    parkingLotTitle: 'Später-Liste',
    parkingLotDescription: 'Diese Aufgaben zählen nicht zu heute. Sie bleiben hier, bis du sie bewusst zurückholst.',
    parkingLotEmpty: 'Aktuell ist nichts für später geparkt.',
    focusBlock: 'Fokusblock',
    currentTask: 'Aktuelle Aufgabe',
    noFocusTaskSelected: 'Keine Fokus-Aufgabe gewählt',
    pause: 'Pause',
    start: 'Start',
    aiFocusTitle: 'KI Fokus-Hilfe',
    aiFocusDescription: 'Nutze die KI vor einer Session zum Schärfen und danach für den nächsten Schritt.',
    aiFocusPlaceholder: (taskTitle) => taskTitle ? `Beispiel: definiere Done für ${taskTitle}` : 'Wähle zuerst eine Fokus-Aufgabe',
    goalContext: 'Zielkontext',
    noActiveGoals: 'Aktuell keine aktiven Quartalsziele.',
    taskTypeLabels: { deep: 'tief', shallow: 'leicht', personal: 'persönlich' },
    planningStateLabels: { inbox: 'Inbox', today: 'Heute', later: 'Später' },
    estimateMinutes: (minutes) => `${minutes} Min`,
    goalProgress: (progress) => `${progress}% fertig`,
    scheduleDialogTitle: 'Aufgabe planen',
    scheduleStart: 'Startzeit',
    scheduleEnd: 'Endzeit',
    scheduleSave: 'Planung übernehmen',
  },
  review: {
    eyebrow: 'Reflektieren',
    title: 'Rückblick',
    description: 'Schließe den Tag sauber ab, prüfe die Woche im Kontext und halte Quartalsziele mit der Ausführung verbunden.',
    completedToday: 'Heute erledigt',
    needShutdown: 'Noch offen',
    shutdownTitle: 'Shutdown-Ritual',
    shutdownDescription: 'Behandle jede verbleibende Aufgabe von heute bewusst: erledigen, verschieben oder streichen.',
    shutdownEmpty: 'Heute ist bereits sauber abgeschlossen. Für ein Beispiel öffne die ?-Hilfe.',
    highlightBadge: 'Highlight',
    estimateMinutes: (minutes) => `${minutes} Min`,
    done: 'Erledigt',
    later: 'Später',
    drop: 'Streichen',
    weeklyReview: 'Wochenrückblick',
    weeklyPlan: 'Wochenplan',
    quarterlyGoals: 'Quartalsziele',
    advancedAI: 'Erweiterte KI',
    aiShutdownTitle: 'KI Shutdown-Assistent',
    aiShutdownDescription: 'Lass die KI deine offenen Aufgaben prüfen und Vorschläge zum Abschließen, Verschieben oder Streichen machen.',
    aiShutdownPlaceholder: 'Beispiel: hilf mir beim Tagesabschluss und entwirf die Überträge für morgen',
    aiNextWeekTitle: 'KI Entwurf für nächste Woche',
    aiNextWeekDescription: 'Nutze die KI, um aus diesem Rückblick einen kurzen Prioritätenentwurf für nächste Woche zu machen.',
    aiNextWeekPlaceholder: 'Beispiel: entwirf die drei wichtigsten Prioritäten für nächste Woche',
    activeGoals: 'Aktive Ziele',
    noActiveGoals: 'Keine aktiven Quartalsziele.',
    reviewDate: 'Rückblick-Datum',
    reviewDateDescription: 'Der Tagesabschluss folgt jetzt dem gewählten Tag. Vergessene Tage bleiben hier erhalten, damit du sie später nachholen kannst.',
    pendingReviewDates: 'Prüfbare Tage',
    pendingReviewDatesEmpty: 'Noch keine Tage für den Tagesabschluss vorhanden.',
    selectedDateLabel: 'Ausgewählter Tag',
    pendingCount: (count) => `${count} offen`,
    taskTypeLabels: { deep: 'tief', shallow: 'leicht', personal: 'persönlich' },
    progress: (progress) => `${progress}% Fortschritt`,
  },
  aiAssistant: {
    suggestions: [
      'Hilf mir, ein Highlight und zwei Support Tasks für heute zu wählen.',
      'Prüfe meine unerledigten Aufgaben und schlage ein Shutdown-Ritual vor.',
      'Entwirf Prioritäten für nächste Woche aus meinen aktuellen Zielen und dem Wochenrückblick.',
    ],
  },
};

const workflowCopies: Record<AppLocale, WorkflowCopy> = {
  'zh-CN': zhCN,
  en,
  de,
};

export const getWorkflowCopy = (locale: AppLocale): WorkflowCopy => workflowCopies[locale] ?? en;
