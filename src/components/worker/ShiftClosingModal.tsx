import React, { useState } from 'react';
import { Shift, ShiftStockItem, Expense } from '../../types';
import {
  X,
  Coins,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Wine,
} from 'lucide-react';

interface ShiftClosingModalProps {
  shift: Shift;
  shiftStockItems: ShiftStockItem[];
  expenses: Expense[];
  onClose: () => void;
  onConfirmClose: (params: {
    closingPhysicalCounts: Record<string, number>;
    closingCashActual: number;
    closingMpesaBalance: number;
    closingNotes?: string;
  }) => void;
}

export const ShiftClosingModal: React.FC<ShiftClosingModalProps> = ({
  shift,
  shiftStockItems,
  expenses,
  onClose,
  onConfirmClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // 1. Stock left on counter
  const [closingPhysicalCounts, setClosingPhysicalCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    shiftStockItems.forEach((item) => {
      const available =
        item.openingPhysicalCount +
        item.additions +
        item.transfersIn -
        item.transfersOut -
        item.damages;
      initial[item.productId] = Math.max(0, available);
    });
    return initial;
  });

  // 2. Financials (Empty initially with helpful placeholder)
  const [closingCashActual, setClosingCashActual] = useState<string>('');
  const [closingMpesaBalance, setClosingMpesaBalance] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  const adjustCount = (productId: string, delta: number) => {
    setClosingPhysicalCounts((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      };
    });
  };

  // Calculations
  const parsedCashActual = parseFloat(closingCashActual) || 0;
  const parsedMpesaClosing = parseFloat(closingMpesaBalance) || 0;
  const openingMpesa = shift.openingMpesaBalance || 0;
  const openingCashFloat = shift.openingCashFloat || 0;

  const netMpesaIncome = parsedMpesaClosing - openingMpesa;
  const netCashIncome = parsedCashActual - openingCashFloat;
  const totalMoneyCollected = netCashIncome + netMpesaIncome;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  let totalBottlesSold = 0;
  let expectedSalesRevenue = 0;

  shiftStockItems.forEach((item) => {
    const availableStock =
      item.openingPhysicalCount +
      item.additions +
      item.transfersIn -
      item.transfersOut -
      item.damages;

    const leftOnCounter =
      closingPhysicalCounts[item.productId] !== undefined
        ? closingPhysicalCounts[item.productId]
        : availableStock;

    const sold = Math.max(0, availableStock - leftOnCounter);
    totalBottlesSold += sold;
    expectedSalesRevenue += sold * item.sellingPrice;
  });

  // Shortage or surplus
  const variance = totalMoneyCollected + totalExpenses - expectedSalesRevenue;

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmClose({
      closingPhysicalCounts,
      closingCashActual: parsedCashActual,
      closingMpesaBalance: parsedMpesaClosing,
      closingNotes: closingNotes.trim() ? closingNotes : undefined,
    });
  };

  // Sorted items
  const sortedItems = [...shiftStockItems].sort((a, b) =>
    a.productName.localeCompare(b.productName)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#121824] border border-[#1E293B] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#151D2C]">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Shift Handover · Step {step} of 3
            </span>
            <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
              {step === 1 && 'Count Remaining Bottles'}
              {step === 2 && 'Count Money in Drawer & Phone'}
              {step === 3 && 'Check Shift Balance & Handover'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-1 px-4 sm:px-6 pt-3">
          <div className={`h-1.5 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          <div className={`h-1.5 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
        </div>

        <div className="p-4 sm:p-6">
          {/* STEP 1: COUNT REMAINING BOTTLES */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Count what is left on the shelves right now. The system will automatically calculate how many drinks were sold.
              </p>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {sortedItems.map((item) => {
                  const available =
                    item.openingPhysicalCount +
                    item.additions +
                    item.transfersIn -
                    item.transfersOut -
                    item.damages;
                  const count =
                    closingPhysicalCounts[item.productId] !== undefined
                      ? closingPhysicalCounts[item.productId]
                      : available;
                  const sold = Math.max(0, available - count);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#0E1420] border border-slate-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{item.productName}</span>
                          {item.additions > 0 && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 shrink-0">
                              +{item.additions} added
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>
                            Start: {available}
                            {item.additions > 0 && ` (+${item.additions} added)`}
                          </span>
                          <span>·</span>
                          <span className={sold > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                            Sold: {sold}
                          </span>
                        </div>
                      </div>

                      {/* Stepper Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjustCount(item.productId, -1)}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-base text-white">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustCount(item.productId, 1)}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Real-time drinks sold summary banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Wine className="w-4 h-4" />
                  <span className="font-bold">{totalBottlesSold} Drinks Sold</span>
                </div>
                <div className="font-mono font-bold text-white">
                  Expected: KES {expectedSalesRevenue.toLocaleString()}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Next: Enter Cash & M-Pesa</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: COUNT MONEY */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Check the expected money below, then enter your physical drawer cash and ending M-Pesa balance.
              </p>

              {/* EXPECTED MONEY SUMMARY CARD (BEFORE INPUTS) */}
              <div className="bg-gradient-to-br from-emerald-950/50 via-[#151D2C] to-[#0E1420] border-2 border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs shadow-inner shrink-0">
                      KES
                    </span>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                        Shift Sales Target
                      </span>
                      <h4 className="text-sm font-black text-white">
                        Expected Money from Shift
                      </h4>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 uppercase font-sans block">
                      Expected Sales
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      KES {expectedSalesRevenue.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Sold ({totalBottlesSold})</div>
                    <div className="font-bold text-white mt-0.5">KES {expectedSalesRevenue.toLocaleString()}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Expenses</div>
                    <div className={`font-bold mt-0.5 ${totalExpenses > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {totalExpenses > 0 ? `-KES ${totalExpenses.toLocaleString()}` : 'KES 0'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-sans">Starting Floats</div>
                    <div className="font-bold text-slate-300 mt-0.5">
                      KES {(openingCashFloat + openingMpesa).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Total target in Drawer + Phone:</span>
                  </span>
                  <span className="font-mono font-black text-emerald-300 text-sm">
                    KES {((openingCashFloat + openingMpesa) + expectedSalesRevenue - totalExpenses).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cash in Drawer */}
              <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  <Coins className="w-4 h-4" />
                  <span>Final Cash in Drawer</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    step="any"
                    inputMode="numeric"
                    required
                    value={closingCashActual}
                    onChange={(e) => setClosingCashActual(e.target.value)}
                    placeholder="e.g. 14,500"
                    className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl pl-14 pr-4 py-3 text-lg font-bold text-white focus:outline-none tabular-nums"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {closingCashActual.trim() ? (
                    <span>Cash collected from sales: <strong className="text-white font-mono">KES {Math.max(0, netCashIncome).toLocaleString()}</strong></span>
                  ) : (
                    <span>Opening drawer float was <strong className="text-slate-400 font-mono">KES {openingCashFloat.toLocaleString()}</strong></span>
                  )}
                </div>
              </div>

              {/* M-Pesa Balance */}
              <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <Smartphone className="w-4 h-4" />
                  <span>Final M-Pesa Till Balance</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    step="any"
                    inputMode="numeric"
                    required
                    value={closingMpesaBalance}
                    onChange={(e) => setClosingMpesaBalance(e.target.value)}
                    placeholder="e.g. 17,000"
                    className="w-full bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-xl pl-14 pr-4 py-3 text-lg font-bold text-white focus:outline-none tabular-nums"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {closingMpesaBalance.trim() ? (
                    <span>M-Pesa collected from sales: <strong className="text-emerald-400 font-mono">KES {Math.max(0, netMpesaIncome).toLocaleString()}</strong></span>
                  ) : (
                    <span>Opening till balance was <strong className="text-slate-400 font-mono">KES {openingMpesa.toLocaleString()}</strong></span>
                  )}
                </div>
              </div>

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
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Next: Check Balance</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: TRAINER VERDICT & HANDOVER */}
          {step === 3 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              {/* Verdict Card */}
              {Math.abs(variance) <= 10 ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500 text-emerald-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Everything Matches! Shift Balanced.</span>
                  </div>
                  <p className="text-xs text-emerald-300/90">
                    Your money collected matches the bottles sold. Ready to hand over to the owner.
                  </p>
                </div>
              ) : variance < -10 ? (
                <div className="p-4 rounded-2xl bg-red-950/50 border border-red-500 text-red-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>Short by KES {Math.abs(variance).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-red-300/90">
                    Money counted is less than the drinks sold. Check if someone forgot an M-Pesa payment or cash in the drawer.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500 text-blue-200 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-blue-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>KES {variance.toLocaleString()} Extra Cash Recorded</span>
                  </div>
                  <p className="text-xs text-blue-300/90">
                    You have extra cash beyond what was recorded from drinks.
                  </p>
                </div>
              )}

              {/* Simple Breakdown Table */}
              <div className="bg-[#0E1420] border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Drinks Sold ({totalBottlesSold} bottles)</span>
                  <span className="font-bold text-white">KES {expectedSalesRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Cash & M-Pesa Collected</span>
                  <span className="font-bold text-emerald-400">KES {totalMoneyCollected.toLocaleString()}</span>
                </div>
                {totalExpenses > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Expenses Paid (Ice, lemon, etc.)</span>
                    <span>KES {totalExpenses.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                  <span className="text-slate-200">Balance Difference</span>
                  <span className={variance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {variance >= 0 ? `+KES ${variance.toLocaleString()}` : `-KES ${Math.abs(variance).toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Optional closing notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Handover Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. 2 broken Tusker bottles, key left with guard..."
                  className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Confirm & Hand Over Shift 🔒</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
