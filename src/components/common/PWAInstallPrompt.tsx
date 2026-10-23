import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X, CheckCircle, ShieldCheck } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed in standalone mode, do not show
  if (isInstalled) {
    return null;
  }

  // Direct Android Chrome prompt available
  if (isInstallable) {
    return (
      <>
        <button
          type="button"
          onClick={install}
          title="Install BarTrack directly on your Android phone as an app"
          className={
            className ||
            `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer ${
              compact ? 'text-[11px] py-0.5 px-2' : ''
            }`
          }
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Install' : 'Install on Android'}</span>
        </button>
      </>
    );
  }

  // Fallback guide button for Android or iOS if prompt isn't directly triggered yet
  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        title="Add BarTrack to your mobile home screen"
        className={
          className ||
          `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface hover:bg-surface-2 border border-line text-muted hover:text-content transition-colors cursor-pointer ${
            compact ? 'text-[11px] py-0.5 px-2' : ''
          }`
        }
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{compact ? 'Add App' : 'Add to Home Screen'}</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111622] border border-[#1E2638] p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install BarTrack</h3>
                  <p className="text-[11px] text-slate-400">Add to your phone for 1-tap counter access</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAndroid || !isIOS ? (
              <div className="space-y-3 bg-[#0D1117] p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>On Android Phone (Google Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    Tap the <strong>three vertical dots ⋮</strong> at the top-right corner of Chrome.
                  </li>
                  <li>
                    Tap <strong className="text-slate-200">"Install app"</strong> or <strong className="text-slate-200">"Add to Home screen"</strong>.
                  </li>
                  <li>
                    Confirm <strong className="text-emerald-400">Install</strong>. BarTrack will appear on your app drawer like a native app!
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 bg-[#0D1117] p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>On iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    Tap the <strong>Share</strong> button in the bottom Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong className="text-slate-200">"Add to Home Screen"</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-cyan-400">Add</strong> at the top right.
                  </li>
                </ol>
              </div>
            )}

            <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Zero URL address bar distraction</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Works offline and caches stock data locally</span>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
