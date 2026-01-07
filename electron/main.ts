import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

let win: BrowserWindow | null
let floatingWin: BrowserWindow | null
let pomodoroState: PomodoroState | null = null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    title: 'Daily Planner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 允许跨域请求，解决 CalDAV 连接问题
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 关键修复：确保窗口加载后输入法能正常唤起
  win.webContents.on('dom-ready', () => {
    win?.focus();
    win?.webContents.focus();
  });

  // 拦截百度网盘 API 请求，强制修改 Referer 以绕过限制
  // 注意：生产环境如果使用 file:// 协议，这里必须伪造一个 http 的 Referer
  // 请确保百度开放平台后台的“根域名绑定”和“授权回调页”也配置了相同的域名（如 localhost:5173）
  win.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://openapi.baidu.com/*', '*://pan.baidu.com/*', '*://pcs.baidu.com/*'] },
    (details, callback) => {
      // 强制设置 Referer 为授权回调页的域名
      details.requestHeaders['Referer'] = 'http://localhost:5173';
      // 有些接口可能还需要 Origin
      details.requestHeaders['Origin'] = 'http://localhost:5173';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  win.on('closed', () => {
    win = null;
  });
}

function createFloatingWindow() {
  if (floatingWin) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  floatingWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 220,
    height: 220,
    x: Math.max(0, width - 260),
    y: Math.max(0, height - 320),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  floatingWin.setMenuBarVisibility(false);
  floatingWin.setAlwaysOnTop(true, 'floating');
  floatingWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (VITE_DEV_SERVER_URL) {
    floatingWin.loadURL(`${VITE_DEV_SERVER_URL}?view=floating`);
  } else {
    floatingWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { view: 'floating' } });
  }

  floatingWin.on('closed', () => {
    floatingWin = null;
  });
}

// Log handler
ipcMain.on('log-message', (_event, message) => {
  console.log(message);
});

ipcMain.on('pomodoro:state', (_event, state: PomodoroState) => {
  pomodoroState = state;
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.webContents.send('pomodoro:state', state);
  }
});

ipcMain.handle('pomodoro:getState', () => pomodoroState);

ipcMain.on('pomodoro:action', (_event, action) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('pomodoro:action', action);
  }
});

ipcMain.on('app:open-tab', (_event, tab) => {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.webContents.send('app:open-tab', tab);
  }
});

ipcMain.handle('floating:getPosition', () => {
  if (!floatingWin || floatingWin.isDestroyed()) return { x: 0, y: 0 };
  const [x, y] = floatingWin.getPosition();
  return { x, y };
});

ipcMain.on('floating:setPosition', (_event, position: { x: number; y: number }) => {
  if (!floatingWin || floatingWin.isDestroyed()) return;
  const display = screen.getDisplayMatching({
    x: position.x,
    y: position.y,
    width: floatingWin.getBounds().width,
    height: floatingWin.getBounds().height,
  });
  const maxX = display.workArea.x + Math.max(0, display.workArea.width - floatingWin.getBounds().width);
  const maxY = display.workArea.y + Math.max(0, display.workArea.height - floatingWin.getBounds().height);
  const nextX = Math.min(Math.max(position.x, display.workArea.x), maxX);
  const nextY = Math.min(Math.max(position.y, display.workArea.y), maxY);
  floatingWin.setPosition(nextX, nextY);
});

ipcMain.handle('floating:getAlwaysOnTop', () => {
  if (!floatingWin || floatingWin.isDestroyed()) return false;
  return floatingWin.isAlwaysOnTop();
});

ipcMain.handle('floating:setAlwaysOnTop', (_event, enabled: boolean) => {
  if (!floatingWin || floatingWin.isDestroyed()) return false;
  floatingWin.setAlwaysOnTop(Boolean(enabled), 'floating');
  return floatingWin.isAlwaysOnTop();
});

// 保留媒体键处理禁用，避免影响输入法相关特性
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
    floatingWin = null
  }
})

app.on('activate', () => {
  if (!win || win.isDestroyed()) {
    createWindow()
  }
  if (!floatingWin || floatingWin.isDestroyed()) {
    createFloatingWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  createFloatingWindow()
})
