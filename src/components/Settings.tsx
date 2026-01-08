import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Languages, Info, Download, Globe, Cpu, Key } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'error' | 'latest';

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { aiSettings, updateAISettings, clearPomodoroHistory, language, setLanguage } = useAppStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  // 更新相关状态
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version: string, url: string, notes?: string } | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    if (!window.ipcRenderer) return;

    // 获取真实版本号
    window.ipcRenderer.invoke('app:get-version').then((v: unknown) => {
      if (typeof v === 'string') setCurrentVersion(v);
    });
  }, []);

  if (!isOpen) return null;

  const checkUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const result = await window.ipcRenderer.invoke('app:check-update') as { version: string, url: string, notes?: string } | null;
      if (result) {
        if (result.version !== currentVersion) {
          setUpdateInfo(result);
          setUpdateStatus('available');
        } else {
          setUpdateStatus('latest');
          setTimeout(() => setUpdateStatus('idle'), 3000);
        }
      } else {
        setUpdateStatus('error');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (error: unknown) {
      console.error('Check update error:', error);
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const openDownloadPage = () => {
    if (updateInfo?.url) {
      // 使用 shell.openExternal (通过 preload 暴露的 app:open-external 或者直接用 app:start-download 的通道改成打开网页)
      // 由于之前 main.ts 里没有专门的 open-external 通道，我们可以复用 app:install-update (它原本就是 shell.openPath)，或者新增一个。
      // 但最简单的是直接让 main 暴露一个 openExternal。
      // 暂时假设 main.ts 会处理这个，我们先用 window.open 试试，或者更稳妥地，发送一个明确的指令。
      // 鉴于 main.ts 里已经有 shell 模块，我们可以发送一个专门的事件。
      window.ipcRenderer.send('app:open-url', updateInfo.url);
      setUpdateStatus('idle');
    }
  };

  const handleClearHistory = () => {
    clearPomodoroHistory();
    setShowConfirmClear(false);
    alert(language === 'zh-CN' ? '番茄钟历史已清空' : 'Pomodoro history cleared');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm p-4">
      <div className="bg-white/90 rounded-[28px] w-full max-w-lg p-6 shadow-[var(--shadow-card)] border border-white/60 overflow-y-auto max-h-[90vh] relative">
        
        <AnimatePresence>
          {updateStatus === 'available' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="space-y-6">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Download size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">发现新版本 v{updateInfo?.version}</h3>
                <div className="bg-slate-50 rounded-2xl p-4 text-left max-h-40 overflow-y-auto border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">更新日志</p>
                  <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{updateInfo?.notes || '优化了性能和用户体验'}</pre>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setUpdateStatus('idle')} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200">稍后</button>
                  <button onClick={openDownloadPage} className="flex-1 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20">前往下载</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center mb-6 border-b border-white/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{language === 'zh-CN' ? '系统设置' : 'System Settings'}</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preferences</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/70 rounded-full cursor-pointer"><X size={20} /></button>
        </div>

        <div className="space-y-8">
          {/* Language Settings */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{language === 'zh-CN' ? '通用设置' : 'General'}</h4>
            <div className="bg-white/70 border border-white/60 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Languages size={18} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{language === 'zh-CN' ? '显示语言' : 'Language'}</span>
                </div>
                <select value={language} onChange={(e) => setLanguage(e.target.value as 'zh-CN' | 'en-US')} className="bg-white border border-slate-200 rounded-lg p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>
            </div>
          </section>

          {/* AI Settings */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{language === 'zh-CN' ? 'AI 助手配置 (OpenAI 风格)' : 'AI Assistant (OpenAI Style)'}</h4>
            <div className="space-y-4 bg-white/70 border border-white/60 rounded-2xl p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Globe size={16} /> {language === 'zh-CN' ? 'API 基础地址 (Base URL)' : 'API Base URL'}
                </label>
                <input type="text" value={aiSettings.baseUrl} onChange={(e) => updateAISettings({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Cpu size={16} /> {language === 'zh-CN' ? '模型名称 (Model)' : 'Model Name'}
                </label>
                <input type="text" value={aiSettings.model} onChange={(e) => updateAISettings({ model: e.target.value })} placeholder="gpt-3.5-turbo" className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Key size={16} /> API Key
                </label>
                <input type="password" value={aiSettings.apiKey} onChange={(e) => updateAISettings({ apiKey: e.target.value })} placeholder="sk-..." className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{language === 'zh-CN' ? '数据管理' : 'Data Management'}</h4>
            <div className="bg-white/70 border border-white/60 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">{language === 'zh-CN' ? '清空专注历史' : 'Clear Focus History'}</p>
                  <p className="text-xs text-slate-500 mt-1">{language === 'zh-CN' ? '仅删除番茄钟记录，保留任务和习惯数据。' : 'Only deletes pomodoro logs, keeps tasks and habits.'}</p>
                </div>
                {showConfirmClear ? (
                  <div className="flex gap-2 animate-in slide-in-from-right-2">
                    <button onClick={() => setShowConfirmClear(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">{language === 'zh-CN' ? '取消' : 'Cancel'}</button>
                    <button onClick={handleClearHistory} className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg shadow-lg">确定清空</button>
                  </div>
                ) : (
                  <button onClick={() => setShowConfirmClear(true)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-1.5 text-sm cursor-pointer">
                    <Trash2 size={16} /> {language === 'zh-CN' ? '清空记录' : 'Clear Logs'}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* About Section */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{language === 'zh-CN' ? '关于应用' : 'About'}</h4>
            <div className="bg-white/70 border border-white/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info size={18} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{language === 'zh-CN' ? '当前版本' : 'Version'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">v{currentVersion || '...'}</span>
                  <button 
                    onClick={checkUpdate} 
                    disabled={updateStatus === 'checking'}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded-md transition-all cursor-pointer",
                      updateStatus === 'latest' ? "bg-secondary/10 text-secondary" : 
                      updateStatus === 'error' ? "bg-red-100 text-red-500" :
                      "bg-slate-100 text-slate-500 hover:bg-primary hover:text-white"
                    )}
                  >
                    {updateStatus === 'checking' ? '检查中...' : 
                     updateStatus === 'latest' ? '已是最新' : 
                     updateStatus === 'error' ? '检查失败' : '检查更新'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Save size={18} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{language === 'zh-CN' ? '开发者' : 'Developer'}</span>
                </div>
                <span className="text-sm font-bold text-slate-600">lqf-0624</span>
              </div>
            </div>
          </section>

          <button onClick={onClose} className="w-full py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95">
            <Save size={18} /> {language === 'zh-CN' ? '保存并关闭' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
