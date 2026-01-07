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
let tray: Tray | null = null
let isQuitting = false

// --- 主进程番茄钟逻辑 ---
let pomodoroState: PomodoroState = {
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

function updateTrayDisplay() {
  if (!tray) return;
  const timeStr = formatTime(pomodoroState.timeLeft);
  const modeLabel = pomodoroState.mode === 'work' ? '专注' : '休息';
  const statusStr = pomodoroState.isActive ? `${modeLabel} ${timeStr}` : `已暂停 ${timeStr}`;

  if (process.platform === 'darwin') {
    // macOS 菜单栏特有：在图标旁显示文字
    tray.setTitle(pomodoroState.isActive ? ` ${timeStr}` : ''); 
  }
  
  tray.setToolTip(`Daily Planner - ${statusStr}`);
}

function broadcastState() {
  const payload = JSON.parse(JSON.stringify(pomodoroState));
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:state', payload);
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send('pomodoro:state', payload);
  updateTrayDisplay();
}

function startTimer() {
  if (mainTimer) clearInterval(mainTimer);
  mainTimer = setInterval(() => {
    if (pomodoroState.isActive && pomodoroState.timeLeft > 0) {
      pomodoroState.timeLeft -= 1;
      broadcastState();
    } else if (pomodoroState.timeLeft === 0 && pomodoroState.isActive) {
      stopTimer();
      if (win && !win.isDestroyed()) win.webContents.send('pomodoro:on-complete');
      if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send('pomodoro:on-complete');
    }
  }, 1000);
}

function stopTimer() {
  if (mainTimer) {
    clearInterval(mainTimer);
    mainTimer = null;
  }
  updateTrayDisplay();
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
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
  
  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => showMainWindow() },
      { type: 'separator' },
      { label: pomodoroState.isActive ? '暂停番茄钟' : '开始番茄钟', 
        click: () => {
          pomodoroState.isActive = !pomodoroState.isActive;
          if (pomodoroState.isActive) startTimer(); else stopTimer();
          broadcastState();
          updateMenu();
        } 
      },
      { label: '重置番茄钟', click: () => {
          const duration = pomodoroState.mode === 'work' ? pomodoroState.pomodoroSettings.workDuration : pomodoroState.pomodoroSettings.shortBreakDuration;
          pomodoroState.timeLeft = duration * 60;
          pomodoroState.isActive = false;
          stopTimer();
          broadcastState();
          updateMenu();
        } 
      },
      { type: 'separator' },
      { label: '显示/隐藏悬浮球', click: () => {
          if (floatingWin && floatingWin.isVisible()) floatingWin.hide();
          else if (floatingWin) floatingWin.show();
          else createFloatingWindow();
        }
      },
      { type: 'separator' },
      { label: '退出', click: () => quitApp() },
    ])
    tray?.setContextMenu(contextMenu)
  }

  tray.on('click', () => {
    showMainWindow()
  })
  
  updateMenu();
}

function quitApp() {
  isQuitting = true
  stopTimer();
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.destroy()
  if (win && !win.isDestroyed()) win.destroy()
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
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: false,
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
  }
  win = new BrowserWindow(windowOptions)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.webContents.on('dom-ready', () => {
    win?.focus();
    broadcastState();
  });

  win.on('closed', () => { win = null; });
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win?.webContents.send('app:request-close')
  })
}

function createFloatingWindow() {
  if (floatingWin && !floatingWin.isDestroyed()) return;
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

  floatingWin.webContents.on('dom-ready', () => {
    broadcastState();
  });

  floatingWin.on('closed', () => { floatingWin = null; });
}

// IPC Handlers
ipcMain.on('app:quit', () => { quitApp() })
ipcMain.on('app:minimize-to-tray', () => {
  if (win) {
    win.hide();
    if (process.platform === 'darwin') app.dock?.hide();
  }
})

ipcMain.on('pomodoro:sync-state', (_event, newState: PomodoroState) => {
  pomodoroState = newState;
  if (pomodoroState.isActive) startTimer(); else stopTimer();
  broadcastState();
});

ipcMain.handle('pomodoro:getState', () => pomodoroState);

ipcMain.on('pomodoro:action', (_event, action) => {
  if (win && !win.isDestroyed()) win.webContents.send('pomodoro:action', action);
  if (floatingWin && !floatingWin.isDestroyed()) floatingWin.webContents.send('pomodoro:action', action);
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
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

ipcMain.handle('floating:getPosition', () => {
  if (!floatingWin) return { x: 0, y: 0 };
  const [x, y] = floatingWin.getPosition();
  return { x, y };
});

ipcMain.on('floating:setPosition', (_event, pos) => {
  if (floatingWin) floatingWin.setPosition(pos.x, pos.y);
});

ipcMain.handle('floating:getAlwaysOnTop', () => floatingWin?.isAlwaysOnTop() || false);
ipcMain.handle('floating:setAlwaysOnTop', (_event, enabled) => {
  floatingWin?.setAlwaysOnTop(enabled, 'floating');
  return enabled;
});

ipcMain.on('floating:hide', () => { floatingWin?.hide(); });
ipcMain.on('floating:show', () => {
  if (!floatingWin) createFloatingWindow();
  else floatingWin.show();
});

app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') quitApp();
})

app.on('activate', () => {
  if (!win) createWindow();
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createTray()
  createWindow()
  createFloatingWindow()
})