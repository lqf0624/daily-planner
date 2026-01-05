import axios from 'axios';
import { useAppStore } from '../stores/useAppStore';

const AUTH_URL = 'http://openapi.baidu.com/oauth/2.0/authorize';
const REDIRECT_URI = 'http://localhost:5173'; // Or your production URI

// Helper to get settings from store
const getSettings = () => useAppStore.getState().baiduSettings;

export const initiateLogin = () => {
  const { appKey } = getSettings();
  if (!appKey) {
    alert('请先在设置中配置百度网盘 AppKey');
    return;
  }
  
  const url = `${AUTH_URL}?response_type=token&client_id=${appKey}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=basic,netdisk`;
  window.location.href = url;
};

// Check if URL has token (call this on app init)
export const checkAuthCallback = () => {
  const hash = window.location.hash;
  if (hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1)); // remove #
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    
    if (accessToken) {
      useAppStore.getState().updateBaiduSettings({
        accessToken,
        expiresAt: Date.now() + (Number(expiresIn) * 1000)
      });
      // Clear hash to clean up URL
      window.history.replaceState(null, '', window.location.pathname);
      alert('百度网盘授权成功！');
    }
  }
};

export const uploadBackup = async () => {
  const { accessToken, backupFileName } = getSettings();
  if (!accessToken) throw new Error('未授权，请先登录百度网盘');

  const state = useAppStore.getState();
  const dataToBackup = {
    tasks: state.tasks,
    groups: state.groups,
    goals: state.goals,
    weeklyPlans: state.weeklyPlans,
    habits: state.habits,
    pomodoroSettings: state.pomodoroSettings,
    aiSettings: state.aiSettings,
    timestamp: Date.now(),
    version: '1.0'
  };

  const fileName = backupFileName || 'daily-planner-backup.json';
  const content = JSON.stringify(dataToBackup);
  
  // 1. Precreate file to get uploadid (optional for small files, but good practice? Actually 'upload' method handles small files directly)
  // For simplicity, using simple upload for small files. Baidu API 'xpan/file?method=upload' requires multipart/form-data
  
  const formData = new FormData();
  const file = new File([content], fileName, { type: 'application/json' });
  formData.append('file', file);

  try {
    const res = await axios.post(`https://pan.baidu.com/rest/2.0/xpan/file?method=upload&access_token=${accessToken}&path=/apps/daily-planner/${fileName}&ondup=overwrite`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (res.data.errno && res.data.errno !== 0) {
      throw new Error(`Upload failed: ${res.data.errno}`);
    }
    return res.data;
  } catch (e: any) {
    console.error('Upload error', e);
    throw new Error(e.response?.data?.errmsg || e.message || '备份上传失败');
  }
};

export const downloadBackup = async () => {
  const { accessToken, backupFileName } = getSettings();
  if (!accessToken) throw new Error('未授权，请先登录百度网盘');

  const fileName = backupFileName || 'daily-planner-backup.json';
  
  // 1. Get Dlink (optional, or just try to download if we know path? xpan/file?method=download requires fsid usually? No, there is dlink query)
  // Standard way: list file to get fs_id/dlink, then download.
  
  try {
    // Search for the file to get dlink
    const listRes = await axios.get(`https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token=${accessToken}&dir=/apps/daily-planner/`);
    
    if (listRes.data.errno !== 0) throw new Error('无法获取文件列表');
    
    const fileInfo = listRes.data.list.find((f: any) => f.server_filename === fileName);
    if (!fileInfo) throw new Error('云端未找到备份文件');
    
    // Download using dlink requires access_token appended
    const downloadUrl = `${fileInfo.dlink}&access_token=${accessToken}`;
    
    const contentRes = await axios.get(downloadUrl);
    const data = contentRes.data;
    
    if (!data || !data.tasks) throw new Error('备份文件格式无效');
    
    // Restore data
    const store = useAppStore.getState();
    // Batch updates? Zustand doesn't have batch update for root, but we can do one by one or add a 'importData' action.
    // Let's add 'importData' to store first. For now, manual update.
    store.importData(data);
    
    return true;
  } catch (e: any) {
    console.error('Download error', e);
    throw new Error(e.message || '恢复失败');
  }
};
