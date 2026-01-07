/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void;
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
    off: (channel: string, ...args: unknown[]) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };
}