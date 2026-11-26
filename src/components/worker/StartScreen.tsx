import React from 'react';
import { User } from '../../types';
import { store } from '../../services/store';
import {
  PlayCircle,
  Wine,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  Layers,
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
  const expenses = activeShift ? store.getExpenses(activeShift.id) : [];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalStockOnHand = inventory.reduce((sum, i) => sum + Number(i.quantityOnHand || 0), 0);

  const dateFormatted = new Date().toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const firstName = currentUser.name.split(' ')[0] || currentUser.name;

  return (
    <div className="max-w-xl mx-auto pb-12 space-y-4">
      {/* Header */}
      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted truncate">
            {currentBiz.name} · {dateFormatted}
          </p>
          <h1 className="text-xl font-bold text-content tracking-tight mt-0.5 truncate">
            Hello, {firstName}
          </h1>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[11px] font-medium text-muted">Counter Stock</div>
          <div className="text-sm font-mono font-bold text-content tabular-nums">
            {totalStockOnHand.toLocaleString()} · {products.length} drinks
          </div>
        </div>
      </div>

      {/* Main Shift State */}
      {activeShift ? (
        <div className="bg-surface border border-brand-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-soft">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
                Active Shift
              </div>
              <h2 className="text-lg font-bold text-content mt-0.5">
                {activeShift.workerName} on Counter
              </h2>
            </div>
            <div className="text-right text-xs font-mono tabular-nums">
              <span className="text-[11px] text-muted block font-sans">Started</span>
              <span className="text-content font-semibold">
                {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line-soft bg-ink-soft rounded-xl border border-line py-3 text-center">
            <div className="px-2">
              <span className="text-[11px] text-muted block">Coins Float</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-content mt-0.5 block tabular-nums">
                KES {(activeShift.openingCoinsFloat || activeShift.openingCashFloat || 0).toLocaleString()}
              </span>
            </div>
            <div className="px-2">
              <span className="text-[11px] text-muted block">M-Pesa Float</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-brand-strong mt-0.5 block tabular-nums">
                KES {(activeShift.openingMpesaBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="px-2">
              <span className="text-[11px] text-muted block">Expenses</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-warn mt-0.5 block tabular-nums">
                KES {totalExpenses.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onGoToCounter}
              className="min-h-[48px] py-3 px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Wine className="w-4 h-4" />
              <span>Open Counter Hub</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <button
              type="button"
              onClick={onGoToEndShift}
              className="min-h-[48px] py-3 px-4 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-brand-strong" />
              <span>Guided Closing Count</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-content">
              Start Your Counter Shift
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              Confirm inherited stock and floats in one tap, or flag any shelf mismatch against the outgoing attendant.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartShift}
            className="w-full min-h-[50px] py-3.5 px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <PlayCircle className="w-5 h-5" />
            <span>Verify Handover & Start Shift</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {lastShift && (
            <div className="pt-3 border-t border-line-soft flex items-center justify-between gap-2 text-xs">
              <div className="text-muted">
                Outgoing: <span className="text-content font-semibold">{lastShift.workerName}</span> ·{' '}
                {new Date(lastShift.closedAt || lastShift.openedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
              <div className="font-mono font-semibold text-brand-strong tabular-nums">
                Coins KES {(lastShift.closingCoinsActual ?? lastShift.closingCashActual ?? 0).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <ShieldCheck className="w-4 h-4 text-brand-strong" />
            <span>Shift Flow</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
            <Layers className="w-3.5 h-3.5" />
            <span>3 Fast Steps</span>
          </div>
        </div>
        <ul className="text-xs text-muted space-y-1.5">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Verify opening floats and flag any shelf mismatch on start</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Log restocks, breakages, or expenses mid-shift in 2 taps</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
            <span>Count closing bottles category-by-category at handover</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
