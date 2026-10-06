import React, { useState } from 'react';
import { Product } from '../../types';
import { X, Plus, Minus, PackagePlus, AlertCircle, CheckCircle } from 'lucide-react';

interface ItemRestockModalProps {
  product: Product;
  currentCount: number;
  onClose: () => void;
  onConfirmRestock: (quantity: number) => void;
}

export const ItemRestockModal: React.FC<ItemRestockModalProps> = ({
  product,
  currentCount,
  onClose,
  onConfirmRestock,
}) => {
  const isMeasured = product.isMeasured;
  const isValue = isMeasured && (product.measurementType === 'VALUE' || product.unit === 'VALUE_KES');
  const unitLabel = isValue ? 'KES' : product.measureUnitLabel || product.unit.toLowerCase();

  const [quantity, setQuantity] = useState<string>(isValue ? '500' : (isMeasured ? '5' : '12'));
  const parsedQty = parseFloat(quantity) || 0;
  const newTotal = currentCount + Math.max(0, parsedQty);

  const handleAdjust = (delta: number) => {
    const step = isValue ? 100 : (isMeasured ? 1 : 1);
    const current = parseFloat(quantity) || 0;
    const next = Math.max(step, current + delta * step);
    setQuantity(String(next));
  };

  const handleSetPreset = (amount: number) => {
    setQuantity(String(amount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedQty <= 0) return;
    onConfirmRestock(parsedQty);
  };

  const presets = isValue ? [250, 500, 1000, 1500] : (isMeasured ? [1, 2, 5, 10] : [6, 12, 24, 48]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${isMeasured ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'} flex items-center justify-center`}>
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isMeasured ? 'text-cyan-400' : 'text-emerald-400'} font-bold block`}>
                {isMeasured ? 'Restock Measured Drink' : 'Restock Counter'}
              </span>
              <h3 className="text-base font-bold text-white tracking-tight truncate max-w-[260px]">
                {product.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Current Shelf Stock Status */}
          <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Current on shelf:</span>
            <span className="text-white font-bold text-sm">
              {isValue ? `KES ${currentCount.toLocaleString()} worth` : `${currentCount} ${unitLabel}`}
            </span>
          </div>

          {/* Quantity Stepper & Adjuster */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {isValue ? 'Add Amount / Worth (Kshs)' : `Add Amount (${unitLabel})`}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjust(-1)}
                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center font-bold text-xl cursor-pointer shrink-0"
              >
                <Minus className="w-5 h-5" />
              </button>

              <input
                type="number"
                step="any"
                min="0.1"
                required
                autoFocus
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isValue ? "e.g. 1500" : "e.g. 5"}
                className={`flex-1 h-12 bg-[#0E1420] border border-slate-700 focus:border-cyan-500 rounded-2xl text-center font-mono font-black text-2xl ${isMeasured ? 'text-cyan-400' : 'text-emerald-400'} placeholder:text-slate-600 focus:outline-none`}
              />

              <button
                type="button"
                onClick={() => handleAdjust(1)}
                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center font-bold text-xl cursor-pointer shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {presets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSetPreset(amt)}
                  className={`py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                    parsedQty === amt
                      ? `${isMeasured ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'} font-bold`
                      : 'bg-[#0E1420] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  +{amt} {isValue ? 'KES' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* New Total Calculation Preview */}
          {parsedQty > 0 ? (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-sans">New counter total will be:</span>
              <span className="text-emerald-300 font-bold text-sm">
                {currentCount} + {parsedQty} = <strong className="text-white text-base">{newTotal}</strong>
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-sans">New counter total:</span>
              <span className="text-slate-500 italic text-xs">Enter quantity above</span>
            </div>
          )}

          {/* Audit Notice */}
          <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <span>
              This restock will be automatically recorded and reported to the owner. Once the owner verifies and saves it, the addition becomes immutable to deletion.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={parsedQty <= 0}
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {parsedQty > 0
                ? `Confirm Restock (+${parsedQty} ${product.unit.toLowerCase()}s)`
                : 'Enter Quantity to Restock'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
