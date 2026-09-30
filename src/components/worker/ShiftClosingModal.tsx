import React, { useState } from 'react';
import { Shift, ShiftStockItem, Expense } from '../../types';
import { store } from '../../services/store';
import {
  X,
  Lock,
  Smartphone,
  Banknote,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowRight,
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
  // Step 1: Physical closing stock counts
  // Default to expected closing: opening + additions - sales - damages + transfersIn - transfersOut
  const [closingPhysicalCounts, setClosingPhysicalCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    shiftStockItems.forEach((item) => {
      const expected =
        item.openingPhysicalCount +
        item.additions +
        item.transfersIn -
        item.recordedSales -
        item.transfersOut -
        item.damages;
      initial[item.productId] = Math.max(0, expected);
    });
    return initial;
  });

  // Step 2: Financial counts
  // Actual cash physically present in drawer at shift end
  const [closingCashActual, setClosingCashActual] = useState<string>('14500');

  // Closing M-Pesa balance on the phone/till
  // For demonstration, default to (opening + ~7000) as in user's prompt
  const [closingMpesaBalance, setClosingMpesaBalance] = useState<string>(
    String((shift.openingMpesaBalance || 10000) + 7000)
  );

  const [closingNotes, setClosingNotes] = useState<string>('');

  const handlePhysicalCountChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setClosingPhysicalCounts((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  // Perform live preview calculations
  const parsedCashActual = parseFloat(closingCashActual) || 0;
  const parsedMpesaClosing = parseFloat(closingMpesaBalance) || 0;
  const openingMpesa = shift.openingMpesaBalance || 0;
  const openingCashFloat = shift.openingCashFloat || 0;

  // The User's explicit M-Pesa formula: Closing - Opening
  const netMpesaIncome = parsedMpesaClosing - openingMpesa;
  const netCashIncome = parsedCashActual - openingCashFloat;
  const totalIncomeReturned = netCashIncome + netMpesaIncome;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  let expectedSalesRevenue = 0;
  let totalCostOfGoodsSold = 0;
  let stockDiscrepanciesCount = 0;
  let totalStockDiscrepancyValue = 0;

  const stockRows = shiftStockItems.map((item) => {
    const expectedClosing =
      item.openingPhysicalCount +
      item.additions +
      item.transfersIn -
      item.recordedSales -
      item.transfersOut -
      item.damages;

    const actualCount =
      closingPhysicalCounts[item.productId] !== undefined
        ? closingPhysicalCounts[item.productId]
        : expectedClosing;

    const variance = actualCount - expectedClosing;
    const monetaryVariance = variance * item.sellingPrice;

    expectedSalesRevenue += item.recordedSales * item.sellingPrice;
    totalCostOfGoodsSold += item.recordedSales * item.costPrice;

    if (variance !== 0) {
      stockDiscrepanciesCount++;
      totalStockDiscrepancyValue += monetaryVariance;
    }

    return {
      ...item,
      expectedClosing,
      actualCount,
      variance,
      monetaryVariance,
    };
  });

  const grossProfit = expectedSalesRevenue - totalCostOfGoodsSold;
  const netProfit = grossProfit - totalExpenses;
  // Variance between (Actual Money Returned + Expenses) vs Theoretical Drink Sales
  const financialVariance = totalIncomeReturned + totalExpenses - expectedSalesRevenue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmClose({
      closingPhysicalCounts,
      closingCashActual: parsedCashActual,
      closingMpesaBalance: parsedMpesaClosing,
      closingNotes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-7 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Shift Closing & Reconciliation
              </h2>
              <p className="text-xs text-slate-400">
                Shift: <span className="font-mono text-slate-200">{shift.shiftNumber}</span> · {shift.locationName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* SECTION 1: Closing M-Pesa & Cash Financial Counts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>1. Financial Closing Handover</span>
              </h3>
              <span className="text-[11px] text-slate-400">Record ending phone & drawer totals</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Closing M-Pesa Entry */}
              <div className="p-4 rounded-2xl bg-[#151D2C] border border-emerald-900/40">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-emerald-400 uppercase flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>Closing M-Pesa Balance</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Entry: KES {openingMpesa.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Current statement balance displayed on till phone
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={closingMpesaBalance}
                    onChange={(e) => setClosingMpesaBalance(e.target.value)}
                    placeholder="17000"
                    className="w-full bg-[#0E1420] border border-emerald-500/60 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums"
                  />
                </div>
                {/* Instant subtraction display */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Net M-Pesa Revenue:</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {closingMpesaBalance ? `${parsedMpesaClosing.toLocaleString()} - ${openingMpesa.toLocaleString()} = ` : ''}
                    KES {netMpesaIncome.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Closing Cash Entry */}
              <div className="p-4 rounded-2xl bg-[#151D2C] border border-amber-900/40">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-amber-400 uppercase flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" />
                    <span>Ending Cash in Drawer</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Float: KES {openingCashFloat.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Physical count of notes & coins in drawer
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={closingCashActual}
                    onChange={(e) => setClosingCashActual(e.target.value)}
                    placeholder="14500"
                    className="w-full bg-[#0E1420] border border-amber-500/60 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 tabular-nums"
                  />
                </div>
                {/* Instant subtraction display */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Net Cash Revenue:</span>
                  <span className="font-mono font-bold text-amber-400 tabular-nums">
                    {closingCashActual ? `${parsedCashActual.toLocaleString()} - ${openingCashFloat.toLocaleString()} = ` : ''}
                    KES {netCashIncome.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Income Surrendered Highlight */}
            <div className="mt-3 p-3.5 rounded-2xl bg-[#172030] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-300">
                  Total Actual Income Surrendered
                </div>
                <div className="text-[11px] text-slate-400">
                  Net Cash (KES {netCashIncome.toLocaleString()}) + Net M-Pesa (KES {netMpesaIncome.toLocaleString()})
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                  KES {totalIncomeReturned.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Physical Stock Ending Count */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>2. Physical Stock Count on Counter</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Formula: Opening + In - Sold - Out
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-[#0E1420]">
              {stockRows.map((item) => {
                const isShort = item.variance < 0;
                const isOver = item.variance > 0;

                return (
                  <div
                    key={item.productId}
                    className={`p-2.5 flex items-center justify-between gap-3 text-xs ${
                      isShort ? 'bg-red-950/20' : isOver ? 'bg-amber-950/20' : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-200 truncate">
                        {item.productName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Start: {item.openingPhysicalCount} · Sold: {item.recordedSales} · Expected: <span className="text-slate-300 font-bold">{item.expectedClosing}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Physical:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.actualCount}
                        onChange={(e) => handlePhysicalCountChange(item.productId, e.target.value)}
                        className={`w-16 bg-[#151D2C] border rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none tabular-nums ${
                          isShort
                            ? 'border-red-500 text-red-300'
                            : isOver
                            ? 'border-amber-500 text-amber-300'
                            : 'border-slate-700'
                        }`}
                      />
                      {item.variance !== 0 && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            isShort
                              ? 'bg-red-950/80 border-red-800 text-red-400'
                              : 'bg-amber-950/80 border-amber-800 text-amber-400'
                          }`}
                        >
                          {item.variance > 0 ? `+${item.variance}` : item.variance}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Automated Shift Discrepancy & Profit Calculation Card */}
          <div className="p-4 rounded-2xl bg-[#151D2C] border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Automatic Reconciliation Calculation</span>
              <span className="text-[10px] font-mono text-emerald-400">Zero Worker Calculation Burden</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Drink Sales Expected</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  KES {expectedSalesRevenue.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Shift Expenses</div>
                <div className="font-mono font-bold text-red-400 mt-0.5">
                  -KES {totalExpenses.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Cost of Goods (COGS)</div>
                <div className="font-mono font-bold text-slate-300 mt-0.5">
                  KES {totalCostOfGoodsSold.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Shift Net Profit</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">
                  KES {netProfit.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Discrepancy Alert Notice if any */}
            {(stockDiscrepanciesCount > 0 || Math.abs(financialVariance) > 5) && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Variance Detected - Will Be Surfaced to Owner</span>
                </div>
                {stockDiscrepanciesCount > 0 && (
                  <div>
                    • {stockDiscrepanciesCount} stock item(s) differ from expected (Total stock difference: KES {totalStockDiscrepancyValue.toLocaleString()})
                  </div>
                )}
                {Math.abs(financialVariance) > 5 && (
                  <div>
                    • Financial difference of KES {Math.abs(financialVariance).toLocaleString()}{' '}
                    ({financialVariance < 0 ? 'Cash/M-Pesa Shortage' : 'Cash/M-Pesa Surplus'})
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Closing Handover Notes (Optional)
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="e.g. Returned 2 damaged glasses, counter cleaned, keys handed to night guard"
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-13 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Final Reconciliation & Close Shift</span>
          </button>
        </form>
      </div>
    </div>
  );
};
