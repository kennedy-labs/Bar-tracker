import React, { useState } from 'react';
import { Product, InventoryItem } from '../../types';
import { store } from '../../services/store';
import {
  Smartphone,
  Coins,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Search,
  Plus,
  Minus,
  UserX,
} from 'lucide-react';

interface ShiftOpeningModalProps {
  products: Product[];
  inventory: InventoryItem[];
  workerName: string;
  onConfirmOpen: (data: {
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
    inconsistencyNote?: string;
  }) => void;
}

export const ShiftOpeningModal: React.FC<ShiftOpeningModalProps> = ({
  products,
  inventory,
  workerName,
  onConfirmOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Retrieve previous shift to identify who is liable if items are missing
  const lastClosedShift = store.getLastClosedShift();
  const previousAttendant = lastClosedShift ? lastClosedShift.workerName : 'Previous Shift Attendant';

  // M-Pesa entry business balance
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>('10000');
  // Opening cash float in drawer
  const [openingCashFloat, setOpeningCashFloat] = useState<string>('3000');

  // Physical count record initialized with expected inventory
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      initial[p.id] = inv ? inv.quantityOnHand : 0;
    });
    return initial;
  });

  const [inconsistencyNote, setInconsistencyNote] = useState<string>('');

  // Sort products alphabetically A to Z (single column layout)
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const filteredProducts = sortedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check shortages against expected handover
  const shortages: {
    product: Product;
    expected: number;
    actual: number;
    diff: number;
    lossValue: number;
  }[] = [];

  products.forEach((p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    const systemQty = inv ? inv.quantityOnHand : 0;
    const physicalQty = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : systemQty;
    if (physicalQty < systemQty) {
      const diff = physicalQty - systemQty;
      shortages.push({
        product: p,
        expected: systemQty,
        actual: physicalQty,
        diff,
        lossValue: Math.abs(diff) * p.sellingPrice,
      });
    }
  });

  const totalShortageValue = shortages.reduce((sum, s) => sum + s.lossValue, 0);
  const totalMissingUnits = shortages.reduce((sum, s) => sum + Math.abs(s.diff), 0);

  const handleCountChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  const adjustCount = (productId: string, delta: number) => {
    setPhysicalCounts((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmOpen({
      openingCashFloat: parseFloat(openingCashFloat) || 0,
      openingMpesaBalance: parseFloat(openingMpesaBalance) || 0,
      physicalCounts,
      inconsistencyNote:
        shortages.length > 0
          ? `Missing ${totalMissingUnits} bottles (KES ${totalShortageValue.toLocaleString()}). Liable worker: ${previousAttendant}. ${inconsistencyNote}`
          : inconsistencyNote || undefined,
    });
  };

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-8 max-w-2xl mx-auto shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Shift Opening & Stock Handover
          </h2>
          <p className="text-xs text-slate-400">
            Attendant: <span className="text-emerald-400 font-medium">{workerName}</span>
            {lastClosedShift && (
              <span> · Taking over from: <strong className="text-amber-300">{previousAttendant}</strong></span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-6">
        {/* Financial Inputs: M-Pesa & Cash Float */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* M-Pesa Starting Balance */}
          <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Smartphone className="w-4 h-4" />
              <span>Starting M-Pesa Balance</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Balance on business phone/till right now
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                KES
              </span>
              <input
                type="number"
                step="any"
                required
                value={openingMpesaBalance}
                onChange={(e) => setOpeningMpesaBalance(e.target.value)}
                placeholder="10000"
                className="w-full bg-[#0E1420] border border-slate-700 focus:border-emerald-500 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums"
              />
            </div>
          </div>

          {/* Cash Float */}
          <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Coins className="w-4 h-4" />
              <span>Opening Cash Float</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Coins & small notes in drawer for change
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                KES
              </span>
              <input
                type="number"
                step="any"
                required
                value={openingCashFloat}
                onChange={(e) => setOpeningCashFloat(e.target.value)}
                placeholder="3000"
                className="w-full bg-[#0E1420] border border-slate-700 focus:border-amber-500 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Single-Column Alphabetical Item Count */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Bar Stock Physical Count (Alphabetical A to Z)
              </label>
              <span className="text-[11px] text-slate-400">
                Verify what is physically present. If bottles are missing, {previousAttendant} is liable.
              </span>
            </div>
            {/* Search filter */}
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drink..."
                className="w-full bg-[#0E1420] border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>
          </div>

          {/* 1 Single Column List */}
          <div className="border border-slate-800 rounded-2xl divide-y divide-slate-800/80 bg-[#0E1420] max-h-80 overflow-y-auto">
            {filteredProducts.map((product) => {
              const inv = inventory.find((i) => i.productId === product.id);
              const systemCount = inv ? inv.quantityOnHand : 0;
              const currentPhysical =
                physicalCounts[product.id] !== undefined
                  ? physicalCounts[product.id]
                  : systemCount;
              const diff = currentPhysical - systemCount;
              const isShortage = diff < 0;

              return (
                <div
                  key={product.id}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                    isShortage ? 'bg-red-950/20' : diff > 0 ? 'bg-amber-950/15' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate">
                      {product.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>Expected from {previousAttendant}: <strong className="text-slate-300">{systemCount}</strong></span>
                      <span>·</span>
                      <span>KES {product.sellingPrice}</span>
                    </div>
                    {isShortage && (
                      <div className="text-[11px] font-semibold text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Missing {Math.abs(diff)} bottle(s) (-KES {Math.abs(diff * product.sellingPrice).toLocaleString()}) — {previousAttendant} is responsible</span>
                      </div>
                    )}
                  </div>

                  {/* Large tactile counter controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustCount(product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={currentPhysical}
                      onChange={(e) => handleCountChange(product.id, e.target.value)}
                      className={`w-14 bg-[#151D2C] border rounded-lg px-2 py-1.5 text-center font-mono font-bold text-sm text-white focus:outline-none tabular-nums ${
                        isShortage
                          ? 'border-red-500 text-red-300'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustCount(product.id, 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Handover Shortage Accountability Warning */}
        {shortages.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800 text-xs text-red-200 space-y-2">
            <div className="font-bold flex items-center gap-2 text-red-300">
              <UserX className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                Missing Stock Detected: {totalMissingUnits} bottle(s) short (KES {totalShortageValue.toLocaleString()})
              </span>
            </div>
            <p className="text-[11px] text-red-300/90 leading-relaxed">
              <strong>Accountability Rule:</strong> The previous attendant (<strong>{previousAttendant}</strong>) is recorded as liable for this missing stock. You will only accept custody of what you physically verified.
            </p>
            <div>
              <label className="text-[10px] uppercase font-mono text-red-400 block mb-1">
                Optional Incident Remarks for Owner:
              </label>
              <input
                type="text"
                value={inconsistencyNote}
                onChange={(e) => setInconsistencyNote(e.target.value)}
                placeholder="e.g. Bottles missing from bottom shelf"
                className="w-full bg-[#121824] border border-red-900 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Protection Note */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0E1420] border border-slate-800 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Strict Handover Protection: By confirming, you take custody of the verified count. At shift end, you only enter what remains — the system calculates everything sold.
          </span>
        </div>

        {/* Confirm Shift Opening */}
        <button
          type="submit"
          className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
        >
          <span>Confirm Count & Open Shift</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
