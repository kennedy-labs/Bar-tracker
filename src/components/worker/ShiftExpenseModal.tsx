import React, { useState } from 'react';
import { ExpenseCategory } from '../../types';
import { X, Receipt, CheckCircle, Banknote, Smartphone } from 'lucide-react';

interface ShiftExpenseModalProps {
  onClose: () => void;
  onConfirmExpense: (params: {
    category: ExpenseCategory;
    amount: number;
    paymentMethod: 'CASH' | 'MPESA';
    description: string;
    receiptRef?: string;
  }) => void;
}

export const ShiftExpenseModal: React.FC<ShiftExpenseModalProps> = ({
  onClose,
  onConfirmExpense,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>('ICE');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA'>('CASH');
  const [description, setDescription] = useState<string>('');
  const [receiptRef, setReceiptRef] = useState<string>('');

  const categories: { cat: ExpenseCategory; label: string }[] = [
    { cat: 'ICE', label: 'Ice Delivery' },
    { cat: 'LEMONS_LIMES', label: 'Lemons / Limes / Garnishes' },
    { cat: 'CLEANING', label: 'Cleaning Supplies' },
    { cat: 'CASUAL_WAGES', label: 'Casual Wages / Bouncer' },
    { cat: 'TRANSPORT', label: 'Transport / Errand' },
    { cat: 'BREAKAGE', label: 'Customer / Counter Breakage' },
    { cat: 'SUPPLIES', label: 'Bar Accessories / Straws' },
    { cat: 'OTHER', label: 'Other Operational Payout' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    onConfirmExpense({
      category,
      amount: parsedAmount,
      paymentMethod,
      description,
      receiptRef,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Record Operational Payout</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Expense Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
            >
              {categories.map((c) => (
                <option key={c.cat} value={c.cat}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
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
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl pl-12 pr-3 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-red-500 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Paid Out From
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === 'CASH'
                    ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash Drawer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MPESA')}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer ${
                  paymentMethod === 'MPESA'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Business M-Pesa</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description / Vendor Name
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 2 bags ice from vendor"
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Receipt / Voucher # (Optional)
            </label>
            <input
              type="text"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="e.g. RCP-883"
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Record Authorized Expense</span>
          </button>
        </form>
      </div>
    </div>
  );
};
