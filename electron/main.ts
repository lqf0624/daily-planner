import { app, BrowserWindow, ipcMain, screen, Menu, nativeImage, Tray } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
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
let tray: Tray | null = null
let isQuitting = false

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，焦点聚焦到主窗口
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

function showMainWindow() {
  if (!win || win.isDestroyed()) {
    createWindow()
  } else {
    win.show()
    win.focus()
  }
  if (process.platform === 'darwin') {
    app.dock?.show()
  }
}

function getTrayIcon() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) return icon
  return nativeImage.createEmpty()
}

function createTray() {
  if (tray) return
  tray = new Tray(getTrayIcon())
  tray.setToolTip('Daily Planner')
  tray.on('click', () => {
    showMainWindow()
  })
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => showMainWindow() },
    { label: '退出', click: () => quitApp() },
  ])
  tray.setContextMenu(contextMenu)
}

function quitApp() {
  isQuitting = true
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.destroy()
  }
  if (win && !win.isDestroyed()) {
    win.destroy()
  }
  app.quit()
}

function createWindow() {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }

  const windowOptions: BrowserWindowConstructorOptions = {
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    title: 'Daily Planner',
    autoHideMenuBar: true,
    frame: false, // 移除系统默认边框
    transparent: true, // 开启透明窗口支持
    backgroundColor: '#00000000', // 设置背景完全透明
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: false, // 允许跨域请求，解决 CalDAV 连接问题
    },
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : {}),
  }
  win = new BrowserWindow(windowOptions)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.setMenuBarVisibility(false)

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

  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win?.webContents.send('app:request-close')
  })
}

// ... existing createFloatingWindow ...

ipcMain.on('app:quit', () => {
  quitApp()
})

ipcMain.on('app:minimize-to-tray', () => {
  if (win && !win.isDestroyed()) {
    createTray()
    win.hide()
    if (process.platform === 'darwin') {
      app.dock?.hide()
    }
  }
})

function createFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) {
    return;
  }
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
      backgroundThrottling: false,
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

ipcMain.on('window-control', (_event, action: 'minimize' | 'maximize' | 'close') => {
  if (!win || win.isDestroyed()) return;
  if (action === 'minimize') {
    win.minimize();
  } else if (action === 'maximize') {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  } else if (action === 'close') {
    win.close();
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

ipcMain.on('floating:toggle', () => {
  if (!floatingWin || floatingWin.isDestroyed()) {
    createFloatingWindow();
    return;
  }
  if (floatingWin.isVisible()) {
    floatingWin.hide();
  } else {
    floatingWin.show();
  }
});

ipcMain.on('floating:hide', () => {
  if (floatingWin && !floatingWin.isDestroyed()) {
    floatingWin.hide();
  }
});

ipcMain.on('floating:show', () => {
  if (!floatingWin || floatingWin.isDestroyed()) {
    createFloatingWindow();
  } else {
    floatingWin.show();
  }
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
  } else {
    showMainWindow()
  }
  if (!floatingWin || floatingWin.isDestroyed()) {
    createFloatingWindow()
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  app.on('before-quit', () => {
    isQuitting = true
  })
  createWindow()
  createFloatingWindow()
})
