import React, { useState } from 'react';
import { X, Key, Save, Globe, Cpu, Trash2, Languages } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { aiSettings, updateAISettings, clearPomodoroHistory, language, setLanguage } = useAppStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    clearPomodoroHistory();
    setShowConfirmClear(false);
    alert(language === 'zh-CN' ? '番茄钟历史已清空' : 'Pomodoro history cleared');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white/90 rounded-[28px] w-full max-w-lg p-6 shadow-[var(--shadow-card)] border border-white/60 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 border-b border-white/60 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{language === 'zh-CN' ? '系统设置' : 'System Settings'}</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preferences</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/70 rounded-full"><X size={20} /></button>
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
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'zh-CN' | 'en-US')}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
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
              {/* ... AI inputs ... */}
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

          {/* Data Management */}
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">数据管理</h4>
            <div className="bg-white/70 border border-white/60 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">清空专注历史</p>
                  <p className="text-xs text-slate-500 mt-1">仅删除番茄钟记录，保留任务和习惯数据。</p>
                </div>
                {showConfirmClear ? (
                  <div className="flex gap-2 animate-in slide-in-from-right-2">
                    <button 
                      onClick={() => setShowConfirmClear(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleClearHistory}
                      className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg shadow-lg shadow-red-200 hover:bg-red-600"
                    >
                      确定清空
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowConfirmClear(true)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-1.5 text-sm"
                  >
                    <Trash2 size={16} /> 清空记录
                  </button>
                )}
              </div>
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
