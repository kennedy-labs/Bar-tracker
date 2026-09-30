import React, { useState } from 'react';
import { Product, StockLocation, InventoryItem } from '../../types';
import {
  Smartphone,
  Coins,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface ShiftOpeningModalProps {
  locations: StockLocation[];
  products: Product[];
  inventory: InventoryItem[];
  workerName: string;
  defaultLocationId: string;
  onConfirmOpen: (data: {
    locationId: string;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
    inconsistencyNote?: string;
  }) => void;
}

export const ShiftOpeningModal: React.FC<ShiftOpeningModalProps> = ({
  locations,
  products,
  inventory,
  workerName,
  defaultLocationId,
  onConfirmOpen,
}) => {
  const counterLocations = locations.filter((l) => l.isCounter);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    defaultLocationId || counterLocations[0]?.id || ''
  );

  // M-Pesa entry business amount (as requested by user)
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>('10000');
  // Opening cash float in drawer
  const [openingCashFloat, setOpeningCashFloat] = useState<string>('3000');

  // Physical count record: initialize with system inventory
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      const inv = inventory.find(
        (i) => i.locationId === selectedLocationId && i.productId === p.id
      );
      initial[p.id] = inv ? inv.quantityOnHand : 0;
    });
    return initial;
  });

  const [inconsistencyNote, setInconsistencyNote] = useState<string>('');

  // Check if any physical count differs from expected system inventory
  const mismatches = products.filter((p) => {
    const inv = inventory.find(
      (i) => i.locationId === selectedLocationId && i.productId === p.id
    );
    const systemQty = inv ? inv.quantityOnHand : 0;
    const physicalQty = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : systemQty;
    return physicalQty !== systemQty;
  });

  const handleCountChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmOpen({
      locationId: selectedLocationId,
      openingCashFloat: parseFloat(openingCashFloat) || 0,
      openingMpesaBalance: parseFloat(openingMpesaBalance) || 0,
      physicalCounts,
      inconsistencyNote: mismatches.length > 0 ? inconsistencyNote : undefined,
    });
  };

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-8 max-w-2xl mx-auto shadow-2xl">
      <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Shift Opening & Physical Verification
          </h2>
          <p className="text-xs text-slate-400">
            Attendant: <span className="text-emerald-400 font-medium">{workerName}</span> · Enforcing strict counter handover
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Location Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Counter Station
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {counterLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setSelectedLocationId(loc.id);
                  // refresh counts
                  const updated: Record<string, number> = {};
                  products.forEach((p) => {
                    const inv = inventory.find(
                      (i) => i.locationId === loc.id && i.productId === p.id
                    );
                    updated[p.id] = inv ? inv.quantityOnHand : 0;
                  });
                  setPhysicalCounts(updated);
                }}
                className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${
                  selectedLocationId === loc.id
                    ? 'border-emerald-500/50 bg-emerald-950/30 text-white ring-1 ring-emerald-500/30 font-semibold'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Financial Opening Entry: M-Pesa & Cash Float */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* M-Pesa Starting Business Balance */}
          <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Smartphone className="w-4 h-4" />
              <span>Entry M-Pesa Balance</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Read starting balance on counter phone / till SIM
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
                className="w-full bg-[#0E1420] border border-slate-700 focus:border-emerald-500 rounded-xl pl-12 pr-3 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums"
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              e.g. KES 10,000 float left from prior handover
            </div>
          </div>

          {/* Opening Cash Float */}
          <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Coins className="w-4 h-4" />
              <span>Opening Cash Float</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Physical coins & notes in drawer for change
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
                className="w-full bg-[#0E1420] border border-slate-700 focus:border-amber-500 rounded-xl pl-12 pr-3 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 tabular-nums"
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              e.g. KES 3,000 initial change float
            </div>
          </div>
        </div>

        {/* Physical Stock Handover Verification */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Physical Stock Verification
            </label>
            <span className="text-[11px] text-slate-400">
              Count bottles currently on counter shelves
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-[#0E1420]">
            {products.map((product) => {
              const inv = inventory.find(
                (i) => i.locationId === selectedLocationId && i.productId === product.id
              );
              const systemCount = inv ? inv.quantityOnHand : 0;
              const currentPhysical =
                physicalCounts[product.id] !== undefined
                  ? physicalCounts[product.id]
                  : systemCount;
              const hasDiff = currentPhysical !== systemCount;

              return (
                <div
                  key={product.id}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                    hasDiff ? 'bg-amber-950/20' : 'hover:bg-slate-900/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-200 truncate">
                      {product.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Expected: <span className="text-slate-300 font-semibold">{systemCount}</span> {product.unit.toLowerCase()}s
                      · Sell @ KES {product.sellingPrice}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Physical:</span>
                    <input
                      type="number"
                      min="0"
                      value={currentPhysical}
                      onChange={(e) => handleCountChange(product.id, e.target.value)}
                      className={`w-18 bg-[#151D2C] border rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none tabular-nums ${
                        hasDiff
                          ? 'border-amber-500 text-amber-300'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {hasDiff && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 px-1 py-0.5 rounded bg-amber-950/60 border border-amber-800">
                        {currentPhysical - systemCount > 0
                          ? `+${currentPhysical - systemCount}`
                          : currentPhysical - systemCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Warning & Inconsistency explanation if mismatch exists */}
        {mismatches.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{mismatches.length} Item Count Mismatch(es) Detected</span>
            </div>
            <p className="text-xs text-amber-300/90 mb-3">
              Physical count differs from registered store inventory. Record explanation for the Owner before proceeding:
            </p>
            <input
              type="text"
              required
              value={inconsistencyNote}
              onChange={(e) => setInconsistencyNote(e.target.value)}
              placeholder="e.g., 2 bottles of Tusker cider broke in storage prior to shift opening"
              className="w-full bg-[#121824] border border-amber-700/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verify Stock & Open Active Shift</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </form>
    </div>
  );
};
