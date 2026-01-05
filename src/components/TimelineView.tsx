import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  format,
  startOfDay,
  addHours,
  parseISO,
  differenceInMinutes,
  addMinutes,
  isSameDay,
  setHours,
  setMinutes,
  addDays,
} from 'date-fns';
import { cn } from '../utils/cn';
import { Crosshair, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, ListTodo } from 'lucide-react';
import { Task } from '../types';

const NORMAL_HEIGHT = 80;
const COMPACT_HEIGHT = 30;
const INACTIVE_HOURS = [0, 1, 2, 3, 4, 5, 6, 23]; // 00:00 - 06:59 & 23:00 - 23:59
const SNAP_MINUTES = 15;

type TimelineTask = Task & {
  startDate: Date;
  endDate: Date;
};

const TimelineView: React.FC = () => {
  const { tasks, groups, updateTask, addTask } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [now, setNow] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState('');
  const [quickGroupId, setQuickGroupId] = useState(groups[0]?.id || 'work');
  const [quickStartTime, setQuickStartTime] = useState('09:00');
  const [quickEndTime, setQuickEndTime] = useState('10:00');
  const [scheduleTaskId, setScheduleTaskId] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');

  const dayBase = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const isToday = isSameDay(dayBase, now);
  const scrollToRelevantTimeRef = useRef<(smooth?: boolean) => void>(() => {});

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!groups.find(g => g.id === quickGroupId)) {
      setQuickGroupId(groups[0]?.id || 'work');
    }
  }, [groups, quickGroupId]);

  const resolveTime = useCallback((timeValue?: string) => {
    if (!timeValue) return null;
    if (/^\d{2}:\d{2}/.test(timeValue)) {
      const [h, m] = timeValue.split(':').map(Number);
      return setMinutes(setHours(startOfDay(dayBase), h), m);
    }
    const parsed = parseISO(timeValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, [dayBase]);

  const timelineTasks = useMemo(() => {
    return tasks
      .filter(t => t.hasTime && t.startTime && t.date === selectedDate)
      .map((task) => {
        const startDate = resolveTime(task.startTime);
        if (!startDate) return null;
        const rawEnd = resolveTime(task.endTime);
        const endDate = rawEnd && rawEnd > startDate ? rawEnd : addMinutes(startDate, 60);
        return { ...task, startDate, endDate };
      })
      .filter((task): task is TimelineTask => Boolean(task))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [tasks, selectedDate, resolveTime]);

  const unscheduledTasks = useMemo(
    () => tasks.filter(t => t.date === selectedDate && !t.hasTime),
    [tasks, selectedDate]
  );

  useEffect(() => {
    if (unscheduledTasks.length === 0) {
      setScheduleTaskId('');
      return;
    }
    if (!unscheduledTasks.some(t => t.id === scheduleTaskId)) {
      setScheduleTaskId(unscheduledTasks[0].id);
    }
  }, [unscheduledTasks, scheduleTaskId]);

  useEffect(() => {
    if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
      const rounded = getRoundedTime(new Date());
      setQuickStartTime(rounded);
      setQuickEndTime(getOffsetTime(rounded, 60));
      setScheduleStartTime(rounded);
      return;
    }
    setQuickStartTime('09:00');
    setQuickEndTime('10:00');
    setScheduleStartTime('09:00');
  }, [selectedDate]);

  useEffect(() => {
    const startMin = toMinutes(quickStartTime);
    const endMin = toMinutes(quickEndTime);
    if (endMin <= startMin) {
      setQuickEndTime(toTimeString(startMin + 60));
    }
  }, [quickStartTime, quickEndTime]);

  // 1. Calculate variable hour heights based on activity
  const { hourHeights, hourOffsets } = useMemo(() => {
    const heights = new Array(24).fill(0).map((_, h) => {
        const hourStart = setHours(startOfDay(dayBase), h);
        const hourEnd = addHours(hourStart, 1);
        
        // Check if any task overlaps with this hour
        const hasTask = timelineTasks.some(t => t.startDate < hourEnd && t.endDate > hourStart);
        
        // Compact if inactive hour AND no task
        if (INACTIVE_HOURS.includes(h) && !hasTask) return COMPACT_HEIGHT;
        return NORMAL_HEIGHT;
    });
    
    const offsets = [0];
    heights.forEach(h => offsets.push(offsets[offsets.length - 1] + h));
    return { hourHeights: heights, hourOffsets: offsets };
  }, [timelineTasks, dayBase]); // Recalculate when tasks change

  // Helpers for coordinate mapping
  const getYFromDate = useCallback((date: Date) => {
    const h = date.getHours();
    const m = date.getMinutes();
    // Safety check
    if (h < 0 || h > 23) return 0;
    
    const offset = hourOffsets[h];
    const height = hourHeights[h];
    return offset + (m / 60) * height;
  }, [hourOffsets, hourHeights]);

  const getTimeFromY = (y: number) => {
      // Clamp Y
      const maxY = hourOffsets[24];
      const clampedY = Math.max(0, Math.min(y, maxY - 1));

      // Find which hour this Y belongs to
      let h = 0;
      while (h < 23 && clampedY >= hourOffsets[h + 1]) {
          h++;
      }

      const offset = hourOffsets[h];
      const height = hourHeights[h];
      const fraction = (clampedY - offset) / height;
      const minutes = Math.floor(fraction * 60);
      
      return setMinutes(setHours(startOfDay(dayBase), h), minutes);
  };

  const [dragInfo, setDragInfo] = useState<{ 
    id: string; 
    type: 'move' | 'resize-top' | 'resize-bottom'; 
    startY: number; 
    originalTop: number; 
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  // Auto-scroll logic
  scrollToRelevantTimeRef.current = (smooth = false) => {
    if (!containerRef.current) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isTodayForScroll = selectedDate === todayStr;

    // Default target: Now or 09:00
    let targetY = isTodayForScroll
      ? getYFromDate(new Date())
      : getYFromDate(setHours(startOfDay(dayBase), 9));

    if (timelineTasks.length > 0) {
      // Find earliest task top position
      const startYs = timelineTasks.map(t => getYFromDate(t.startDate));
      const earliestY = Math.min(...startYs);
      targetY = earliestY;
    }

    const scrollY = targetY - 80;
    containerRef.current.scrollTo({ 
      top: Math.max(0, scrollY), 
      behavior: smooth ? 'smooth' : 'auto' 
    });
  };

  useEffect(() => {
    scrollToRelevantTimeRef.current(false);
  }, [selectedDate]);

  useEffect(() => {
    setDragInfo(null);
  }, [selectedDate]);

  const handleMouseDown = (e: React.MouseEvent, task: TimelineTask, type: 'move' | 'resize-top' | 'resize-bottom', top: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragInfo({ 
      id: task.id, 
      type, 
      startY: e.clientY, 
      originalTop: top,
      originalStart: task.startDate,
      originalEnd: task.endDate,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo) return;

    const deltaY = e.clientY - dragInfo.startY;
    const task = tasks.find(t => t.id === dragInfo.id);
    if (!task) return;

    if (dragInfo.type === 'move') {
      const newTop = Math.max(0, dragInfo.originalTop + deltaY);
      
      // Convert newTop to time
      const newStartDate = getTimeFromY(newTop);
      
      // Snap to minutes
      const remainder = newStartDate.getMinutes() % SNAP_MINUTES;
      if (remainder !== 0) {
          const add = remainder >= SNAP_MINUTES / 2;
          const snapDiff = add ? (SNAP_MINUTES - remainder) : -remainder;
          newStartDate.setMinutes(newStartDate.getMinutes() + snapDiff);
      }
      
      const duration = differenceInMinutes(dragInfo.originalEnd, dragInfo.originalStart);
      const newEndDate = addMinutes(newStartDate, duration);
      
      const existingStart = resolveTime(task.startTime) ?? dragInfo.originalStart;
      if (format(newStartDate, 'HH:mm') !== format(existingStart, 'HH:mm')) {
        updateTask(task.id, { startTime: newStartDate.toISOString(), endTime: newEndDate.toISOString(), date: selectedDate, updatedAt: new Date().toISOString() });
      }

    } else if (dragInfo.type === 'resize-bottom') {
       const originalBottomY = getYFromDate(dragInfo.originalEnd);
       const newBottomY = Math.max(getYFromDate(dragInfo.originalStart) + 10, originalBottomY + deltaY); 

       const newEndDate = getTimeFromY(newBottomY);
       
       // Snap
       const remainder = newEndDate.getMinutes() % SNAP_MINUTES;
       if (remainder !== 0) {
           const add = remainder >= SNAP_MINUTES / 2;
           const snapDiff = add ? (SNAP_MINUTES - remainder) : -remainder;
           newEndDate.setMinutes(newEndDate.getMinutes() + snapDiff);
       }

       const taskStart = resolveTime(task.startTime) ?? dragInfo.originalStart;
       if (taskStart && differenceInMinutes(newEndDate, taskStart) >= SNAP_MINUTES) {
          const existingEnd = resolveTime(task.endTime) ?? dragInfo.originalEnd;
          if (format(newEndDate, 'HH:mm') !== format(existingEnd, 'HH:mm')) {
             updateTask(task.id, { endTime: newEndDate.toISOString(), date: selectedDate, updatedAt: new Date().toISOString() });
          }
       }

    } else if (dragInfo.type === 'resize-top') {
        const newTop = Math.max(0, dragInfo.originalTop + deltaY);
        const newStartDate = getTimeFromY(newTop);

        // Snap
        const remainder = newStartDate.getMinutes() % SNAP_MINUTES;
        if (remainder !== 0) {
            const add = remainder >= SNAP_MINUTES / 2;
            const snapDiff = add ? (SNAP_MINUTES - remainder) : -remainder;
            newStartDate.setMinutes(newStartDate.getMinutes() + snapDiff);
        }

        const taskEnd = resolveTime(task.endTime) ?? dragInfo.originalEnd;
        if (taskEnd && differenceInMinutes(taskEnd, newStartDate) >= SNAP_MINUTES) {
            const existingStart = resolveTime(task.startTime) ?? dragInfo.originalStart;
            if (format(newStartDate, 'HH:mm') !== format(existingStart, 'HH:mm')) {
               updateTask(task.id, { startTime: newStartDate.toISOString(), endTime: taskEnd.toISOString(), date: selectedDate, updatedAt: new Date().toISOString() });
            }
        }
    }
  };

  const handleMouseUp = () => setDragInfo(null);

  const layoutById = useMemo(() => {
    if (timelineTasks.length === 0) return {};

    const sorted = [...timelineTasks].sort((a, b) => {
      const startDiff = a.startDate.getTime() - b.startDate.getTime();
      if (startDiff !== 0) return startDiff;
      const endDiff = a.endDate.getTime() - b.endDate.getTime();
      if (endDiff !== 0) return endDiff;
      return a.id.localeCompare(b.id);
    });

    const active: Array<{ id: string; end: Date; column: number; clusterId: number }> = [];
    const assignments = new Map<string, { column: number; clusterId: number }>();
    const clusterMax: Record<number, number> = {};
    let clusterId = -1;

    sorted.forEach((task) => {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].end <= task.startDate) {
          active.splice(i, 1);
        }
      }

      if (active.length === 0) {
        clusterId += 1;
      }

      const usedColumns = new Set(active.map(item => item.column));
      let column = 0;
      while (usedColumns.has(column)) {
        column += 1;
      }

      assignments.set(task.id, { column, clusterId });
      active.push({ id: task.id, end: task.endDate, column, clusterId });
      clusterMax[clusterId] = Math.max(clusterMax[clusterId] ?? 0, active.length);
    });

    const layouts: Record<string, { top: number; height: number; width: string; left: string }> = {};
    timelineTasks.forEach((task) => {
      const assignment = assignments.get(task.id);
      if (!assignment) return;
      const top = getYFromDate(task.startDate);
      const height = Math.max(getYFromDate(task.endDate) - top, 24);
      const maxCols = clusterMax[assignment.clusterId] || 1;
      const width = 100 / maxCols;
      layouts[task.id] = {
        top,
        height,
        width: `${width}%`,
        left: `${assignment.column * width}%`,
      };
    });

    return layouts;
  }, [timelineTasks, getYFromDate]);

  return (
    <div className="relative h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(format(addDays(dayBase, -1), 'yyyy-MM-dd'))} className="p-2 rounded-xl hover:bg-white/80 border border-transparent hover:border-slate-200">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-white/60 shadow-sm">
            <CalendarIcon size={16} className="text-primary" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-sm font-medium bg-transparent"
            />
          </div>
          <button onClick={() => setSelectedDate(format(addDays(dayBase, 1), 'yyyy-MM-dd'))} className="p-2 rounded-xl hover:bg-white/80 border border-transparent hover:border-slate-200">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))} className="px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary border border-slate-200 bg-white/70">
            今天
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-2 rounded-xl bg-white/80 border border-white/60 text-xs uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Clock size={12} /> 排期 {timelineTasks.length} 项
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/80 border border-white/60 text-xs uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <ListTodo size={12} /> 待排 {unscheduledTasks.length} 项
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/80 border border-white/60 text-xs uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary" /> {getTotalHours(timelineTasks)}h
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="relative flex-1 bg-white/80 border border-white/60 rounded-[28px] shadow-[var(--shadow-card)] overflow-hidden">
          {/* Floating 'Back to focus' button */}
          <button 
            onClick={() => scrollToRelevantTimeRef.current(true)}
            className="absolute bottom-6 right-8 z-40 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-dark transition-all hover:scale-105 active:scale-95"
            title="聚焦到当前或最近任务"
          >
            <Crosshair size={22} />
          </button>

          <div 
            className="relative h-full overflow-y-auto pr-4 timeline-container scroll-smooth"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={containerRef}
          >
            <div className="absolute left-16 top-0 bottom-0 w-px bg-slate-200/70" />
            
            {Array.from({ length: 24 }).map((_, hour) => {
              const height = hourHeights[hour];
              const isCompact = height === COMPACT_HEIGHT;
              
              const hasTaskInHour = timelineTasks.some(t => t.startDate.getHours() === hour);

              return (
                <div 
                  key={hour} 
                  className={cn(
                    "relative flex border-t border-slate-100/70 transition-all overflow-hidden group",
                    isCompact ? "bg-slate-50/60 hover:bg-slate-50" : "bg-white"
                  )}
                  style={{ height: `${height}px` }}
                >
                  <div className="w-16 text-right pr-4 py-1 flex justify-end gap-2 shrink-0">
                    <span className={cn("text-xs font-medium block", hasTaskInHour ? "text-slate-800 font-bold" : "text-slate-400", isCompact && "opacity-50 group-hover:opacity-100")}>
                      {format(addHours(startOfDay(dayBase), hour), 'HH:00')}
                    </span>
                    {hasTaskInHour && <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                  
                  {!isCompact && (
                      <div className="absolute left-16 right-0 top-1/2 border-t border-dashed border-slate-100 w-full pointer-events-none" />
                  )}
                </div>
              );
            })}

            <div className="absolute left-16 right-0 top-0 h-full ml-px">
              {timelineTasks.map(task => {
                const group = groups.find(g => g.id === task.groupId);
                const layout = layoutById[task.id];
                if (!layout) return null;
                const isDragging = dragInfo?.id === task.id;

                return (
                  <div 
                    key={task.id}
                    className={cn(
                      "absolute p-1 z-[1] transition-all duration-75 ease-out", 
                      isDragging ? "z-10 opacity-90 scale-[1.02]" : "opacity-100",
                      task.isCompleted && "opacity-60 grayscale-[0.5]"
                    )}
                    style={{ 
                      top: `${layout.top}px`, 
                      height: `${layout.height}px`, 
                      width: layout.width, 
                      left: layout.left 
                    }}
                  >
                    <div 
                      className="h-full rounded-lg shadow-sm overflow-hidden border-l-4 relative group/item cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md bg-white"
                      style={{ 
                        borderColor: group?.color || '#cbd5e1', 
                        backgroundColor: group?.color ? `${group.color}18` : '#f1f5f9'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, task, 'move', layout.top)}
                    >
                      {/* Top Resize Handle */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 hover:bg-black/5"
                        onMouseDown={(e) => handleMouseDown(e, task, 'resize-top', layout.top)}
                      />

                      <div className="p-2 select-none pointer-events-none overflow-hidden h-full">
                        <div 
                          className="text-[10px] font-bold truncate leading-tight" 
                          style={{ color: group?.color ?  'inherit' : '#334155' }}
                        >
                          {task.title}
                        </div>
                        {layout.height > 30 && (
                            <div className="text-[9px] font-medium opacity-70 mt-0.5 text-slate-500">
                            {format(task.startDate, 'HH:mm')} - {format(task.endDate, 'HH:mm')}
                            </div>
                        )}
                      </div>

                      {/* Bottom Resize Handle */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 hover:bg-black/5"
                        onMouseDown={(e) => handleMouseDown(e, task, 'resize-bottom', layout.top)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current Time Indicator */}
            {isToday && (
              <div 
                className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center transition-all duration-500" 
                style={{ top: `${getYFromDate(now)}px` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] ring-2 ring-white shadow-sm" />
                <div className="ml-1 text-[9px] font-bold text-white bg-red-500 px-1 rounded-sm shadow-sm translate-y-[-12px]">
                  {format(now, 'HH:mm')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-white/60 bg-white/80 shadow-[var(--shadow-soft)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">快速新建</h3>
              <span className="text-[10px] text-slate-400">固定时段</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickTitle.trim()) return;
                const start = buildDateTime(selectedDate, quickStartTime);
                let end = buildDateTime(selectedDate, quickEndTime);
                if (end <= start) {
                  end = addMinutes(start, 60);
                }
                addTask({
                  id: crypto.randomUUID(),
                  title: quickTitle.trim(),
                  description: '',
                  date: selectedDate,
                  hasTime: true,
                  startTime: start.toISOString(),
                  endTime: end.toISOString(),
                  isCompleted: false,
                  groupId: quickGroupId,
                  tagIds: [],
                  pomodoroCount: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                setQuickTitle('');
              }}
              className="space-y-3"
            >
              <input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="任务名称"
                className="w-full rounded-xl border border-slate-200 bg-white/80 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={quickStartTime}
                  onChange={(e) => setQuickStartTime(e.target.value)}
                  step={900}
                  className="rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                />
                <input
                  type="time"
                  value={quickEndTime}
                  onChange={(e) => setQuickEndTime(e.target.value)}
                  step={900}
                  min={quickStartTime}
                  className="rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                />
              </div>
              <select
                value={quickGroupId}
                onChange={(e) => setQuickGroupId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-xl bg-primary text-white py-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-dark"
              >
                <Plus size={14} /> 添加任务
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/80 shadow-[var(--shadow-soft)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">未排期任务</h3>
              <span className="text-[10px] text-slate-400">{unscheduledTasks.length} 项</span>
            </div>
            {unscheduledTasks.length > 0 ? (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!scheduleTaskId) return;
                    const start = buildDateTime(selectedDate, scheduleStartTime);
                    const end = addMinutes(start, 60);
                    updateTask(scheduleTaskId, {
                      hasTime: true,
                      startTime: start.toISOString(),
                      endTime: end.toISOString(),
                      date: selectedDate,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  className="space-y-2"
                >
                  <select
                    value={scheduleTaskId}
                    onChange={(e) => setScheduleTaskId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                  >
                    {unscheduledTasks.map(task => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                      step={900}
                      className="flex-1 rounded-xl border border-slate-200 bg-white/80 p-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="px-3 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary-dark"
                    >
                      安排
                    </button>
                  </div>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {unscheduledTasks.map(task => {
                    const group = groups.find(g => g.id === task.groupId);
                    return (
                      <div key={task.id} className="flex items-center gap-2 text-xs text-slate-600 bg-white/70 border border-white/60 rounded-lg px-2 py-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group?.color || '#cbd5e1' }} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 bg-white/70 border border-dashed border-slate-200 rounded-xl p-3 text-center">
                当天没有待排任务，可以去「每日规划」补充清单。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const buildDateTime = (dateStr: string, timeStr: string) => {
  const base = parseISO(dateStr);
  const [h, m] = timeStr.split(':').map(Number);
  return setMinutes(setHours(base, h), m);
};

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

const getRoundedTime = (date: Date) => {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.ceil(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  const roundedDate = setMinutes(date, roundedMinutes % 60);
  const adjusted = roundedMinutes >= 60 ? addHours(roundedDate, 1) : roundedDate;
  return format(adjusted, 'HH:mm');
};

const getOffsetTime = (time: string, offsetMinutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const base = setMinutes(setHours(new Date(), h), m);
  return format(addMinutes(base, offsetMinutes), 'HH:mm');
};

const getTotalHours = (timelineTasks: TimelineTask[]) => {
  const totalMinutes = timelineTasks.reduce((acc, task) => {
    return acc + Math.max(0, differenceInMinutes(task.endDate, task.startDate));
  }, 0);
  return Math.round((totalMinutes / 60) * 10) / 10;
};

export default TimelineView;
