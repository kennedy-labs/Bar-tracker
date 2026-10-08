import React, { useState, useEffect } from 'react';
import { User, Shift, ShiftStockItem, Expense } from '../../types';
import { store } from '../../services/store';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wine,
  Coins,
  Smartphone,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Search,
  Share2,
  Printer,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Calendar,
  Layers,
  Store,
} from 'lucide-react';

interface EndOfShiftScreenProps {
  currentUser: User;
  onGoToStartScreen: () => void;
  onGoToCounter: () => void;
}

export const EndOfShiftScreen: React.FC<EndOfShiftScreenProps> = ({
  currentUser,
  onGoToStartScreen,
  onGoToCounter,
}) => {
  const activeShift = store.getActiveShift();
  const lastShift = store.getLastClosedShift();
  const currentBiz = store.getCurrentBusiness();
  const primaryMpesa = store.getPrimaryMpesaAccount();

  // If active shift exists, get its stock items and expenses
  const shiftStockItems: ShiftStockItem[] = activeShift
    ? store.getShiftStockItems(activeShift.id)
    : [];
  const expenses: Expense[] = activeShift ? store.getExpenses(activeShift.id) : [];

  const existingDraft = activeShift ? store.getHandoverDraft(activeShift.id) : null;

  // Local state for active shift handover steps (1: Bottles, 2: Money, 3: Reconciliation)
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    return existingDraft?.step || 1;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Stock left on counter
  const [closingPhysicalCounts, setClosingPhysicalCounts] = useState<Record<string, number>>(() => {
    if (existingDraft?.closingPhysicalCounts) {
      return existingDraft.closingPhysicalCounts;
    }
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

  // 2. Financial inputs
  const [closingCashActual, setClosingCashActual] = useState<string>(() => {
    return existingDraft?.closingCashActual || '';
  });
  const [closingMpesaBalance, setClosingMpesaBalance] = useState<string>(() => {
    return existingDraft?.closingMpesaBalance || '';
  });
  const [closingNotes, setClosingNotes] = useState<string>(() => {
    return existingDraft?.closingNotes || '';
  });

  // Auto-persist draft so navigating backward or forward NEVER loses state
  useEffect(() => {
    if (!activeShift) return;
    store.saveHandoverDraft(activeShift.id, {
      step,
      closingPhysicalCounts,
      closingCashActual,
      closingMpesaBalance,
      closingNotes,
    });
  }, [activeShift?.id, step, closingPhysicalCounts, closingCashActual, closingMpesaBalance, closingNotes]);

  // Feedback states
  const [copiedToast, setCopiedToast] = useState(false);
  const [justClosedShift, setJustClosedShift] = useState<Shift | null>(null);

  // Stepper helper
  const adjustCount = (productId: string, delta: number) => {
    setClosingPhysicalCounts((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      };
    });
  };

  // Calculations for active handover
  const parsedCashActual = parseFloat(closingCashActual) || 0;
  const parsedMpesaClosing = parseFloat(closingMpesaBalance) || 0;
  const openingMpesa = activeShift?.openingMpesaBalance || 0;
  const openingCashFloat = activeShift?.openingCashFloat || 0;

  const netMpesaIncome = parsedMpesaClosing - openingMpesa;
  const netCashIncome = parsedCashActual - openingCashFloat;
  const totalMoneyCollected = netCashIncome + netMpesaIncome;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  let totalBottlesSold = 0;
  let expectedSalesRevenue = 0;
  const products = store.getProducts();

  shiftStockItems.forEach((item) => {
    const prod = products.find((p) => p.id === item.productId);
    const isMeasured = prod?.isMeasured || item.unit === 'VALUE_KES';
    const isValue = isMeasured && (prod?.measurementType === 'VALUE' || prod?.unit === 'VALUE_KES' || item.unit === 'VALUE_KES');

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
    if (!isValue) {
      totalBottlesSold += sold;
      expectedSalesRevenue += sold * item.sellingPrice;
    } else {
      expectedSalesRevenue += sold;
    }
  });

  // Financial Variance: (Total Money Accounted For) - Expected Revenue
  const totalAccountedFor = totalMoneyCollected + totalExpenses;
  const variance = totalAccountedFor - expectedSalesRevenue;

  // Submit Handler
  const handleFinalClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const closed = store.closeShift({
      shiftId: activeShift.id,
      closingPhysicalCounts,
      closingCashActual: parsedCashActual,
      closingMpesaBalance: parsedMpesaClosing,
      closingNotes: closingNotes.trim() ? closingNotes : undefined,
    });

    setJustClosedShift(closed);
  };

  // WhatsApp formatted report generator
  const copyHandoverSummary = (shiftToExport: Shift) => {
    const shiftItems = store.getShiftStockItems(shiftToExport.id);
    const shiftExp = store.getExpenses(shiftToExport.id);

    const netMpesa =
      shiftToExport.calculatedMpesaIncome !== undefined
        ? shiftToExport.calculatedMpesaIncome
        : (shiftToExport.closingMpesaBalance || 0) - shiftToExport.openingMpesaBalance;
    const netCash =
      shiftToExport.calculatedCashIncome !== undefined
        ? shiftToExport.calculatedCashIncome
        : (shiftToExport.closingCashActual || 0) - shiftToExport.openingCashFloat;
    const totalSales = shiftToExport.expectedSalesRevenue || 0;
    const varianceVal = shiftToExport.financialVariance || 0;

    const soldItems = shiftItems.filter((i) => i.recordedSales > 0);

    const drinksText = soldItems.length > 0
      ? soldItems.map((i) => `• ${i.productName}: ${i.recordedSales} sold (KES ${(i.recordedSales * i.sellingPrice).toLocaleString()})`).join('\n')
      : '• No drink sales recorded';

    const expText = shiftExp.length > 0
      ? shiftExp.map((e) => `• ${e.description}: -KES ${e.amount.toLocaleString()}`).join('\n')
      : '• No shift expenses';

    const text = `📋 *BAR TRACK — SHIFT HANDOVER REPORT*
🏪 Establishment: ${currentBiz.name}
🔢 Shift #: ${shiftToExport.shiftNumber}
👤 Attendant: ${shiftToExport.workerName}
⏰ Time: ${new Date(shiftToExport.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${shiftToExport.closedAt ? new Date(shiftToExport.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}

💵 *FINANCIAL RECONCILIATION*
• Expected Drink Sales: KES ${totalSales.toLocaleString()}
• Net Cash Returned: KES ${netCash.toLocaleString()}
• Net M-Pesa Returned: KES ${netMpesa.toLocaleString()}
• Operational Expenses: -KES ${(shiftToExport.totalExpenses || 0).toLocaleString()}
• Financial Variance: ${varianceVal === 0 ? 'KES 0 (Balanced ✅)' : varianceVal > 0 ? `+KES ${varianceVal.toLocaleString()} (Surplus 📈)` : `-KES ${Math.abs(varianceVal).toLocaleString()} (Shortage ⚠️)`}

🍾 *DRINKS ACCOUNTABILITY*
${drinksText}

🧾 *SHIFT EXPENSES*
${expText}

${shiftToExport.closingNotes ? `📝 Note: ${shiftToExport.closingNotes}\n` : ''}
Generated via Bar Track System`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Target shift to display in completed view
  const displayClosedShift = justClosedShift || lastShift;

  // -------------------------------------------------------------
  // VIEW A: ACTIVE SHIFT HANDOVER WIZARD
  // -------------------------------------------------------------
  if (activeShift) {
    const filteredItems = shiftStockItems
      .filter((item) => item.productName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return (
      <div className="max-w-xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
        {/* Top Header Card */}
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                End of Shift Handover · Step {step} of 3
              </span>
              <h1 className="text-xl font-black text-white tracking-tight mt-0.5">
                {step === 1 && 'Count Remaining Bottles'}
                {step === 2 && 'Cash Drawer & M-Pesa Balance'}
                {step === 3 && 'Final Audit & Reconcile'}
              </h1>
            </div>
            <button
              onClick={() => {
                if (activeShift) {
                  store.markCounterFinished(activeShift.id, false);
                }
                onGoToCounter();
              }}
              className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer"
            >
              Back to Counter
            </button>
          </div>

          {/* Progress Bar */}
          <div className="grid grid-cols-3 gap-1.5 pt-3">
            <div className={`h-1.5 rounded-full ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          </div>
        </div>

        {/* STEP 1: COUNT REMAINING BOTTLES */}
        {step === 1 && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Count Counter Bottles</h3>
                <p className="text-xs text-slate-400">
                  Tap + or - to enter bottles left. Units sold are automatically computed.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter drink..."
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Drink Rows */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const available =
                  item.openingPhysicalCount +
                  item.additions +
                  item.transfersIn -
                  item.transfersOut -
                  item.damages;
                const left =
                  closingPhysicalCounts[item.productId] !== undefined
                    ? closingPhysicalCounts[item.productId]
                    : available;
                const sold = Math.max(0, available - left);

                const prod = products.find((p) => p.id === item.productId);
                const isMeasured = prod?.isMeasured || item.unit === 'VALUE_KES';
                const isValue = isMeasured && (prod?.measurementType === 'VALUE' || prod?.unit === 'VALUE_KES' || item.unit === 'VALUE_KES');
                const stepDelta = isValue ? 100 : 1;
                const unitLabel = isValue ? 'worth' : (prod?.measureUnitLabel || item.unit.toLowerCase());
                const itemRevenue = isValue ? sold : sold * item.sellingPrice;

                return (
                  <div
                    key={item.productId}
                    className={`p-3 rounded-2xl bg-[#0E1420] border flex items-center justify-between gap-2 ${
                      isMeasured ? 'border-cyan-900/60 bg-gradient-to-r from-[#0E1420] to-cyan-950/20' : 'border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">
                          {item.productName}
                        </span>
                        {isMeasured && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-700/60 shrink-0">
                            Measured
                          </span>
                        )}
                        {item.additions > 0 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800 shrink-0">
                            +{item.additions} added
                          </span>
                        )}
                        {item.additions < 0 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800 shrink-0">
                            {item.additions} reduced
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>
                          Start: {isValue ? `KES ${available.toLocaleString()}` : `${available} ${unitLabel}`}
                          {item.additions > 0 && ` (inc. +${item.additions} restocked)`}
                          {item.additions < 0 && ` (inc. ${item.additions} reduced)`}
                        </span>
                        <span>·</span>
                        <span className="text-emerald-400 font-bold">
                          Sold: {isValue ? `KES ${sold.toLocaleString()}` : sold}
                        </span>
                        <span>·</span>
                        <span>KES {itemRevenue.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Stepper Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustCount(item.productId, -stepDelta)}
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                        title={isValue ? '-100 KES' : '-1'}
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={left}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setClosingPhysicalCounts((prev) => ({
                            ...prev,
                            [item.productId]: isNaN(val) ? 0 : Math.max(0, val),
                          }));
                        }}
                        className={`w-16 h-9 text-center rounded-xl font-mono font-bold text-xs focus:outline-none ${
                          isValue
                            ? 'bg-[#0E1420] border border-cyan-700 text-cyan-300'
                            : 'bg-[#151D2C] border border-slate-700 text-white'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() => adjustCount(item.productId, stepDelta)}
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center font-bold text-lg cursor-pointer"
                        title={isValue ? '+100 KES' : '+1'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick summary of bottles sold so far */}
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Units Sold Counted:</span>
              <span className="font-mono font-black text-emerald-400 text-sm">
                {totalBottlesSold} bottles (KES {expectedSalesRevenue.toLocaleString()})
              </span>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer"
            >
              <span>Next: Enter Cash & M-Pesa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: MONEY COLLECTION */}
        {step === 2 && (
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Count Money in Drawer & Phone</h3>
              <p className="text-xs text-slate-400">
                Check the expected money below, then enter your physical drawer cash and ending M-Pesa balance.
              </p>
            </div>

            {/* EXPECTED MONEY SUMMARY CARD (BEFORE INPUTS) */}
            <div className="bg-gradient-to-br from-emerald-950/50 via-[#151D2C] to-[#0E1420] border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-inner shrink-0">
                    KES
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                      Shift Sales Target
                    </span>
                    <h4 className="text-base font-black text-white tracking-tight">
                      Expected Money to Account For
                    </h4>
                  </div>
                </div>

                <div className="sm:text-right font-mono">
                  <span className="text-[10px] text-slate-400 uppercase font-sans block">
                    Expected Drink Sales
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400">
                    KES {expectedSalesRevenue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-sans">
                    Bottles Sold ({totalBottlesSold})
                  </div>
                  <div className="font-bold text-white mt-1">
                    KES {expectedSalesRevenue.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-sans">
                    Shift Expenses
                  </div>
                  <div className={`font-bold mt-1 ${totalExpenses > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {totalExpenses > 0 ? `-KES ${totalExpenses.toLocaleString()}` : 'KES 0'}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-sans">
                    Starting Floats
                  </div>
                  <div className="font-bold text-slate-300 mt-1">
                    KES {(openingCashFloat + openingMpesa).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Total Physical Money Target Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                <div className="text-slate-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-medium">
                    Total expected across drawer cash + M-Pesa phone:
                  </span>
                </div>
                <div className="font-mono font-black text-emerald-300 text-base sm:text-lg">
                  KES {((openingCashFloat + openingMpesa) + expectedSalesRevenue - totalExpenses).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Cash In Drawer */}
            <div className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Physical Cash in Drawer
                  </label>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Float was: KES {openingCashFloat.toLocaleString()}
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                  KES
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  autoFocus
                  value={closingCashActual}
                  onChange={(e) => setClosingCashActual(e.target.value)}
                  placeholder="Count all physical banknotes & coins"
                  className="w-full bg-[#151D2C] border border-slate-700 rounded-xl pl-13 pr-3.5 py-3 text-lg font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 tabular-nums"
                />
              </div>

              {parsedCashActual > 0 && (
                <div className="text-[11px] font-mono text-emerald-400 flex items-center justify-between pt-1">
                  <span>Net Cash Collected (Ending - Float):</span>
                  <span className="font-bold">KES {netCashIncome.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* M-Pesa Exit Balance */}
            <div className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Ending M-Pesa Balance
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {primaryMpesa && (
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                      {primaryMpesa.identifier}
                      {primaryMpesa.accountNumber ? ` (${primaryMpesa.accountNumber})` : ''}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">
                    Opening was: KES {openingMpesa.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                  KES
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={closingMpesaBalance}
                  onChange={(e) => setClosingMpesaBalance(e.target.value)}
                  placeholder="Check current balance on business Till / Paybill"
                  className="w-full bg-[#151D2C] border border-slate-700 rounded-xl pl-13 pr-3.5 py-3 text-lg font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 tabular-nums"
                />
              </div>

              {parsedMpesaClosing > 0 && (
                <div className="text-[11px] font-mono text-emerald-400 flex items-center justify-between pt-1">
                  <span>Net M-Pesa Collected (Ending - Opening):</span>
                  <span className="font-bold">KES {netMpesaIncome.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Shift Expenses Reminder */}
            {expenses.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-amber-400" />
                    <span>Authorized Shift Expenses ({expenses.length})</span>
                  </div>
                  <span className="text-red-400 font-mono font-bold">
                    -KES {totalExpenses.toLocaleString()}
                  </span>
                </div>
                <div className="divide-y divide-slate-800 text-[11px] text-slate-400">
                  {expenses.map((e) => (
                    <div key={e.id} className="py-1 flex items-center justify-between">
                      <span className="truncate max-w-[200px]">{e.description}</span>
                      <span className="font-mono text-slate-300">KES {e.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3.5 px-4 rounded-2xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer"
              >
                <span>Review Shift Balance & Reconcile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RECONCILIATION & CLOSING SIGN-OFF */}
        {step === 3 && (
          <form
            onSubmit={handleFinalClose}
            className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-white">Shift Handover Audit & Variance</h3>
              <p className="text-xs text-slate-400">
                Inspect calculations before closing. Both cashier money and drink counts are compared.
              </p>
            </div>

            {/* Big Variance Indicator */}
            <div
              className={`p-4 rounded-2xl border text-center space-y-1 ${
                variance === 0
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : variance < 0
                  ? 'bg-red-950/40 border-red-500/60 text-red-300'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-wider font-bold">
                {variance === 0
                  ? 'Perfect Reconciliation'
                  : variance < 0
                  ? 'Cash Shortage Detected'
                  : 'Cash Surplus'}
              </div>
              <div className="text-2xl font-mono font-black">
                {variance === 0
                  ? 'KES 0 (Balanced)'
                  : variance > 0
                  ? `+KES ${variance.toLocaleString()}`
                  : `-KES ${Math.abs(variance).toLocaleString()}`}
              </div>
              <div className="text-xs text-slate-300">
                {variance === 0
                  ? 'Total collected money equals drink sales revenue.'
                  : variance < 0
                  ? 'The drawer/phone is short compared to drinks sold. Please explain in notes.'
                  : 'Extra money collected beyond recorded drink sales.'}
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs font-mono space-y-2">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans">Expected Drink Sales Revenue:</span>
                <span className="font-bold text-white">KES {expectedSalesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="font-sans">+ Net Cash Collected:</span>
                <span>KES {netCashIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="font-sans">+ Net M-Pesa Collected:</span>
                <span>KES {netMpesaIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span className="font-sans">+ Operational Expenses:</span>
                <span>KES {totalExpenses.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white">
                <span className="font-sans">Total Money Accounted For:</span>
                <span>KES {totalAccountedFor.toLocaleString()}</span>
              </div>
            </div>

            {/* Closing Handover Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Handover Note for Owner {variance < 0 && <span className="text-red-400">* (Explanation)</span>}
              </label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Leave notes about breakages, complimentary drinks, or drawer notes..."
                className="w-full bg-[#0E1420] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3.5 px-4 rounded-2xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 cursor-pointer transition-all active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Handover & Close Shift</span>
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: COMPLETED SHIFT HANDOVER SHEET / RECEIPT
  // -------------------------------------------------------------
  if (displayClosedShift) {
    const shift = displayClosedShift;
    const stockItems = store.getShiftStockItems(shift.id);
    const shiftExpenses = store.getExpenses(shift.id);

    const netMpesa =
      shift.calculatedMpesaIncome !== undefined
        ? shift.calculatedMpesaIncome
        : (shift.closingMpesaBalance || 0) - shift.openingMpesaBalance;
    const netCash =
      shift.calculatedCashIncome !== undefined
        ? shift.calculatedCashIncome
        : (shift.closingCashActual || 0) - shift.openingCashFloat;
    const totalReturned = shift.totalIncomeReturned || netCash + netMpesa;
    const varianceVal = shift.financialVariance || 0;

    return (
      <div className="max-w-2xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
        {/* Toast */}
        {copiedToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-center gap-2 shadow-2xl animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">Handover summary copied! Ready to paste into WhatsApp/SMS.</span>
          </div>
        )}

        {/* Certificate Header Card */}
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Reconciled & Closed
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Shift #{shift.shiftNumber}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                  End of Shift Handover Slip
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Attendant: <strong className="text-white">{shift.workerName}</strong> · Closed {shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Recently'}
                </p>
              </div>
            </div>

            {/* Actions: Copy & Print */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyHandoverSummary(shift)}
                className="py-2 px-3 rounded-xl bg-[#151D2C] hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Summary</span>
              </button>

              <button
                onClick={() => window.print()}
                className="py-2 px-3 rounded-xl bg-[#151D2C] hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Key Financial KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-sans">Expected Sales</div>
              <div className="text-sm sm:text-base font-black text-white mt-0.5">
                KES {(shift.expectedSalesRevenue || 0).toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-sans">Cash Returned</div>
              <div className="text-sm sm:text-base font-black text-emerald-400 mt-0.5">
                KES {netCash.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-sans">M-Pesa Returned</div>
              <div className="text-sm sm:text-base font-black text-emerald-400 mt-0.5">
                KES {netMpesa.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-sans">Variance</div>
              <div className={`text-sm sm:text-base font-black mt-0.5 ${
                varianceVal === 0 ? 'text-emerald-400' : varianceVal < 0 ? 'text-red-400' : 'text-amber-400'
              }`}>
                {varianceVal === 0 ? 'KES 0 (Balanced)' : `KES ${varianceVal.toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Itemized Drink Sales Table */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wine className="w-4 h-4 text-emerald-400" />
                <span>Drinks Sold Breakdown</span>
              </span>
              <span className="text-slate-400 font-mono">
                {shift.recordedSalesCount || 0} total bottles sold
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Drink</th>
                    <th className="p-2.5 text-center">Opening</th>
                    <th className="p-2.5 text-center">Additions</th>
                    <th className="p-2.5 text-center">Closing</th>
                    <th className="p-2.5 text-center text-emerald-400 font-bold">Sold</th>
                    <th className="p-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {stockItems
                    .filter((item) => item.recordedSales > 0 || (item.closingPhysicalCount !== undefined && item.closingPhysicalCount < item.openingPhysicalCount))
                    .map((item) => {
                      const prod = products.find((p) => p.id === item.productId);
                      const isValue = (prod?.isMeasured && prod.measurementType === 'VALUE') || item.unit === 'VALUE_KES';
                      const rev = isValue ? item.recordedSales : item.recordedSales * item.sellingPrice;

                      return (
                        <tr key={item.productId} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-sans font-medium text-white flex items-center gap-1.5">
                            <span>{item.productName}</span>
                            {prod?.isMeasured && (
                              <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                                Measured
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-400">{isValue ? `KES ${item.openingPhysicalCount.toLocaleString()}` : item.openingPhysicalCount}</td>
                          <td className="p-2.5 text-center text-emerald-400">+{item.additions + item.transfersIn}</td>
                          <td className="p-2.5 text-center text-slate-300">{item.closingPhysicalCount !== undefined ? (isValue ? `KES ${item.closingPhysicalCount.toLocaleString()}` : item.closingPhysicalCount) : '-'}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-400">{isValue ? `KES ${item.recordedSales.toLocaleString()}` : item.recordedSales}</td>
                          <td className="p-2.5 text-right font-bold text-white">
                            KES {rev.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift Operational Expenses */}
          {shiftExpenses.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Recorded Expenses</span>
                </span>
                <span className="font-mono text-red-400 font-bold">
                  Total: -KES {(shift.totalExpenses || 0).toLocaleString()}
                </span>
              </div>
              <div className="border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-[#0E1420] text-xs">
                {shiftExpenses.map((exp) => (
                  <div key={exp.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{exp.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-red-400">
                      -KES {exp.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {(shift.openingInconsistencyNote || shift.closingNotes) && (
            <div className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs space-y-1">
              {shift.openingInconsistencyNote && (
                <div>
                  <span className="text-amber-400 font-bold">Opening Handover Note: </span>
                  <span className="text-slate-300">{shift.openingInconsistencyNote}</span>
                </div>
              )}
              {shift.closingNotes && (
                <div>
                  <span className="text-slate-400 font-bold">Closing Note: </span>
                  <span className="text-slate-300">{shift.closingNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* Return Button */}
          <button
            onClick={onGoToStartScreen}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition-all active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Return to Start Screen / Begin New Shift</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW C: NO SHIFTS TO DISPLAY
  // -------------------------------------------------------------
  return (
    <div className="max-w-md mx-auto text-center py-16 px-4 space-y-4">
      <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
        <ClipboardCheck className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-white">No Shift in Progress</h2>
      <p className="text-xs text-slate-400">
        There is no active shift to close right now. Go to the Start Screen to launch a new shift.
      </p>
      <button
        onClick={onGoToStartScreen}
        className="py-3 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
      >
        <span>Go to Start Screen</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
