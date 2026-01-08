import { app, BrowserWindow, ipcMain, screen, Menu, nativeImage, Tray, Notification, shell, NativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import https from 'node:https'
import Store from 'electron-store'

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

type PomodoroState = {
  timeLeft: number;
  isActive: boolean;
  mode: 'work' | 'shortBreak' | 'longBreak';
  sessionsCompleted: number;
  popup: { title: string; message: string } | null;
  pomodoroSettings: {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number;
    autoStartBreaks: boolean;
    autoStartPomodoros: boolean;
    maxSessions: number;
  };
};

let win: BrowserWindow | null = null
let floatingWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// --- 状态与图标缓存 ---
const iconCache: Record<string, NativeImage> = {};
let lastMenuState = {
  isActive: false,
  isFloatingAlive: false,
  mode: ''
};

function getCachedIcon(mode: 'work' | 'shortBreak' | 'longBreak') {
  const base = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;
  const isMac = process.platform === 'darwin';
  const isWork = mode === 'work';
  const iconPath = path.join(base, isMac 
    ? (isWork ? 'tray-work-mac.png' : 'tray-rest-mac.png') 
    : (isWork ? 'tray-work-win.png' : 'tray-rest-win.png')
  );

  if (iconCache[iconPath]) return iconCache[iconPath];
  
  let icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'win32') {
    icon = icon.resize({ width: 16, height: 16 });
  } else if (process.platform === 'darwin') {
    icon = icon.resize({ width: 22, height: 22 });
    icon.setTemplateImage(true);
  }
  iconCache[iconPath] = icon;
  return icon;
}

const FLOAT_NORMAL_SIZE = { width: 220, height: 220 };
const FLOAT_MINI_SIZE = { width: 160, height: 40 };
let currentFloatMode: 'normal' | 'mini' = 'normal';

const store = new Store();

const defaultSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  maxSessions: 8,
};

const pomodoroState: PomodoroState = {
  timeLeft: 25 * 60,
  isActive: false,
  mode: 'work',
  sessionsCompleted: 0,
  popup: null,
  pomodoroSettings: {
    ...defaultSettings,
    ...(store.get('pomodoroSettings') as object || {})
  }
};

let mainTimer: NodeJS.Timeout | null = null;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getAppIconPath() {
  const base = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;
  return path.join(base, 'icon.png');
}

