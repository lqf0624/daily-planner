import React from 'react';
import { X, Key, Save, Globe, Cpu } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { aiSettings, updateAISettings } = useAppStore();

  if (!isOpen) return null;

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
