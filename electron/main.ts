import { app, BrowserWindow, ipcMain, screen, Menu, nativeImage, Tray, Notification, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import https from 'node:https'
import fs from 'node:fs'

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

const pomodoroState: PomodoroState = {
  timeLeft: 25 * 60,
  isActive: false,
  mode: 'work',
  sessionsCompleted: 0,
  popup: null,
  pomodoroSettings: {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    maxSessions: 8,
  }
};

let mainTimer: NodeJS.Timeout | null = null;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getIconPath() {
  const iconName = 'electron-vite.svg';
  const base = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : path.join(app.getAppPath(), 'dist');
  return path.join(base, iconName);
}

function updateTray() {
  if (!tray) return;
  const timeStr = formatTime(pomodoroState.timeLeft);
  if (process.platform === 'darwin') {
    const prefix = pomodoroState.mode === 'work' ? '专注' : '休息';
    tray.setTitle(pomodoroState.isActive ? `${prefix} ${timeStr}` : '');
  }
  tray.setToolTip(`Daily Planner - ${pomodoroState.mode === 'work' ? '专注' : '休息'} [${timeStr}]`);
}

function broadcastState() {
  const payload = JSON.parse(JSON.stringify(pomodoroState));
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:state', payload);
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send('pomodoro:state', payload);
  updateTray();
}

function handleModeComplete() {
  const settings = pomodoroState.pomodoroSettings;
  let title = '';
  let body = '';

  if (pomodoroState.mode === 'work') {
    pomodoroState.sessionsCompleted += 1;
    if (win && !win.isDestroyed()) win.webContents.send('pomodoro:log-session', settings.workDuration);

    if (pomodoroState.sessionsCompleted >= settings.maxSessions) {
      pomodoroState.isActive = false;
      title = '任务圆满完成';
      body = '恭喜完成今日所有番茄钟！';
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

  if (Notification.isSupported()) {
    new Notification({ title, body, icon: getIconPath() }).show();
  }
  
  pomodoroState.popup = { title, message: body };
  if (!pomodoroState.isActive) stopTimer();
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
}

function createTray() {
  if (tray) return;
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  const trayIcon = icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  
  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => { win?.show(); win?.focus(); } },
      { type: 'separator' },
      { label: pomodoroState.isActive ? '暂停' : '开始', click: () => {
          pomodoroState.isActive = !pomodoroState.isActive;
          if (pomodoroState.isActive) startTimer(); else stopTimer();
          broadcastState();
          updateMenu();
        }
      },
      { label: '显示/隐藏悬浮窗', click: () => toggleFloatingWindow() },
      { type: 'separator' },
      { label: '检查更新', click: () => shell.openExternal('https://github.com/lqf0624/daily-planner-ai/releases/latest') },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray?.setContextMenu(contextMenu);
  };
  
  tray.on('click', () => { win?.show(); win?.focus(); });
  updateMenu();
}

function toggleFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    if (floatingWin.isVisible()) floatingWin.hide();
    else floatingWin.show();
  } else {
    createFloatingWindow();
  }
}

function createWindow() {
  win = new BrowserWindow({
    icon: getIconPath(), width: 1200, height: 800,
    frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.mjs'), backgroundThrottling: false }
  });
  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win?.hide(); } });
}

function createFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  floatingWin = new BrowserWindow({
    width: 220, height: 220,
    x: width - 240, y: height - 240,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.mjs'), backgroundThrottling: false }
  });
  floatingWin.loadURL(`${VITE_DEV_SERVER_URL || 'file://' + path.join(RENDERER_DIST, 'index.html')}?view=floating`);
  floatingWin.on('closed', () => { floatingWin = null; });
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
      path: '/repos/lqf0624/daily-planner-ai/releases/latest',
      headers: { 'User-Agent': 'Daily-Planner-AI' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const version = release.tag_name.replace('v', '');
          const platformExt = process.platform === 'win32' ? '.exe' : '.dmg';
          const asset = release.assets.find((a: GitHubAsset) => a.name.endsWith(platformExt));
          resolve({ version, url: asset?.browser_download_url, notes: release.body });
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
});

ipcMain.on('app:start-download', (event, url) => {
  const fileName = path.basename(url);
  const filePath = path.join(app.getPath('downloads'), fileName);
  const file = fs.createWriteStream(filePath);
  
  const download = (targetUrl: string) => {
    https.get(targetUrl, { headers: { 'User-Agent': 'Daily-Planner-AI' } }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        download(res.headers.location);
        return;
      }
      const totalSize = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        event.reply('app:download-progress', totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0);
      });
      res.on('end', () => {
        file.end();
        event.reply('app:download-complete', filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      event.reply('app:download-error', err.message);
    });
  };
  download(url);
});

ipcMain.on('app:install-update', (_event, filePath) => { shell.openPath(filePath); });

// --- IPC 监听 ---
ipcMain.on('floating:toggle', () => toggleFloatingWindow());
ipcMain.on('floating:show', () => { if (floatingWin) floatingWin.show(); else createFloatingWindow(); });
ipcMain.on('floating:resize', (_event, size) => {
  if (floatingWin) {
    const [oldWidth, oldHeight] = floatingWin.getSize();
    const [oldX, oldY] = floatingWin.getPosition();
    floatingWin.setBounds({ x: oldX + (oldWidth - size.width), y: oldY + (oldHeight - size.height), width: size.width, height: size.height });
  }
});

ipcMain.on('pomodoro:action', (_, action) => {
  switch (action.type) {
    case 'toggle': pomodoroState.isActive = !pomodoroState.isActive; if (pomodoroState.isActive) startTimer(); else stopTimer(); break;
    case 'reset': pomodoroState.isActive = false; pomodoroState.timeLeft = pomodoroState.pomodoroSettings.workDuration * 60; stopTimer(); break;
    case 'skip': if (pomodoroState.mode !== 'work') handleModeComplete(); break;
    case 'dismissPopup': pomodoroState.popup = null; break;
    case 'updateSettings': pomodoroState.pomodoroSettings = { ...pomodoroState.pomodoroSettings, ...action.settings }; if (!pomodoroState.isActive) pomodoroState.timeLeft = pomodoroState.pomodoroSettings.workDuration * 60; break;
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
ipcMain.on('floating:setPosition', (_event, pos) => { if (floatingWin) floatingWin.setPosition(pos.x, pos.y); });
ipcMain.handle('floating:getAlwaysOnTop', () => floatingWin?.isAlwaysOnTop() || false);
ipcMain.handle('floating:setAlwaysOnTop', (_event, enabled) => { floatingWin?.setAlwaysOnTop(enabled, 'floating'); return enabled; });

app.whenReady().then(() => { createTray(); createWindow(); createFloatingWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });