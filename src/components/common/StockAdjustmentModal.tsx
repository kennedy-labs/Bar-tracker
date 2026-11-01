import React, { useState } from 'react';
import { Product, User } from '../../types';
import { store } from '../../services/store';
import { useBackHandler } from '../../services/navigationHistory';
import {
  X,
  Check,
  ShieldCheck,
} from 'lucide-react';

export type AdjustmentMode = 'REAL_RESTOCK' | 'CLERICAL_CORRECTION' | 'SHRINKAGE_VARIANCE';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  currentStock: number;
  initialTargetStock?: number;
  currentUser: User;
  onSuccess?: (newStock: number, mode: AdjustmentMode) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  product,
  currentStock,
  initialTargetStock,
  currentUser,
  onSuccess,
}) => {
  useBackHandler(isOpen, onClose, 'stock-adjustment-modal');
  const [targetStockStr, setTargetStockStr] = useState<string>(
    initialTargetStock !== undefined ? String(initialTargetStock) : String(currentStock)
  );

  const initialDelta = (initialTargetStock !== undefined ? initialTargetStock : currentStock) - currentStock;
  const [mode, setMode] = useState<AdjustmentMode>(
    initialDelta > 0 ? 'REAL_RESTOCK' : 'CLERICAL_CORRECTION'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const parsedTarget = Math.max(0, parseFloat(targetStockStr) || 0);
  const delta = Math.round((parsedTarget - currentStock) * 100) / 100;
  const unitPrice = product.sellingPrice || 0;
  const valueDeltaKes = Math.round(Math.abs(delta) * unitPrice);

  const handleConfirm = () => {
    setIsSubmitting(true);
    try {
      store.adjustProductStock(product.id, parsedTarget, {
        mode,
        reason:
          mode === 'REAL_RESTOCK'
            ? 'Add real stock'
            : mode === 'CLERICAL_CORRECTION'
            ? 'Correction / Wrong entry'
            : 'Broken or lost',
        actorName: currentUser.name || 'Owner',
        actorRole: currentUser.role,
      });

      if (onSuccess) {
        onSuccess(parsedTarget, mode);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Fix Count</span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase mt-0.5">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Count Input Display */}
        <div className="mt-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#0B0F17] border border-slate-800/80">
          <input
            type="number"
            min="0"
            step="any"
            value={targetStockStr}
            onChange={(e) => setTargetStockStr(e.target.value)}
            className="w-36 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-3xl font-black font-mono text-white text-center focus:outline-none focus:border-emerald-500 shadow-inner"
            autoFocus
          />
        </div>

        {/* Difference summary */}
        {delta !== 0 && (
          <div
            className={`mt-2.5 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
              delta < 0
                ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
            }`}
          >
            <span>
              Difference: <strong className="font-mono">{delta > 0 ? `+${delta}` : delta}</strong> {product.unit.toLowerCase()}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              KES {valueDeltaKes.toLocaleString()}
            </span>
          </div>
        )}

        {/* Why? Selector with good spacing and comfortable touch targets */}
        <div className="mt-4 space-y-2.5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Why?
          </label>

          {/* Option 1: Add real stock */}
          <div
            onClick={() => setMode('REAL_RESTOCK')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              mode === 'REAL_RESTOCK'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-[#0B0F17] border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    mode === 'REAL_RESTOCK'
                      ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                      : 'border-slate-600'
                  }`}
                >
                  {mode === 'REAL_RESTOCK' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="text-sm font-bold text-white tracking-tight">
                  Add real stock
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1 rounded-lg shrink-0">
                +Restock
              </span>
            </div>
          </div>

          {/* Option 2: Correction / Wrong Entry */}
          <div
            onClick={() => setMode('CLERICAL_CORRECTION')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              mode === 'CLERICAL_CORRECTION'
                ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500/30'
                : 'bg-[#0B0F17] border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    mode === 'CLERICAL_CORRECTION'
                      ? 'border-sky-500 bg-sky-500 text-slate-950'
                      : 'border-slate-600'
                  }`}
                >
                  {mode === 'CLERICAL_CORRECTION' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="text-sm font-bold text-white tracking-tight">
                  Correction / Wrong Entry
                </span>
              </div>
              <span className="text-[11px] font-bold text-sky-400 bg-sky-900/40 border border-sky-700/40 px-2.5 py-1 rounded-lg shrink-0">
                Fix Mistake
              </span>
            </div>
          </div>

          {/* Option 3: Broken or Lost */}
          <div
            onClick={() => setMode('SHRINKAGE_VARIANCE')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
              mode === 'SHRINKAGE_VARIANCE'
                ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/30'
                : 'bg-[#0B0F17] border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    mode === 'SHRINKAGE_VARIANCE'
                      ? 'border-rose-500 bg-rose-500 text-white'
                      : 'border-slate-600'
                  }`}
                >
                  {mode === 'SHRINKAGE_VARIANCE' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className="text-sm font-bold text-white tracking-tight">
                  Broken or Lost
                </span>
              </div>
              <span className="text-[11px] font-bold text-rose-400 bg-rose-900/40 border border-rose-700/40 px-2.5 py-1 rounded-lg shrink-0">
                Shortage
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3.5 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Save New Count</span>
          </button>
        </div>
      </div>
    </div>
  );
};
