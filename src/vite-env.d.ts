/// <reference types="vite/client" />

declare interface Window {
  __TAURI_METADATA__: {
    __windows: { label: string }[];
    __currentWindow: { label: string };
  };
}
