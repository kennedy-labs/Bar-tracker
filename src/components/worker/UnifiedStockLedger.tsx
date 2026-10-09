import React, { useState, useEffect, useMemo } from 'react';
import { User, Shift, Product, ShiftStockItem, Expense } from '../../types';
import { store } from '../../services/store';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import {
  Search,
  CheckCircle2,
  Coins,
  Smartphone,
  Receipt,
  Share2,
  Check,
  ArrowRight,
  LogOut,
  Clock,
  Layers,
  ArrowLeft,
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
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [justClosedShift, setJustClosedShift] = useState<Shift | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // New shift opening inputs if no active shift
  const [openingCashInput, setOpeningCashInput] = useState<string>('0');
  const [openingMpesaInput, setOpeningMpesaInput] = useState<string>('0');

  // Closing cash & M-pesa inputs for handover modal
  const [closingCashInput, setClosingCashInput] = useState<string>('');
  const [closingMpesaInput, setClosingMpesaInput] = useState<string>('');
  const [closingNotesInput, setClosingNotesInput] = useState<string>('');

  const [, setStoreTick] = useState<number>(0);

  useEffect(() => {
    return store.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const activeShift = store.getActiveShift();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const incomingTransfers = store.getPendingIncomingTransfers();
  const shiftStockItems: ShiftStockItem[] = activeShift
    ? store.getShiftStockItems(activeShift.id)
    : [];
  const expenses: Expense[] = activeShift ? store.getExpenses(activeShift.id) : [];

  // Local drafts for instant responsiveness
  const [localDrafts, setLocalDrafts] = useState<
    Record<string, { opening?: number; added?: number; closing?: number }>
  >({});

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

  // Extract categories for clean filter tabs
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Computed row data for each beverage
  const rowDataList = useMemo(() => {
    return products.map((product) => {
      const ssi = shiftStockItems.find((s) => s.productId === product.id);
      const invItem = inventory.find((i) => i.productId === product.id);
      const draft = localDrafts[product.id];

      // 1. Opening stock
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

      // 6. Amount (Sales Revenue) & Profit
      const sellingPrice = product.sellingPrice || 0;
      const costPrice = product.costPrice || 0;
      const amountKes = salesUnits * sellingPrice;
      const profitKes = salesUnits * Math.max(0, sellingPrice - costPrice);

      return {
        product,
        ssi,
        openingStock,
        addedStock,
        totalStock,
        closingStock,
        hasClosingEntered: closingStock !== undefined,
        salesUnits,
        amountKes,
        profitKes,
        hasOverage,
        sellingPrice,
        costPrice,
      };
    });
  }, [products, shiftStockItems, inventory, localDrafts]);

  // Filtered rows
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
      return true;
    });
  }, [rowDataList, searchQuery, selectedCategory]);

  // Grand summary totals
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

  // 1-Tap "Verify All Opening Stock"
  const handleVerifyAllOpening = () => {
    if (!activeShift) return;
    const updates: Record<string, { opening?: number }> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      const qty = inv ? Number(inv.quantityOnHand || 0) : 0;
      updates[p.id] = { opening: qty };
    });
    store.batchUpdateShiftStockItems(activeShift.id, updates);
    showToast('All opening counts confirmed.');
  };

  // Open a new shift
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

    showToast(`Shift #${shift.shiftNumber} started.`);
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

  const hasEnteredDrawer = closingCashInput.trim() !== '' || closingMpesaInput.trim() !== '';
  const financialVariance = hasEnteredDrawer
    ? (totalMoneyCollected + totalExpenses) - summaryTotals.totalAmount
    : 0;

  // Complete and close shift
  const handleConfirmCloseShift = () => {
    if (!activeShift) return;

    const closingCounts: Record<string, number> = {};
    rowDataList.forEach((row) => {
      if (row.closingStock !== undefined) {
        closingCounts[row.product.id] = row.closingStock;
      } else {
        closingCounts[row.product.id] = row.totalStock;
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
      setShowCloseModal(false);
      setJustClosedShift(closed);
    } catch (err: any) {
      alert(err.message || 'Error closing shift.');
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Incoming Stock Loan Banners */}
      <IncomingTransferBanner transfers={incomingTransfers} />

      {/* ============================================================ */}
      {/* SCENARIO 1: NO ACTIVE SHIFT (CLEAN LINEAR OPENING FORM) */}
      {/* ============================================================ */}
      {!activeShift ? (
        <div className="space-y-4">
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="max-w-xl mx-auto space-y-5">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Open Counter Shift</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Step 1: Enter your starting cash float and M-Pesa till balance. Verify shelf bottles below, then begin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Starting Cash Float (KES)
                  </label>
                  <div className="relative">
                    <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      value={openingCashInput}
                      onChange={(e) => setOpeningCashInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Starting M-Pesa Float (KES)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      value={openingMpesaInput}
                      onChange={(e) => setOpeningMpesaInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartShiftNow}
                  className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Open Counter & Begin Shift</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Shelf Verification Preview */}
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Starting Shelf Stock ({products.length} Products)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pre-filled from previous closing inventory. You can edit any starting count directly.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <th className="py-2 px-3 font-semibold text-slate-300">Beverage</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-300">Selling Price</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-300 w-32">Starting Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rowDataList.map((row) => (
                    <tr key={row.product.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-200">{row.product.name}</span>
                        <span className="text-slate-500 text-[11px] ml-2">({row.product.category})</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        KES {row.sellingPrice.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.openingStock !== undefined ? row.openingStock : ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleCellChange(row.product.id, 'opening', e.target.value)}
                          className="w-20 mx-auto text-center font-mono font-semibold text-xs py-1 px-2 rounded-lg bg-[#0D1117] border border-slate-800 text-white focus:outline-none focus:border-slate-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* SCENARIO 2: ACTIVE SHIFT WORKSPACE (CLEAN LINEAR COUNTER) */
        /* ============================================================ */
        <div className="space-y-4">
          {/* 1. Shift Header Strip (Minimal, Calm, Clear) */}
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                  <span className="font-bold text-white text-sm">Shift #{activeShift.shiftNumber}</span>
                  <span>·</span>
                  <span>Attendant: <strong className="text-slate-200 font-medium">{activeShift.workerName}</strong></span>
                  <span>·</span>
                  <span>Started {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Cash Float: KES {activeShift.openingCashFloat.toLocaleString()} · M-Pesa Float: KES {activeShift.openingMpesaBalance.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="py-1.5 px-3 rounded-lg bg-[#161F30] hover:bg-[#1B263C] text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span>+ Record Expense</span>
              </button>

              <button
                onClick={() => setShowCloseModal(true)}
                className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Close Shift & Reconcile</span>
              </button>
            </div>
          </div>

          {/* 2. Quiet 4-Metric Summary Strip (No Loud Cards) */}
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-3 sm:px-5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px] font-sans">Drinks Sold:</span>
              <span className="font-bold text-white text-sm">{summaryTotals.totalSold}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px] font-sans">Sales Revenue:</span>
              <span className="font-bold text-emerald-400 text-sm">
                KES {summaryTotals.totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px] font-sans">Gross Profit:</span>
              <span className="font-bold text-slate-200 text-sm">
                KES {summaryTotals.totalProfit.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px] font-sans">Total Restocked:</span>
              <span className="font-bold text-slate-300 text-sm">+{summaryTotals.totalAdded}</span>
            </div>
          </div>

          {/* 3. Filter & Search Bar */}
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search beverage..."
                className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleVerifyAllOpening}
                className="py-1 px-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#161F30] text-xs font-medium transition-colors cursor-pointer"
              >
                Confirm Opening All
              </button>

              <div className="h-4 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#161F30] text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? 'bg-[#161F30] text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. THE CORE STOCK LEDGER TABLE (THE "ONE LIST") */}
          <div className="bg-[#111622] border border-[#1E2638] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0D1117] text-slate-400 font-mono text-[11px] border-b border-[#1E2638]">
                    <th className="py-2.5 px-3.5 font-semibold text-slate-300">Beverage</th>
                    <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-20">Opening</th>
                    <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-20">Added</th>
                    <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-16">Total</th>
                    <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-20">Closing</th>
                    <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-16">Sold</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-300 w-28">Sales (KES)</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-300 w-28">Profit (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500 font-sans text-xs">
                        No beverages found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const p = row.product;
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* 1. Beverage Name & Unit Price */}
                          <td className="py-2.5 px-3.5 font-sans">
                            <div className="font-medium text-slate-100">{p.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              KES {row.sellingPrice.toLocaleString()} · {p.category}
                            </div>
                          </td>

                          {/* 2. Opening Stock */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.openingStock !== undefined ? row.openingStock : ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCellChange(p.id, 'opening', e.target.value)}
                              placeholder="0"
                              className="w-16 text-center py-1 px-1.5 rounded-lg bg-[#0D1117] border border-slate-800 text-slate-200 focus:outline-none focus:border-slate-600"
                            />
                          </td>

                          {/* 3. Added Stock */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.addedStock !== 0 ? row.addedStock : ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCellChange(p.id, 'added', e.target.value)}
                              placeholder="0"
                              className={`w-16 text-center py-1 px-1.5 rounded-lg bg-[#0D1117] border focus:outline-none ${
                                row.addedStock > 0
                                  ? 'border-emerald-600/60 text-emerald-300 font-semibold focus:border-emerald-500'
                                  : 'border-slate-800 text-slate-300 focus:border-slate-600'
                              }`}
                            />
                          </td>

                          {/* 4. Total Stock */}
                          <td className="py-2 px-2 text-center font-bold text-slate-200">
                            {row.totalStock}
                          </td>

                          {/* 5. Closing Stock */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.closingStock !== undefined ? row.closingStock : ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
                              placeholder="-"
                              className={`w-16 text-center py-1 px-1.5 rounded-lg bg-[#0D1117] border focus:outline-none ${
                                row.hasClosingEntered
                                  ? 'border-slate-600 text-white font-semibold'
                                  : 'border-slate-800 text-slate-400 focus:border-slate-600'
                              }`}
                            />
                          </td>

                          {/* 6. Sold */}
                          <td className="py-2 px-2 text-center font-semibold">
                            {row.hasOverage ? (
                              <span className="text-amber-400 text-[10px]">Overage</span>
                            ) : (
                              <span className={row.salesUnits > 0 ? 'text-white' : 'text-slate-500'}>
                                {row.salesUnits}
                              </span>
                            )}
                          </td>

                          {/* 7. Sales Amount (KES) */}
                          <td className="py-2 px-3 text-right font-medium text-slate-200">
                            {row.amountKes > 0 ? `KES ${row.amountKes.toLocaleString()}` : '-'}
                          </td>

                          {/* 8. Profit (KES) */}
                          <td className="py-2 px-3 text-right font-medium text-slate-400">
                            {row.profitKes > 0 ? `KES ${row.profitKes.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Grand Totals Footer */}
                <tfoot className="bg-[#0D1117] font-mono text-xs font-bold border-t border-[#1E2638]">
                  <tr>
                    <td className="py-3 px-3.5 text-white">
                      TOTAL ({rowDataList.length} items)
                    </td>
                    <td className="py-3 px-2 text-center text-slate-300">
                      {summaryTotals.totalOpening}
                    </td>
                    <td className="py-3 px-2 text-center text-emerald-400">
                      +{summaryTotals.totalAdded}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-200">
                      {summaryTotals.totalOpening + summaryTotals.totalAdded}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-300">
                      {summaryTotals.totalClosing > 0 ? summaryTotals.totalClosing : '-'}
                    </td>
                    <td className="py-3 px-2 text-center text-white">
                      {summaryTotals.totalSold}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400">
                      KES {summaryTotals.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      KES {summaryTotals.totalProfit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: RECORD EXPENSE */}
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
            showToast(`Recorded expense of KES ${data.amount.toLocaleString()}`);
          }}
        />
      )}

      {/* ============================================================ */}
      {/* 6. MODAL: CLOSE SHIFT & RECONCILE (FOCUSED & LINEAR) */}
      {/* ============================================================ */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#111622] border border-[#1E2638] rounded-2xl p-5 md:p-6 shadow-xl space-y-4 my-auto">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Shift Financial Reconciliation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Shift #{activeShift.shiftNumber} · Count cash in drawer and check M-Pesa till balance.
              </p>
            </div>

            {/* Expected Revenue Summary */}
            <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400 font-sans">
                <span>Drinks Sold from Counter:</span>
                <span className="font-bold text-white font-mono">{summaryTotals.totalSold} units</span>
              </div>
              <div className="flex justify-between text-slate-400 font-sans">
                <span>Expected Sales Revenue:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  KES {summaryTotals.totalAmount.toLocaleString()}
                </span>
              </div>
              {totalExpenses > 0 && (
                <div className="flex justify-between text-slate-400 font-sans pt-1 border-t border-slate-800/80">
                  <span>Shift Expenses Paid (Cash):</span>
                  <span className="text-rose-400 font-mono">
                    -KES {totalExpenses.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Cash Drawer & M-Pesa Inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Physical Cash in Drawer (KES)
                </label>
                <input
                  type="number"
                  min="0"
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  placeholder="Enter cash count"
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                  Starting Float: KES {cashFloat.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  M-Pesa Till Balance (KES)
                </label>
                <input
                  type="number"
                  min="0"
                  value={closingMpesaInput}
                  onChange={(e) => setClosingMpesaInput(e.target.value)}
                  placeholder="Enter M-Pesa balance"
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                  Starting Float: KES {mpesaFloat.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  value={closingNotesInput}
                  onChange={(e) => setClosingNotesInput(e.target.value)}
                  placeholder="Notes for owner..."
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>

            {/* Reconciliation Equation Outcome */}
            {hasEnteredDrawer && (
              <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="font-sans text-slate-400">Handover Balance:</span>
                <span
                  className={`font-bold ${
                    financialVariance === 0
                      ? 'text-emerald-400'
                      : financialVariance < 0
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {financialVariance === 0
                    ? 'Balanced (KES 0)'
                    : financialVariance < 0
                    ? `-KES ${Math.abs(financialVariance).toLocaleString()} (Shortage)`
                    : `+KES ${financialVariance.toLocaleString()} (Surplus)`}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="py-2 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCloseShift}
                className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Confirm & Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL: SHIFT HANDOVER RECEIPT (CLEAN, MINIMAL, WHATSAPP-READY) */}
      {/* ============================================================ */}
      {justClosedShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-[#111622] border border-[#1E2638] rounded-2xl p-5 md:p-6 shadow-xl space-y-4 my-auto">
            <div className="text-center space-y-1 pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white tracking-tight">Shift Handover Receipt</h2>
              <p className="text-xs text-slate-400 font-mono">
                Shift #{justClosedShift.shiftNumber} · Attendant: {justClosedShift.workerName}
              </p>
            </div>

            <div className="space-y-2 text-xs font-mono p-3 rounded-xl bg-[#0D1117] border border-slate-800 text-slate-300">
              <div className="flex justify-between">
                <span className="font-sans text-slate-400">Drinks Sold:</span>
                <span className="text-white font-bold">{justClosedShift.recordedSalesCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-400">Sales Revenue:</span>
                <span className="text-emerald-400 font-bold">
                  KES {(justClosedShift.expectedSalesRevenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-400">Gross Profit:</span>
                <span className="text-slate-200">
                  KES {(justClosedShift.grossProfit || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-400">Expenses Deducted:</span>
                <span className="text-rose-400">
                  -KES {(justClosedShift.totalExpenses || 0).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex justify-between font-bold">
                <span className="font-sans text-slate-400">Net Money Returned:</span>
                <span className="text-white">
                  KES {((justClosedShift.calculatedCashIncome || 0) + (justClosedShift.calculatedMpesaIncome || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span className="font-sans text-slate-400">Variance:</span>
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
                    ? 'Balanced (KES 0)'
                    : (justClosedShift.financialVariance || 0) < 0
                    ? `-KES ${Math.abs(justClosedShift.financialVariance || 0).toLocaleString()}`
                    : `+KES ${(justClosedShift.financialVariance || 0).toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                onClick={() => {
                  const report = `📊 SHIFT HANDOVER REPORT\nShift #${justClosedShift.shiftNumber}\nAttendant: ${justClosedShift.workerName}\nDate: ${new Date(justClosedShift.closedAt || '').toLocaleString()}\n\nDrinks Sold: ${justClosedShift.recordedSalesCount || 0}\nSales Revenue: KES ${(justClosedShift.expectedSalesRevenue || 0).toLocaleString()}\nProfit: KES ${(justClosedShift.grossProfit || 0).toLocaleString()}\nExpenses: KES ${(justClosedShift.totalExpenses || 0).toLocaleString()}\nCash Returned: KES ${(justClosedShift.calculatedCashIncome || 0).toLocaleString()}\nM-Pesa Income: KES ${(justClosedShift.calculatedMpesaIncome || 0).toLocaleString()}\nVariance: KES ${(justClosedShift.financialVariance || 0).toLocaleString()}`;
                  navigator.clipboard.writeText(report);
                  setCopiedReceipt(true);
                  setTimeout(() => setCopiedReceipt(false), 2500);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#161F30] hover:bg-[#1B263C] text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedReceipt ? 'Copied WhatsApp Report' : 'Copy WhatsApp Report'}</span>
              </button>

              <button
                onClick={() => {
                  setJustClosedShift(null);
                  onGoToHistory();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Done</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
