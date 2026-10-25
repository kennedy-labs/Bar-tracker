import React, { useState } from 'react';
import { Product, InventoryItem } from '../../types';
import { store } from '../../services/store';
import {
  Smartphone,
  Coins,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { useBackHandler } from '../../services/navigationHistory';

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
  onCancel,
}) => {
  const activeShift = isRevision ? store.getActiveShift() : null;
  const shiftStockItems = isRevision && activeShift ? store.getShiftStockItems(activeShift.id) : [];

  const [openingCashFloat, setOpeningCashFloat] = useState<string>(activeShift ? activeShift.openingCashFloat.toString() : '0');
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>(activeShift ? activeShift.openingMpesaBalance.toString() : '0');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Close confirmation modal on back button
  useBackHandler(showConfirmModal, () => setShowConfirmModal(false), 'shift-confirm-modal');

  // Automatically initialize counts from existing live inventory or previous shift setup without requiring Page 2 entry
  const [counts] = useState<Record<string, number>>(() => {
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
    <div className="max-w-md mx-auto py-6">
      <div className="bg-[#111622] border border-[#1E2638] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRevision ? 'Revising Money Floats' : 'Open Counter Shift'}</span>
            </div>
            <h1 className="text-lg font-black text-white tracking-tight">
              {isRevision ? 'Update Money Floats' : 'Shift Float Setup'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isRevision && onCancel && (
              <button
                type="button"
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

        {/* MONEY FLOATS FORM (Page 1 only, Page 2 Shelf Stock removed) */}
        <form onSubmit={handleStartClick} className="space-y-5 animate-in fade-in duration-200">
          <div className="space-y-4">
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

          <div className="flex items-center gap-2.5 pt-2">
            {isRevision && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isRevision ? 'Save Floats' : 'Start Shift'}</span>
            </button>
          </div>
        </form>

        {/* CONFIRMATION MODAL BEFORE STARTING */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 font-sans">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{isRevision ? 'Confirm Correction' : 'Confirm Shift Opening'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isRevision 
                    ? 'Updating these values will recalibrate your expected stock and cash balances for the current shift.'
                    : 'Are you ready to start this shift with the opening floats and live shelf inventory?'}
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
                  <span className="text-slate-400">Shelf Baseline:</span>
                  <span className="text-emerald-400 font-bold">Auto-linked ({Object.keys(counts).length} items)</span>
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
