import React, { useState } from 'react';
import { 
  Database, Settings as SettingsIcon, RefreshCw, Download, Upload, Info, Loader2,
  CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { aiSettings, updateAISettings, importData } = useAppStore();
  
  const [isChecking, setIsChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('0 KB/s');
  const [newVersion, setNewVersion] = useState('');
  const [updateObj, setUpdateObj] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const handleExport = async () => {
    try {
      const data = useAppStore.getState();
      const content = JSON.stringify(data, null, 2);
      const path = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `daily-planner-backup-${new Date().toISOString().split('T')[0]}.json`
      });
      if (path) {
        await writeTextFile(path, content);
        alert('数据已成功导出！');
      }
    } catch (e) {
      alert('导出失败: ' + e);
    }
  };

  const handleImport = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (path && typeof path === 'string') {
        const content = await readTextFile(path);
        const json = JSON.parse(content);
        if (!json.tasks || !json.habits) throw new Error('无效的备份文件');
        importData(json);
        alert('导入成功！');
        window.location.reload();
      }
    } catch (e) {
      alert('导入失败: ' + e);
    }
  };

  const handleCheckUpdate = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const update = await check();
      if (update?.available) {
        setNewVersion(update.version);
        setUpdateObj(update);
        setUpdateStatus('available');
      } else {
        alert('当前已是最新版本');
      }
    } catch (e) {
      alert('无法获取更新信息。');
    } finally {
      setIsChecking(false);
    }
  };

  const startDownload = async () => {
    if (!updateObj) return;
    setUpdateStatus('downloading');
    let downloaded = 0;
    let contentLength = 0;
    const startTime = Date.now();

    try {
      await updateObj.downloadAndInstall((event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (event.event === 'Started') contentLength = event.data.contentLength || 0;
        else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) setDownloadProgress(Math.round((downloaded / contentLength) * 100));
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > 0) {
            const speed = downloaded / elapsed;
            setDownloadSpeed(speed > 1024 * 1024 ? `${(speed / 1024 / 1024).toFixed(2)} MB/s` : `${(speed / 1024).toFixed(2)} KB/s`);
          }
        } else if (event.event === 'Finished') setUpdateStatus('ready');
      });
    } catch (e) {
      setUpdateStatus('idle');
      alert('下载失败');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] h-[65vh] flex flex-col p-0 overflow-hidden rounded-3xl border-slate-200 bg-white">
        <DialogHeader className="p-6 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><SettingsIcon size={20} className="text-primary" /></div>
            <DialogTitle className="text-xl font-black text-slate-800">应用设置</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs defaultValue="ai" className="flex-1 flex overflow-hidden">
          <TabsList className="w-40 flex flex-col h-full bg-slate-50 p-4 gap-2 border-r border-slate-100 rounded-none">
            <TabsTrigger value="ai" className="w-full justify-start font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">AI 设置</TabsTrigger>
            <TabsTrigger value="data" className="w-full justify-start font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">数据管理</TabsTrigger>
            <TabsTrigger value="about" className="w-full justify-start font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">关于应用</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="ai" className="m-0 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Base URL</label>
                  <Input value={aiSettings.baseUrl} onChange={e => updateAISettings({ baseUrl: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="https://api.openai.com/v1" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                  <Input type="password" value={aiSettings.apiKey} onChange={e => updateAISettings({ apiKey: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="sk-..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">模型名称</label>
                  <Input value={aiSettings.model} onChange={e => updateAISettings({ model: e.target.value })} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="gpt-3.5-turbo" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="data" className="m-0 space-y-6">
              <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center gap-4">
                <Database size={40} className="text-slate-200" />
                <div className="space-y-1">
                  <h4 className="font-black text-slate-700">本地备份</h4>
                  <p className="text-xs text-slate-400 font-medium px-4">使用原生文件对话框安全地导出或导入您的数据。</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <Button variant="outline" onClick={handleExport} className="flex-1 rounded-xl h-11 border-slate-200 gap-2">
                    <Download size={16} /> 导出备份
                  </Button>
                  <Button variant="outline" onClick={handleImport} className="flex-1 rounded-xl h-11 border-slate-200 gap-2">
                    <Upload size={16} /> 导入备份
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="m-0 space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm"><Info size={24} className="text-primary" /></div>
                  <div>
                    <h4 className="font-black text-slate-800">Daily Planner AI</h4>
                    <p className="text-xs text-slate-400 font-bold">Version 0.1.18</p>
                  </div>
                </div>

                {updateStatus === 'idle' && (
                  <Button onClick={handleCheckUpdate} disabled={isChecking} className="w-full h-12 rounded-xl font-bold gap-2">
                    {isChecking ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    {isChecking ? '正在检查...' : '检查更新'}
                  </Button>
                )}

                {updateStatus === 'available' && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-4">
                    <span className="text-sm font-black text-primary">发现新版本: {newVersion}</span>
                    <Button onClick={startDownload} className="w-full h-10 rounded-xl font-bold">立即下载并更新</Button>
                  </div>
                )}

                {updateStatus === 'downloading' && (
                  <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black text-slate-500">正在下载...</span>
                      <span className="text-xs font-bold text-primary">{downloadSpeed}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                    </div>
                    <p className="text-[10px] text-center text-slate-400">{downloadProgress}% 完成</p>
                  </div>
                )}

                {updateStatus === 'ready' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-center space-y-3">
                    <CheckCircle2 size={32} className="mx-auto text-green-500" />
                    <p className="text-xs text-green-600 font-medium">下载完成，请重启安装。</p>
                    <Button onClick={() => relaunch()} className="w-full h-10 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-white">立即重启</Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default Settings;
