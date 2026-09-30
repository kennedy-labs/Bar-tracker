import React, { useState } from 'react';
import { Shift, ShiftStockItem, Expense } from '../../types';
import {
  X,
  Lock,
  Smartphone,
  Coins,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Search,
  Plus,
  Minus,
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Physical closing stock counts: worker records what's LEFT in the counter
  // Default to available stock on counter
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

  // Physical cash in drawer
  const [closingCashActual, setClosingCashActual] = useState<string>('14500');

  // Ending M-Pesa balance on business phone
  const [closingMpesaBalance, setClosingMpesaBalance] = useState<string>(
    String((shift.openingMpesaBalance || 10000) + 7000)
  );

  const [closingNotes, setClosingNotes] = useState<string>('');

  // Sort shift stock items alphabetically A to Z
  const sortedItems = [...shiftStockItems].sort((a, b) =>
    a.productName.localeCompare(b.productName)
  );

  const filteredItems = sortedItems.filter((i) =>
    i.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePhysicalCountChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setClosingPhysicalCounts((prev) => ({
      ...prev,
      [productId]: num,
    }));
  };

  const adjustCount = (productId: string, delta: number) => {
    setClosingPhysicalCounts((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      };
    });
  };

  // Perform live system calculations:
  // "They simply record whats left in the counter, the system calculates whats sold"
  const parsedCashActual = parseFloat(closingCashActual) || 0;
  const parsedMpesaClosing = parseFloat(closingMpesaBalance) || 0;
  const openingMpesa = shift.openingMpesaBalance || 0;
  const openingCashFloat = shift.openingCashFloat || 0;

  const netMpesaIncome = parsedMpesaClosing - openingMpesa;
  const netCashIncome = parsedCashActual - openingCashFloat;
  const totalMoneyCollected = netCashIncome + netMpesaIncome;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  let totalBottlesSold = 0;
  let expectedDrinkSalesRevenue = 0;

  const calculatedRows = shiftStockItems.map((item) => {
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

    // System calculates sold quantity
    const sold = Math.max(0, availableStock - leftOnCounter);
    const itemRevenue = sold * item.sellingPrice;

    totalBottlesSold += sold;
    expectedDrinkSalesRevenue += itemRevenue;

    return {
      ...item,
      availableStock,
      leftOnCounter,
      sold,
      itemRevenue,
    };
  });

  // Financial discrepancy: Money accounted for vs expected drink sales
  const cashDiscrepancy = totalMoneyCollected + totalExpenses - expectedDrinkSalesRevenue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmClose({
      closingPhysicalCounts,
      closingCashActual: parsedCashActual,
      closingMpesaBalance: parsedMpesaClosing,
      closingNotes: closingNotes.trim() ? closingNotes : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#121824] border border-[#1E293B] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#151D2C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Close Shift & Record Ending Counter
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {shift.locationName} · Attendant: {shift.workerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {/* Instructions banner */}
          <div className="p-3 rounded-xl bg-[#0E1420] border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
            <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Automated Math:</strong> Simply record what is left on the counter, your cash drawer total, and M-Pesa balance. The system automatically calculates sold units, expected money, and verifies variances.
            </span>
          </div>

          {/* Financial Balances: Closing Cash & Closing M-Pesa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Closing Cash */}
            <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  <span>Closing Drawer Cash</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Float: KES {openingCashFloat.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Total physical notes & coins in drawer
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
                  className="w-full bg-[#0E1420] border border-slate-700 focus:border-amber-500 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none tabular-nums"
                />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
                Net Cash Taken: <strong className="text-white">KES {netCashIncome.toLocaleString()}</strong>
              </div>
            </div>

            {/* Closing M-Pesa Balance */}
            <div className="bg-[#151D2C] border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>Closing M-Pesa Balance</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Start: KES {openingMpesa.toLocaleString()}
                </span>
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
                  value={closingMpesaBalance}
                  onChange={(e) => setClosingMpesaBalance(e.target.value)}
                  className="w-full bg-[#0E1420] border border-slate-700 focus:border-emerald-500 rounded-xl pl-12 pr-3 py-2 text-base font-mono font-bold text-white focus:outline-none tabular-nums"
                />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
                Net M-Pesa Taken: <strong className="text-white">KES {netMpesaIncome.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Single Column Alphabetical Counter Inventory Count */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  What's Left on Counter (Alphabetical A to Z)
                </label>
                <span className="text-[11px] text-slate-400">
                  Count remaining bottles. The system calculates what was sold and expected sales revenue.
                </span>
              </div>
              {/* Search filter */}
              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter drink..."
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                />
              </div>
            </div>

            {/* 1 Single Column List */}
            <div className="border border-slate-800 rounded-2xl divide-y divide-slate-800/80 bg-[#0E1420] max-h-72 overflow-y-auto">
              {filteredItems.map((item) => {
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
                const revenue = sold * item.sellingPrice;

                return (
                  <div
                    key={item.productId}
                    className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                        <span>Total on counter: <strong className="text-slate-300">{availableStock}</strong></span>
                        <span>·</span>
                        <span>KES {item.sellingPrice}</span>
                      </div>
                      {sold > 0 && (
                        <div className="text-[11px] font-mono text-emerald-400 mt-1">
                          System calculated sold: <strong>{sold} units</strong> (KES {revenue.toLocaleString()})
                        </div>
                      )}
                    </div>

                    {/* Counter Input for What's Left */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-mono">Left:</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustCount(item.productId, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={leftOnCounter}
                          onChange={(e) => handlePhysicalCountChange(item.productId, e.target.value)}
                          className="w-14 bg-[#151D2C] border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-sm text-white focus:outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => adjustCount(item.productId, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Automated System Reconciliation Math Card */}
          <div className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Shift Reconciliation Summary</span>
              </span>
              <span className="text-emerald-400">{totalBottlesSold} bottles calculated sold</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Expected Drink Sales:</span>
                <div className="text-sm font-bold text-white">
                  KES {expectedDrinkSalesRevenue.toLocaleString()}
                </div>
              </div>

              <div>
                <span className="text-slate-500">Net Money Collected:</span>
                <div className="text-sm font-bold text-white">
                  KES {totalMoneyCollected.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">
                  (Cash: KES {netCashIncome.toLocaleString()} + M-Pesa: KES {netMpesaIncome.toLocaleString()})
                </div>
              </div>
            </div>

            {totalExpenses > 0 && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>Authorized Shift Expenses:</span>
                <span className="font-bold text-slate-300">KES {totalExpenses.toLocaleString()}</span>
              </div>
            )}

            {/* Discrepancy Verdict */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                Math.abs(cashDiscrepancy) <= 5
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : cashDiscrepancy < 0
                  ? 'bg-red-950/40 border-red-800 text-red-300'
                  : 'bg-amber-950/40 border-amber-800 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {Math.abs(cashDiscrepancy) <= 5 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {Math.abs(cashDiscrepancy) <= 5
                      ? 'Reconciliation Balanced'
                      : cashDiscrepancy < 0
                      ? 'Cash & M-Pesa Shortage Detected'
                      : 'Cash Surplus'}
                  </div>
                  <div className="text-[10px] opacity-80">
                    {Math.abs(cashDiscrepancy) <= 5
                      ? 'Total money in drawer and till perfectly accounts for bottles sold.'
                      : cashDiscrepancy < 0
                      ? 'Money returned is less than expected sales of bottles sold.'
                      : 'More money collected than expected drinks sold.'}
                  </div>
                </div>
              </div>
              <div className="text-right font-bold text-sm tabular-nums">
                {cashDiscrepancy >= 0 ? `+KES ${cashDiscrepancy.toLocaleString()}` : `-KES ${Math.abs(cashDiscrepancy).toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Closing Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase font-mono block mb-1">
              Handover Remarks for Next Shift & Owner (Optional):
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="e.g. Left counter chiller fully locked, key on shelf"
              className="w-full bg-[#0E1420] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Confirm Handover & Close Shift</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
