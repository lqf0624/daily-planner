import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import FloatingPomodoro from './views/FloatingPomodoro.tsx'
import './index.css'
import { PomodoroProvider } from './contexts/PomodoroContext'

console.log('🚀 Daily Planner Frontend Initializing...');

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const view = params?.get('view')
const Root = view === 'floating' ? FloatingPomodoro : App

if (view === 'floating' && typeof document !== 'undefined') {
  document.body.classList.add('floating-view')
  document.documentElement.classList.add('floating-view')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PomodoroProvider>
      <Root />
    </PomodoroProvider>
  </React.StrictMode>,
)

// 全局禁用默认右键菜单
document.addEventListener('contextmenu', (e) => e.preventDefault());