function updateTray() {
  if (!tray) return;
  const timeStr = formatTime(pomodoroState.timeLeft);
  const isWork = pomodoroState.mode === 'work';
  
  if (process.platform === 'darwin') {
    const prefix = isWork ? '专注' : '休息';
    tray.setTitle(pomodoroState.isActive ? `${prefix} ${timeStr}` : '');
  }
  tray.setToolTip(`Daily Planner - ${isWork ? '专注' : '休息'} [${timeStr}]`);
  tray.setImage(getCachedIcon(pomodoroState.mode));
  
  const isFloatingAlive = !!(floatingWin && !floatingWin.isDestroyed());
  if (lastMenuState.isActive !== pomodoroState.isActive || 
      lastMenuState.isFloatingAlive !== isFloatingAlive ||
      lastMenuState.mode !== pomodoroState.mode) {
    updateTrayMenu();
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const isFloatingAlive = !!(floatingWin && !floatingWin.isDestroyed());
  
  lastMenuState = {
    isActive: pomodoroState.isActive,
    isFloatingAlive,
    mode: pomodoroState.mode
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: pomodoroState.isActive ? '暂停' : '开始', click: () => {
        pomodoroState.isActive = !pomodoroState.isActive;
        if (pomodoroState.isActive) startTimer(); else stopTimer();
        broadcastState();
      }
    },
    { label: isFloatingAlive ? '关闭悬浮窗' : '打开悬浮窗', click: () => toggleFloatingWindow() },
    { type: 'separator' },
    { label: '检查更新', click: () => { 
        if (win && !win.isDestroyed()) {
          win.show();
          win.focus();
          win.webContents.send('app:check-for-updates-request');
        }
      } 
    },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
}

function broadcastState() {
  const payload = JSON.parse(JSON.stringify(pomodoroState));
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:state', payload);
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send('pomodoro:state', payload);
  updateTray();
}

function handleModeComplete(isSkip = false) {
  const settings = pomodoroState.pomodoroSettings;
  let title = '';
  let body = '';

  if (pomodoroState.mode === 'work') {
    if (!isSkip) {
      pomodoroState.sessionsCompleted += 1;
      if (win && !win.isDestroyed()) win.webContents.send('pomodoro:log-session', settings.workDuration);
    }

    const reachedMax = pomodoroState.sessionsCompleted >= settings.maxSessions;
    
    if (reachedMax && !isSkip && settings.maxSessions > 0) {
      pomodoroState.isActive = false;
      title = '任务圆满完成';
      body = '恭喜完成今日所有番茄钟！';
      const isLongBreak = pomodoroState.sessionsCompleted % settings.longBreakInterval === 0;
      pomodoroState.mode = isLongBreak ? 'longBreak' : 'shortBreak';
      pomodoroState.timeLeft = (isLongBreak ? settings.longBreakDuration : settings.shortBreakDuration) * 60;
    } else {
      const isLongBreak = pomodoroState.sessionsCompleted % settings.longBreakInterval === 0;
      pomodoroState.mode = isLongBreak ? 'longBreak' : 'shortBreak';
      pomodoroState.timeLeft = (isLongBreak ? settings.longBreakDuration : settings.shortBreakDuration) * 60;
      pomodoroState.isActive = settings.autoStartBreaks;
      
      title = '专注结束';
      body = isLongBreak ? '进入长休息。' : '短休开始。';
    }
  } else {
    pomodoroState.mode = 'work';
    pomodoroState.timeLeft = settings.workDuration * 60;
    pomodoroState.isActive = settings.autoStartPomodoros;
    title = '休息结束';
    body = '回到专注。';
  }

  if (Notification.isSupported() && !isSkip) {
    new Notification({ title, body }).show();
  }
  
  pomodoroState.popup = isSkip ? null : { title, message: body };
  
  if (pomodoroState.isActive) {
    startTimer();
  } else {
    stopTimer();
  }
  broadcastState();
}

function startTimer() {
  if (mainTimer) clearInterval(mainTimer);
  mainTimer = setInterval(() => {
    if (pomodoroState.isActive && pomodoroState.timeLeft > 0) {
      pomodoroState.timeLeft -= 1;
      broadcastState(); 
    } else if (pomodoroState.isActive && pomodoroState.timeLeft === 0) {
      handleModeComplete();
    }
  }, 1000);
}

function stopTimer() {
  if (mainTimer) clearInterval(mainTimer);
  mainTimer = null;
  broadcastState();
}

function createTray() {
  if (tray) return;
  tray = new Tray(getCachedIcon(pomodoroState.mode));
  tray.on('click', () => { win?.show(); win?.focus(); });
  updateTray();
}

function toggleFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.close(); 
    floatingWin = null;
  } else {
    createFloatingWindow();
  }
  updateTray();
}

function createWindow() {
  win = new BrowserWindow({
    icon: getAppIconPath(), width: 1200, height: 800,
    minWidth: 1000, minHeight: 700,
    frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { 
      preload: path.join(__dirname, 'preload.mjs'),
    }
  });
  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win?.hide(); } });
}

function createFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.focus();
    return;
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const targetSize = currentFloatMode === 'mini' ? FLOAT_MINI_SIZE : FLOAT_NORMAL_SIZE;
  
  floatingWin = new BrowserWindow({
    width: targetSize.width, height: targetSize.height,
    x: width - 240, y: height - 240,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: false,
    backgroundColor: '#00000000',
    webPreferences: { 
      preload: path.join(__dirname, 'preload.mjs'), 
      backgroundThrottling: false,
      zoomFactor: 1.0 
    }
  });
  floatingWin.webContents.setVisualZoomLevelLimits(1, 1);
  floatingWin.loadURL(`${VITE_DEV_SERVER_URL || 'file://' + path.join(RENDERER_DIST, 'index.html')}?view=floating`);
  
  floatingWin.on('closed', () => { 
    floatingWin = null; 
    updateTray();
  });

  floatingWin.webContents.once('did-finish-load', () => {
    broadcastState();
  });
}

