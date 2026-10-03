import React from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  PlayCircle,
  Wine,
  ClipboardCheck,
  Clock,
  Coins,
  Smartphone,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  Store,
  Layers,
  Lock,
} from 'lucide-react';

interface StartScreenProps {
  currentUser: User;
  onStartShift: () => void;
  onGoToCounter: () => void;
  onGoToEndShift: () => void;
  onGoToHistory: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  currentUser,
  onStartShift,
  onGoToCounter,
  onGoToEndShift,
  onGoToHistory,
}) => {
  const currentBiz = store.getCurrentBusiness();
  const activeShift = store.getActiveShift();
  const lastShift = store.getLastClosedShift();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const shifts = store.getShifts();
  const expenses = activeShift ? store.getExpenses(activeShift.id) : [];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalStockOnHand = inventory.reduce((sum, i) => sum + i.quantityOnHand, 0);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-KE', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-xl mx-auto pb-24 md:pb-12 px-3 sm:px-0 space-y-4">
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-gradient-to-br from-[#121824] via-[#151D2C] to-[#0E1522] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle glow highlight */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <span>Start Screen</span>
                <span>·</span>
                <span className="text-slate-400">{currentBiz.name}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Hello, {currentUser.name.split(' ')[0]}
              </h1>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{dateFormatted}</span>
            </div>
            <div className="text-[11px] font-mono text-emerald-400 font-semibold mt-0.5">
              Terminal POS Ready
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Shift Operational Status */}
      {activeShift ? (
        /* Status Card: ACTIVE SHIFT RUNNING */
        <div className="bg-[#121824] border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Shift in Progress
                </span>
                <h2 className="text-lg font-black text-white">
                  Shift #{activeShift.shiftNumber}
                </h2>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="block text-slate-500 text-[10px] uppercase font-mono">Started At</span>
              <span className="font-mono text-white font-semibold">
                {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Cash Float</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                KES {activeShift.openingCashFloat.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">M-Pesa Float</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                KES {activeShift.openingMpesaBalance.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Shift Expenses</span>
              <span className="text-sm font-bold font-mono text-amber-400 mt-0.5 block">
                KES {totalExpenses.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Actions for Active Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={onGoToCounter}
              className="py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Wine className="w-4 h-4" />
              <span>Go to Active Counter</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            {activeShift.counterFinished ? (
              <button
                onClick={onGoToEndShift}
                className="py-3.5 px-4 rounded-2xl bg-[#1E293B] hover:bg-emerald-950/40 hover:border-emerald-500/50 border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                <span>Return to End of Shift</span>
                <ArrowRight className="w-4 h-4 ml-auto text-emerald-400" />
              </button>
            ) : (
              <div
                className="py-3.5 px-4 rounded-2xl bg-[#0E1420] border border-slate-800 text-slate-500 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed select-none"
                title="Finish the active counter routine first before proceeding to end of shift."
              >
                <Lock className="w-4 h-4 text-slate-600" />
                <span>End of Shift (Finish Counter First)</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Status Card: COUNTER CLOSED · READY TO START NEW SHIFT */
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="text-center py-2 space-y-1.5">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-1">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Ready to Open Counter
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              Count drawer cash float, confirm starting M-Pesa balance, and verify counter stock before serving drinks.
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onStartShift}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base tracking-wide flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/70 transition-all active:scale-[0.98] cursor-pointer"
          >
            <PlayCircle className="w-6 h-6" />
            <span>Start New Shift (Open Counter)</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>

          {/* Previous Shift Handover Brief */}
          {lastShift && (
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1.5 border-b border-slate-800/80">
                <span className="font-semibold text-slate-300">Previous Shift Handover</span>
                <span className="font-mono text-emerald-400">Shift #{lastShift.shiftNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Attendant</span>
                  <span className="font-medium text-white">{lastShift.workerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Closing Cash Float</span>
                  <span className="font-mono font-bold text-white">
                    KES {(lastShift.closingCashActual || lastShift.openingCashFloat).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Opening Checklist & Bar Stock Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Checklist */}
        <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Shift Opening Checklist</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>Verify physical cash float in drawer</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>Check opening M-Pesa balance on business phone</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>Physically count counter bottle shelf</span>
            </li>
          </ul>
        </div>

        {/* Stock Snapshot */}
        <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Bar Stock Snapshot</span>
            </div>
            <span className="font-mono text-emerald-400 text-[11px]">
              {products.length} catalog items
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Total bottles in storage/counter:</span>
              <span className="font-mono font-bold text-white">{totalStockOnHand} units</span>
            </div>
          </div>
          <button
            onClick={onGoToHistory}
            className="w-full py-2 px-3 rounded-xl bg-[#0E1420] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>View Past Shift Records ({shifts.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
