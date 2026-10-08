import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Shift, Product, ShiftStockItem, Expense } from '../../types';
import { store } from '../../services/store';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import {
  Wine,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Coins,
  Smartphone,
  Receipt,
  Printer,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  LogOut,
  Calendar,
  Clock,
  Layers,
  Scale,
  RefreshCw,
  FileSpreadsheet,
  LayoutGrid,
  Filter,
} from 'lucide-react';

interface UnifiedStockLedgerProps {
  currentUser: User;
  onGoToHistory: () => void;
}

export const UnifiedStockLedger: React.FC<UnifiedStockLedgerProps> = ({
  currentUser,
  onGoToHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [isReconExpanded, setIsReconExpanded] = useState<boolean>(false);
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [justClosedShift, setJustClosedShift] = useState<Shift | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // New shift opening inputs if no active shift
  const [openingCashInput, setOpeningCashInput] = useState<string>('0');
  const [openingMpesaInput, setOpeningMpesaInput] = useState<string>('0');

  // Closing cash & M-pesa inputs for active shift
  const [closingCashInput, setClosingCashInput] = useState<string>('');
  const [closingMpesaInput, setClosingMpesaInput] = useState<string>('');
  const [closingNotesInput, setClosingNotesInput] = useState<string>('');

  const [, setStoreTick] = useState<number>(0);

  useEffect(() => {
    return store.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeShift = store.getActiveShift();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const incomingTransfers = store.getPendingIncomingTransfers();
  const shiftStockItems: ShiftStockItem[] = activeShift
    ? store.getShiftStockItems(activeShift.id)
    : [];
  const expenses: Expense[] = activeShift ? store.getExpenses(activeShift.id) : [];

  // Local state for draft inputs to keep UI snappy while typing
  // Map of productId -> { opening?: number, added?: number, closing?: number }
  const [localDrafts, setLocalDrafts] = useState<
    Record<string, { opening?: number; added?: number; closing?: number }>
  >({});

  // Populate local drafts from existing ShiftStockItems whenever activeShift changes
  useEffect(() => {
    if (!activeShift) {
      setLocalDrafts({});
      return;
    }
    const drafts: Record<string, { opening?: number; added?: number; closing?: number }> = {};
    shiftStockItems.forEach((ssi) => {
      drafts[ssi.productId] = {
        opening: ssi.openingPhysicalCount,
        added: ssi.additions || 0,
        closing: ssi.closingPhysicalCount,
      };
    });
    setLocalDrafts(drafts);
  }, [activeShift?.id, shiftStockItems.length]);

  // Extract categories for filter pills
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Computed row data for each product
  const rowDataList = useMemo(() => {
    return products.map((product) => {
      const ssi = shiftStockItems.find((s) => s.productId === product.id);
      const invItem = inventory.find((i) => i.productId === product.id);
      const draft = localDrafts[product.id];

      // 1. Opening stock: draft > ssi > inventory > 0
      const defaultOpening = invItem ? Number(invItem.quantityOnHand || 0) : 0;
      const openingStock = draft?.opening !== undefined
        ? draft.opening
        : (ssi?.openingPhysicalCount !== undefined ? ssi.openingPhysicalCount : defaultOpening);

      // 2. Added stock
      const addedStock = draft?.added !== undefined
        ? draft.added
        : (ssi?.additions !== undefined ? ssi.additions : 0);

      // 3. Total stock = Opening + Added
      const totalStock = Number(openingStock || 0) + Number(addedStock || 0);

      // 4. Closing stock
      const hasClosingEntered = draft?.closing !== undefined || ssi?.closingPhysicalCount !== undefined;
      const closingStock = draft?.closing !== undefined
        ? draft.closing
        : (ssi?.closingPhysicalCount !== undefined ? ssi.closingPhysicalCount : undefined);

      // 5. Sales = Total - Closing (if entered)
      let salesUnits = 0;
      let hasOverage = false;
      if (closingStock !== undefined) {
        if (closingStock > totalStock) {
          hasOverage = true;
          salesUnits = 0;
        } else {
          salesUnits = Math.max(0, totalStock - closingStock);
        }
      }

      // 6. Amount (Sales Revenue)
      const sellingPrice = product.sellingPrice || 0;
      const costPrice = product.costPrice || 0;
      const amountKes = salesUnits * sellingPrice;

      // 7. Profit
      const profitKes = salesUnits * Math.max(0, sellingPrice - costPrice);

      return {
        product,
        ssi,
        openingStock,
        addedStock,
        totalStock,
        closingStock,
        hasClosingEntered,
        salesUnits,
        amountKes,
        profitKes,
        hasOverage,
        sellingPrice,
        costPrice,
      };
    });
  }, [products, shiftStockItems, inventory, localDrafts]);

  // Filtered rows based on search and category
  const filteredRows = useMemo(() => {
    return rowDataList.filter((row) => {
      const p = row.product;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (selectedCategory !== 'ALL' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      if (filterActiveOnly) {
        const hasActivity =
          row.openingStock > 0 ||
          row.addedStock > 0 ||
          row.totalStock > 0 ||
          row.hasClosingEntered;
        if (!hasActivity) return false;
      }

      return true;
    });
  }, [rowDataList, searchQuery, selectedCategory, filterActiveOnly]);

  // Grand summary totals across all rows
  const summaryTotals = useMemo(() => {
    let totalOpening = 0;
    let totalAdded = 0;
    let totalClosing = 0;
    let totalSold = 0;
    let totalAmount = 0;
    let totalProfit = 0;

    rowDataList.forEach((row) => {
      totalOpening += Number(row.openingStock || 0);
      totalAdded += Number(row.addedStock || 0);
      if (row.closingStock !== undefined) {
        totalClosing += Number(row.closingStock || 0);
      }
      totalSold += row.salesUnits;
      totalAmount += row.amountKes;
      totalProfit += row.profitKes;
    });

    return {
      totalOpening,
      totalAdded,
      totalClosing,
      totalSold,
      totalAmount,
      totalProfit,
    };
  }, [rowDataList]);

  // Handle cell edit commit to store & Neon
  const handleCellChange = (
    productId: string,
    field: 'opening' | 'added' | 'closing',
    valueStr: string
  ) => {
    const num = valueStr.trim() === '' ? undefined : Math.max(0, parseInt(valueStr, 10) || 0);

    setLocalDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: num,
      },
    }));

    if (!activeShift) return;

    if (field === 'opening') {
      store.updateShiftStockItemRow({
        shiftId: activeShift.id,
        productId,
        openingPhysicalCount: num !== undefined ? num : 0,
      });
    } else if (field === 'added') {
      store.updateShiftStockItemRow({
        shiftId: activeShift.id,
        productId,
        additions: num !== undefined ? num : 0,
      });
    } else if (field === 'closing') {
      store.updateShiftStockItemRow({
        shiftId: activeShift.id,
        productId,
        closingPhysicalCount: num,
      });
    }
  };

  // Quick addition increment (+1, +5, etc)
  const handleQuickAdd = (productId: string, delta: number) => {
    const currentDraft = localDrafts[productId];
    const ssi = shiftStockItems.find((s) => s.productId === productId);
    const currentAdded = currentDraft?.added !== undefined ? currentDraft.added : (ssi?.additions || 0);
    const newAdded = Math.max(0, currentAdded + delta);
    handleCellChange(productId, 'added', String(newAdded));
    showToast(`Added +${delta} to ${ssi?.productName || 'drink'}`);
  };

  // 1-Tap "Confirm All Opening Stock"
  const handleConfirmAllOpening = () => {
    if (!activeShift) return;
    const updates: Record<string, { opening?: number }> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      const qty = inv ? Number(inv.quantityOnHand || 0) : 0;
      updates[p.id] = { opening: qty };
    });
    store.batchUpdateShiftStockItems(activeShift.id, updates);
    showToast('All Opening Stock verified & locked to current shelf inventory.');
  };

  // Open a new shift directly from this single screen
  const handleStartShiftNow = () => {
    const cashFloat = Math.max(0, parseFloat(openingCashInput) || 0);
    const mpesaFloat = Math.max(0, parseFloat(openingMpesaInput) || 0);

    const physicalCounts: Record<string, number> = {};
    products.forEach((p) => {
      const draft = localDrafts[p.id];
      const inv = inventory.find((i) => i.productId === p.id);
      physicalCounts[p.id] = draft?.opening !== undefined
        ? draft.opening
        : (inv ? Number(inv.quantityOnHand || 0) : 0);
    });

    const shift = store.openShift({
      workerId: currentUser.id,
      workerName: currentUser.name,
      openingCashFloat: cashFloat,
      openingMpesaBalance: mpesaFloat,
      physicalCounts,
    });

    showToast(`Shift #${shift.shiftNumber} opened successfully! You are now live.`);
  };

  // Financial reconciliation math
  const cashFloat = activeShift?.openingCashFloat || 0;
  const mpesaFloat = activeShift?.openingMpesaBalance || 0;
  const parsedCashActual = closingCashInput.trim() !== '' ? parseFloat(closingCashInput) || 0 : 0;
  const parsedMpesaClosing = closingMpesaInput.trim() !== '' ? parseFloat(closingMpesaInput) || 0 : 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netCashCollected = closingCashInput.trim() !== '' ? parsedCashActual - cashFloat : 0;
  const netMpesaCollected = closingMpesaInput.trim() !== '' ? parsedMpesaClosing - mpesaFloat : 0;
  const totalMoneyCollected = netCashCollected + netMpesaCollected;

  // Variance = (Money Collected + Expenses) - Expected Sales
  const hasEnteredDrawer = closingCashInput.trim() !== '' || closingMpesaInput.trim() !== '';
  const financialVariance = hasEnteredDrawer
    ? (totalMoneyCollected + totalExpenses) - summaryTotals.totalAmount
    : 0;

  // Complete and close shift right from this sheet
  const handleCloseShift = () => {
    if (!activeShift) return;

    const closingCounts: Record<string, number> = {};
    rowDataList.forEach((row) => {
      if (row.closingStock !== undefined) {
        closingCounts[row.product.id] = row.closingStock;
      } else {
        closingCounts[row.product.id] = row.totalStock; // If uncounted, defaults to total
      }
    });

    try {
      const closed = store.closeShift({
        shiftId: activeShift.id,
        closingPhysicalCounts: closingCounts,
        closingCashActual: parsedCashActual,
        closingMpesaBalance: parsedMpesaClosing,
        closingNotes: closingNotesInput,
      });
      setJustClosedShift(closed);
      showToast('Shift successfully closed! Handover receipt generated.');
    } catch (err: any) {
      alert(err.message || 'Error closing shift.');
    }
  };

  return (
    <div className="space-y-4 pb-28 md:pb-16 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 max-w-md text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Incoming Stock Loan Banners */}
      <IncomingTransferBanner transfers={incomingTransfers} />

      {/* ============================================================ */}
      {/* 1. TOP SHIFT HEADER & STATUS BAR */}
      {/* ============================================================ */}
      {!activeShift ? (
        /* NO SHIFT OPEN: COMPACT OPENER BAR ABOVE THE SHEET */
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Start New Shift (Counter Sheet)</h2>
                <p className="text-xs text-slate-400">
                  Confirm/correct your starting bottles below, enter floats, then start serving.
                </p>
              </div>
            </div>
            <button
              onClick={onGoToHistory}
              className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer shrink-0 self-start sm:self-center"
            >
              Past Shifts Log
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Cash Drawer Float (KES)
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                <input
                  type="number"
                  min="0"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                M-Pesa Till Float (KES)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                <input
                  type="number"
                  min="0"
                  value={openingMpesaInput}
                  onChange={(e) => setOpeningMpesaInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleStartShiftNow}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-[0.98] transition-all"
              >
                <span>Start Shift & Open Counter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE SHIFT: TOP BAR WITH REAL-TIME INDICATOR */
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-black text-white">
                    Counter Stock Sheet
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Shift #{activeShift.shiftNumber}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Attendant: <strong className="text-emerald-400">{activeShift.workerName}</strong>
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    Started {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>·</span>
                  <span className="text-slate-400 font-mono">
                    Cash Float: KES {activeShift.openingCashFloat.toLocaleString()} · M-Pesa: KES {activeShift.openingMpesaBalance.toLocaleString()}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Actions Header Buttons */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-amber-900/50 hover:bg-amber-950/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>+ Pay Expense</span>
              </button>

              <button
                onClick={() => setIsReconExpanded(!isReconExpanded)}
                className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isReconExpanded
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-[#0E1420] border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cash & Drawer</span>
                {isReconExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={onGoToHistory}
                className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Past Shifts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. LIVE KPI SUMMARY BAR (CALCULATED FROM THE ONE LIST) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-2xl bg-[#121824] border border-[#1E293B]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Drinks Sold
          </span>
          <span className="text-lg font-black text-white font-mono mt-0.5 block">
            {summaryTotals.totalSold} <span className="text-xs font-normal text-slate-400">units</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#121824] border border-emerald-900/40 bg-gradient-to-br from-[#121824] to-emerald-950/20">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
            Sales Amount
          </span>
          <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
            KES {summaryTotals.totalAmount.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#121824] border border-cyan-900/40 bg-gradient-to-br from-[#121824] to-cyan-950/20">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
            Total Profit
          </span>
          <span className="text-lg font-black text-cyan-400 font-mono mt-0.5 block">
            KES {summaryTotals.totalProfit.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#121824] border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Opening Stock
          </span>
          <span className="text-lg font-black text-slate-200 font-mono mt-0.5 block">
            {summaryTotals.totalOpening} <span className="text-xs font-normal text-slate-500">units</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#121824] border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Added Stock
          </span>
          <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
            +{summaryTotals.totalAdded} <span className="text-xs font-normal text-slate-500">units</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[#121824] border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Remaining Shelf
          </span>
          <span className="text-lg font-black text-slate-300 font-mono mt-0.5 block">
            {summaryTotals.totalClosing > 0 ? summaryTotals.totalClosing : summaryTotals.totalOpening + summaryTotals.totalAdded - summaryTotals.totalSold} <span className="text-xs font-normal text-slate-500">left</span>
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. CASH DRAWER & TILL RECONCILIATION SECTION (BUILT-IN) */}
      {/* ============================================================ */}
      {activeShift && isReconExpanded && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#121824] border border-cyan-800/40 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Cash Drawer & M-Pesa Till Reconciliation</h3>
                <p className="text-xs text-slate-400">
                  Verify that money in your drawer and till balances with the Sales Amount from your sheet.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsReconExpanded(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Minimize
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* 1. Cash Count Input */}
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">1. Physical Cash in Drawer</span>
              <div className="relative">
                <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                <input
                  type="number"
                  min="0"
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  placeholder="Enter cash amount"
                  className="w-full bg-[#151D2C] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Opening Float: KES {cashFloat.toLocaleString()}
                {closingCashInput.trim() !== '' && (
                  <span className="text-amber-400 block font-bold">
                    Net Cash Collected: KES {netCashCollected.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* 2. M-Pesa Till Input */}
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">2. Current M-Pesa Till Balance</span>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                <input
                  type="number"
                  min="0"
                  value={closingMpesaInput}
                  onChange={(e) => setClosingMpesaInput(e.target.value)}
                  placeholder="Enter till balance"
                  className="w-full bg-[#151D2C] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Opening Till: KES {mpesaFloat.toLocaleString()}
                {closingMpesaInput.trim() !== '' && (
                  <span className="text-emerald-400 block font-bold">
                    Net M-Pesa Collected: KES {netMpesaCollected.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Shift Expenses */}
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">3. Shift Expenses</span>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="text-base font-black text-rose-400 font-mono pt-1">
                KES {totalExpenses.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">
                {expenses.length === 0 ? 'No expenses recorded' : `${expenses.length} expense(s) paid`}
              </div>
            </div>

            {/* 4. Live Variance Result */}
            <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">4. Financial Variance</span>
              <div
                className={`text-base font-black font-mono pt-1 ${
                  !hasEnteredDrawer
                    ? 'text-slate-500'
                    : financialVariance === 0
                    ? 'text-emerald-400'
                    : financialVariance < 0
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {!hasEnteredDrawer
                  ? 'Awaiting Cash Input'
                  : financialVariance === 0
                  ? 'Balanced 🟢 KES 0'
                  : financialVariance < 0
                  ? `Shortage -KES ${Math.abs(financialVariance).toLocaleString()}`
                  : `Surplus +KES ${financialVariance.toLocaleString()}`}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Expected: KES {summaryTotals.totalAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. SEARCH & CATEGORY FILTER BAR */}
      {/* ============================================================ */}
      <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter beverages (e.g. Tusker, KC, Heineken, White Cap)..."
              className="w-full bg-[#0E1420] border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Confirm All Opening Stock button */}
            {activeShift && (
              <button
                onClick={handleConfirmAllOpening}
                className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                title="Verify all opening stock matches current inventory"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verify All Opening</span>
              </button>
            )}

            {/* Filter Active / Stocked Only */}
            <button
              onClick={() => setFilterActiveOnly(!filterActiveOnly)}
              className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                filterActiveOnly
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#0E1420] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{filterActiveOnly ? 'Stocked Only' : 'All Products'}</span>
            </button>

            {/* Layout Toggle */}
            <div className="flex items-center bg-[#0E1420] border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Ledger Table View"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                  viewMode === 'CARDS' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Card Rows View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-[#0E1420] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. THE ONE LIST: UNIFIED COUNTER STOCK SHEET TABLE */}
      {/* COLUMNS: Opening Stock | Added Stock | Total | Closing Stock | Sales | Amount | Profit */}
      {/* ============================================================ */}
      {viewMode === 'TABLE' ? (
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0B0F17] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800 sticky top-0 z-20">
                  <th className="py-3 px-3.5 sm:px-4 text-left font-bold text-slate-300 sticky left-0 bg-[#0B0F17] z-10 min-w-[160px] sm:min-w-[200px]">
                    Item / Beverage
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-center min-w-[90px] text-amber-300 bg-amber-950/20 border-l border-slate-800">
                    Opening Stock
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-center min-w-[95px] text-emerald-300 bg-emerald-950/20 border-l border-slate-800">
                    Added Stock
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-center min-w-[75px] text-cyan-300 bg-cyan-950/20 border-l border-slate-800">
                    Total
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-center min-w-[95px] text-blue-300 bg-blue-950/20 border-l border-slate-800">
                    Closing Stock
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-center min-w-[75px] text-amber-400 border-l border-slate-800">
                    Sales
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-right min-w-[100px] text-emerald-400 border-l border-slate-800">
                    Amount (KES)
                  </th>
                  <th className="py-3 px-2 sm:px-3 text-right min-w-[100px] text-cyan-400 border-l border-slate-800">
                    Profit (KES)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      No beverages match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const p = row.product;
                    const isMeasured = p.isMeasured;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          row.salesUnits > 0
                            ? 'bg-emerald-950/10'
                            : row.addedStock > 0
                            ? 'bg-slate-900/30'
                            : ''
                        }`}
                      >
                        {/* 1. Item Name / Price / Category */}
                        <td className="py-2.5 px-3.5 sm:px-4 sticky left-0 bg-[#121824] z-10 border-r border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm truncate">
                              {p.name}
                            </span>
                            {isMeasured && (
                              <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                                Measured
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-emerald-400 font-bold">
                              KES {row.sellingPrice.toLocaleString()}
                            </span>
                            <span>·</span>
                            <span className="text-slate-500">Cost: KES {row.costPrice.toLocaleString()}</span>
                            <span>·</span>
                            <span className="text-slate-500">{p.unit || 'Btl'}</span>
                          </div>
                        </td>

                        {/* 2. Opening Stock (Editable / Confirmable) */}
                        <td className="py-2 px-2 text-center bg-amber-950/5 border-l border-slate-800/60">
                          <input
                            type="number"
                            min="0"
                            value={row.openingStock !== undefined ? row.openingStock : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleCellChange(p.id, 'opening', e.target.value)}
                            placeholder="0"
                            className="w-16 sm:w-20 mx-auto text-center font-mono font-bold text-xs sm:text-sm py-1 px-1.5 rounded-lg bg-[#0E1420] border border-amber-900/40 text-amber-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                          />
                        </td>

                        {/* 3. Added Stock (Editable / Restock entries) */}
                        <td className="py-2 px-2 text-center bg-emerald-950/5 border-l border-slate-800/60">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={row.addedStock !== 0 ? row.addedStock : ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCellChange(p.id, 'added', e.target.value)}
                              placeholder="0"
                              className={`w-14 sm:w-16 text-center font-mono font-bold text-xs sm:text-sm py-1 px-1 rounded-lg bg-[#0E1420] border focus:outline-none focus:ring-1 ${
                                row.addedStock > 0
                                  ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40 focus:border-emerald-400 focus:ring-emerald-400/30'
                                  : 'border-slate-800 text-slate-300 focus:border-emerald-500'
                              }`}
                            />
                            {/* Quick +1 / +5 stepper */}
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(p.id, 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center cursor-pointer shrink-0"
                              title="Add +1 to counter"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* 4. Total Stock (Calculated: Opening + Added) */}
                        <td className="py-2 px-2 text-center font-mono font-black text-xs sm:text-sm text-cyan-300 bg-cyan-950/5 border-l border-slate-800/60">
                          {row.totalStock}
                        </td>

                        {/* 5. Closing Stock (Editable: Physical count left on counter) */}
                        <td className="py-2 px-2 text-center bg-blue-950/5 border-l border-slate-800/60">
                          <input
                            type="number"
                            min="0"
                            value={row.closingStock !== undefined ? row.closingStock : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
                            placeholder="Count..."
                            className={`w-16 sm:w-20 mx-auto text-center font-mono font-bold text-xs sm:text-sm py-1 px-1.5 rounded-lg bg-[#0E1420] border focus:outline-none focus:ring-1 ${
                              row.hasClosingEntered
                                ? 'border-blue-500 text-blue-200 bg-blue-950/40 focus:border-blue-400 focus:ring-blue-400/30'
                                : 'border-slate-800 text-slate-400 focus:border-blue-500'
                            }`}
                          />
                        </td>

                        {/* 6. Sales Units (Calculated: Total - Closing) */}
                        <td className="py-2 px-2 text-center font-mono border-l border-slate-800/60">
                          {row.hasOverage ? (
                            <span className="text-[10px] text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                              Overage
                            </span>
                          ) : (
                            <span
                              className={`text-xs sm:text-sm font-black ${
                                row.salesUnits > 0 ? 'text-amber-300' : 'text-slate-500'
                              }`}
                            >
                              {row.salesUnits}
                            </span>
                          )}
                        </td>

                        {/* 7. Amount (Calculated: Sales × Selling Price) */}
                        <td className="py-2 px-2.5 sm:px-3 text-right font-mono font-bold text-xs sm:text-sm border-l border-slate-800/60 text-emerald-400">
                          KES {row.amountKes.toLocaleString()}
                        </td>

                        {/* 8. Profit (Calculated: Sales × (Selling Price - Cost Price)) */}
                        <td className="py-2 px-2.5 sm:px-3 text-right font-mono font-bold text-xs sm:text-sm border-l border-slate-800/60 text-cyan-400">
                          KES {row.profitKes.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Grand Totals Footer Row */}
              <tfoot className="bg-[#0B0F17] font-mono text-xs font-black border-t-2 border-slate-700">
                <tr>
                  <td className="py-3 px-3.5 sm:px-4 text-white sticky left-0 bg-[#0B0F17] z-10 border-r border-slate-800">
                    TOTALS ({rowDataList.length} items)
                  </td>
                  <td className="py-3 px-2 text-center text-amber-300 border-l border-slate-800">
                    {summaryTotals.totalOpening}
                  </td>
                  <td className="py-3 px-2 text-center text-emerald-300 border-l border-slate-800">
                    +{summaryTotals.totalAdded}
                  </td>
                  <td className="py-3 px-2 text-center text-cyan-300 border-l border-slate-800">
                    {summaryTotals.totalOpening + summaryTotals.totalAdded}
                  </td>
                  <td className="py-3 px-2 text-center text-blue-300 border-l border-slate-800">
                    {summaryTotals.totalClosing > 0 ? summaryTotals.totalClosing : '-'}
                  </td>
                  <td className="py-3 px-2 text-center text-amber-400 border-l border-slate-800 text-sm">
                    {summaryTotals.totalSold} sold
                  </td>
                  <td className="py-3 px-2.5 sm:px-3 text-right text-emerald-400 border-l border-slate-800 text-sm sm:text-base">
                    KES {summaryTotals.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-2.5 sm:px-3 text-right text-cyan-400 border-l border-slate-800 text-sm sm:text-base">
                    KES {summaryTotals.totalProfit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ALTERNATIVE VIEW: MOBILE CARDS SHEET */
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const p = row.product;
            return (
              <div
                key={p.id}
                className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] shadow-md space-y-3"
              >
                {/* Header: Name and Prices */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <div className="text-sm font-black text-white">{p.name}</div>
                    <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                      Price: KES {row.sellingPrice.toLocaleString()} · Cost: KES {row.costPrice.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {p.category}
                  </span>
                </div>

                {/* 4-Box Grid: Opening | Added | Total | Closing */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-[#0E1420] border border-amber-900/30">
                    <span className="text-[9px] font-mono text-amber-400 block uppercase">Opening</span>
                    <input
                      type="number"
                      min="0"
                      value={row.openingStock !== undefined ? row.openingStock : ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCellChange(p.id, 'opening', e.target.value)}
                      placeholder="0"
                      className="w-full text-center font-mono font-bold text-amber-200 mt-1 bg-transparent border-b border-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-[#0E1420] border border-emerald-900/30">
                    <span className="text-[9px] font-mono text-emerald-400 block uppercase">Added</span>
                    <input
                      type="number"
                      min="0"
                      value={row.addedStock !== 0 ? row.addedStock : ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCellChange(p.id, 'added', e.target.value)}
                      placeholder="0"
                      className="w-full text-center font-mono font-bold text-emerald-300 mt-1 bg-transparent border-b border-slate-700 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-[#0E1420] border border-cyan-900/30 flex flex-col justify-center">
                    <span className="text-[9px] font-mono text-cyan-400 block uppercase">Total</span>
                    <span className="font-mono font-black text-cyan-300 text-sm mt-1">
                      {row.totalStock}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#0E1420] border border-blue-900/30">
                    <span className="text-[9px] font-mono text-blue-400 block uppercase">Closing</span>
                    <input
                      type="number"
                      min="0"
                      value={row.closingStock !== undefined ? row.closingStock : ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
                      placeholder="Count"
                      className="w-full text-center font-mono font-bold text-blue-200 mt-1 bg-transparent border-b border-slate-700 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* 3-Box Results: Sales | Amount | Profit */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-xs text-center font-mono">
                  <div className="p-2 rounded-xl bg-[#0E1420]">
                    <span className="text-[9px] text-slate-400 uppercase block">Sales</span>
                    <span className="font-black text-amber-300 text-sm mt-0.5 block">
                      {row.salesUnits} sold
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0E1420]">
                    <span className="text-[9px] text-slate-400 uppercase block">Amount</span>
                    <span className="font-black text-emerald-400 text-sm mt-0.5 block">
                      KES {row.amountKes.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0E1420]">
                    <span className="text-[9px] text-slate-400 uppercase block">Profit</span>
                    <span className="font-black text-cyan-400 text-sm mt-0.5 block">
                      KES {row.profitKes.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. BOTTOM BAR: FINISH SHIFT & HANDOVER BUTTON */}
      {/* ============================================================ */}
      {activeShift && (
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-2xl space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Shift Handover & Reconciliation</h4>
              <p className="text-xs text-slate-400">
                Ready to reconcile? Verify drawer cash & till, then finish shift to generate handover receipt.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isReconExpanded && (
                <button
                  onClick={() => setIsReconExpanded(true)}
                  className="py-3 px-4 rounded-2xl bg-[#0E1420] border border-cyan-800 text-cyan-300 font-bold text-xs cursor-pointer hover:bg-slate-800"
                >
                  Enter Drawer & Till
                </button>
              )}

              <button
                onClick={handleCloseShift}
                className="flex-1 sm:flex-initial py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-red-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 transition-all cursor-pointer active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4" />
                <span>Finish Shift & Handover</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. EXPENSE MODAL */}
      {/* ============================================================ */}
      {showExpenseModal && activeShift && (
        <ShiftExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onConfirmExpense={(data) => {
            store.recordExpense({
              shiftId: activeShift.id,
              description: data.description,
              amount: data.amount,
              category: 'OTHER',
              paymentMethod: 'CASH',
            });
            setShowExpenseModal(false);
            showToast(`Recorded expense of KES ${data.amount.toLocaleString()} for ${data.description}`);
          }}
        />
      )}

      {/* ============================================================ */}
      {/* 8. SHIFT HANDOVER RECEIPT MODAL */}
      {/* ============================================================ */}
      {justClosedShift && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#121824] border border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
            <div className="text-center space-y-1 pb-3 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">Shift Handover Receipt</h2>
              <p className="text-xs text-slate-400 font-mono">
                Shift #{justClosedShift.shiftNumber} · Attendant: {justClosedShift.workerName}
              </p>
            </div>

            {/* Receipt Summary Details */}
            <div className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Drinks Sold:</span>
                <span className="font-bold text-white">{justClosedShift.recordedSalesCount || 0} units</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Expected Sales Revenue:</span>
                <span className="font-bold text-emerald-400">
                  KES {(justClosedShift.expectedSalesRevenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gross Profit:</span>
                <span className="font-bold text-cyan-400">
                  KES {(justClosedShift.grossProfit || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Shift Expenses Deducted:</span>
                <span className="font-bold text-rose-400">
                  -KES {(justClosedShift.totalExpenses || 0).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-300">
                <span>Net Cash Returned:</span>
                <span className="font-bold text-white">
                  KES {(justClosedShift.calculatedCashIncome || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Net M-Pesa Till Income:</span>
                <span className="font-bold text-white">
                  KES {(justClosedShift.calculatedMpesaIncome || 0).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                <span>Financial Variance:</span>
                <span
                  className={
                    (justClosedShift.financialVariance || 0) === 0
                      ? 'text-emerald-400'
                      : (justClosedShift.financialVariance || 0) < 0
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }
                >
                  {(justClosedShift.financialVariance || 0) === 0
                    ? 'Balanced 🟢 KES 0'
                    : (justClosedShift.financialVariance || 0) < 0
                    ? `-KES ${Math.abs(justClosedShift.financialVariance || 0).toLocaleString()} (Shortage)`
                    : `+KES ${(justClosedShift.financialVariance || 0).toLocaleString()} (Surplus)`}
                </span>
              </div>
            </div>

            {/* Actions: Copy WhatsApp Report / Start Next Shift */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                onClick={() => {
                  const report = `📊 SHIFT HANDOVER REPORT\nShift #${justClosedShift.shiftNumber}\nAttendant: ${justClosedShift.workerName}\nDate: ${new Date(justClosedShift.closedAt || '').toLocaleString()}\n\nDrinks Sold: ${justClosedShift.recordedSalesCount || 0}\nSales Revenue: KES ${(justClosedShift.expectedSalesRevenue || 0).toLocaleString()}\nProfit: KES ${(justClosedShift.grossProfit || 0).toLocaleString()}\nExpenses: KES ${(justClosedShift.totalExpenses || 0).toLocaleString()}\nCash Returned: KES ${(justClosedShift.calculatedCashIncome || 0).toLocaleString()}\nM-Pesa Income: KES ${(justClosedShift.calculatedMpesaIncome || 0).toLocaleString()}\nVariance: KES ${(justClosedShift.financialVariance || 0).toLocaleString()}`;
                  navigator.clipboard.writeText(report);
                  setCopiedReceipt(true);
                  setTimeout(() => setCopiedReceipt(false), 3000);
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {copiedReceipt ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedReceipt ? 'Copied WhatsApp Report!' : 'Copy WhatsApp Report'}</span>
              </button>

              <button
                onClick={() => {
                  setJustClosedShift(null);
                  onGoToHistory();
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                <span>View Past Shifts / Done</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
