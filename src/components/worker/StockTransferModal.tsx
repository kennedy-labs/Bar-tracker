import React, { useState } from 'react';
import { Product, StockLocation } from '../../types';
import { X, ArrowRightLeft, CheckCircle } from 'lucide-react';

interface StockTransferModalProps {
  products: Product[];
  locations: StockLocation[];
  currentLocationId: string;
  workerName: string;
  onClose: () => void;
  onConfirmTransfer: (params: {
    productId: string;
    toLocationId: string;
    quantity: number;
    senderName: string;
  }) => void;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  products,
  locations,
  currentLocationId,
  workerName,
  onClose,
  onConfirmTransfer,
}) => {
  const otherLocations = locations.filter((l) => l.id !== currentLocationId);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [toLocationId, setToLocationId] = useState<string>(otherLocations[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(6);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || !selectedProductId || !toLocationId) return;
    onConfirmTransfer({
      productId: selectedProductId,
      toLocationId,
      quantity,
      senderName: workerName,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Inter-Station Stock Transfer</h3>
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
              Product To Transfer
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Destination Location
            </label>
            <select
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {otherLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Quantity To Dispatch ({selectedProduct?.unit.toLowerCase()}s)
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-amber-500 tabular-nums"
            />
            <div className="flex gap-2 mt-2">
              {[2, 6, 12, 24].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-xs font-mono text-slate-300 hover:border-slate-700"
                >
                  {q} units
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300">
            Stock will be deducted from your counter and marked as PENDING until confirmed by the receiver.
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Dispatch Transfer</span>
          </button>
        </form>
      </div>
    </div>
  );
};
