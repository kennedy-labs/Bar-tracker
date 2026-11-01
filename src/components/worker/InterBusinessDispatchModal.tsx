import React, { useState } from 'react';
import { Product, InventoryItem, BusinessPartner } from '../../types';
import { store } from '../../services/store';
import {
 Truck,
 Building2,
 X,
 Search,
 Plus,
 Minus,
 AlertCircle,
 ArrowRight,
 ShieldAlert,
} from 'lucide-react';

interface InterBusinessDispatchModalProps {
 products: Product[];
 inventory: InventoryItem[];
 partners: BusinessPartner[];
 onClose: () => void;
 onSuccess: (info: { partnerName: string; productName: string; quantity: number; cost: number }) => void;
}

export const InterBusinessDispatchModal: React.FC<InterBusinessDispatchModalProps> = ({
 products,
 inventory,
 partners,
 onClose,
 onSuccess,
}) => {
 const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
 partners[0]?.partnerBusinessId || ''
 );
 const [customConnectCode, setCustomConnectCode] = useState<string>('');
 const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
 const [quantity, setQuantity] = useState<number>(24);
 const [notes, setNotes] = useState<string>('');
 const [errorMsg, setErrorMsg] = useState<string | null>(null);

 const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
 const inv = inventory.find((i) => i.productId === selectedProduct?.id);
 const availableStock = inv ? inv.quantityOnHand : 0;

 const totalTransferValue = (selectedProduct?.sellingPrice || 0) * quantity;

 const handleSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   setErrorMsg(null);

   let targetBusinessId = selectedPartnerId;

   // If user typed in a custom connect code / phone
   if (!targetBusinessId && customConnectCode) {
     try {
       const newPartner = store.connectPartner(customConnectCode);
       targetBusinessId = newPartner.partnerBusinessId;
     } catch (err: any) {
       setErrorMsg(err.message || 'Could not find bar with that connect code');
       return;
     }
   }

   if (!targetBusinessId) {
     setErrorMsg('Please select or connect a partner bar first.');
     return;
   }

   if (quantity <= 0) {
     setErrorMsg('Quantity must be at least 1.');
     return;
   }

   if (quantity > availableStock) {
     setErrorMsg(`Cannot send more than current stock on hand (${availableStock} ${selectedProduct.unit.toLowerCase()}s).`);
     return;
   }

   try {
     store.dispatchInterBusinessTransfer({
       toBusinessId: targetBusinessId,
       productId: selectedProduct.id,
       quantity,
       notes: notes || undefined,
     });

     const partner = store.getBusinesses().find((b) => b.id === targetBusinessId);
     onSuccess({
       partnerName: partner?.name || 'Partner Bar',
       productName: selectedProduct.name,
       quantity,
       cost: totalTransferValue,
     });
   } catch (err: any) {
     setErrorMsg(err.message || 'Failed to dispatch stock transfer');
   }
 };

 return (
 <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
 <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-7 max-w-lg w-full shadow-2xl space-y-5 my-6">
 {/* Header */}
 <div className="flex items-center justify-between pb-4 border-b border-slate-800">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
 <Truck className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-base font-bold text-white tracking-tight">
 Transfer Stock to Partner Bar
 </h2>
 <p className="text-xs text-slate-400">
 Transfer drinks directly to a neighboring business
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {errorMsg && (
 <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
 <span>{errorMsg}</span>
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-4 text-xs">
 {/* 1. Destination Bar Selector */}
 <div>
 <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
 Recipient Partner Bar
 </label>

 {partners.length > 0 ? (
 <select
 value={selectedPartnerId}
 onChange={(e) => {
 setSelectedPartnerId(e.target.value);
 setCustomConnectCode('');
 }}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 text-sm"
 >
 {partners.map((p) => (
 <option key={p.partnerBusinessId} value={p.partnerBusinessId}>
 {p.partnerName} ({p.partnerPhone || `Code: ${p.partnerConnectCode}`})
 </option>
 ))}
 </select>
 ) : (
 <div className="space-y-2">
 <p className="text-slate-400 text-[11px]">
 No partner bars linked yet. Enter their 6-digit Bar Connect Code or phone number:
 </p>
 <input
 type="text"
 required
 value={customConnectCode}
 onChange={(e) => setCustomConnectCode(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
 />
 </div>
 )}
 </div>

 {/* 2. Select Drink (Single-Column A to Z) */}
 <div>
 <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
 Select Drink to Dispatch
 </label>
 <select
 value={selectedProductId}
 onChange={(e) => setSelectedProductId(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500 text-sm"
 >
 {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((prod) => {
 const stock = inventory.find((i) => i.productId === prod.id)?.quantityOnHand || 0;
 return (
   <option key={prod.id} value={prod.id}>
     {prod.name} (In Stock: {stock} {prod.unit.toLowerCase()}s · Price: KES {prod.sellingPrice})
   </option>
 );
 })}
 </select>
 </div>

 {/* 3. Quantity to Transfer */}
 <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4 space-y-2">
 <div className="flex items-center justify-between">
 <span className="font-semibold text-slate-300">Quantity to Transfer</span>
 <span className="text-[11px] text-slate-400 font-mono">
 Available: <strong className="text-emerald-400">{availableStock}</strong> {selectedProduct.unit.toLowerCase()}s
 </span>
 </div>

 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={() => setQuantity((q) => Math.max(1, q - 1))}
 className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-base cursor-pointer"
 >
 <Minus className="w-4 h-4" />
 </button>

 <input
 type="number"
 step="any"
 min="0.5"
 max={availableStock}
 value={quantity}
 onChange={(e) => setQuantity(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
 className="flex-1 bg-[#151D2C] border border-slate-700 rounded-xl py-2 text-center text-lg font-mono font-bold text-white focus:outline-none focus:border-amber-500"
 />

 <button
 type="button"
 onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
 className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-base cursor-pointer"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>

 {/* Quick pack / crate helper presets */}
 <div className="flex items-center gap-1.5 pt-1">
 <span className="text-[10px] text-slate-500 font-mono">Quick:</span>
 {[6, 12, 24, 48].map((amt) => (
 <button
 key={amt}
 type="button"
 onClick={() => setQuantity(Math.min(availableStock, amt))}
 className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] cursor-pointer"
 >
 {amt}x ({amt === 24 ? '1 Crate' : amt === 48 ? '2 Crates' : `${amt} bottles`})
 </button>
 ))}
 </div>
 </div>

 {/* 4. Transfer Valuation Breakdown */}
 <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-1.5 font-mono">
   <div className="flex items-center justify-between text-slate-300 text-xs">
     <span>Selling Price:</span>
     <span>KES {selectedProduct.sellingPrice.toLocaleString()}</span>
   </div>
   <div className="flex items-center justify-between text-amber-300 text-sm font-bold pt-1 border-t border-amber-900/40">
     <span>Total Value to Transfer:</span>
     <span>KES {totalTransferValue.toLocaleString()}</span>
   </div>
   <p className="text-[10px] text-slate-400 font-sans pt-0.5">
     💡 <strong>Automatic Accounting:</strong> Once accepted by the partner, this stock value (KES {totalTransferValue.toLocaleString()}) is removed from your bar and added to the receiving bar's ledger.
   </p>
 </div>

 {/* 5. Optional Note */}
 <div>
 <label className="block text-slate-400 text-[11px] mb-1">
 Remark / Note (Optional)
 </label>
 <input
 type="text"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-slate-500"
 />
 </div>

 {/* Submit */}
 <div className="pt-2">
 <button
 type="submit"
 disabled={quantity > availableStock || availableStock <= 0}
 className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-sm tracking-wide shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
 >
 <span>Dispatch Stock Transfer</span>
 <ArrowRight className="w-4 h-4" />
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
