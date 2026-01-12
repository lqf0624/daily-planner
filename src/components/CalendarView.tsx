import React, { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useAppStore } from '../stores/useAppStore';
import { format, parseISO, isValid, isSameDay, addDays, differenceInDays } from 'date-fns';
import { Task, Deadline, RecurrenceFrequency } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { 
  Plus, Trash2, Settings2, 
  Repeat, AlertCircle, Edit3, CheckCircle2, Clock, Tag
} from 'lucide-react';
import { cn } from '../utils/cn';
import './CalendarView.css';

const CalendarView: React.FC = () => {
  const { 
    tasks, addTask, updateTask, deleteTask, 
    groups, addGroup, updateGroup, deleteGroup,
    deadlines, addDeadline, updateDeadline, deleteDeadline 
  } = useAppStore();
  
  const [viewMode, setViewMode] = useState<'timeGridDay' | 'dayGridMonth' | 'listWeek'>('timeGridDay');
  const calendarRef = useRef<FullCalendar>(null);
  
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<Partial<Deadline> | null>(null);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#0f766e');

  const safeParseDate = (dateStr?: string) => {
    if (!dateStr) return new Date();
    const d = parseISO(dateStr);
    return isValid(d) ? d : new Date();
  };

  const events = useMemo(() => {
    return tasks.map(task => {
      const group = groups.find(g => g.id === task.groupId);
      let endVal = undefined;
      if (task.isMultiDay && task.endDate) {
        // FullCalendar 的 end 是排他的（不包含），跨天任务需要加 1 天
        endVal = format(addDays(parseISO(task.endDate), 1), 'yyyy-MM-dd');
      } else if (task.hasTime && task.endTime) {
        endVal = task.endTime;
      }

      return {
        id: task.id,
        title: task.title,
        start: task.hasTime && task.startTime ? task.startTime : task.date,
        end: endVal,
        allDay: !task.hasTime,
        backgroundColor: group?.color || '#0f766e',
        borderColor: group?.color || '#0f766e',
        extendedProps: { ...task },
        classNames: [task.isCompleted ? 'task-completed' : '']
      };
    });
  }, [tasks, groups]);

  const [menuPos, setMenuPos] = useState<{ x: number, y: number } | null>(null);
  const [contextTaskId, setContextTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = () => setMenuPos(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(viewMode);
    }
  }, [viewMode]);

  const handleSaveTask = () => {
    if (!editingTask?.title) return;
    if (editingTask.isMultiDay && editingTask.endDate && editingTask.date) {
      if (parseISO(editingTask.endDate) < parseISO(editingTask.date)) {
        alert('结束日期不能早于开始日期');
        return;
      }
    }
    const taskData = { ...editingTask, updatedAt: new Date().toISOString() } as Task;
    if (editingTask.id) updateTask(editingTask.id, taskData);
    else addTask({ ...taskData, id: crypto.randomUUID(), pomodoroCount: 0, tagIds: [], createdAt: new Date().toISOString() });
    setIsTaskDialogOpen(false);
  };

  const handleSaveDeadline = () => {
    if (!editingDeadline?.title || !editingDeadline?.date) return;
    if (editingDeadline.id) {
      updateDeadline(editingDeadline.id, editingDeadline);
    } else {
      addDeadline({
        ...editingDeadline,
        id: crypto.randomUUID(),
        priority: 'medium',
        createdAt: new Date().toISOString()
      } as Deadline);
    }
    setIsDeadlineDialogOpen(false);
  };

  const handleDateClick = (arg: { dateStr: string; allDay: boolean }) => {
    let startTime: string | undefined;
    let endTime: string | undefined;
    
    if (!arg.allDay && arg.dateStr.includes('T')) {
      startTime = arg.dateStr;
      const d = parseISO(arg.dateStr);
      d.setHours(d.getHours() + 1);
      endTime = d.toISOString();
    }

    setEditingTask({
      title: '',
      date: arg.dateStr.split('T')[0],
      groupId: groups[0]?.id || 'work',
      hasTime: !arg.allDay,
      isCompleted: false,
      startTime: startTime,
      endTime: endTime
    });
    setIsTaskDialogOpen(true);
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex items-center justify-between no-drag">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[{ id: 'timeGridDay', label: '本日' }, { id: 'dayGridMonth', label: '本月' }, { id: 'listWeek', label: '清单' }].map(v => (
            <Button 
              key={v.id} 
              variant={viewMode === v.id ? 'default' : 'ghost'} 
              size="sm" 
              className={cn("rounded-lg px-4 h-8 transition-all font-bold", viewMode === v.id ? "bg-white shadow-sm text-primary" : "text-slate-500")} 
              onClick={() => setViewMode(v.id as 'timeGridDay' | 'dayGridMonth' | 'listWeek')}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border border-slate-200" onClick={() => setIsGroupDialogOpen(true)}><Settings2 size={16} /> 分类管理</Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border border-slate-200" onClick={() => { setEditingDeadline({ date: format(new Date(), 'yyyy-MM-dd'), title: '' }); setIsDeadlineDialogOpen(true); }}><AlertCircle size={16} /> 新增截止日</Button>
          <Button size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/10" onClick={() => { setEditingTask({ title: '', date: format(new Date(), 'yyyy-MM-dd'), groupId: groups[0]?.id || 'work', hasTime: false, isCompleted: false }); setIsTaskDialogOpen(true); }}><Plus size={16} /> 新建任务</Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-inner overflow-hidden calendar-container no-drag relative">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={viewMode}
          headerToolbar={false}
          events={events}
          editable={true}
          selectable={true}
          locale="zh-cn"
          height="100%"
          dateClick={handleDateClick}
          eventClick={(info) => { setEditingTask(info.event.extendedProps as Task); setIsTaskDialogOpen(true); }}
          eventDidMount={(info) => {
            info.el.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              setContextTaskId(info.event.id);
              setMenuPos({ x: e.clientX, y: e.clientY });
            });
          }}
          eventDrop={(info) => {
            const task = info.event.extendedProps as Task;
            updateTask(task.id, {
              date: format(info.event.start!, 'yyyy-MM-dd'),
              startTime: info.event.start?.toISOString(),
              endTime: info.event.end?.toISOString(),
              isMultiDay: !!(info.event.end && !isSameDay(info.event.start!, info.event.end!)),
              endDate: info.event.end ? format(addDays(info.event.end, -1), 'yyyy-MM-dd') : undefined
            });
          }}
        />

        {menuPos && (
          <div className="fixed z-[1000] bg-white border border-slate-200 rounded-xl shadow-2xl p-1 min-w-[140px] animate-in zoom-in-95 duration-100" style={{ top: menuPos.y, left: menuPos.x }}>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => { const t = tasks.find(t => t.id === contextTaskId); if (t) setEditingTask(t); setIsTaskDialogOpen(true); setMenuPos(null); }}><Edit3 size={14} /> 编辑详情</button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-lg" onClick={() => { if (contextTaskId) deleteTask(contextTaskId); setMenuPos(null); }}><Trash2 size={14} /> 彻底删除</button>
          </div>
        )}
      </div>

      {deadlines.length > 0 && (
        <div className="flex gap-4 pt-2 overflow-x-auto pb-2 no-scrollbar">
          {deadlines.map(dl => {
            const daysLeft = differenceInDays(parseISO(dl.date), new Date());
            return (
              <div key={dl.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between group min-w-[220px] shadow-sm transition-all hover:border-primary/20">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {dl.date}</div>
                  <h4 className="text-sm font-black text-slate-700 truncate max-w-[100px]">{dl.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className={cn("text-xl font-black", daysLeft <= 3 ? "text-red-500" : "text-primary")}>{daysLeft < 0 ? 'Over' : `${daysLeft}d`}</div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingDeadline(dl); setIsDeadlineDialogOpen(true); }} className="text-slate-300 hover:text-primary"><Edit3 size={12} /></button>
                    <button onClick={() => deleteDeadline(dl.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-800">任务详情</DialogTitle></DialogHeader>
          <div className="grid gap-6 py-4 max-h-[75vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">任务名称</label>
              <Input className="bg-slate-50 border-slate-200 rounded-xl h-12 text-lg font-bold" value={editingTask?.title || ''} onChange={e => setEditingTask(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex gap-3 items-center"><CheckCircle2 size={20} className={cn(editingTask?.isCompleted ? "text-green-500" : "text-slate-300")} /><span className="text-sm font-black text-slate-700">标记为已完成</span></div>
              <input type="checkbox" checked={editingTask?.isCompleted || false} onChange={e => setEditingTask(prev => ({ ...prev, isCompleted: e.target.checked }))} className="w-5 h-5 accent-green-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase px-1">开始日期</label><Input type="date" className="rounded-xl bg-slate-50 h-10 font-bold" value={editingTask?.date || ''} onChange={e => setEditingTask(prev => ({ ...prev, date: e.target.value }))} /></div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase px-1">任务分类</label>
                <div className="relative">
                  <select 
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold appearance-none" 
                    value={editingTask?.groupId || ''} 
                    onChange={e => setEditingTask(prev => ({ ...prev, groupId: e.target.value }))}
                  >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Tag className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {/* 跨天任务设置 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">这是一个跨天任务？</span>
                <input 
                  type="checkbox" 
                  checked={editingTask?.isMultiDay || false} 
                  onChange={e => setEditingTask(prev => ({ 
                    ...prev, 
                    isMultiDay: e.target.checked,
                    // 如果取消跨天，清除 endDate
                    endDate: e.target.checked ? prev?.endDate : undefined 
                  }))} 
                  className="w-4 h-4 accent-primary" 
                />
              </div>
              {editingTask?.isMultiDay && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-1">结束日期</label>
                  <Input 
                    type="date" 
                    className="rounded-xl bg-white h-10 font-bold" 
                    value={editingTask?.endDate || ''} 
                    min={editingTask?.date} // 限制不能早于开始日期
                    onChange={e => setEditingTask(prev => ({ ...prev, endDate: e.target.value }))} 
                  />
                </div>
              )}
            </div>

            {/* 具体时段设置 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">设定具体时段</span><input type="checkbox" checked={editingTask?.hasTime || false} onChange={e => setEditingTask(prev => ({ ...prev, hasTime: e.target.checked }))} className="w-4 h-4 accent-primary" /></div>
              {editingTask?.hasTime && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <Input type="time" className="h-9 rounded-lg bg-white" value={editingTask?.startTime ? format(safeParseDate(editingTask.startTime), 'HH:mm') : ''} onChange={e => { const d = safeParseDate(editingTask?.date); const [h, m] = e.target.value.split(':').map(Number); d.setHours(h, m, 0, 0); setEditingTask(prev => ({ ...prev, startTime: d.toISOString() })); }} />
                  <Input type="time" className="h-9 rounded-lg bg-white" value={editingTask?.endTime ? format(safeParseDate(editingTask.endTime), 'HH:mm') : ''} onChange={e => { const d = safeParseDate(editingTask?.date); const [h, m] = e.target.value.split(':').map(Number); d.setHours(h, m, 0, 0); setEditingTask(prev => ({ ...prev, endTime: d.toISOString() })); }} />
                </div>
              )}
            </div>
            
            {/* 重复周期 */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Repeat size={16} className="text-primary" /><span className="text-sm font-bold text-slate-700">重复周期</span></div>
                <select 
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold" 
                  value={editingTask?.recurrence?.frequency || 'none'} 
                  onChange={e => setEditingTask(prev => prev ? ({ 
                    ...prev, 
                    recurrence: { 
                      frequency: e.target.value as RecurrenceFrequency,
                      smartWorkdayOnly: prev.recurrence?.smartWorkdayOnly || false 
                    } 
                  }) : null)}
                >
                  <option value="none">不重复</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              {editingTask?.recurrence?.frequency !== 'none' && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs font-medium text-slate-500">仅工作日 (含调休)</span>
                  <input 
                    type="checkbox" 
                    checked={editingTask?.recurrence?.smartWorkdayOnly || false} 
                    onChange={e => setEditingTask(prev => prev ? ({ 
                      ...prev, 
                      recurrence: { 
                        frequency: prev.recurrence?.frequency || 'none',
                        smartWorkdayOnly: e.target.checked 
                      } 
                    }) : null)} 
                    className="w-4 h-4 accent-primary" 
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-4"><Button size="lg" onClick={handleSaveTask} className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/10">保存计划</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl bg-white shadow-2xl border-slate-200">
          <DialogHeader><DialogTitle className="text-xl font-black">管理分类</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
              {groups.map(group => (
                <div key={group.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
                  <input type="color" value={group.color} onChange={(e) => updateGroup(group.id, { color: e.target.value })} className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-none" />
                  <Input value={group.name} onChange={(e) => updateGroup(group.id, { name: e.target.value })} className="flex-1 bg-transparent border-none shadow-none font-bold focus-visible:ring-0 p-0 h-auto" />
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 rounded-lg h-8 w-8" onClick={() => groups.length > 1 && deleteGroup(group.id)}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <input type="color" value={newGroupColor} onChange={(e) => setNewGroupColor(e.target.value)} className="w-11 h-11 rounded-xl border border-slate-200 cursor-pointer bg-transparent" />
              <Input placeholder="分类名称..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="flex-1 h-11 rounded-xl bg-slate-50 border border-slate-200 font-bold" />
              <Button onClick={() => { if(newGroupName.trim()){ addGroup({id: crypto.randomUUID(), name: newGroupName, color: newGroupColor}); setNewGroupName(''); } }} className="h-11 w-11 rounded-xl p-0 shadow-md shadow-primary/10"><Plus size={20} /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeadlineDialogOpen} onOpenChange={setIsDeadlineDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl bg-white border-slate-200 shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black">{editingDeadline?.id ? '编辑截止日' : '设定截止日'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">项目名称</label>
              <Input className="bg-slate-50 border-slate-200 rounded-xl font-bold" value={editingDeadline?.title || ''} onChange={e => setEditingDeadline(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">截止日期</label>
              <Input type="date" className="bg-slate-50 border-slate-200 rounded-xl font-bold" value={editingDeadline?.date || ''} onChange={e => setEditingDeadline(prev => ({ ...prev, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveDeadline} className="w-full h-12 rounded-xl font-black shadow-lg shadow-primary/10">确认</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;