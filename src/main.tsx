import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Handle dynamic Vite chunk loading errors seamlessly on new deployments
window.addEventListener('vite:preloadError', () => {
  console.warn('Vite preload chunk mismatch detected, auto-reloading...');
  window.location.reload();
});

// Resilient PWA registration with auto-update
try {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.location.reload();
    },
    onRegisterError(err) {
      console.warn('PWA registration note:', err);
    },
  });
} catch (e) {
  console.warn('PWA init note:', e);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    (window as any).__appMounted = true;
  } catch (err) {
    console.error('Fatal root mount error:', err);
    if (typeof (window as any).__renderStartupRecovery === 'function') {
      (window as any).__renderStartupRecovery(err instanceof Error ? err.message : String(err));
    }
  }
}

