import { useEffect, useRef, useState } from 'react';
import { Database, Download, FolderTree, Info, Plus, RefreshCcw, Settings as SettingsIcon, Trash2, Upload } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useAppStore } from '../stores/useAppStore';
import { checkForUpdates, relaunchApp, supportsUpdater } from '../services/updater';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings = ({ isOpen, onClose }: SettingsProps) => {
  const {
    aiSettings,
    lists,
    updateAISettings,
    importData,
    addList,
    updateList,
    deleteList,
  } = useAppStore();

  const [version, setVersion] = useState('0.0.0');
  const [listName, setListName] = useState('');
  const [listColor, setListColor] = useState('#2563eb');
  const [updateStatus, setUpdateStatus] = useState('未检查更新');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [updateNotes, setUpdateNotes] = useState<string | null>(null);
  const pendingUpdateRef = useRef<Awaited<ReturnType<typeof checkForUpdates>>>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isOpen || !supportsUpdater()) return;
    void handleCheckUpdate(true);
  }, [isOpen]);

  const handleExport = async () => {
    const path = await save({
      defaultPath: `daily-planner-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!path) return;
    await writeTextFile(path, JSON.stringify(useAppStore.getState(), null, 2));
  };

  const handleImport = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!path || typeof path !== 'string') return;
    const content = await readTextFile(path);
    importData(JSON.parse(content));
    window.location.reload();
  };

  const handleAddList = () => {
    if (!listName.trim()) return;
    addList({
      id: crypto.randomUUID(),
      name: listName.trim(),
      color: listColor,
    });
    setListName('');
    setListColor('#2563eb');
  };

  const handleCheckUpdate = async (silent = false) => {
    if (!supportsUpdater()) {
      setUpdateStatus('当前环境不支持自动更新');
      return;
    }

    setIsCheckingUpdate(true);
    if (!silent) setUpdateStatus('正在检查更新...');

    try {
      const update = await checkForUpdates();
      pendingUpdateRef.current = update;

      if (!update) {
        setAvailableUpdateVersion(null);
        setUpdateNotes(null);
        setUpdateStatus('当前已经是最新版本');
        return;
      }

      setAvailableUpdateVersion(update.version);
      setUpdateNotes(update.body || null);
      setUpdateStatus(`发现新版本 ${update.version}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      setUpdateStatus(`检查更新失败：${message}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    const update = pendingUpdateRef.current;
    if (!update) return;

    setIsInstallingUpdate(true);
    setUpdateStatus(`正在下载并安装 ${update.version}...`);

    try {
      await update.downloadAndInstall();
      setUpdateStatus(`已安装 ${update.version}，应用即将重启`);
      await relaunchApp();
    } catch (error) {
      const message = error instanceof Error ? error.message : '安装更新失败';
      setUpdateStatus(`安装更新失败：${message}`);
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,1120px)] max-w-[1120px] overflow-hidden rounded-[32px] border-slate-200 bg-white p-0">
        <DialogHeader className="border-b border-slate-100 p-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-900">
            <div className="rounded-2xl bg-primary/10 p-2">
              <SettingsIcon size={20} className="text-primary" />
            </div>
            应用设置
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[calc(92vh-96px)] gap-6 overflow-y-auto p-6 xl:grid-cols-[1.1fr_1fr_0.95fr]">
          <section data-testid="settings-ai" className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Info size={18} className="text-primary" />
              AI 助手
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Base URL</div>
                <Input data-testid="settings-ai-base-url" value={aiSettings.baseUrl} onChange={(event) => updateAISettings({ baseUrl: event.target.value })} className="rounded-2xl border-slate-200 bg-white" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">API Key</div>
                <Input data-testid="settings-ai-api-key" type="password" value={aiSettings.apiKey} onChange={(event) => updateAISettings({ apiKey: event.target.value })} className="rounded-2xl border-slate-200 bg-white" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">模型</div>
                <Input data-testid="settings-ai-model" value={aiSettings.model} onChange={(event) => updateAISettings({ model: event.target.value })} className="rounded-2xl border-slate-200 bg-white" />
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <FolderTree size={18} className="text-primary" />
              任务分类
            </div>
            <p className="mt-3 text-sm text-slate-500">这里的分类会同步出现在任务创建、日历筛选和清单归属里。</p>
            <div className="mt-4 flex gap-3">
              <Input
                data-testid="settings-list-name"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                className="rounded-2xl border-slate-200 bg-white"
                placeholder="新分类名称"
              />
              <input
                data-testid="settings-list-color"
                type="color"
                value={listColor}
                onChange={(event) => setListColor(event.target.value)}
                className="h-11 w-14 rounded-2xl border border-slate-200 bg-white p-1"
              />
              <Button data-testid="settings-list-add" className="rounded-2xl" onClick={handleAddList}>
                <Plus size={16} className="mr-2" />
                添加
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {lists.map((list) => (
                <div key={list.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: list.color }} />
                  <Input
                    value={list.name}
                    onChange={(event) => updateList(list.id, { name: event.target.value })}
                    className="h-10 rounded-xl border-slate-200 bg-slate-50"
                  />
                  {list.id !== 'inbox' && (
                    <button
                      type="button"
                      className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50"
                      onClick={() => deleteList(list.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Database size={18} className="text-primary" />
              数据与更新
            </div>
            <p className="mt-3 text-sm text-slate-500">保持本地数据可恢复，也支持直接从应用内检查和安装新版本。</p>
            <div className="mt-6 grid gap-3">
              <Button variant="outline" className="justify-start rounded-2xl" onClick={handleExport}>
                <Download size={16} className="mr-2" />
                导出完整备份
              </Button>
              <Button variant="outline" className="justify-start rounded-2xl" onClick={handleImport}>
                <Upload size={16} className="mr-2" />
                导入备份
              </Button>
            </div>
            <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-slate-500">
              当前版本 <span className="font-semibold text-slate-900">{version}</span>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">自动更新</div>
                  <div data-testid="settings-update-status" className="mt-1 text-sm text-slate-500">{updateStatus}</div>
                </div>
                <Button
                  data-testid="settings-check-update"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleCheckUpdate(false)}
                  disabled={isCheckingUpdate}
                >
                  <RefreshCcw size={16} className="mr-2" />
                  {isCheckingUpdate ? '检查中' : '检查更新'}
                </Button>
              </div>
              {availableUpdateVersion && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">可更新到 {availableUpdateVersion}</div>
                  {updateNotes && (
                    <div data-testid="settings-update-notes" className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-500">
                      {updateNotes}
                    </div>
                  )}
                  <Button
                    data-testid="settings-install-update"
                    className="mt-4 rounded-2xl"
                    onClick={() => void handleInstallUpdate()}
                    disabled={isInstallingUpdate}
                  >
                    {isInstallingUpdate ? '安装中...' : '下载并安装'}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Settings;
