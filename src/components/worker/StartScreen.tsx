import React from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  PlayCircle,
  Wine,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  History,
  Store,
  Layers,
  LogOut,
} from 'lucide-react';

interface StartScreenProps {
  currentUser: User;
  onStartShift: () => void;
  onGoToCounter: () => void;
  onGoToEndShift: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  currentUser,
  onStartShift,
  onGoToCounter,
  onGoToEndShift,
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="max-w-xl mx-auto pb-24 md:pb-12 px-3 sm:px-0 space-y-4">
      {/* 1. Friendly Header */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">
              {currentBiz.name}
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              Hello, {currentUser.name.split(' ')[0]}
            </h1>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{dateFormatted}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 mt-1 inline-block">
            Ready
          </span>
        </div>
      </div>

      {/* 2. Main Status Card */}
      {activeShift ? (
        /* ACTIVE SHIFT */
        <div className="bg-[#121824] border-2 border-emerald-500/50 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Work is Ongoing
                </span>
                <h2 className="text-base font-black text-white">
                  Active Shift Ongoing
                </h2>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono">
              <span className="text-[10px] text-slate-500 block">Started</span>
              <span className="text-white font-bold">
                {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Drawer Cash</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-white mt-0.5 block">
                KES {activeShift.openingCashFloat.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">M-Pesa Float</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                KES {activeShift.openingMpesaBalance.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#0E1420] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Expenses</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-amber-400 mt-0.5 block">
                KES {totalExpenses.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onGoToCounter}
              className="py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
            >
              <Wine className="w-4 h-4" />
              <span>Open Counter Sheet</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <button
              type="button"
              onClick={onGoToEndShift}
              className="py-3 px-4 rounded-2xl bg-[#161F30] hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-emerald-400" />
              <span>Close & Handover</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          </div>
        </div>
      ) : (
        /* READY TO START WORK */
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="text-center py-2 space-y-1">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-1">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Ready to Start Work
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Count cash in drawer, check M-Pesa on phone, and check bottles on shelf before serving customers.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartShift}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base tracking-wide flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/70 transition-all cursor-pointer"
          >
            <PlayCircle className="w-6 h-6" />
            <span>Start Work (Count & Open)</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>

          {/* Previous Shift Handover */}
          {lastShift && (
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800/80">
                <span className="font-bold text-slate-300">Last Shift Handover</span>
                <span className="font-mono text-slate-400">
                  {new Date(lastShift.openedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Attendant</span>
                  <span className="font-medium text-white">{lastShift.workerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Cash Left in Drawer</span>
                  <span className="font-mono font-bold text-emerald-400">
                    KES {(lastShift.closingCashActual || lastShift.openingCashFloat).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Simple 2-Card Row: Morning Steps & Bottles on Hand */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Morning Checklist */}
        <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Before Starting</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Count cash in drawer</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Check M-Pesa balance on phone</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Count bottles on counter shelf</span>
            </li>
          </ul>
        </div>

        {/* Stock Info */}
        <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Total Bar Stock</span>
            </div>
            <span className="font-mono text-emerald-400 text-[11px]">
              {products.length} drinks
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800 text-xs flex items-center justify-between text-slate-400">
            <span>Bottles in bar:</span>
            <span className="font-mono font-bold text-white text-sm">{totalStockOnHand} units</span>
          </div>
        </div>
      </div>
    </div>
  );
};
