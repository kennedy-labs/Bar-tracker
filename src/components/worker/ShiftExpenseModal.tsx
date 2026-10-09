import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
 <div className="w-full max-w-sm bg-[#111622] border border-[#1E2638] rounded-2xl p-5 shadow-xl space-y-4">
 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
 <h3 className="text-base font-bold text-white tracking-tight">Record Expense</h3>
 <button
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-3.5">
 <div>
 <label className="block text-xs font-medium text-slate-300 mb-1">
 Expense Item
 </label>
 <input
 type="text"
 required
 autoFocus
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-slate-300 mb-1">
 Amount (KES)
 </label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-500">
 KES
 </span>
 <input
 type="number"
 step="any"
 min="1"
 required
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-11 pr-3 py-2 text-sm font-mono font-semibold text-white focus:outline-none focus:border-slate-600 tabular-nums"
 />
 </div>
 </div>

 <div className="flex items-center justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={!description.trim() || !amount}
 className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
 >
 Save Expense
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
