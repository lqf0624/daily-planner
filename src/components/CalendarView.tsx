import React, { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useAppStore } from '../stores/useAppStore';
import { format, parseISO, isValid } from 'date-fns';
import { Task } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Plus, Trash2, Tag, Settings2 } from 'lucide-react';
import { cn } from '../utils/cn';
import './CalendarView.css';

const CalendarView: React.FC = () => {
  const { tasks, addTask, updateTask, deleteTask, groups, addGroup, updateGroup, deleteGroup } = useAppStore();
  const [viewMode, setViewMode] = useState<'timeGridDay' | 'dayGridMonth' | 'listWeek'>('timeGridDay');
  const calendarRef = useRef<FullCalendar>(null);
  
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  
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
      return {
        id: task.id,
        title: task.title,
        start: task.hasTime && task.startTime ? task.startTime : task.date,
        end: task.hasTime && task.endTime ? task.endTime : undefined,
        allDay: !task.hasTime,
        backgroundColor: group?.color || '#0f766e',
        borderColor: group?.color || '#0f766e',
        extendedProps: { ...task },
        classNames: [task.isCompleted ? 'task-completed' : '']
      };
    });
  }, [tasks, groups]);

  useEffect(() => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      api.changeView(viewMode);
      setTimeout(() => api.updateSize(), 50);
    }
  }, [viewMode]);

  const handleDateSelect = (selectInfo: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setEditingTask({
      id: '',
      title: '',
      description: '',
      date: format(selectInfo.start, 'yyyy-MM-dd'),
      startTime: selectInfo.allDay ? undefined : selectInfo.startStr,
      endTime: selectInfo.allDay ? undefined : selectInfo.endStr,
      hasTime: !selectInfo.allDay,
      groupId: groups[0]?.id || 'work',
    });
    setIsTaskDialogOpen(true);
  };

  const handleEventClick = (clickInfo: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setEditingTask(clickInfo.event.extendedProps);
    setIsTaskDialogOpen(true);
  };

  const handleSaveTask = () => {
    if (!editingTask?.title) return;
    if (editingTask.id) {
      updateTask(editingTask.id, { ...editingTask, updatedAt: new Date().toISOString() } as Task);
    } else {
      addTask({
        ...editingTask,
        id: crypto.randomUUID(),
        isCompleted: false,
        pomodoroCount: 0,
        tagIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Task);
    }
    setIsTaskDialogOpen(false);
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    addGroup({ id: crypto.randomUUID(), name: newGroupName, color: newGroupColor });
    setNewGroupName('');
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between no-drag">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'timeGridDay', label: '本日' },
            { id: 'dayGridMonth', label: '本月' },
            { id: 'listWeek', label: '清单' }
          ].map(v => (
            <Button 
              key={v.id}
              variant={viewMode === v.id ? 'default' : 'ghost'} 
              size="sm" 
              className={cn("rounded-lg px-4 h-8 transition-all font-bold", viewMode === v.id ? "bg-white shadow-sm text-primary" : "text-slate-500")}
              onClick={() => setViewMode(v.id as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
            >
              {v.label}
            </Button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-slate-200" onClick={() => setIsGroupDialogOpen(true)}>
            <Settings2 size={16} /> 管理分类
          </Button>
          <Button size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/10" onClick={() => handleDateSelect({ start: new Date(), allDay: true })}>
            <Plus size={16} /> 新建任务
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-inner overflow-hidden calendar-container no-drag relative">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={viewMode}
          headerToolbar={false}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          locale="zh-cn"
          height="100%"
          allDayText="全天"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={(info) => {
            updateTask(info.event.id, {
              date: format(info.event.start!, 'yyyy-MM-dd'),
              startTime: info.event.start?.toISOString(),
              endTime: info.event.end?.toISOString(),
              hasTime: !info.event.allDay
            });
          }}
          eventResize={(info) => {
            updateTask(info.event.id, { endTime: info.event.end?.toISOString() });
          }}
          nowIndicator={true}
          allDaySlot={true}
        />
      </div>

      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-slate-200 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight">
              {editingTask?.id ? '任务详情' : '计划新任务'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">任务名称</label>
              <Input 
                className="bg-slate-50 border-slate-200 rounded-xl h-12 text-lg font-bold"
                value={editingTask?.title || ''} 
                onChange={e => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="要做什么？"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">日期</label>
                <Input type="date" className="rounded-xl bg-slate-50 border-slate-200" value={editingTask?.date || ''} onChange={e => setEditingTask(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">分类</label>
                <div className="relative">
                  <select className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold appearance-none" value={editingTask?.groupId} onChange={e => setEditingTask(prev => ({ ...prev, groupId: e.target.value }))}>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Tag className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">开始时间</label>
                <Input type="time" className="rounded-xl bg-slate-50 border-slate-200" value={editingTask?.startTime ? format(safeParseDate(editingTask.startTime), 'HH:mm') : ''} onChange={e => {
                  if (!e.target.value) return;
                  const [h, m] = e.target.value.split(':').map(Number);
                  const d = safeParseDate(editingTask?.date);
                  d.setHours(h, m, 0, 0);
                  setEditingTask(prev => ({ ...prev, startTime: d.toISOString(), hasTime: true }));
                }} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">结束时间</label>
                <Input type="time" className="rounded-xl bg-slate-50 border-slate-200" value={editingTask?.endTime ? format(safeParseDate(editingTask.endTime), 'HH:mm') : ''} onChange={e => {
                  if (!e.target.value) return;
                  const [h, m] = e.target.value.split(':').map(Number);
                  const d = safeParseDate(editingTask?.date);
                  d.setHours(h, m, 0, 0);
                  setEditingTask(prev => ({ ...prev, endTime: d.toISOString(), hasTime: true }));
                }} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">备注</label>
              <textarea className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium" value={editingTask?.description || ''} onChange={e => setEditingTask(prev => ({ ...prev, description: e.target.value }))} placeholder="..." />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between gap-4 border-t border-slate-100 pt-4">
            {editingTask?.id ? <Button variant="ghost" size="icon" onClick={() => { deleteTask(editingTask.id!); setIsTaskDialogOpen(false); }} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={20} /></Button> : <div />}
            <Button size="lg" onClick={handleSaveTask} className="rounded-xl px-8 h-12 font-bold shadow-lg shadow-primary/10">确认保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl border-slate-200 bg-white shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black">管理任务分类</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">现有分类</label>
              <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                {groups.map(group => (
                  <div key={group.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
                    <input type="color" value={group.color} onChange={(e) => updateGroup(group.id, { color: e.target.value })} className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-none" />
                    <Input value={group.name} onChange={(e) => updateGroup(group.id, { name: e.target.value })} className="flex-1 bg-transparent border-none shadow-none font-bold focus-visible:ring-0 p-0 h-auto" />
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 rounded-lg h-8 w-8" onClick={() => groups.length > 1 && deleteGroup(group.id)}><Trash2 size={14} /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">添加新分类</label>
              <div className="flex gap-2">
                <input type="color" value={newGroupColor} onChange={(e) => setNewGroupColor(e.target.value)} className="w-11 h-11 rounded-xl border border-slate-200 cursor-pointer bg-transparent" />
                <Input placeholder="分类名称..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="flex-1 h-11 rounded-xl bg-slate-50 border border-slate-200 font-bold" />
                <Button onClick={handleAddGroup} className="h-11 w-11 rounded-xl p-0 shadow-md shadow-primary/10"><Plus size={20} /></Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsGroupDialogOpen(false)} className="w-full h-12 rounded-xl font-bold">完成</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
