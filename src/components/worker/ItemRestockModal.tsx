import React, { useState } from 'react';
import { Product } from '../../types';
import { X, Plus, Minus, PackagePlus, PackageMinus, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';

interface ItemRestockModalProps {
  product: Product;
  currentCount: number;
  onClose: () => void;
  onConfirmRestock: (params: {
    quantity: number;
    type: 'ADD' | 'REDUCE';
    reason?: string;
    note?: string;
  }) => void;
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

  const [mode, setMode] = useState<'ADD' | 'REDUCE'>('ADD');
  const [quantity, setQuantity] = useState<string>(isValue ? '500' : (isMeasured ? '5' : '12'));
  const [reduceReason, setReduceReason] = useState<string>('Returned to Main Store');
  const [source, setSource] = useState<string>('Central Warehouse / Storekeeper');
  const [note, setNote] = useState<string>('');

  const parsedQty = parseFloat(quantity) || 0;
  const isReduce = mode === 'REDUCE';
  const newTotal = isReduce
    ? Math.max(0, currentCount - parsedQty)
    : currentCount + Math.max(0, parsedQty);

  const isInvalidReduction = isReduce && (parsedQty > currentCount || currentCount <= 0);

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
    if (isReduce && parsedQty > currentCount) {
      alert(`Cannot reduce ${parsedQty} units. Maximum on shelf is ${currentCount}.`);
      return;
    }

    onConfirmRestock({
      quantity: parsedQty,
      type: mode,
      reason: isReduce ? reduceReason : source,
      note: note.trim() || undefined,
    });
  };

  const addPresets = isValue ? [250, 500, 1000, 1500] : (isMeasured ? [1, 2, 5, 10] : [6, 12, 24, 48]);
  const reducePresets = isValue
    ? [200, 500, 1000].filter((v) => v <= currentCount)
    : [1, 2, 6, 12].filter((v) => v <= currentCount);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isReduce
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                  : isMeasured
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              }`}
            >
              {isReduce ? <PackageMinus className="w-5 h-5" /> : <PackagePlus className="w-5 h-5" />}
            </div>
            <div>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider font-bold block ${
                  isReduce ? 'text-rose-400' : isMeasured ? 'text-cyan-400' : 'text-emerald-400'
                }`}
              >
                {isReduce ? 'Reduce Counter Stock' : isMeasured ? 'Restock Measured Drink' : 'Restock Counter'}
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

        {/* Mode Selector Tabs: Add vs Reduce */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-[#0E1420] rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('ADD');
              setQuantity(isValue ? '500' : (isMeasured ? '5' : '12'));
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !isReduce
                ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>+ Add / Restock</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('REDUCE');
              setQuantity(isValue ? '100' : '1');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isReduce
                ? 'bg-rose-500/20 border border-rose-500/60 text-rose-300 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <PackageMinus className="w-3.5 h-3.5" />
            <span>- Reduce Stock</span>
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

          {/* Reduce Reason Dropdown (only when reducing) */}
          {isReduce && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Reason for Reduction
              </label>
              <select
                value={reduceReason}
                onChange={(e) => setReduceReason(e.target.value)}
                className="w-full bg-[#0E1420] border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              >
                <option value="Returned to Main Store">Returned to Main Store / Warehouse</option>
                <option value="Breakage / Spillage">Breakage / Damaged Bottle</option>
                <option value="Stock Recount Correction">Stock Recount / Counting Correction</option>
                <option value="Customer Return / Void">Customer Return / Void</option>
                <option value="Transferred / Other">Other Counter Reduction</option>
              </select>
            </div>
          )}

          {/* Quantity Stepper & Adjuster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {isReduce
                  ? `Quantity to Deduct (${unitLabel})`
                  : isValue
                  ? 'Add Amount / Worth (KES)'
                  : `Add Amount (${unitLabel})`}
              </label>
              {isReduce && currentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(String(currentCount))}
                  className="text-[10px] font-mono font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  All ({currentCount})
                </button>
              )}
            </div>

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
                max={isReduce ? currentCount : undefined}
                required
                autoFocus
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isValue ? 'e.g. 1500' : isReduce ? 'e.g. 2' : 'e.g. 5'}
                className={`flex-1 h-12 bg-[#0E1420] border rounded-2xl text-center font-mono font-black text-2xl placeholder:text-slate-600 focus:outline-none ${
                  isReduce
                    ? 'border-rose-500/50 text-rose-400 focus:border-rose-400'
                    : isMeasured
                    ? 'border-cyan-500/50 text-cyan-400 focus:border-cyan-400'
                    : 'border-emerald-500/50 text-emerald-400 focus:border-emerald-400'
                }`}
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
              {(isReduce ? reducePresets : addPresets).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSetPreset(amt)}
                  className={`py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                    parsedQty === amt
                      ? isReduce
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                        : isMeasured
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-[#0E1420] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isReduce ? `-${amt}` : `+${amt}`} {isValue ? 'KES' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Source / Note for Add Mode */}
          {!isReduce && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Source / Dispatcher
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Central Warehouse, EABL Supplier"
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* New Total Calculation Preview */}
          {parsedQty > 0 ? (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-mono ${
                isReduce
                  ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span className="font-sans">
                {isReduce ? 'New shelf stock after reduction:' : 'New counter total will be:'}
              </span>
              <span className="font-bold text-sm">
                {currentCount} {isReduce ? '-' : '+'} {parsedQty} ={' '}
                <strong className="text-white text-base">{newTotal}</strong>
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-sans">New counter total:</span>
              <span className="text-slate-500 italic text-xs">Enter quantity above</span>
            </div>
          )}

          {/* Error Notice for Invalid Reduction */}
          {isInvalidReduction && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {currentCount <= 0
                  ? 'Current counter stock is 0. No drinks available to reduce.'
                  : `Cannot deduct ${parsedQty}. Maximum reduction allowed is ${currentCount}.`}
              </span>
            </div>
          )}

          {/* Audit Notice with Undo guarantee */}
          <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <RotateCcw className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <span>
              Recorded in your shift audit trail. You can <strong>Undo</strong> this action at any time from your counter screen before the owner locks it.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={parsedQty <= 0 || isInvalidReduction}
            className={`w-full h-12 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
              isReduce
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {parsedQty > 0
                ? isReduce
                  ? `Confirm Stock Reduction (-${parsedQty} ${product.unit.toLowerCase()}s)`
                  : `Confirm Restock (+${parsedQty} ${product.unit.toLowerCase()}s)`
                : 'Enter Quantity Above'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
