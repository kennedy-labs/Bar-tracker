import React, { useState } from 'react';
import { Product, InventoryItem } from '../../types';
import { store } from '../../services/store';
import {
  Smartphone,
  Coins,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Scale,
  CheckCircle2,
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
  const [step, setStep] = useState<1 | 2>(1);

  // Retrieve previous shift info and configured M-Pesa account
  const lastClosedShift = store.getLastClosedShift();
  const primaryMpesa = store.getPrimaryMpesaAccount();

  // Step 1: Money (Empty initially with helpful placeholder)
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>('');
  const [openingCashFloat, setOpeningCashFloat] = useState<string>('');

  // Step 2: Physical Counts
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      initial[p.id] = inv ? inv.quantityOnHand : 0;
    });
    return initial;
  });

  const [inconsistencyNote, setInconsistencyNote] = useState<string>('');

  // Sort products alphabetically
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const adjustCount = (productId: string, delta: number) => {
    setPhysicalCounts((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      };
    });
  };

  const handleMatchAll = () => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      initial[p.id] = inv ? inv.quantityOnHand : 0;
    });
    setPhysicalCounts(initial);
  };

  // Check differences: calculate both missing shortages AND surplus extra bottles
  let totalMissing = 0;
  let totalSurplus = 0;
  let missingValue = 0;
  let surplusValue = 0;

  products.forEach((p) => {
    const inv = inventory.find((i) => i.productId === p.id);
    const expected = inv ? inv.quantityOnHand : 0;
    const actual = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : expected;
    const diff = actual - expected;

    if (diff < 0) {
      const qtyShort = Math.abs(diff);
      totalMissing += qtyShort;
      missingValue += qtyShort * p.sellingPrice;
    } else if (diff > 0) {
      totalSurplus += diff;
      surplusValue += diff * p.sellingPrice;
    }
  });

  const prevAttendantName = lastClosedShift ? lastClosedShift.workerName : 'the previous attendant';

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let autoSummary = '';
    if (totalMissing > 0 && totalSurplus > 0) {
      autoSummary = `Handover balance: ${totalMissing} bottle(s) short (KES ${missingValue.toLocaleString()}) & +${totalSurplus} bottle(s) surplus (KES ${surplusValue.toLocaleString()}) credited to ${prevAttendantName}.`;
    } else if (totalMissing > 0) {
      autoSummary = `${totalMissing} bottle(s) fewer than expected (KES ${missingValue.toLocaleString()}) left by ${prevAttendantName}.`;
    } else if (totalSurplus > 0) {
      autoSummary = `+${totalSurplus} surplus bottle(s) counted on shelf (+KES ${surplusValue.toLocaleString()}) credited to ${prevAttendantName}.`;
    }

    const finalNote = autoSummary
      ? inconsistencyNote.trim()
        ? `${autoSummary} Note: ${inconsistencyNote.trim()}`
        : autoSummary
      : inconsistencyNote.trim() || undefined;

    onConfirmOpen({
      openingCashFloat: parseFloat(openingCashFloat) || 0,
      openingMpesaBalance: parseFloat(openingMpesaBalance) || 0,
      physicalCounts,
      inconsistencyNote: finalNote,
    });
  };

  return (
    <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-7 max-w-xl mx-auto shadow-2xl space-y-6">
      {/* Trainer Step Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Shift Setup · Step {step} of 2</span>
          </span>
          <span className="text-xs text-slate-400">
            Attendant: <strong className="text-white">{workerName.split(' ')[0]}</strong>
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {step === 1 ? 'Check Till & M-Pesa Money' : 'Check Drinks on the Shelf'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {step === 1
            ? 'Before taking orders, count the cash in the drawer and check the M-Pesa balance.'
            : 'Make sure your bottle count is correct so you are not blamed for previous shortages.'}
        </p>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
        </div>
      </div>

      {/* STEP 1: MONEY */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Cash in Drawer */}
          <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <Coins className="w-4 h-4" />
              <span>1. Cash in the Drawer (Float)</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Count the coins and notes left in the cash box for giving change.
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                KES
              </span>
              <input
                type="number"
                step="any"
                inputMode="numeric"
                required
                value={openingCashFloat}
                onChange={(e) => setOpeningCashFloat(e.target.value)}
                placeholder="e.g. 3,000"
                className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl pl-14 pr-4 py-3 text-lg font-bold text-white focus:outline-none tabular-nums"
              />
            </div>
          </div>

          {/* M-Pesa Balance */}
          <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>2. Current M-Pesa Till Balance</span>
              </div>
              {primaryMpesa && (
                <span className="text-[11px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  {primaryMpesa.accountType === 'BUY_GOODS_TILL' ? 'Till: ' : primaryMpesa.accountType === 'PAYBILL' ? 'Paybill: ' : ''}
                  {primaryMpesa.identifier}
                  {primaryMpesa.accountNumber ? ` (${primaryMpesa.accountNumber})` : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-2">
              {primaryMpesa ? (
                <>Check the current balance on <strong>{primaryMpesa.accountName}</strong> via SMS or till app.</>
              ) : (
                <>Check the SMS balance on the bar's M-Pesa phone right now.</>
              )}
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                KES
              </span>
              <input
                type="number"
                step="any"
                inputMode="numeric"
                required
                value={openingMpesaBalance}
                onChange={(e) => setOpeningMpesaBalance(e.target.value)}
                placeholder="e.g. 10,000"
                className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl pl-14 pr-4 py-3 text-lg font-bold text-white focus:outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Next: Check Shelf Bottles</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: BOTTLE COUNT */}
      {step === 2 && (
        <form onSubmit={handleFinalSubmit} className="space-y-4">
          {/* Fast-Track Match Button */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/60">
            <div className="text-xs text-emerald-300">
              Is everything in order as left by the last shift?
            </div>
            <button
              type="button"
              onClick={handleMatchAll}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Match All</span>
            </button>
          </div>

          {/* Drinks List with Large Touch Buttons */}
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {sortedProducts.map((p) => {
              const inv = inventory.find((i) => i.productId === p.id);
              const expected = inv ? inv.quantityOnHand : 0;
              const count = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : expected;
              const diff = count - expected;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#0E1420] border border-slate-800"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>KES {p.sellingPrice}</span>
                      <span>·</span>
                      <span>Expected: {expected}</span>
                      {diff !== 0 && (
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            diff < 0
                              ? 'bg-red-950/80 text-red-400 border border-red-800/80'
                              : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                          }`}
                        >
                          {diff > 0 ? `+${diff} surplus` : `${diff} short`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Big Touch Stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustCount(p.id, -1)}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-base text-white">
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustCount(p.id, 1)}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Balanced Handover Fairness Banner */}
          {(totalMissing > 0 || totalSurplus > 0) && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                totalMissing > 0 && totalSurplus > 0
                  ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                  : totalMissing > 0
                  ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {totalMissing > 0 && totalSurplus > 0 ? (
                  <>
                    <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Balanced Scale Handover</span>
                  </>
                ) : totalMissing > 0 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{totalMissing} bottle(s) fewer than expected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>+{totalSurplus} surplus bottle(s) found on shelf!</span>
                  </>
                )}
              </div>

              {totalSurplus > 0 && (
                <div className="text-[11px] text-emerald-300">
                  🎉 <strong>+{totalSurplus} extra bottle(s)</strong> (+KES{' '}
                  {surplusValue.toLocaleString()}) left by{' '}
                  <strong>{prevAttendantName}</strong> will be{' '}
                  <strong>credited to their record</strong> to balance their scale fairly.
                </div>
              )}

              {totalMissing > 0 && (
                <div className="text-[11px] text-amber-300/90">
                  ⚠️ <strong>-{totalMissing} missing bottle(s)</strong> (KES{' '}
                  {missingValue.toLocaleString()}) logged so{' '}
                  <strong>{prevAttendantName}</strong> remains accountable, not you.
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Start My Shift 🚀</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
