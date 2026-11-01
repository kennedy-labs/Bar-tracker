import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const PWAInstallCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('bartrack_dismiss_install_card') === 'true';
    } catch {
      return false;
    }
  });

  // When app is installed, disappear completely
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('bartrack_dismiss_install_card', 'true');
    } catch {}
  };

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <div
        className={`w-full bg-gradient-to-r from-[#121B2B] via-[#111A29] to-[#0E1522] border border-emerald-500/40 rounded-2xl p-4 shadow-xl shadow-emerald-950/20 relative animate-in fade-in duration-200 ${className}`}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Dismiss for this session"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>

          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                Recommended for Android
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Install BarTrack on Your Phone
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Add to your home screen for 1-tap counter access, faster loading, and full-screen workspace.
            </p>

            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAction}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isInstallable ? 'Install App (1-Tap)' : 'Add to Home Screen'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                How it works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Dialog */}
      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111622] border border-[#1E2638] p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Install BarTrack</h3>
                  <p className="text-[11px] text-slate-400">Add to phone home screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAndroid || !isIOS ? (
              <div className="space-y-3 bg-[#0D1117] p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>On Android (Google Chrome)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    Tap the <strong>three vertical dots ⋮</strong> at the top-right corner of Chrome.
                  </li>
                  <li>
                    Tap <strong className="text-slate-100">"Install app"</strong> (or <strong className="text-slate-100">"Add to Home screen"</strong>).
                  </li>
                  <li>
                    Confirm <strong className="text-emerald-400">Install</strong>. BarTrack will appear on your home screen with the bar icon!
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
                    Tap the <strong>Share</strong> button at the bottom of Safari.
                  </li>
                  <li>
                    Scroll down and select <strong className="text-slate-100">"Add to Home Screen"</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-cyan-400">Add</strong> at the top right.
                  </li>
                </ol>
              </div>
            )}

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Runs full-screen with no browser address bar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Stores stock counts offline if network fluctuates</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
