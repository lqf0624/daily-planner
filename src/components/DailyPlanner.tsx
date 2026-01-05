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
  Layers
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { format, parseISO, addDays, differenceInMinutes, addMinutes } from 'date-fns';

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

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const filteredTasks = dayTasks.filter(t => {
    const matchesGroup = filterGroupId === 'all' || t.groupId === filterGroupId;
    const matchesQuery = !searchQuery.trim() || [t.title, t.description].some(field => field?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompletion = showCompleted ? true : !t.isCompleted;
    return matchesGroup && matchesQuery && matchesCompletion;
  });

  const timedTasks = [...filteredTasks]
    .filter(t => t.hasTime && t.startTime)
    .sort((a, b) => parseISO(a.startTime!).getTime() - parseISO(b.startTime!).getTime());
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
      updateTask(editingTaskId, {
        title: newTaskTitle,
        description: newTaskDescription,
        date: selectedDate,
        hasTime,
        startTime: startISO,
        endTime: endISO,
        groupId: selectedGroupId,
        updatedAt: new Date().toISOString(),
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
      });
    }
    resetForm();
    setIsAdding(false);
  };

  const startEdit = (task: any) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description || '');
    setHasTime(task.hasTime);
    if (task.hasTime && task.startTime) {
      setStartTime(format(parseISO(task.startTime), 'HH:mm'));
      setEndTime(task.endTime ? format(parseISO(task.endTime), 'HH:mm') : '10:00');
    }
    setSelectedGroupId(task.groupId);
    setIsAdding(true);
  };

  const renderTaskCard = (task: any) => {
    const group = groups.find(g => g.id === task.groupId);
    const start = task.startTime ? format(parseISO(task.startTime), 'HH:mm') : null;
    const end = task.endTime ? format(parseISO(task.endTime), 'HH:mm') : null;
    return (
      <div key={task.id} className="group flex items-start gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm transition-all hover:shadow-md">
        <button onClick={() => updateTask(task.id, { isCompleted: !task.isCompleted })} className="mt-1">
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
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} /> 设定时间
            </label>
            {hasTime && (
              <div className="flex items-center gap-2">
                <input type="time" value={startTime} step={900} onChange={e => setStartTime(e.target.value)} className="border border-slate-200 bg-white/80 p-2 rounded-xl text-sm" />
                <span>-</span>
                <input type="time" value={endTime} step={900} min={startTime} onChange={e => setEndTime(e.target.value)} className="border border-slate-200 bg-white/80 p-2 rounded-xl text-sm" />
              </div>
            )}
            <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="p-2 rounded-xl border text-xs">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { resetForm(); setIsAdding(false); }} className="px-3 py-2 text-slate-500 text-sm">取消</button>
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2">
              <Check size={16} /> 保存
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => { setIsAdding(true); setEditingTaskId(null); }} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-primary hover:text-primary transition-all text-sm font-medium flex items-center justify-center gap-2">
          <Plus size={16} /> 添加任务
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
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            今天还没有任务，先来安排一件重要的事吧。
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyPlanner;
