import React, { useState } from 'react';
import { X, Receipt, CheckCircle } from 'lucide-react';

interface ShiftExpenseModalProps {
  onClose: () => void;
  onConfirmExpense: (params: {
    description: string;
    amount: number;
  }) => void;
}

export const ShiftExpenseModal: React.FC<ShiftExpenseModalProps> = ({
  onClose,
  onConfirmExpense,
}) => {
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    if (!description.trim()) return;

    onConfirmExpense({
      description: description.trim(),
      amount: parsedAmount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Record Expense</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Field 1: Expense Input Text Field (replaces dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Expense
            </label>
            <input
              type="text"
              required
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ice, Lemons, Cleaning, Transport"
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Field 2: Amount (KES) Input Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                KES
              </span>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl pl-13 pr-3.5 py-3 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!description.trim() || !amount}
            className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:cursor-not-allowed mt-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              Save Expense {amount ? `(KES ${Number(amount).toLocaleString()})` : ''}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
