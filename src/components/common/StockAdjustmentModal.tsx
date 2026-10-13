import React, { useState } from 'react';
import { Product, User } from '../../types';
import { store } from '../../services/store';
import {
  X,
  Check,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FileText,
  Minus,
  Plus,
} from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  currentStock: number;
  initialTargetStock?: number;
  currentUser: User;
  onSuccess?: (newStock: number, mode: 'CLERICAL_CORRECTION' | 'SHRINKAGE_VARIANCE') => void;
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
  const [targetStockStr, setTargetStockStr] = useState<string>(
    initialTargetStock !== undefined ? String(initialTargetStock) : String(currentStock)
  );
  const [mode, setMode] = useState<'CLERICAL_CORRECTION' | 'SHRINKAGE_VARIANCE'>(
    'CLERICAL_CORRECTION'
  );
  const [customReason, setCustomReason] = useState<string>('Initial entry typo correction');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const parsedTarget = Math.max(0, parseFloat(targetStockStr) || 0);
  const delta = Math.round((parsedTarget - currentStock) * 100) / 100;
  const unitPrice = product.sellingPrice || 0;
  const valueDeltaKes = Math.round(Math.abs(delta) * unitPrice);

  const quickReasons = [
    'Initial entry typo correction',
    'Entered 100 instead of real count',
    'Incorrect delivery receipt figure',
    'Physical shelf recount reconciliation',
    'Unrecorded bar breakage',
  ];

  const handleConfirm = () => {
    setIsSubmitting(true);
    try {
      store.adjustProductStock(product.id, parsedTarget, {
        mode,
        reason: customReason.trim() || (mode === 'CLERICAL_CORRECTION' ? 'Clerical entry mistake' : 'Physical audit discrepancy'),
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
      <div className="w-full max-w-lg bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-6 shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Professional Stock Reconciliation</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Adjust Stock: {product.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Comparison Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#0B0F17] border border-slate-800/80">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium block">
              System Book Count
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-300 mt-0.5">
              {currentStock} <span className="text-xs font-sans text-slate-500">{product.unit.toLowerCase()}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-medium block">
              New Physical Count
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => setTargetStockStr(String(Math.max(0, parsedTarget - 1)))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="0"
                step="any"
                value={targetStockStr}
                onChange={(e) => setTargetStockStr(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-base font-bold font-mono tabular-nums text-white text-center focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setTargetStockStr(String(parsedTarget + 1))}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Difference summary */}
        {delta !== 0 && (
          <div
            className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
              delta < 0
                ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
            }`}
          >
            <span>
              Net Difference: <strong className="font-mono tabular-nums">{delta > 0 ? `+${delta}` : delta}</strong> {product.unit.toLowerCase()}
            </span>
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              Value: KES {valueDeltaKes.toLocaleString()}
            </span>
          </div>
        )}

        {/* Mode Selector */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Reconciliation Reason & Classification
          </label>

          {/* Option 1: Clerical Correction */}
          <div
            onClick={() => setMode('CLERICAL_CORRECTION')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              mode === 'CLERICAL_CORRECTION'
                ? 'bg-emerald-950/30 border-emerald-500/80 shadow-sm'
                : 'bg-[#0B0F17] border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    mode === 'CLERICAL_CORRECTION'
                      ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                      : 'border-slate-600'
                  }`}
                >
                  {mode === 'CLERICAL_CORRECTION' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="text-sm font-bold text-white">
                  Clerical / Entry Error Correction
                </span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-900/40 px-2 py-0.5 rounded-md">
                Zero Shrinkage Penalty
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 pl-6 leading-relaxed">
              Use when the previous count (e.g. 100) was entered by mistake (typo or incorrect receipt entry).
              Corrects baseline book stock without penalizing workers or recording false theft.
            </p>
          </div>

          {/* Option 2: Shrinkage Variance */}
          <div
            onClick={() => setMode('SHRINKAGE_VARIANCE')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              mode === 'SHRINKAGE_VARIANCE'
                ? 'bg-rose-950/30 border-rose-500/80 shadow-sm'
                : 'bg-[#0B0F17] border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    mode === 'SHRINKAGE_VARIANCE'
                      ? 'border-rose-500 bg-rose-500 text-white'
                      : 'border-slate-600'
                  }`}
                >
                  {mode === 'SHRINKAGE_VARIANCE' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="text-sm font-bold text-white">
                  Physical Stock Variance / Shrinkage
                </span>
              </div>
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider bg-rose-900/40 px-2 py-0.5 rounded-md">
                Loss Discrepancy Ticket
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 pl-6 leading-relaxed">
              Use when bottles are genuinely missing from physical shelves during an audit.
              Flags a stock shortage discrepancy ticket with monetary variance (-KES {valueDeltaKes.toLocaleString()}) in the loss audit log.
            </p>
          </div>
        </div>

        {/* Reason field & quick tags */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Audit Trail Note
          </label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Explain why this count was adjusted..."
            className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {quickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCustomReason(r)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  customReason === r
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'CLERICAL_CORRECTION'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {mode === 'CLERICAL_CORRECTION'
                ? 'Confirm Baseline Correction'
                : 'Record Shrinkage Discrepancy'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
