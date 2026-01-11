import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '../utils/cn';

const NotificationView: React.FC = () => {
  const [data, setData] = useState<{ title: string; message: string; kind: string } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 直接从 URL 提取数据，这是最快的方式
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const message = params.get('message');
    const kind = params.get('kind') || 'system';

    if (title && message) {
      setData({ title, message, kind });
      // 瞬间滑入
      setTimeout(() => setVisible(true), 10);

      // 7秒后滑出并隐藏
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          getCurrentWindow().hide();
        }, 600);
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!data) return <div className="w-screen h-screen bg-transparent" />;

  return (
    <div className={cn(
      "notification-view w-screen h-screen bg-transparent p-3 select-none overflow-hidden transition-all duration-700 ease-in-out transform",
      visible ? "translate-x-0 opacity-100" : "translate-x-12 opacity-0"
    )}>
      <div className="w-full h-full bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[28px] p-5 flex items-start gap-4 overflow-hidden relative">
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", data.kind === 'habit' ? "bg-primary" : "bg-blue-500")} />
        <div className={cn("p-3 rounded-2xl shrink-0", data.kind === 'habit' ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-600")}>
          {data.kind === 'habit' ? <Bell size={24} fill="currentColor" fillOpacity={0.1} /> : <CheckCircle2 size={24} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h5 className="text-base font-black text-slate-800 leading-tight truncate">{data.title}</h5>
          <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-2">{data.message}</p>
        </div>
        <button onClick={() => setVisible(false)} className="text-slate-300 hover:text-slate-500 p-1"><X size={20} /></button>
      </div>
    </div>
  );
};

export default NotificationView;