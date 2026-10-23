import React, { useState } from 'react';
import { Product } from '../../types';
import { X, PackagePlus, CheckCircle } from 'lucide-react';

interface StockAdditionModalProps {
 products: Product[];
 onClose: () => void;
 onConfirmAddition: (params: {
 productId: string;
 quantity: number;
 source: string;
 note?: string;
 }) => void;
}

export const StockAdditionModal: React.FC<StockAdditionModalProps> = ({
 products,
 onClose,
 onConfirmAddition,
}) => {
 const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
 const [quantity, setQuantity] = useState<string>('');
 const [source, setSource] = useState<string>('Central Warehouse / Storekeeper');
 const [note, setNote] = useState<string>('');

 const selectedProduct = products.find((p) => p.id === selectedProductId);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 const parsed = parseFloat(quantity);
 const qty = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
 if (qty <= 0 || !selectedProductId) return;
 onConfirmAddition({
 productId: selectedProductId,
 quantity: qty,
 source,
 note,
 });
 };

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
 <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
 <div className="flex items-center justify-between pb-3 border-b border-slate-800">
 <div className="flex items-center gap-2">
 <PackagePlus className="w-5 h-5 text-emerald-400" />
 <h3 className="text-base font-bold text-white tracking-tight">Receive Stock Restock</h3>
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
 Select Product Received
 </label>
 <select
 value={selectedProductId}
 onChange={(e) => setSelectedProductId(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
 >
 {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
 <option key={p.id} value={p.id}>
 {p.name} ({p.unit})
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
 Quantity Received ({selectedProduct?.unit.toLowerCase()}s)
 </label>
 <input
 type="number"
 step="any"
 min="0.1"
 required
 placeholder="e.g. 9.5 for half bottle"
 value={quantity}
 onChange={(e) => setQuantity(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
 />
 <div className="flex flex-wrap gap-2 mt-2">
 <button
 type="button"
 onClick={() => setQuantity('0.5')}
 className="px-2.5 py-1 rounded-lg border border-emerald-800/80 bg-emerald-950/40 text-xs font-mono text-emerald-300 hover:border-emerald-700 cursor-pointer"
 >
 +0.5 (½ btl)
 </button>
 {[12, 24, 48].map((q) => (
 <button
 key={q}
 type="button"
 onClick={() => setQuantity(String(q))}
 className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-xs font-mono text-slate-300 hover:border-slate-700 cursor-pointer"
 >
 +{q} ({Math.round(q / 24)} crate)
 </button>
 ))}
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
 Source / Dispatcher
 </label>
 <input
 type="text"
 required
 value={source}
 onChange={(e) => setSource(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
 />
 </div>

 <div>
 <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
 Receipt / Delivery Note (Optional)
 </label>
 <input
 type="text"
 value={note}
 onChange={(e) => setNote(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
 />
 </div>

 <button
 type="submit"
 className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
 >
 <CheckCircle className="w-4 h-4" />
 <span>Confirm Stock Addition</span>
 </button>
 </form>
 </div>
 </div>
 );
};