// --- 更新系统 ---
interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('app:check-update', async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/lqf0624/daily-planner/releases/latest',
      headers: { 'User-Agent': 'Daily-Planner-AI', 'Cache-Control': 'no-cache' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) { resolve(null); return; }
          const release = JSON.parse(data);
          const version = release.tag_name.replace('v', '');
          
          let asset;
          if (process.platform === 'win32') {
            asset = release.assets.find((a: GitHubAsset) => a.name.endsWith('-Setup.exe'));
          } else if (process.platform === 'darwin') {
            asset = release.assets.find((a: GitHubAsset) => a.name.endsWith('-Installer.dmg'));
          } else if (process.platform === 'linux') {
            asset = release.assets.find((a: GitHubAsset) => a.name.endsWith('.AppImage'));
          }

          resolve({ version, url: asset?.browser_download_url, notes: release.body });
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
});

ipcMain.on('app:open-url', (_event, url) => { shell.openExternal(url); });

// --- IPC 监听 ---
ipcMain.on('floating:toggle', () => toggleFloatingWindow());
ipcMain.on('floating:show', () => { if (floatingWin) floatingWin.show(); else createFloatingWindow(); });
ipcMain.on('floating:resize', (_event, size) => {
  if (floatingWin && !floatingWin.isDestroyed()) {
    currentFloatMode = size.height < 100 ? 'mini' : 'normal';
    const targetSize = currentFloatMode === 'mini' ? FLOAT_MINI_SIZE : FLOAT_NORMAL_SIZE;
    const [x, y] = floatingWin.getPosition();
    floatingWin.setBounds({ x, y, width: targetSize.width, height: targetSize.height });
  }
});

ipcMain.on('pomodoro:action', (_, action) => {
  switch (action.type) {
    case 'toggle': pomodoroState.isActive = !pomodoroState.isActive; if (pomodoroState.isActive) startTimer(); else stopTimer(); break;
    case 'reset': 
      pomodoroState.isActive = false; 
      if (pomodoroState.mode === 'work') {
        pomodoroState.timeLeft = pomodoroState.pomodoroSettings.workDuration * 60;
      } else if (pomodoroState.mode === 'shortBreak') {
        pomodoroState.timeLeft = pomodoroState.pomodoroSettings.shortBreakDuration * 60;
      } else if (pomodoroState.mode === 'longBreak') {
        pomodoroState.timeLeft = pomodoroState.pomodoroSettings.longBreakDuration * 60;
      }
      stopTimer(); 
      break;
    case 'skip': handleModeComplete(true); break;
    case 'dismissPopup': pomodoroState.popup = null; break;
    case 'updateSettings': 
      pomodoroState.pomodoroSettings = { ...pomodoroState.pomodoroSettings, ...action.settings }; 
      store.set('pomodoroSettings', pomodoroState.pomodoroSettings);
      if (!pomodoroState.isActive) pomodoroState.timeLeft = pomodoroState.pomodoroSettings.workDuration * 60; 
      break;
  }
  broadcastState();
});

ipcMain.handle('pomodoro:getState', () => pomodoroState);
ipcMain.on('window-control', (_event, action) => {
  if (!win || win.isDestroyed()) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});
ipcMain.handle('floating:getPosition', () => floatingWin ? { x: floatingWin.getPosition()[0], y: floatingWin.getPosition()[1] } : { x: 0, y: 0 });
ipcMain.on('floating:setPosition', (_event, pos) => { 
  if (floatingWin && !floatingWin.isDestroyed()) {
    const targetSize = currentFloatMode === 'mini' ? FLOAT_MINI_SIZE : FLOAT_NORMAL_SIZE;
    floatingWin.setBounds({ 
      x: Math.round(pos.x), 
      y: Math.round(pos.y), 
      width: targetSize.width, 
      height: targetSize.height 
    });
  } 
});
ipcMain.handle('floating:getAlwaysOnTop', () => floatingWin?.isAlwaysOnTop() || false);
ipcMain.handle('floating:setAlwaysOnTop', (_event, enabled) => { floatingWin?.setAlwaysOnTop(enabled, 'floating'); return enabled; });

if (gotTheLock) {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => { 
    createTray(); 
    createWindow(); 
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
