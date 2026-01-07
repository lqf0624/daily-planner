export const showToast = (title: string, message: string, kind: 'habit' | 'task' | 'system' = 'system') => {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('app-toast', { detail: { title, message, kind } });
  window.dispatchEvent(event);
};
