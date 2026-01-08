import React, { useMemo, useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Settings2,
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Check,
  Clock,
  Layers,
  Repeat
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { format, parseISO, addDays, differenceInMinutes, addMinutes, getDay, getDate } from 'date-fns';
import { Task, RecurrenceType } from '../types';
import { isWorkday, isHoliday } from '../utils/holidays';

const DailyPlanner: React.FC = () => {
  const { tasks, addTask, updateTask, deleteTask, groups, addGroup, deleteGroup } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterGroupId, setFilterGroupId] = useState<string>('all');
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#0f766e');

  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || 'work');
  
  // 循环日程状态
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [excludeHolidays, setExcludeHolidays] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  const toMinutes = (timeValue: string) => {
    const [h, m] = timeValue.split(':').map(Number);
    return h * 60 + m;
  };

  const toTimeString = (minutes: number) => {
    const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!hasTime) return;
    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);
    if (endMin <= startMin) {
      setEndTime(toTimeString(startMin + 60));
    }
  }, [hasTime, startTime, endTime]);

  useEffect(() => {
    if (!groups.find(g => g.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?.id || 'work');
    }
  }, [groups, selectedGroupId]);

  // 判断循环任务是否应该在指定日期显示
  const shouldShowRecurringTask = React.useCallback((task: Task, targetDate: string) => {
    if (!task.recurrence || task.recurrence.type === 'none') return false;
    
    // 循环任务的原始开始日期必须在目标日期之前或当天
    if (task.date > targetDate) return false;
    
    // 检查结束日期
    if (task.recurrence.endDate && targetDate > task.recurrence.endDate) return false;

    // 检查是否被例外实例覆盖
    const isOverridden = tasks.some(t => t.parentTaskId === task.id && t.originalDate === targetDate);
    if (isOverridden) return false;

    const targetDateObj = parseISO(targetDate);

    // 检查节假日排除
    if (task.recurrence.excludeHolidays && isHoliday(targetDate)) return false;

    switch (task.recurrence.type) {
      case 'daily':
        return true;
      case 'weekly':
        return getDay(parseISO(task.date)) === getDay(targetDateObj);
      case 'monthly':
        return getDate(parseISO(task.date)) === getDate(targetDateObj);
      case 'workdays':
        return isWorkday(targetDate);
      default:
        return false;
    }
  }, [tasks]);

  // 核心逻辑：获取当日任务列表（包含具体的当日任务 + 符合条件的循环任务投影）
  const dayTasks = useMemo(() => {
    // 1. 获取明确指定日期的任务 (包括普通任务和循环任务的例外实例)
    const exactTasks = tasks.filter(t => t.date === selectedDate);
    
    // 2. 获取所有循环主任务，并筛选出在当天生效的
    const recurringTasks = tasks.filter(t => 
      t.id && // type check
      t.recurrence && 
      t.recurrence.type !== 'none' &&
      shouldShowRecurringTask(t, selectedDate)
    );

    // 3. 合并列表
    return [...exactTasks, ...recurringTasks];
  }, [tasks, selectedDate, shouldShowRecurringTask]);

  const filteredTasks = dayTasks.filter(t => {
    const matchesGroup = filterGroupId === 'all' || t.groupId === filterGroupId;
    const matchesQuery = !searchQuery.trim() || [t.title, t.description].some(field => field?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompletion = showCompleted ? true : !t.isCompleted;
    return matchesGroup && matchesQuery && matchesCompletion;
  });

  const timedTasks = [...filteredTasks]
    .filter(t => t.hasTime && t.startTime)
    .sort((a, b) => {
       // 处理循环任务投影的时间比较：需要将 ISO 时间中的日期部分替换为 selectedDate 才能正确排序
       const getTaskTime = (task: Task) => {
         if (!task.startTime) return 0;
         if (task.date === selectedDate) return parseISO(task.startTime).getTime();
         // 这是一个循环任务投影，我们需要构造当天的比较时间
         const timePart = format(parseISO(task.startTime), 'HH:mm:ss');
         return parseISO(`${selectedDate}T${timePart}`).getTime();
       };
       return getTaskTime(a) - getTaskTime(b);
    });
    
  const floatingTasks = filteredTasks.filter(t => !t.hasTime);

  const dayStats = useMemo(() => {
    const completed = dayTasks.filter(t => t.isCompleted).length;
    const total = dayTasks.length;
    const scheduledMinutes = dayTasks.reduce((acc, task) => {
      if (!task.hasTime || !task.startTime) return acc;
      const start = parseISO(task.startTime);
      const end = task.endTime ? parseISO(task.endTime) : addMinutes(start, 60);
      return acc + Math.max(0, differenceInMinutes(end, start));
    }, 0);
    return {
      completed,
      total,
      hours: Math.round((scheduledMinutes / 60) * 10) / 10,
    };
  }, [dayTasks]);

  const changeDate = (delta: number) => {
    const next = addDays(parseISO(selectedDate), delta);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  const resetForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setHasTime(false);
    setStartTime('09:00');
    setEndTime('10:00');
    setRecurrenceType('none');
    setExcludeHolidays(false);
    setEditingTaskId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const baseDate = parseISO(selectedDate);
    let startISO = undefined;
    let endISO = undefined;

    if (hasTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startDate = new Date(new Date(baseDate).setHours(sh, sm, 0, 0));
      let endDate = new Date(new Date(baseDate).setHours(eh, em, 0, 0));
      if (endDate <= startDate) {
        endDate = addMinutes(startDate, 60);
      }
      startISO = startDate.toISOString();
      endISO = endDate.toISOString();
    }

    if (editingTaskId) {
      // 检查是否是编辑循环任务的投影（即 parentTaskId 还是原始 ID？）
      // 目前简化逻辑：如果是在列表点击编辑，我们会传入该任务的 ID。
      // 如果它是循环任务的主体，修改它会影响所有实例。
      // TODO: 未来可以提示用户“仅修改当前”还是“修改所有后续”。
      // 目前默认：如果编辑的是循环任务本身，则修改规则。
      updateTask(editingTaskId, {
        title: newTaskTitle,
        description: newTaskDescription,
        date: selectedDate,
        hasTime,
        startTime: startISO,
        endTime: endISO,
        groupId: selectedGroupId,
        updatedAt: new Date().toISOString(),
        recurrence: {
          type: recurrenceType,
          excludeHolidays
        }
      });
    } else {
      addTask({
        id: crypto.randomUUID(),
        title: newTaskTitle,
        description: newTaskDescription,
        date: selectedDate,
        hasTime,
        isCompleted: false,
        startTime: startISO,
        endTime: endISO,
        groupId: selectedGroupId,
        tagIds: [],
        pomodoroCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: {
          type: recurrenceType,
          excludeHolidays
        }
      });
    }
    resetForm();
    setIsAdding(false);
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description || '');
    setHasTime(task.hasTime);
    if (task.hasTime && task.startTime) {
      // 处理跨天显示时的时间提取
      const datePart = task.date === selectedDate ? task.startTime : `${selectedDate}T${format(parseISO(task.startTime), 'HH:mm:ss')}`;
      setStartTime(format(parseISO(datePart), 'HH:mm'));
      
      if (task.endTime) {
         const endDatePart = task.date === selectedDate ? task.endTime : `${selectedDate}T${format(parseISO(task.endTime), 'HH:mm:ss')}`;
         setEndTime(format(parseISO(endDatePart), 'HH:mm'));
      } else {
         setEndTime('10:00');
      }
    }
    setSelectedGroupId(task.groupId);
    // 加载循环设置
    setRecurrenceType(task.recurrence?.type || 'none');
    setExcludeHolidays(task.recurrence?.excludeHolidays || false);
    
    setIsAdding(true);
  };

  const handleTaskCompletion = (task: Task) => {
    // 如果是循环任务的投影（即当前显示的 task 是主任务，但 date 不是 selectedDate）
    // 我们需要创建一个新的“例外实例”来标记这一天的完成状态
    if (task.recurrence && task.recurrence.type !== 'none' && task.date !== selectedDate) {
      // 创建例外实例
      addTask({
        ...task,
        id: crypto.randomUUID(),
        date: selectedDate, // 锁定到今天
        isCompleted: !task.isCompleted, // 切换状态
        parentTaskId: task.id, // 关联父任务
        originalDate: selectedDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recurrence: undefined // 实例本身不再循环
      });
    } else {
      // 普通任务或已经是例外实例，直接更新
      updateTask(task.id, { isCompleted: !task.isCompleted });
    }
  };

  const renderTaskCard = (task: Task) => {
    const group = groups.find(g => g.id === task.groupId);
    const start = task.startTime ? format(parseISO(task.startTime), 'HH:mm') : null;
    const end = task.endTime ? format(parseISO(task.endTime), 'HH:mm') : null;
    
    // 检查是否是循环任务投影
    const isRecurringProjection = task.recurrence && task.recurrence.type !== 'none' && task.date !== selectedDate;
    
    return (
      <div key={task.id} className={cn("group flex items-start gap-3 rounded-2xl border bg-white/80 p-4 shadow-sm transition-all hover:shadow-md", isRecurringProjection ? "border-primary/20 bg-primary/5" : "border-white/60")}>
        <button onClick={() => handleTaskCompletion(task)} className="mt-1">
          {task.isCompleted ? <CheckCircle2 className="text-secondary" size={20} /> : <Circle size={20} className="text-slate-300" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: group?.color }} />
            <span className={cn("text-sm font-semibold truncate", task.isCompleted && "line-through text-slate-400")}>{task.title}</span>
            {task.hasTime && start && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                <Clock size={12} /> {start}{end ? ` - ${end}` : ''}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400">
            <Layers size={12} /> {group?.name || '未分类'}
            {task.recurrence && task.recurrence.type !== 'none' && (
              <span className="flex items-center gap-0.5 ml-2 text-primary/60" title="循环任务">
                <Repeat size={10} /> 
                {task.recurrence.type === 'daily' ? '每天' : 
                 task.recurrence.type === 'weekly' ? '每周' : 
                 task.recurrence.type === 'monthly' ? '每月' : 
                 task.recurrence.type === 'workdays' ? '工作日' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => startEdit(task)} className="p-1 text-slate-400 hover:text-primary">
            <Edit2 size={14} />
          </button>
          <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/60 bg-white/70 shadow-[var(--shadow-soft)] p-4 backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => changeDate(-1)} className="p-2 rounded-xl hover:bg-white/80 border border-transparent hover:border-slate-200">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-slate-200">
              <CalendarIcon size={16} className="text-primary" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="outline-none text-sm font-medium bg-transparent" />
            </div>
            <button onClick={() => changeDate(1)} className="p-2 rounded-xl hover:bg-white/80 border border-transparent hover:border-slate-200">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))} className="px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary border border-slate-200 bg-white/70">
              今天
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索任务或描述"
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-sm outline-none"
              />
            </div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={cn(
                "px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-widest",
                showCompleted ? "border-slate-200 bg-white/80 text-slate-500" : "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              {showCompleted ? '显示完成' : '隐藏完成'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setFilterGroupId('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              filterGroupId === 'all'
                ? "bg-primary text-white border-primary"
                : "bg-white border-slate-200 text-slate-500"
            )}
          >
            全部
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setFilterGroupId(g.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                filterGroupId === g.id ? "text-white" : "bg-white border-slate-200 text-slate-500"
              )}
              style={filterGroupId === g.id ? { backgroundColor: g.color, borderColor: g.color } : {}}
            >
              {g.name}
            </button>
          ))}
          <button onClick={() => setShowGroupManager(!showGroupManager)} className="p-2 text-slate-400 hover:text-primary">
            <Settings2 size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">今日完成</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{dayStats.completed} / {dayStats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">计划时长</p>
            <p className="text-xl font-bold text-secondary mt-1">{dayStats.hours} 小时</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400">快速状态</p>
            <p className="text-sm font-semibold text-slate-600 mt-1">{showCompleted ? '显示完成任务' : '专注未完成任务'}</p>
          </div>
        </div>
      </section>

      {showGroupManager && (
        <div className="bg-white/80 p-4 rounded-2xl border border-white/60 shadow-[var(--shadow-soft)] backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2">
            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="新分类名称" className="flex-1 p-2 rounded-xl border border-slate-200 text-sm" />
            <input type="color" value={newGroupColor} onChange={e => setNewGroupColor(e.target.value)} className="w-10 h-10 rounded-xl border cursor-pointer" />
            <button
              onClick={() => {
                if (newGroupName.trim()) {
                  addGroup({ id: crypto.randomUUID(), name: newGroupName.trim(), color: newGroupColor });
                  setNewGroupName('');
                }
              }}
              className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-1"
            >
              <Plus size={14} /> 添加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                <span>{g.name}</span>
                <button onClick={() => deleteGroup(g.id)} className="text-slate-300 hover:text-red-500"><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdding ? (
        <form onSubmit={handleSubmit} className="bg-white/80 p-4 rounded-2xl border border-primary/20 shadow-[var(--shadow-soft)] space-y-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">{editingTaskId ? '编辑任务' : '新建任务'}</h3>
            <button type="button" onClick={() => { resetForm(); setIsAdding(false); }} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <input autoFocus type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="输入任务名称..." className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/40" />
          <textarea value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="补充说明（可选）" rows={3} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/40" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-slate-600 font-medium">
                <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} className="rounded text-primary focus:ring-primary" /> 
                <Clock size={16} /> 设定时间
              </label>
              {hasTime && (
                <div className="flex items-center gap-2 pl-6">
                  <input type="time" value={startTime} step={900} onChange={e => setStartTime(e.target.value)} className="border border-slate-200 bg-white/80 p-2 rounded-xl text-sm" />
                  <span className="text-slate-400">-</span>
                  <input type="time" value={endTime} step={900} min={startTime} onChange={e => setEndTime(e.target.value)} className="border border-slate-200 bg-white/80 p-2 rounded-xl text-sm" />
                </div>
              )}
            </div>

            <div className="space-y-3">
               <label className="flex items-center gap-2 text-slate-600 font-medium">
                 <Repeat size={16} /> 循环设置
               </label>
               <div className="flex items-center gap-2 pl-6">
                 <select value={recurrenceType} onChange={e => setRecurrenceType(e.target.value as RecurrenceType)} className="p-2 rounded-xl border border-slate-200 bg-white/80 text-xs w-full">
                   <option value="none">不循环</option>
                   <option value="daily">每天</option>
                   <option value="workdays">工作日 (周一至周五 + 调休)</option>
                   <option value="weekly">每周 (周{['日','一','二','三','四','五','六'][new Date(selectedDate).getDay()]})</option>
                   <option value="monthly">每月 ({new Date(selectedDate).getDate()}日)</option>
                 </select>
               </div>
               {recurrenceType !== 'none' && (
                 <label className="flex items-center gap-2 text-xs text-slate-500 pl-6 cursor-pointer">
                   <input type="checkbox" checked={excludeHolidays} onChange={e => setExcludeHolidays(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                   跳过法定节假日
                 </label>
               )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
             <div className="flex items-center gap-2">
               <Layers size={16} className="text-slate-400" />
               <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="p-2 rounded-xl border border-slate-200 text-sm bg-white/80">
                 {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
               </select>
             </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { resetForm(); setIsAdding(false); }} className="px-3 py-2 text-slate-500 text-sm hover:bg-slate-100 rounded-xl transition-colors">取消</button>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20">
                <Check size={16} /> 保存
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button onClick={() => { setIsAdding(true); setEditingTaskId(null); }} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-primary hover:text-primary transition-all text-sm font-medium flex items-center justify-center gap-2 group">
          <div className="p-1 rounded-full bg-slate-100 group-hover:bg-primary/10 transition-colors">
            <Plus size={16} /> 
          </div>
          添加新任务
        </button>
      )}

      <div className="space-y-4">
        {timedTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
              <Clock size={14} /> 已排期任务
            </div>
            {timedTasks.map(renderTaskCard)}
          </div>
        )}

        {floatingTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
              <Layers size={14} /> 待安排任务
            </div>
            {floatingTasks.map(renderTaskCard)}
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <CalendarIcon size={32} className="text-slate-200 mb-2" />
            <p>今天还没有任务</p>
            <p className="text-xs">点击上方“添加新任务”来规划这一天吧</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyPlanner;