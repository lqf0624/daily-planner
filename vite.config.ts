import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // 使用 127.0.0.1 替代 localhost 以确保最稳定的连接
    host: '127.0.0.1',
  },
  clearScreen: false,
})
