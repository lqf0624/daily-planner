import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { PomodoroProvider } from './contexts/PomodoroContext';
import { I18nProvider } from './i18n';
import './index.css';
import FloatingPomodoro from './views/FloatingPomodoro.tsx';

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const view = params?.get('view');
const Root = view === 'floating' ? FloatingPomodoro : App;

if (view === 'floating' && typeof document !== 'undefined') {
  document.body.classList.add('floating-view');
  document.documentElement.classList.add('floating-view');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <PomodoroProvider>
        <Root />
      </PomodoroProvider>
    </I18nProvider>
  </React.StrictMode>,
);

document.addEventListener('contextmenu', (event) => event.preventDefault());
