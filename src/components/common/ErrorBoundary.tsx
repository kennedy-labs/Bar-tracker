import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error trapped by ErrorBoundary:', error, errorInfo);
  }

  private handleSafeReset = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.unregister());
        });
      }
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage cleanup note:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="bg-[#14141d] border border-[#262633] rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">System Recovery</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                A component interrupted startup. You can resume by reloading or performing a clean cache restart.
              </p>
            </div>
            {this.state.error && (
              <div className="text-[11px] font-mono text-rose-300 bg-[#1a1a25] border border-slate-800 rounded-xl p-3 text-left max-h-24 overflow-y-auto break-all">
                {this.state.error.message || 'Component runtime error'}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 rounded-xl text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleSafeReset}
                className="w-full py-3 px-4 bg-[#1e1e29] hover:bg-[#262638] active:bg-[#1a1a25] border border-[#35354a] rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Clean Cache & Safe Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
