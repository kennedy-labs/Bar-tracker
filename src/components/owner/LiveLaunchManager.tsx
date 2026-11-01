import React, { useState } from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  Rocket,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
  DollarSign,
  Smartphone,
  Trash2,
} from 'lucide-react';

interface LiveLaunchManagerProps {
  currentUser: User;
  onSuccess?: () => void;
}

export const LiveLaunchManager: React.FC<LiveLaunchManagerProps> = ({
  currentUser,
  onSuccess,
}) => {
  const [confirmText, setConfirmText] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const products = store.getProducts(true);
  const users = store.getUsers().filter((u) => !u.isArchived);
  const biz = store.getCurrentBusiness();

  const handleLaunchReset = () => {
    if (confirmText.trim().toUpperCase() !== 'LAUNCH') {
      setStatusMessage({
        type: 'error',
        text: 'Please type LAUNCH in the confirmation box below to verify your intent.',
      });
      return;
    }

    setIsResetting(true);
    setStatusMessage(null);

    try {
      const result = store.resetInventoryForLiveLaunch(currentUser.name || 'Owner');
      setStatusMessage({
        type: 'success',
        text: result.message,
      });
      setConfirmText('');
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e?.message || 'Failed to complete reset operation.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#121824] to-[#0D121D] border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Rocket className="w-4 h-4" />
              <span>Operations Launch Desk</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Start Real Business Operations
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              When transitioning from system testing to real bar service, professional systems keep your entire
              drink menu, prices, and staff accounts intact, while resetting all bottle counts to zero for Day 1 physical counting.
            </p>
          </div>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block">
              {statusMessage.type === 'success' ? 'Live Operations Ready!' : 'Action Required'}
            </span>
            <p className="mt-0.5">{statusMessage.text}</p>
          </div>
        </div>
      )}

      {/* Two Column Architectural Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Safe & Kept Card */}
        <div className="p-5 rounded-3xl bg-[#0E1420] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              100% Kept & Preserved
            </h3>
          </div>

          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Drink Catalog ({products.length} Drinks)
                </span>
                <span className="text-slate-400 text-[11px]">
                  All drink names, categories, units, and bottle volumes remain configured.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Selling Prices & Cost Margins
                </span>
                <span className="text-slate-400 text-[11px]">
                  Every retail counter price and Keg per-kg rate remains in place.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Staff Accounts & Roles ({users.length} Users)
                </span>
                <span className="text-slate-400 text-[11px]">
                  All bartender logins, passwords, and 4-digit PINs are preserved.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Business Details & M-Pesa Till
                </span>
                <span className="text-slate-400 text-[11px]">
                  {biz.name} profile and Buy Goods / Paybill configurations stay ready.
                </span>
              </div>
            </li>
          </ul>
        </div>

        {/* Cleaned & Reset to Zero Card */}
        <div className="p-5 rounded-3xl bg-[#0E1420] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Reset to 0 for Clean Day 1
            </h3>
          </div>

          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <div className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-mono text-[10px] font-bold">
                0
              </div>
              <div>
                <span className="font-semibold text-white block">
                  All Bottle & Can Inventory Counts
                </span>
                <span className="text-slate-400 text-[11px]">
                  Stock on hand drops cleanly to 0, ready for initial physical shelf counting.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Test Shifts & Shift Ledgers
                </span>
                <span className="text-slate-400 text-[11px]">
                  Any trial shift records or draft handovers are wiped clean.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Discrepancy & Shrinkage Logs
                </span>
                <span className="text-slate-400 text-[11px]">
                  Trial variances cleared so the audit trail begins with authentic operations.
                </span>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">
                  Offline Queue Flushed
                </span>
                <span className="text-slate-400 text-[11px]">
                  Ensures zero test actions linger in local storage or sync buffers.
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Confirmation & Execution Console */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#121824] border border-amber-900/40 space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Safeguard Confirmation</span>
          </h4>
          <p className="text-xs text-slate-400">
            To prevent accidental resets, please type <strong className="text-emerald-400 font-mono">LAUNCH</strong> in the field below, then click the confirmation button.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type LAUNCH to verify"
            className="flex-1 bg-[#0A0E17] border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-white uppercase placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            disabled={isResetting || confirmText.trim().toUpperCase() !== 'LAUNCH'}
            onClick={handleLaunchReset}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              confirmText.trim().toUpperCase() === 'LAUNCH'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>{isResetting ? 'Launching Operations...' : 'Launch Live Operations (Reset to 0)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
