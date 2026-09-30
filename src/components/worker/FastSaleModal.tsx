import React, { useState } from 'react';
import { Product, MpesaAccountType } from '../../types';
import { X, Smartphone, Banknote, CheckCircle, Plus, Minus } from 'lucide-react';

interface FastSaleModalProps {
  product: Product;
  currentStock: number;
  onClose: () => void;
  onConfirmSale: (params: {
    productId: string;
    quantity: number;
    paymentMethod: 'CASH' | 'MPESA';
    mpesaAccountType?: MpesaAccountType;
    transactionRef?: string;
  }) => void;
}

export const FastSaleModal: React.FC<FastSaleModalProps> = ({
  product,
  currentStock,
  onClose,
  onConfirmSale,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA'>('CASH');
  const [mpesaAccountType, setMpesaAccountType] = useState<MpesaAccountType>('BUY_GOODS_TILL');
  const [transactionRef, setTransactionRef] = useState<string>('');

  const subtotal = quantity * product.sellingPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;
    onConfirmSale({
      productId: product.id,
      quantity,
      paymentMethod,
      mpesaAccountType: paymentMethod === 'MPESA' ? mpesaAccountType : undefined,
      transactionRef: paymentMethod === 'MPESA' ? transactionRef : undefined,
    });
  };

  const mpesaOptions: { type: MpesaAccountType; label: string; details: string }[] = [
    { type: 'BUY_GOODS_TILL', label: 'Buy Goods Till', details: 'Till 5421980' },
    { type: 'PAYBILL', label: 'Paybill', details: '889900 (Acc: COUNTER)' },
    { type: 'POCHI_LA_BIASHARA', label: 'Pochi la Biashara', details: '0722 841 902' },
    { type: 'SEND_MONEY', label: 'Send Money Direct', details: 'Staff phone' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#121824] border border-[#1E293B] rounded-t-3xl sm:rounded-3xl p-5 md:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Record Sale</h3>
            <p className="text-xs text-slate-400">
              Counter Stock Available: <span className="font-mono text-emerald-400 font-semibold">{currentStock}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Selected Drink Info */}
          <div className="p-3 rounded-2xl bg-[#172030] border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{product.name}</div>
              <div className="text-xs text-slate-400">
                Unit Price: <span className="font-mono text-slate-200 font-semibold">KES {product.sellingPrice}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Total</div>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                KES {subtotal.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Quantity Selector with Quick Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Quantity Sold
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xl active:scale-95 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                min="1"
                max={currentStock > 0 ? currentStock + 5 : 99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 h-12 bg-[#0E1420] border border-slate-700 rounded-xl text-center font-mono font-bold text-2xl text-white focus:outline-none focus:border-emerald-500 tabular-nums"
              />

              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xl active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[1, 2, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={`py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    quantity === num
                      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-400'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Payment Channel
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                  paymentMethod === 'CASH'
                    ? 'border-amber-500/60 bg-amber-950/30 text-amber-300 font-bold ring-1 ring-amber-500/30'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Physical Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MPESA')}
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                  paymentMethod === 'MPESA'
                    ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-400 font-bold ring-1 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>M-Pesa Channel</span>
              </button>
            </div>
          </div>

          {/* M-Pesa Channel Specifics */}
          {paymentMethod === 'MPESA' && (
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-emerald-900/40 space-y-3">
              <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Select M-Pesa Sub-Channel
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mpesaOptions.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setMpesaAccountType(opt.type)}
                    className={`p-2 rounded-xl border text-left text-[11px] transition-all cursor-pointer ${
                      mpesaAccountType === opt.type
                        ? 'border-emerald-500 bg-emerald-950/50 text-white font-semibold'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate font-medium">{opt.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{opt.details}</div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">
                  Customer M-Pesa Ref / Phone (Optional)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value.toUpperCase())}
                  placeholder="e.g. QK8912B9"
                  className="w-full bg-[#151D2C] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Confirm Sale (KES {subtotal.toLocaleString()})</span>
          </button>
        </form>
      </div>
    </div>
  );
};
