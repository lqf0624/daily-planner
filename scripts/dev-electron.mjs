import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const ports = Array.from({ length: 11 }, (_, idx) => 5173 + idx);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isServerUp = (port) => new Promise((resolve) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
    res.resume();
    resolve(true);
  });
  req.on('error', () => resolve(false));
  req.setTimeout(500, () => {
    req.destroy();
    resolve(false);
  });
});

const findServerUrl = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (const port of ports) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await isServerUp(port);
      if (ok) {
        return `http://localhost:${port}/`;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(500);
  }
  return null;
};

const start = async () => {
  const vite = spawn(npmCmd, ['run', 'dev:ui'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_STARTER: 'manual',
    },
  });

  const url = await findServerUrl();
  if (!url) {
    console.error('无法检测到 Vite 开发服务器，请确认是否启动成功。');
    vite.kill();
    process.exit(1);
  }

  const electron = spawn(electronBin, ['.', '--no-sandbox'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url,
    },
  });

  const cleanup = () => {
    vite.kill();
    electron.kill();
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  vite.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Vite 已退出 (code: ${code})`);
    }
    electron.kill();
  });

  electron.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Electron 已退出 (code: ${code})`);
    }
  });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
