import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Shift, Product, ShiftStockItem, Expense, ExpenseCategory } from '../../types';
import { store } from '../../services/store';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { ShiftOpeningWizard } from './ShiftOpeningWizard';
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
 ChevronDown,
 ChevronUp,
 AlertCircle,
 Info,
 Scale,
 X,
 Trash2,
} from 'lucide-react';
import { WeightCalculatorModal } from '../common/WeightCalculatorModal';
import { useBackHandler } from '../../services/navigationHistory';

interface UnifiedStockLedgerProps {
 currentUser: User;
}

export const UnifiedStockLedger: React.FC<UnifiedStockLedgerProps> = ({
 currentUser,
}) => {
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
 const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
 const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
 const [showWeightModal, setShowWeightModal] = useState<boolean>(false);
 const [justClosedShift, setJustClosedShift] = useState<Shift | null>(null);
 const [toastMessage, setToastMessage] = useState<string | null>(null);
 const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

 // Inline Expense List & Form state just above '+ Add Expense' button
 const [isInlineExpenseOpen, setIsInlineExpenseOpen] = useState<boolean>(false);
 const [expenseDesc, setExpenseDesc] = useState<string>('');
 const [expenseAmount, setExpenseAmount] = useState<string>('');
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  // Phone back-button integration: undoes modal opening & returns to counter sheet
  useBackHandler(showExpenseModal, () => setShowExpenseModal(false), 'worker-expense-modal');
  useBackHandler(isInlineExpenseOpen, () => setIsInlineExpenseOpen(false), 'worker-inline-expense');
  useBackHandler(showCloseModal, () => setShowCloseModal(false), 'worker-close-modal');
  useBackHandler(showWeightModal, () => setShowWeightModal(false), 'worker-weight-modal');
  useBackHandler(Boolean(justClosedShift), () => setJustClosedShift(null), 'worker-handover-receipt');

 // New shift opening inputs if no active shift
 const [openingCashInput, setOpeningCashInput] = useState<string>('0');
 const [openingMpesaInput, setOpeningMpesaInput] = useState<string>('0');

 // Selected item for soft missing details modal (Price, Category, Sold Stock)
 const [detailsProductId, setDetailsProductId] = useState<string | null>(null);
 useBackHandler(Boolean(detailsProductId), () => setDetailsProductId(null), 'worker-item-details');

 // Selected item for adjusting opening stock during an active shift
 const [editOpeningProductId, setEditOpeningProductId] = useState<string | null>(null);
 const [editOpeningInput, setEditOpeningInput] = useState<string>('');
 useBackHandler(Boolean(editOpeningProductId), () => setEditOpeningProductId(null), 'worker-edit-opening');

 const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

 const startLongPress = (productId: string) => {
   if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
   longPressTimerRef.current = setTimeout(() => {
     try {
       if (typeof window !== 'undefined' && 'vibrate' in navigator) {
         navigator.vibrate?.(40);
       }
     } catch (_) {}
     setDetailsProductId(productId);
   }, 450);
 };

 const cancelLongPress = () => {
   if (longPressTimerRef.current) {
     clearTimeout(longPressTimerRef.current);
     longPressTimerRef.current = null;
   }
 };

 const handleTouchStart = (productId: string, e: React.TouchEvent) => {
   const t = e.touches[0];
   touchStartPosRef.current = { x: t.clientX, y: t.clientY };
   startLongPress(productId);
 };

 const handleTouchMove = (e: React.TouchEvent) => {
   if (!touchStartPosRef.current || !longPressTimerRef.current) return;
   const t = e.touches[0];
   const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
   const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
   if (dx > 10 || dy > 10) {
     cancelLongPress();
   }
 };

 // Closing cash & M-pesa inputs for handover modal
 const [closingCashInput, setClosingCashInput] = useState<string>('');
 const [closingMpesaInput, setClosingMpesaInput] = useState<string>('');
 const [closingNotesInput, setClosingNotesInput] = useState<string>('');

  const [, setStoreTick] = useState<number>(0);

  useEffect(() => {
    return store.subscribe(() => {
      setStoreTick((t) => t + 1);
    });
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

 const handleDeleteExpense = (exp: Expense) => {
   try {
     store.deleteExpense(exp.id);
     showToast(`Removed expense: ${exp.description} (KES ${exp.amount.toLocaleString()})`);
     setDeletingExpenseId(null);
   } catch (err: any) {
     showToast(err.message || 'Error deleting expense');
   }
 };

 const handleSaveInlineExpense = (e: React.FormEvent) => {
   e.preventDefault();
   if (!activeShift) return;

   const parsed = parseFloat(expenseAmount);
   if (!parsed || parsed <= 0) {
     showToast('Please enter a valid expense amount.');
     return;
   }
   if (!expenseDesc.trim()) {
     showToast('Please enter an expense description.');
     return;
   }

   store.recordExpense({
     shiftId: activeShift.id,
     description: expenseDesc.trim(),
     amount: parsed,
     category: 'OTHER',
     paymentMethod: 'CASH',
   });

   setExpenseDesc('');
   setExpenseAmount('');
   setIsInlineExpenseOpen(false);
   showToast(`Recorded: ${expenseDesc.trim()} (KES ${parsed.toLocaleString()})`);
 };

  // Transient string values while attendant is actively typing in cells
  const [cellInputStrings, setCellInputStrings] = useState<
    Record<string, { opening?: string; added?: string; closing?: string }>
  >({});


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
     const inv = inventory.find((i) => i.productId === product.id);

     const isValue =
       (product.isMeasured && product.measurementType === 'VALUE') ||
       product.unit === 'VALUE_KES';

     // 1. Opening stock:
      // When shift is active, ssi.openingPhysicalCount is the authoritative count.
      // Owner stock adjustments directly update this count, keeping attendant in lockstep.
      let openingStock = 0;
      if (activeShift) {
        openingStock = ssi?.openingPhysicalCount !== undefined
          ? ssi.openingPhysicalCount
          : (inv ? Number(inv.quantityOnHand || 0) : 0);
      } else {
        openingStock = inv ? Number(inv.quantityOnHand || 0) : 0;
      }

      // 2. Added stock & owner adjustments
      const addedStock = ssi?.additions !== undefined ? ssi.additions : 0;
      const ownerAdjustments = ssi?.ownerAdjustments !== undefined ? ssi.ownerAdjustments : 0;

      // 3. Total stock = Opening + Added + TransfersIn - TransfersOut - Damages + OwnerAdjustments
      const totalStock =
        Number(openingStock || 0) +
        Number(addedStock || 0) +
        Number(ssi?.transfersIn || 0) -
        Number(ssi?.transfersOut || 0) -
        Number(ssi?.damages || 0) +
        Number(ownerAdjustments || 0);

      // 4. Closing stock
      const closingStock = ssi?.closingPhysicalCount !== undefined
        ? ssi.closingPhysicalCount
        : undefined;

     // 5. Sales = Total - Closing (if entered)
     let salesUnits = 0;
     let hasOverage = false;
     if (closingStock !== undefined) {
       if (closingStock > totalStock) {
         hasOverage = true;
         salesUnits = 0;
       } else {
         salesUnits = Math.round(Math.max(0, totalStock - closingStock) * 100) / 100;
       }
     }

     // 6. Amount (Sales Revenue)
     // For drinks measured by money value (e.g. Muratina left on counter), salesUnits is ALREADY KES!
     // For drinks measured by weight on scale (e.g. Keg tank), salesUnits is kg sold * ratePerUnit KES/kg!
     // 6. Amount (Sales Revenue)
     // For drinks measured by money value (e.g. Muratina left on counter), salesUnits is ALREADY KES!
     const sellingPrice = product.sellingPrice || 0;
     const amountKes = isValue ? salesUnits : salesUnits * sellingPrice;

     return {
       product,
       ssi,
       isValue,
       openingStock,
       addedStock,
       totalStock,
       closingStock,
       hasClosingEntered: closingStock !== undefined,
       salesUnits,
       amountKes,
       hasOverage,
       sellingPrice,
     };
   });
 }, [products, shiftStockItems, inventory, activeShift]);

 // Selected row for soft missing details modal
 const detailsRow = useMemo(() => {
   if (!detailsProductId) return null;
   return rowDataList.find((r) => r.product.id === detailsProductId) || null;
 }, [detailsProductId, rowDataList]);

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

   rowDataList.forEach((row) => {
     totalOpening += Number(row.openingStock || 0);
     totalAdded += Number(row.addedStock || 0);
     if (row.closingStock !== undefined) {
       totalClosing += Number(row.closingStock || 0);
     }
     totalSold += row.salesUnits;
     totalAmount += row.amountKes;
   });

   return {
     totalOpening,
     totalAdded,
     totalClosing,
     totalSold,
     totalAmount,
   };
 }, [rowDataList]);

  // Handle cell edit commit to store & Neon
  const handleCellChange = (
    productId: string,
    field: 'opening' | 'added' | 'closing',
    valueStr: string
  ) => {
    // Only buffer input locally while attendant is actively typing
    setCellInputStrings((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: valueStr,
      },
    }));
  };

  const handleCellBlur = (productId: string, field: 'opening' | 'added' | 'closing') => {
    const rawVal = cellInputStrings[productId]?.[field];
    if (rawVal === undefined) return;

    const trimmed = rawVal.trim();
    const parsed = trimmed === '' ? undefined : Math.max(0, parseFloat(trimmed));
    const num = parsed !== undefined && !isNaN(parsed) ? parsed : undefined;

    if (!activeShift) {
      // In pre-shift shelf preview, keep the input buffered until the shift opens
      return;
    }

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

    // Clear input buffer once committed so store becomes single source of truth
    setCellInputStrings((prev) => {
      if (!prev[productId]) return prev;
      const copy = { ...prev };
      const prodCopy = { ...copy[productId] };
      delete prodCopy[field];
      if (Object.keys(prodCopy).length === 0) {
        delete copy[productId];
      } else {
        copy[productId] = prodCopy;
      }
      return copy;
    });
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
    setCellInputStrings({});
    showToast('All opening counts confirmed.');
  };

  // Open a new shift
  const handleStartShiftNow = () => {
    const cashFloat = Math.max(0, parseFloat(openingCashInput) || 0);
    const mpesaFloat = Math.max(0, parseFloat(openingMpesaInput) || 0);

    const physicalCounts: Record<string, number> = {};
    products.forEach((p) => {
      const inv = inventory.find((i) => i.productId === p.id);
      const systemQty = inv ? Number(inv.quantityOnHand || 0) : 0;
      const rawInput = cellInputStrings[p.id]?.opening;
      if (rawInput !== undefined && rawInput.trim() !== '') {
        const parsed = Math.max(0, parseFloat(rawInput.trim()));
        physicalCounts[p.id] = !isNaN(parsed) ? parsed : systemQty;
      } else {
        physicalCounts[p.id] = systemQty;
      }
    });

    const shift = store.openShift({
      workerId: currentUser.id,
      workerName: currentUser.name,
      openingCashFloat: cashFloat,
      openingMpesaBalance: mpesaFloat,
      physicalCounts,
    });

    setCellInputStrings({});
    showToast('Shift started successfully.');
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
    <ShiftOpeningWizard
      products={products}
      inventory={inventory}
      workerName={currentUser.name}
      onConfirmOpen={({ openingCashFloat, openingMpesaBalance, physicalCounts }: { openingCashFloat: number; openingMpesaBalance: number; physicalCounts: Record<string, number> }) => {
        store.openShift({
          workerId: currentUser.id,
          workerName: currentUser.name,
          openingCashFloat,
          openingMpesaBalance,
          physicalCounts,
        });
        setCellInputStrings({});
        showToast('Shift started successfully.');
      }}
    />
 ) : (
 /* ============================================================ */
 /* SCENARIO 2: ACTIVE SHIFT WORKSPACE (CLEAN LINEAR COUNTER) */
 /* ============================================================ */
 <div className="space-y-4">
 {/* 1. Shift Header Strip (Minimal, Calm, Clear) */}
 <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
 <div>
 <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
 <strong className="font-bold text-white text-sm">{activeShift.workerName}</strong>
 <span>·</span>
 <span>Started {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <div className="text-[11px] text-slate-500 font-mono mt-0.5">
 Cash Float: KES {activeShift.openingCashFloat.toLocaleString()} · M-Pesa Float: KES {activeShift.openingMpesaBalance.toLocaleString()}
 </div>
 </div>
 </div>
 </div>

 {/* 2. Quiet 4-Metric Summary Strip */}

 {/* 3. Filter & Search Bar */}
 <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
 />
 </div>

 <div className="flex items-center gap-2 flex-wrap">


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
 {/* Mobile Helpful Hint */}
 <div className="px-3.5 py-2 bg-[#0D1117] border-b border-[#1E2638] flex items-center justify-between text-[11px] text-slate-400">
 <div className="flex items-center gap-1.5">
 <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 <span>Long press any item to view Price, Category & Sold Stock</span>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs border-collapse">
 <thead>
 <tr className="bg-[#0D1117] text-slate-400 font-mono text-[11px] border-b border-[#1E2638]">
 <th className="py-2.5 px-3 sm:px-3.5 font-bold text-slate-200">Name</th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-bold text-slate-200 w-20 sm:w-24">
 <div className="leading-tight">Opening</div>
 </th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-bold text-slate-200 w-16 sm:w-20">
 <div className="leading-tight">Add</div>
 </th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-bold text-slate-200 w-20 sm:w-24">
 <div className="leading-tight">Closing</div>
 </th>
 <th className="py-2.5 px-2 sm:px-3.5 text-right font-bold text-slate-200 w-24 sm:w-28">
 <div className="leading-tight">Amount</div>
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800/60 font-mono">
 {filteredRows.length === 0 ? (
 <tr>
 <td colSpan={5} className="py-10 text-center text-slate-500 font-sans text-xs">
 No beverages found matching your filter.
 </td>
 </tr>
 ) : (
 filteredRows.map((row) => {
 const p = row.product;

 return (
 <tr
 key={p.id}
 onTouchStart={(e) => handleTouchStart(p.id, e)}
 onTouchMove={handleTouchMove}
 onTouchEnd={cancelLongPress}
 onTouchCancel={cancelLongPress}
 onMouseDown={() => startLongPress(p.id)}
 onMouseUp={cancelLongPress}
 onMouseLeave={cancelLongPress}
 onContextMenu={(e) => {
   e.preventDefault();
   setDetailsProductId(p.id);
 }}
 className="transition-colors hover:bg-slate-900/40 select-none cursor-pointer"
 title="Long press to view Price, Category & Sold Stock"
 >
 {/* 1. Name */}
 <td className="py-3 px-3 sm:px-3.5 font-sans">
 <div className="font-medium text-slate-100 truncate text-xs sm:text-sm">
 {p.name}
 </div>
 </td>

  {/* 2. Opening Stock (Long-press or click to readjust opening stock without undoing shift) */}
  <td
    className="py-2.5 px-1.5 sm:px-2 text-center font-mono font-semibold text-slate-300 cursor-pointer hover:bg-slate-800/40 transition-colors group relative"
    onClick={(e) => {
      e.stopPropagation();
      setEditOpeningProductId(p.id);
      setEditOpeningInput(String(row.openingStock));
    }}
    onTouchStart={(e) => {
      e.stopPropagation();
      startLongPress(p.id);
    }}
    onTouchEnd={(e) => {
      e.stopPropagation();
      cancelLongPress();
    }}
    onContextMenu={(e) => {
      e.preventDefault();
      e.stopPropagation();
      setEditOpeningProductId(p.id);
      setEditOpeningInput(String(row.openingStock));
    }}
    title="Long press or click to readjust opening stock"
  >
    <span className="underline decoration-dotted decoration-slate-500 underline-offset-4 group-hover:text-amber-300 transition-colors">
      {row.openingStock !== undefined ? row.openingStock : 0}
    </span>
  </td>

 {/* 3. Add Stock Input */}
 <td
 className="py-2 px-1.5 sm:px-2 text-center"
 onClick={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 onTouchStart={(e) => e.stopPropagation()}
 >
 <input
 type="number"
 step="any"
 inputMode="decimal"
 min="0"
 value={cellInputStrings[p.id]?.added !== undefined ? cellInputStrings[p.id]?.added : (row.addedStock !== undefined && row.addedStock > 0 ? row.addedStock : '')}
 onFocus={(e) => e.target.select()}
 onBlur={() => handleCellBlur(p.id, 'added')}
 onChange={(e) => handleCellChange(p.id, 'added', e.target.value)}
 title="Added restock quantity"
 className={`w-12 sm:w-16 text-center py-1.5 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${row.addedStock > 0 ? 'border-emerald-600/70 text-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' : 'border-slate-800 text-slate-300 focus:border-slate-600'}`}
 />
 </td>

 {/* 3. Closing Stock Input */}
 <td
 className="py-2 px-1.5 sm:px-2 text-center"
 onClick={(e) => e.stopPropagation()}
 onMouseDown={(e) => e.stopPropagation()}
 onTouchStart={(e) => e.stopPropagation()}
 >
 <input
 type="number" step="any"
 inputMode="decimal"
 min="0"
 value={cellInputStrings[p.id]?.closing !== undefined ? cellInputStrings[p.id]?.closing : (row.closingStock !== undefined ? row.closingStock : '')}
 onFocus={(e) => e.target.select()}
 onBlur={() => handleCellBlur(p.id, 'closing')}
 onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
 title="Closing stock count at shift handover"
 className={`w-14 sm:w-16 text-center py-1.5 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${row.hasClosingEntered ? "border-slate-500 text-white font-bold" : "border-slate-800 text-slate-400 focus:border-slate-600"}`}
 />
 </td>

 {/* 4. Amount (Expected sales for that item) */}
 <td className="py-2.5 px-2 sm:px-3.5 text-right font-mono font-semibold">
 <span className={row.amountKes > 0 ? "text-emerald-400 font-bold text-xs sm:text-sm" : "text-slate-500 text-xs"}>
 {row.amountKes > 0 ? `KES ${row.amountKes.toLocaleString()}` : "KES 0"}
 </span>
 </td>
 </tr>
 );
 })
 )}
 </tbody>

 {/* Grand Totals Footer */}
 <tfoot className="bg-[#0D1117] font-mono text-xs font-bold border-t border-[#1E2638]">
 <tr>
 <td className="py-3 px-3 sm:px-3.5 text-white">
 TOTAL ({rowDataList.length} items)
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-slate-300">
 {summaryTotals.totalOpening}
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-emerald-400">
 {summaryTotals.totalAdded > 0 ? `+${summaryTotals.totalAdded}` : '-'}
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-slate-300">
 {summaryTotals.totalClosing > 0 ? summaryTotals.totalClosing : '-'}
 </td>
 <td className="py-3 px-2 sm:px-3.5 text-right text-emerald-400">
 KES {summaryTotals.totalAmount.toLocaleString()}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>

 {/* ============================================================ */}
 {/* SHIFT EXPENSE LIST & FORM (DIRECTLY ABOVE '+ ADD EXPENSE' BUTTON) */}
 {/* ============================================================ */}
 <div className="space-y-3 pt-2">
   {/* 1. Recorded Expense List */}
   {expenses.length > 0 && (
     <div className="bg-[#111622] border border-[#1E2638] rounded-2xl overflow-hidden shadow-sm">
       <div className="p-3 bg-[#0D1117] border-b border-[#1E2638] flex items-center justify-between">
         <span className="text-xs font-bold text-white tracking-wide">Expense list</span>
         <span className="text-xs font-mono font-bold text-rose-400">KES {totalExpenses.toLocaleString()}</span>
       </div>

       <div className="overflow-x-auto">
         <table className="w-full text-left text-xs border-collapse">
           <thead>
             <tr className="bg-[#0D1117]/60 text-slate-400 font-mono text-[11px] border-b border-slate-800/80">
               <th className="py-2.5 px-3.5 font-bold text-slate-300">Name</th>
               <th className="py-2.5 px-3 text-right font-bold text-slate-300">Amount</th>
               <th className="py-2.5 px-3 text-center font-bold text-slate-300 w-24">Time</th>
               <th className="py-2.5 px-2 text-center w-10"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-800/50 text-xs">
             {expenses.map((exp) => (
               <tr key={exp.id} className="hover:bg-slate-800/20 transition-colors">
                 <td className="py-2.5 px-3.5 font-semibold text-slate-100 font-sans">
                   {exp.description}
                 </td>
                 <td className="py-2.5 px-3 text-right font-bold text-rose-400 font-mono">
                   KES {exp.amount.toLocaleString()}
                 </td>
                 <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                   {exp.timestamp
                     ? new Date(exp.timestamp).toLocaleTimeString([], {
                         hour: '2-digit',
                         minute: '2-digit',
                       })
                     : '-'}
                 </td>
                 <td className="py-2.5 px-2 text-center">
                   {deletingExpenseId === exp.id ? (
                     <div className="flex items-center justify-center gap-1">
                       <button
                         type="button"
                         onClick={() => handleDeleteExpense(exp)}
                         className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                         title="Confirm"
                       >
                         <Check className="w-3 h-3" />
                       </button>
                       <button
                         type="button"
                         onClick={() => setDeletingExpenseId(null)}
                         className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                         title="Cancel"
                       >
                         <X className="w-3 h-3" />
                       </button>
                     </div>
                   ) : (
                     <button
                       type="button"
                       onClick={() => setDeletingExpenseId(exp.id)}
                       className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                       title="Delete"
                     >
                       <X className="w-3.5 h-3.5" />
                     </button>
                   )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     </div>
   )}

   {/* 2. Inline Expense Form (Forms right above the '+ Add Expense' button when toggled) */}
   {isInlineExpenseOpen && (
     <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5 animate-in fade-in duration-150">
       <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
         <h3 className="text-xs font-bold text-white tracking-tight">Add Expense</h3>
         <button
           type="button"
           onClick={() => setIsInlineExpenseOpen(false)}
           className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
           title="Close"
         >
           <X className="w-4 h-4" />
         </button>
       </div>

       <form onSubmit={handleSaveInlineExpense} className="space-y-3">
         <div className="space-y-3">
           <div>
             <label className="block text-xs font-semibold text-slate-300 mb-1">
               Name
             </label>
             <input
               type="text"
               required
               autoFocus
               value={expenseDesc}
               onChange={(e) => setExpenseDesc(e.target.value)}
               className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
             />
           </div>

           <div>
             <label className="block text-xs font-semibold text-slate-300 mb-1">
               Amount
             </label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-500">
                 KES
               </span>
               <input
                 type="number"
                 step="any"
                 min="1"
                 required
                 value={expenseAmount}
                 onChange={(e) => setExpenseAmount(e.target.value)}
                 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-12 pr-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-slate-600 tabular-nums"
               />
             </div>
           </div>
         </div>

         {/* Buttons */}
         <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
           <button
             type="button"
             onClick={() => setIsInlineExpenseOpen(false)}
             className="py-1.5 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
           >
             Cancel
           </button>
           <button
             type="submit"
             disabled={!expenseDesc.trim() || !expenseAmount}
             className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md shadow-emerald-950/40"
           >
             <Check className="w-3.5 h-3.5" />
             <span>Save</span>
           </button>
         </div>
       </form>
     </div>
   )}

   {/* 3. The 'Add Expense' Button Row */}
   <div className="flex items-center gap-2">
     <button
       type="button"
       onClick={() => setIsInlineExpenseOpen((prev) => !prev)}
       className={`py-2 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-sm ${
         isInlineExpenseOpen
           ? 'bg-[#1C273E] border-slate-700 text-slate-200'
           : 'bg-[#161F30] hover:bg-[#1C273E] border-slate-800 text-slate-200'
       }`}
     >
       <Receipt className="w-4 h-4 text-amber-400" />
       <span>{isInlineExpenseOpen ? 'Close Expense Form' : '+ Add Expense'}</span>
     </button>
   </div>
 </div>

 {/* 2. Isolated Shift Submission Bar (Acts as the final submit button at bottom right) */}
 <div className="mt-8 pt-6 border-t border-[#1E2638] flex justify-end">
 <button
 type="button"
 onClick={() => setShowCloseModal(true)}
 className="w-full sm:w-auto py-3 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
 >
 <LogOut className="w-4 h-4" />
 <span>End Shift</span>
 </button>
 </div>

 {/* SOFT MISSING DETAILS MODAL (OPENED VIA LONG PRESS) */}
 {detailsRow && (
 <div
 className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
 onClick={() => setDetailsProductId(null)}
 >
 <div
 className="bg-[#111622] border border-[#1E2638] rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-3 font-sans"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between pb-2 border-b border-slate-800">
 <h3 className="text-sm font-bold text-white truncate pr-2">
 {detailsRow.product.name}
 </h3>
 <button
 type="button"
 onClick={() => setDetailsProductId(null)}
 className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
 aria-label="Close details"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="space-y-2 text-xs">
 {/* Price */}
 <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80">
 <span className="text-slate-400">Price</span>
 <span className="font-mono font-bold text-white">
 {detailsRow.isValue
 ? 'Measured by Value'
 : `KES ${detailsRow.sellingPrice.toLocaleString()}`}
 </span>
 </div>

 {/* Category */}
 <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80">
 <span className="text-slate-400">Category</span>
 <span className="font-mono text-slate-200">
 {detailsRow.product.category || 'General'}
 </span>
 </div>

 {/* Sold Stock */}
 <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80">
 <span className="text-slate-400">Sold Stock</span>
 <span className="font-mono font-bold text-emerald-400">
 {detailsRow.hasClosingEntered
 ? detailsRow.isValue
 ? `KES ${detailsRow.salesUnits.toLocaleString()}`
 : `${detailsRow.salesUnits} units`
 : '0 units (pending closing)'}
 </span>
 </div>

 {/* Added Stock if any */}
 {detailsRow.addedStock > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80">
 <span className="text-slate-400">Added Stock</span>
 <span className="font-mono font-bold text-cyan-400">
 +{detailsRow.addedStock} {detailsRow.isValue ? 'KES' : 'units'}
 </span>
 </div>
 )}

 {/* Audit Adjustment if any */}
 {detailsRow.ssi?.ownerAdjustments !== undefined && detailsRow.ssi.ownerAdjustments !== 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0D1117] border border-slate-800/80">
 <span className="text-slate-400">Audit Adjustment</span>
 <span className="font-mono font-bold text-amber-400">
 {detailsRow.ssi.ownerAdjustments > 0
 ? `+${detailsRow.ssi.ownerAdjustments}`
 : detailsRow.ssi.ownerAdjustments}
 </span>
 </div>
 )}
 </div>

 <button
 type="button"
 onClick={() => setDetailsProductId(null)}
 className="w-full py-2 rounded-xl bg-[#161F30] hover:bg-[#1C273E] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
 >
 Done
 </button>
 </div>
 </div>
 )}
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
 <p className="text-xs text-slate-400 mt-0.5 font-mono">Active Shift</p>
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
 inputMode="decimal"
 min="0"
 value={closingCashInput}
 onChange={(e) => setClosingCashInput(e.target.value)}
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
 />
 
 </div>

 <div>
 <label className="text-xs font-medium text-slate-300 block mb-1">
 M-Pesa Till Balance (KES)
 </label>
 <input
 type="number"
 inputMode="decimal"
 min="0"
 value={closingMpesaInput}
 onChange={(e) => setClosingMpesaInput(e.target.value)}
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
 />
 
 </div>

 <div>
 <label className="text-xs font-medium text-slate-300 block mb-1">
 Closing Notes (Optional)
 </label>
 <input
 type="text"
 value={closingNotesInput}
 onChange={(e) => setClosingNotesInput(e.target.value)}
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
  {/* ============================================================ */}
  {/* MODAL: ADJUST OPENING STOCK FOR ACTIVE SHIFT */}
  {/* ============================================================ */}
  {editOpeningProductId && activeShift && (() => {
    const row = rowDataList.find((r) => r.product.id === editOpeningProductId);
    if (!row) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#111622] border border-[#1E2638] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Adjust Opening Stock</h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">{row.product.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpeningProductId(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Opening Count
              </label>
              <input
                type="number"
                step="any"
                min="0"
                autoFocus
                value={editOpeningInput}
                onChange={(e) => setEditOpeningInput(e.target.value)}
                className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-slate-600"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Adjusting this updates the starting count for this shift without ending or resetting the shift.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditOpeningProductId(null)}
              className="py-1.5 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const val = parseFloat(editOpeningInput);
                if (isNaN(val) || val < 0) {
                  showToast('Please enter a valid opening count.');
                  return;
                }
                store.updateShiftStockItemRow({
                  shiftId: activeShift.id,
                  productId: row.product.id,
                  openingPhysicalCount: val,
                });
                setEditOpeningProductId(null);
                showToast(`Opening stock for ${row.product.name} updated to ${val}.`);
              }}
              className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  })()}

  {justClosedShift && (
 <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
 <div className="w-full max-w-md bg-[#111622] border border-[#1E2638] rounded-2xl p-5 md:p-6 shadow-xl space-y-4 my-auto">
 <div className="text-center space-y-1 pb-3 border-b border-slate-800">
 <h2 className="text-base font-bold text-white tracking-tight">Shift Handover Receipt</h2>
 <p className="text-xs text-slate-400 font-mono">
 Closed Shift · Attendant: {justClosedShift.workerName}
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
     const report = `📊 SHIFT HANDOVER REPORT\nAttendant: ${justClosedShift.workerName}\nDate: ${new Date(justClosedShift.closedAt || '').toLocaleString()}\n\nDrinks Sold: ${justClosedShift.recordedSalesCount || 0}\nSales Revenue: KES ${(justClosedShift.expectedSalesRevenue || 0).toLocaleString()}\nExpenses: KES ${(justClosedShift.totalExpenses || 0).toLocaleString()}\nCash Returned: KES ${(justClosedShift.calculatedCashIncome || 0).toLocaleString()}\nM-Pesa Income: KES ${(justClosedShift.calculatedMpesaIncome || 0).toLocaleString()}\nVariance: KES ${(justClosedShift.financialVariance || 0).toLocaleString()}`;
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
 onClick={() => setJustClosedShift(null)}
 className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
 >
 <span>Done</span>
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Weight & Keg Scale Valuation Modal */}
 <WeightCalculatorModal
   isOpen={showWeightModal}
   onClose={() => setShowWeightModal(false)}
 />
 </div>
 );
};
