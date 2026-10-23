import React, { useState } from 'react';
import { Product, InventoryItem } from '../../types';
import { store } from '../../services/store';
import {
  Smartphone,
  Coins,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { useBackHandler, usePageBack } from '../../services/navigationHistory';

interface ShiftOpeningWizardProps {
  products: Product[];
  inventory: InventoryItem[];
  workerName: string;
  onConfirmOpen: (data: {
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
  }) => void;
  isRevision?: boolean;
  initialStep?: 1 | 2;
  onCancel?: () => void;
}

export const ShiftOpeningWizard: React.FC<ShiftOpeningWizardProps> = ({
  products,
  inventory,
  workerName,
  onConfirmOpen,
  isRevision = false,
  initialStep,
  onCancel,
}) => {
  const activeShift = isRevision ? store.getActiveShift() : null;
  const shiftStockItems = isRevision && activeShift ? store.getShiftStockItems(activeShift.id) : [];

  // When revising from active counter, start directly on Page 2 (Starting Shelf Stock)
  const [step, setStep] = useState<1 | 2>(initialStep ?? (isRevision ? 2 : 1));
  const [openingCashFloat, setOpeningCashFloat] = useState<string>(activeShift ? activeShift.openingCashFloat.toString() : '0');
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>(activeShift ? activeShift.openingMpesaBalance.toString() : '0');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Undo / Back navigation within wizard:
  // On Page 2 -> revert to Page 1
  usePageBack('wizard-step-2-to-1', () => setStep(1), step === 2);
  // On Page 1 in revision mode -> revert back to counter
  usePageBack('wizard-step-1-to-counter', () => { onCancel?.(); }, isRevision && step === 1);

  // Close confirmation modal on back button
  useBackHandler(showConfirmModal, () => setShowConfirmModal(false), 'shift-confirm-modal');

  // Physical counts state for page 2
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      if (isRevision && activeShift) {
        const ssi = shiftStockItems.find(s => s.productId === p.id);
        initial[p.id] = ssi ? ssi.openingPhysicalCount : 0;
      } else {
        const inv = inventory.find((i) => i.productId === p.id);
        initial[p.id] = inv ? Number(inv.quantityOnHand || 0) : 0;
      }
    });
    return initial;
  });

  const handleCountChange = (productId: string, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setCounts((prev) => ({ ...prev, [productId]: num }));
  };

  const handleStartClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleConfirmStart = () => {
    setShowConfirmModal(false);
    onConfirmOpen({
      openingCashFloat: parseFloat(openingCashFloat) || 0,
      openingMpesaBalance: parseFloat(openingMpesaBalance) || 0,
      physicalCounts: counts,
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="bg-[#111622] border border-[#1E2638] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Header & Step Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRevision ? 'Revising Setup' : 'Shift Setup'} · Page {step} of 2</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              {step === 1 
                ? (isRevision ? 'Update Money Floats' : 'Open Counter Shift') 
                : (isRevision ? 'Update Shelf Stock' : 'Starting Shelf Stock')}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isRevision && onCancel && (
              <button
                onClick={onCancel}
                className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cancel Correction"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
              {workerName}
            </span>
          </div>
        </div>

        {/* PAGE 1: MONEY FLOATS */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  <span>Starting Cash Float (KES)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="0"
                  value={openingCashFloat}
                  onChange={(e) => setOpeningCashFloat(e.target.value)}
                  className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-lg font-bold font-mono text-white focus:outline-none"
                />
              </div>

              <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>Starting M-Pesa Float (KES)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="0"
                  value={openingMpesaBalance}
                  onChange={(e) => setOpeningMpesaBalance(e.target.value)}
                  className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-lg font-bold font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {isRevision && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                  title="Return to Active Counter"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Counter</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <span>Next: Shelf Counts (Page 2)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PAGE 2: SHELF STOCK */}
        {step === 2 && (
          <form onSubmit={handleStartClick} className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Starting Shelf Stock ({products.length} Products)
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0E1420]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-mono text-[11px] border-b border-slate-800 bg-slate-900/50">
                      <th className="py-3 px-4 font-semibold text-slate-300">Beverage</th>
                      <th className="py-3 px-4 text-center font-semibold text-slate-300">Selling Price</th>
                      <th className="py-3 px-4 text-center font-semibold text-slate-300 w-36">Starting Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {products.map((p) => {
                      const count = counts[p.id] !== undefined ? counts[p.id] : 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/30">
                          <td className="py-3 px-4">
                            <span className="font-bold text-white text-sm block">{p.name}</span>
                            <span className="text-slate-500 text-[11px] font-mono uppercase">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-400 font-semibold text-sm">
                            KES {p.sellingPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              min="0"
                              value={count}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCountChange(p.id, e.target.value)}
                              className="w-24 mx-auto text-center font-mono font-bold text-sm py-2 px-3 rounded-xl bg-[#151D2C] border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                title="Back to Page 1: Money Floats"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Page 1 (Floats)</span>
              </button>
              <button
                type="submit"
                className="flex-1 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <span>{isRevision ? 'Save Corrections & Return to Counter' : 'Start Shift'}</span>
              </button>
            </div>
          </form>
        )}

        {/* CONFIRMATION MODAL BEFORE STARTING */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 font-sans">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{isRevision ? 'Confirm Correction' : 'Confirm Shift Opening'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isRevision 
                    ? 'Updating these values will recalibrate your expected stock and cash balances for the current shift.'
                    : 'Are you ready to start this shift with the opening float and shelf counts?'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800 space-y-1.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cash Float:</span>
                  <span className="text-white font-bold">KES {parseFloat(openingCashFloat || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">M-Pesa Float:</span>
                  <span className="text-white font-bold">KES {parseFloat(openingMpesaBalance || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Shelf Products:</span>
                  <span className="text-white font-bold">{Object.keys(counts).length} items</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Review
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStart}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
                >
                  Confirm & Start
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
