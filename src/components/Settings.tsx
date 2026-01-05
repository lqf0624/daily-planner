import React, { useState } from 'react';
import { X, Key, Save, Globe, Cpu, Calendar, RefreshCw, CheckCircle, Wifi } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { checkConnection, syncTasks } from '../services/caldavService';
import { format } from 'date-fns';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { aiSettings, updateAISettings, caldavSettings, updateCaldavSettings } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleCheckConnection = async () => {
    setLoading(true);
    try {
      const success = await checkConnection();
      setConnectionStatus(success ? 'success' : 'error');
      if (success) {
          updateCaldavSettings({ enabled: true });
          alert('连接成功！');
      } else {
          alert('连接失败：未找到日历');
      }
    } catch (e: any) {
      setConnectionStatus('error');
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await syncTasks();
      updateCaldavSettings({ lastSyncTime: Date.now() });
      alert('同步成功！');
    } catch (e: any) {
      alert('同步失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white/90 rounded-[28px] w-full max-w-lg p-6 shadow-[var(--shadow-card)] border border-white/60 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 border-b border-white/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">系统设置</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preferences</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/70 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-8">
          {/* AI Settings */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">AI 助手配置 (OpenAI 风格)</h4>
            <div className="space-y-4 bg-white/70 border border-white/60 rounded-2xl p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Globe size={16} /> API 基础地址 (Base URL)
                </label>
                <input
                  type="text"
                  value={aiSettings.baseUrl}
                  onChange={(e) => updateAISettings({ baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Cpu size={16} /> 模型名称 (Model)
                </label>
                <input
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) => updateAISettings({ model: e.target.value })}
                  placeholder="gpt-3.5-turbo"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Key size={16} /> API Key
                </label>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => updateAISettings({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </section>
          
          <hr className="border-slate-100" />

          {/* CalDAV Settings */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Calendar size={16} /> CalDAV 日历同步
               {connectionStatus === 'success' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10} /> 已连接</span>}
            </h4>
            
            <div className="bg-white/70 p-4 rounded-2xl space-y-4 border border-white/60">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500">服务器地址 (Server URL)</label>
                 <input 
                   type="text" 
                   value={caldavSettings.serverUrl}
                   onChange={e => updateCaldavSettings({ serverUrl: e.target.value })}
                   placeholder="https://caldav.example.com/"
                   className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500">用户名</label>
                   <input 
                     type="text" 
                     value={caldavSettings.username}
                     onChange={e => updateCaldavSettings({ username: e.target.value })}
                   className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                 />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">密码 / 应用密码</label>
                  <input 
                     type="password" 
                     value={caldavSettings.password}
                     onChange={e => updateCaldavSettings({ password: e.target.value })}
                   className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                 />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                   onClick={handleCheckConnection}
                   disabled={loading || !caldavSettings.serverUrl}
                   className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
                 >
                   <Wifi size={16} /> 测试连接
                 </button>
                 <button 
                   onClick={handleSync}
                   disabled={loading || !caldavSettings.enabled}
                   className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 立即同步
                 </button>
              </div>
               
               {caldavSettings.lastSyncTime && (
                   <p className="text-[10px] text-center text-slate-400">上次同步: {format(caldavSettings.lastSyncTime, 'yyyy-MM-dd HH:mm:ss')}</p>
               )}
            </div>
          </section>

          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
