import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Ensure the persisted theme is applied (index.html also does an early pass).
import { useThemeStore, applyTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
applyTheme(useThemeStore.getState().theme);

// Load the chat theme (accent + wallpaper) for the current user, and re-load it
// whenever the logged-in user changes so each user keeps their own preference.
let lastUserId = useAuthStore.getState().user?.id ?? null;
useThemeStore.getState().loadForUser(lastUserId);
useAuthStore.subscribe((state) => {
  const id = state.user?.id ?? null;
  if (id !== lastUserId) {
    lastUserId = id;
    useThemeStore.getState().loadForUser(id);
  }
});

// Register the service worker (auto-updates in the background).
registerSW({ immediate: true });

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
