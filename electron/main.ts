import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
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
}

// Log handler
ipcMain.on('log-message', (_event, message) => {
  console.log(message);
});

// 保留媒体键处理禁用，避免影响输入法相关特性
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
