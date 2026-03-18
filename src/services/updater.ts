type UpdateInfo = {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
};

type UpdaterMock = {
  check?: () => Promise<UpdateInfo | null>;
  downloadAndInstall?: () => Promise<void>;
  relaunch?: () => Promise<void>;
};

type UpdateHandle = {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall: () => Promise<void>;
};

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TEST_UPDATER__?: UpdaterMock;
  }
}

const getMockUpdate = async (): Promise<UpdateHandle | null> => {
  if (typeof window === 'undefined' || !window.__TEST_UPDATER__?.check) return null;
  const update = await window.__TEST_UPDATER__.check();
  if (!update) return null;
  return {
    ...update,
    downloadAndInstall: async () => {
      await window.__TEST_UPDATER__?.downloadAndInstall?.();
    },
  };
};

export const supportsUpdater = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TEST_UPDATER__);
};

export const checkForUpdates = async (): Promise<UpdateHandle | null> => {
  const mockUpdate = await getMockUpdate();
  if (mockUpdate) return mockUpdate;
  if (!supportsUpdater()) return null;

  const { check } = await import('@tauri-apps/plugin-updater');
  return await check();
};

export const relaunchApp = async () => {
  if (typeof window !== 'undefined' && window.__TEST_UPDATER__?.relaunch) {
    await window.__TEST_UPDATER__.relaunch();
    return;
  }
  if (!supportsUpdater()) return;
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
};
