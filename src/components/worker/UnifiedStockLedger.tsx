import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Shift, Product, ShiftStockItem, Expense, ExpenseCategory } from '../../types';
import { store } from '../../services/store';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { ShiftOpeningWizard } from './ShiftOpeningWizard';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import { intelligentMatch } from '../../utils/searchMatcher';
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
 FileText,
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
 const [toastMessage, setToastMessage] = useState<string | null>(null);

 // Inline Expense List & Form state just above '+ Add Expense' button
 const [isInlineExpenseOpen, setIsInlineExpenseOpen] = useState<boolean>(false);
 const [isExpenseListExpanded, setIsExpenseListExpanded] = useState<boolean>(false);
 const [expenseDesc, setExpenseDesc] = useState<string>('');
 const [expenseAmount, setExpenseAmount] = useState<string>('');
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
 const syncTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Phone back-button integration: undoes modal opening & returns to counter sheet
  useBackHandler(showExpenseModal, () => setShowExpenseModal(false), 'worker-expense-modal');
  useBackHandler(isInlineExpenseOpen, () => setIsInlineExpenseOpen(false), 'worker-inline-expense');
  useBackHandler(showCloseModal, () => setShowCloseModal(false), 'worker-close-modal');
  useBackHandler(showWeightModal, () => setShowWeightModal(false), 'worker-weight-modal');

 // New shift opening inputs if no active shift
 const [openingCashInput, setOpeningCashInput] = useState<string>('0');
 const [openingMpesaInput, setOpeningMpesaInput] = useState<string>('0');

 // Selected item for soft missing details modal (Price, Category, Sold Stock)
 // Inline collapsible details drop-down row & option menu popup
 const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
 const [optionMenuProductId, setOptionMenuProductId] = useState<string | null>(null);
 useBackHandler(Boolean(expandedDetailsId || optionMenuProductId), () => {
   setExpandedDetailsId(null);
   setOptionMenuProductId(null);
 }, 'worker-item-details');

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
     setOptionMenuProductId(productId);
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

 const expenseLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const expenseTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);

 const startExpenseLongPress = (expenseId: string) => {
   if (expenseLongPressTimerRef.current) clearTimeout(expenseLongPressTimerRef.current);
   expenseLongPressTimerRef.current = setTimeout(() => {
     try {
       if (typeof window !== 'undefined' && 'vibrate' in navigator) {
         navigator.vibrate?.(40);
       }
     } catch (_) {}
     setDeletingExpenseId(expenseId);
   }, 500);
 };

 const cancelExpenseLongPress = () => {
   if (expenseLongPressTimerRef.current) {
     clearTimeout(expenseLongPressTimerRef.current);
     expenseLongPressTimerRef.current = null;
   }
 };

 const handleExpenseTouchStart = (expenseId: string, e: React.TouchEvent) => {
   const t = e.touches[0];
   expenseTouchStartPosRef.current = { x: t.clientX, y: t.clientY };
   startExpenseLongPress(expenseId);
 };

 const handleExpenseTouchMove = (e: React.TouchEvent) => {
   if (!expenseTouchStartPosRef.current) return;
   const t = e.touches[0];
   const dx = Math.abs(t.clientX - expenseTouchStartPosRef.current.x);
   const dy = Math.abs(t.clientY - expenseTouchStartPosRef.current.y);
   if (dx > 10 || dy > 10) {
     cancelExpenseLongPress();
   }
 };


 // Closing cash & M-pesa inputs for handover modal
 const [closingCashInput, setClosingCashInput] = useState<string>('');
 const [closingMpesaInput, setClosingMpesaInput] = useState<string>('');
 const [closingNotesInput, setClosingNotesInput] = useState<string>('');

 // Minimal subtle form state for optional stock reduction note
 const [reductionNoteProductId, setReductionNoteProductId] = useState<string | null>(null);
 const [noteInputStrings, setNoteInputStrings] = useState<Record<string, string>>({});

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
   setIsExpenseListExpanded(true);
   showToast(`Recorded: ${expenseDesc.trim()} (KES ${parsed.toLocaleString()})`);
 };

  const handleSaveReductionNote = (productId: string, noteText: string) => {
    if (!activeShift) return;
    const trimmed = noteText.trim();
    store.updateShiftStockItemRow({
      shiftId: activeShift.id,
      productId,
      adjustmentNote: trimmed,
    });
    setReductionNoteProductId(null);
    const prod = products.find((p) => p.id === productId);
    if (trimmed) {
      showToast(`Saved note for ${prod?.name || 'item'}: "${trimmed}"`);
    } else {
      showToast(`Cleared note for ${prod?.name || 'item'}`);
    }
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

 // Computed row data for each beverage (sorted alphabetically)
 const rowDataList = useMemo(() => {
   const list = products.map((product) => {
     const ssi = shiftStockItems.find((s) => s.productId === product.id);
     const inv = inventory.find((i) => i.productId === product.id);

     const isValue =
       (product.isMeasured && product.measurementType === 'VALUE') ||
       product.unit === 'VALUE_KES';

     // 1. Opening stock: check active typed cellInputStrings first, then ssi / inventory
      let openingStock = 0;
      const rawOpening = cellInputStrings[product.id]?.opening;
      if (rawOpening !== undefined && rawOpening.trim() !== '') {
        const parsed = parseFloat(rawOpening.trim());
        openingStock = !isNaN(parsed) ? Math.max(0, parsed) : 0;
      } else if (activeShift) {
        openingStock = ssi?.openingPhysicalCount !== undefined
          ? ssi.openingPhysicalCount
          : (inv ? Number(inv.quantityOnHand || 0) : 0);
      } else {
        openingStock = inv ? Number(inv.quantityOnHand || 0) : 0;
      }

      // 2. Added stock: real-time live from cell inputs
      let addedStock = 0;
      const rawAdded = cellInputStrings[product.id]?.added;
      if (rawAdded !== undefined) {
        const trimmedAdded = rawAdded.trim();
        if (trimmedAdded === '' || trimmedAdded === '-') {
          addedStock = 0;
        } else {
          const parsed = parseFloat(trimmedAdded);
          addedStock = !isNaN(parsed) ? parsed : 0;
        }
      } else {
        addedStock = ssi?.additions !== undefined ? ssi.additions : 0;
      }
      const ownerAdjustments = ssi?.ownerAdjustments !== undefined ? ssi.ownerAdjustments : 0;

      // 3. Total stock = Opening + Added + TransfersIn - TransfersOut - Damages + OwnerAdjustments
      const totalStock =
        Number(openingStock || 0) +
        Number(addedStock || 0) +
        Number(ssi?.transfersIn || 0) -
        Number(ssi?.transfersOut || 0) -
        Number(ssi?.damages || 0) +
        Number(ownerAdjustments || 0);

      // 4. Closing stock: real-time live from cell inputs
      let closingStock: number | undefined = undefined;
      const rawClosing = cellInputStrings[product.id]?.closing;
      if (rawClosing !== undefined) {
        const trimmedClosing = rawClosing.trim();
        if (trimmedClosing !== '') {
          const parsed = parseFloat(trimmedClosing);
          if (!isNaN(parsed)) {
            closingStock = Math.max(0, parsed);
          }
        }
      } else {
        closingStock = ssi?.closingPhysicalCount !== undefined
          ? ssi.closingPhysicalCount
          : undefined;
      }

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
       adjustmentNote: ssi?.adjustmentNote,
     };
   });
   return list.sort((a, b) => a.product.name.localeCompare(b.product.name, undefined, { sensitivity: 'base' }));
 }, [products, shiftStockItems, inventory, activeShift, cellInputStrings]);

 // Selected row for soft missing details modal

 // Filtered rows
 const filteredRows = useMemo(() => {
 return rowDataList.filter((row) => {
 const p = row.product;
 const matchesSearch = intelligentMatch(searchQuery, p.name);
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

  // Handle cell edit commit to store & Neon (Live calculation + background auto-sync)
  const handleCellChange = (
    productId: string,
    field: 'opening' | 'added' | 'closing',
    valueStr: string
  ) => {
    // 1. Immediately update state so all math (Total, Sold, Amount, Footer) recalculates live on every keystroke
    setCellInputStrings((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: valueStr,
      },
    }));

    if (!activeShift) return;

    // 2. Debounce persist to store so changes are saved in the background even before blurring
    const syncKey = `${productId}_${field}`;
    if (syncTimeoutRef.current[syncKey]) {
      clearTimeout(syncTimeoutRef.current[syncKey]);
    }

    syncTimeoutRef.current[syncKey] = setTimeout(() => {
      const trimmed = valueStr.trim();
      let num: number | undefined;
      if (trimmed === '' || trimmed === '-') {
        num = field === 'added' ? 0 : undefined;
      } else {
        const parsed = parseFloat(trimmed);
        if (!isNaN(parsed)) {
          num = field === 'added' ? parsed : Math.max(0, parsed);
        }
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
        if (num !== undefined && num < 0) {
          setReductionNoteProductId(productId);
        } else if (num !== undefined && num >= 0 && reductionNoteProductId === productId) {
          setReductionNoteProductId(null);
        }
      } else if (field === 'closing') {
        store.updateShiftStockItemRow({
          shiftId: activeShift.id,
          productId,
          closingPhysicalCount: num,
        });
      }
    }, 600);
  };

  const handleCellBlur = (productId: string, field: 'opening' | 'added' | 'closing') => {
    const syncKey = `${productId}_${field}`;
    if (syncTimeoutRef.current[syncKey]) {
      clearTimeout(syncTimeoutRef.current[syncKey]);
      delete syncTimeoutRef.current[syncKey];
    }

    const rawVal = cellInputStrings[productId]?.[field];
    if (rawVal === undefined) return;

    const trimmed = rawVal.trim();
   let num: number | undefined;
   if (trimmed === '' || trimmed === '-') {
     num = field === 'added' ? 0 : undefined;
   } else {
     const parsed = parseFloat(trimmed);
     if (!isNaN(parsed)) {
       num = field === 'added' ? parsed : Math.max(0, parsed);
     }
   }

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
      // When attendant reduces stock (< 0), open minimal subtle prompt for optional note
      if (num !== undefined && num < 0) {
        setReductionNoteProductId(productId);
      } else if (num !== undefined && num >= 0 && reductionNoteProductId === productId) {
        setReductionNoteProductId(null);
      }
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
 const isDrawerFilled = closingCashInput.trim() !== '' && closingMpesaInput.trim() !== '';
 const financialVariance = hasEnteredDrawer
 ? (totalMoneyCollected + totalExpenses) - summaryTotals.totalAmount
 : 0;

 // Complete and close shift
 const handleConfirmCloseShift = () => {
 if (!activeShift) return;
 if (!isDrawerFilled) {
   showToast('Please enter both Cash and Mpesa before submitting shift.');
   return;
 }

 const closingCounts: Record<string, number> = {};
 rowDataList.forEach((row) => {
 if (row.closingStock !== undefined) {
 closingCounts[row.product.id] = row.closingStock;
 } else {
 closingCounts[row.product.id] = row.totalStock;
 }
 });

 try {
 store.closeShift({
 shiftId: activeShift.id,
 closingPhysicalCounts: closingCounts,
 closingCashActual: parsedCashActual,
 closingMpesaBalance: parsedMpesaClosing,
 closingNotes: closingNotesInput,
 });
 setShowCloseModal(false);
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
 

 {/* 2. Quiet 4-Metric Summary Strip */}

  {/* Subtle Floating Search Bar */}
  <div className="flex justify-end">
    <div className="relative w-44 sm:w-60">
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        placeholder="Search drink..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-[#111622] border border-[#1E2638] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-700 shadow-sm"
      />
    </div>
  </div>

      {/* 4. THE CORE STOCK LEDGER TABLE (THE "ONE LIST") */}
      <div className="bg-[#111622] border border-[#1E2638] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-[#0D1117] text-slate-300 font-mono text-xs sm:text-[13px] border-b border-[#1E2638]">
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-100">Name</th>
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-slate-100 w-20 sm:w-24">
                  <div className="leading-tight">Opening</div>
                </th>
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-slate-100 w-24 sm:w-28">
                  <div className="leading-tight">Add</div>
                </th>
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-emerald-400 w-20 sm:w-24">
                  <div className="leading-tight">Total</div>
                </th>
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-slate-100 w-22 sm:w-26">
                  <div className="leading-tight">Closing</div>
                </th>
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-sky-400 w-20 sm:w-24">
                  <div className="leading-tight">Sold</div>
                </th>
                <th className="py-3 px-3 sm:px-4 text-right font-bold text-slate-100 w-28 sm:w-32">
                  <div className="leading-tight">Amount</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 font-sans text-sm">
                    No beverages found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const p = row.product;

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="transition-colors hover:bg-slate-900/30">
                        {/* 1. Name: Long press or tap item name / empty space to show option to view details */}
                        <td
                          className="py-3.5 px-3 sm:px-4 font-sans relative cursor-pointer select-none group"
                          onTouchStart={(e) => handleTouchStart(p.id, e)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                          onMouseDown={() => startLongPress(p.id)}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOptionMenuProductId(p.id);
                          }}
                          onClick={() => {
                            if (expandedDetailsId === p.id) {
                              setExpandedDetailsId(null);
                              setOptionMenuProductId(null);
                            } else if (optionMenuProductId === p.id) {
                              setOptionMenuProductId(null);
                            } else {
                              setOptionMenuProductId(p.id);
                            }
                          }}
                          title="Long press or tap to view details"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-semibold text-slate-100 truncate text-[13px] sm:text-[15px]">
                              {p.name}
                            </span>
                            {expandedDetailsId === p.id ? (
                              <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
                            )}
                          </div>
                          {!p.isMeasured && p.unit !== 'KG' && p.unit !== 'VALUE_KES' && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 tracking-tight">
                              KES {(p.sellingPrice || 0).toLocaleString()}
                            </div>
                          )}

                          {/* Subtle Option Popup Menu when longpressed or tapped */}
                          {optionMenuProductId === p.id && (
                            <div
                              className="absolute left-3 top-full mt-1 z-30 bg-[#161F30] border border-emerald-500/60 shadow-2xl rounded-xl p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDetailsId(expandedDetailsId === p.id ? null : p.id);
                                  setOptionMenuProductId(null);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                              >
                                <Info className="w-3.5 h-3.5" />
                                <span>{expandedDetailsId === p.id ? 'Hide Details' : 'View Details'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOptionMenuProductId(null);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Close"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 2. Opening Stock */}
                        <td
                          className="py-3 px-2 sm:px-2.5 text-center font-mono font-semibold text-slate-200 cursor-pointer hover:bg-slate-800/40 transition-colors group relative"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditOpeningProductId(p.id);
                            setEditOpeningInput(String(row.openingStock));
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditOpeningProductId(p.id);
                            setEditOpeningInput(String(row.openingStock));
                          }}
                          title="Click to readjust opening stock"
                        >
                          <span className="underline decoration-dotted decoration-slate-500 underline-offset-4 group-hover:text-amber-300 transition-colors text-[13px] sm:text-sm">
                            {row.openingStock !== undefined ? row.openingStock : 0}
                          </span>
                        </td>

                        {/* 3. Add Stock Input */}
                        <td
                          className={`py-2.5 px-1.5 sm:px-2 text-center transition-colors ${row.addedStock < 0 ? 'bg-rose-950/20' : row.addedStock > 0 ? 'bg-emerald-950/15' : ''}`}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onContextMenu={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={cellInputStrings[p.id]?.added !== undefined ? cellInputStrings[p.id]?.added : (row.addedStock !== undefined && row.addedStock !== 0 ? String(row.addedStock) : '')}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleCellBlur(p.id, 'added')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^-?\d*\.?\d*$/.test(val)) {
                                handleCellChange(p.id, 'added', val);
                              }
                            }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.stopPropagation()}
                            placeholder="0"
                            title="Add stock (+ or enter negative e.g. -5 to subtract)"
                            className={`w-15 sm:w-18 text-center py-2 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none transition-colors ${
                              (cellInputStrings[p.id]?.added !== undefined && cellInputStrings[p.id]?.added?.startsWith('-')) || (cellInputStrings[p.id]?.added === undefined && row.addedStock < 0)
                                ? 'border-rose-600/70 text-rose-300 bg-rose-950/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : (cellInputStrings[p.id]?.added !== undefined && parseFloat(cellInputStrings[p.id]?.added || '0') > 0) || (cellInputStrings[p.id]?.added === undefined && row.addedStock > 0)
                                ? 'border-emerald-600/70 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                : 'border-slate-800 text-slate-300 placeholder:text-slate-600 focus:border-slate-600'
                            }`}
                          />
                          {/* If stock is reduced (< 0), show subtle trigger button for optional note */}
                          {row.addedStock < 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReductionNoteProductId(reductionNoteProductId === p.id ? null : p.id);
                              }}
                              className={`mt-1 text-[10px] sm:text-[11px] font-sans flex items-center justify-center gap-1 mx-auto px-1.5 py-0.5 rounded transition-all max-w-[90px] cursor-pointer ${
                                row.adjustmentNote
                                  ? 'text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/50'
                                  : 'text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40'
                              }`}
                              title={row.adjustmentNote ? `Reason: ${row.adjustmentNote}` : 'Add note for reduction'}
                            >
                              <FileText className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">
                                {row.adjustmentNote ? row.adjustmentNote : '+ note'}
                              </span>
                            </button>
                          )}
                        </td>

                        {/* Read-only Total Stock Column */}
                        <td className="py-3 px-2 sm:px-2.5 text-center font-mono font-bold text-emerald-400 text-xs sm:text-sm bg-emerald-950/5">
                          {row.totalStock}
                        </td>

                        {/* 3. Closing Stock Input */}
                        <td
                          className="py-2.5 px-2 sm:px-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onContextMenu={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            min="0"
                            value={cellInputStrings[p.id]?.closing !== undefined ? cellInputStrings[p.id]?.closing : (row.closingStock !== undefined ? row.closingStock : '')}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleCellBlur(p.id, 'closing')}
                            onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
                            onTouchStart={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.stopPropagation()}
                            title="Closing stock count at shift handover"
                            className={`w-15 sm:w-18 text-center py-2 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${row.hasClosingEntered ? "border-slate-500 text-white font-bold" : "border-slate-800 text-slate-400 focus:border-slate-600"}`}
                          />
                        </td>

                        {/* Read-only Sold Units Column */}
                        <td className="py-3 px-2 sm:px-2.5 text-center font-mono font-bold text-sky-400 text-xs sm:text-sm bg-sky-950/5">
                          {row.hasClosingEntered ? row.salesUnits : '-'}
                        </td>

                        {/* 4. Amount (Expected sales for that item) */}
                        <td className="py-3 px-3 sm:px-4 text-right font-mono font-semibold">
                          <span className={row.amountKes > 0 ? "text-emerald-400 font-bold text-xs sm:text-sm" : "text-slate-500 text-xs sm:text-sm"}>
                            {row.amountKes > 0 ? `KES ${row.amountKes.toLocaleString()}` : "KES 0"}
                          </span>
                        </td>
                      </tr>

                      {/* Minimal subtle form for optional note when stock is reduced */}
                      {reductionNoteProductId === p.id && row.addedStock < 0 && (
                        <tr key={`${p.id}-reduction-note`} className="bg-rose-950/20 border-b border-rose-900/40 animate-in fade-in duration-150">
                          <td colSpan={5} className="py-2.5 px-3 sm:px-4">
                            <div className="p-3 rounded-xl bg-[#111726] border border-rose-800/50 flex items-center gap-2 font-sans shadow-md">
                              <input
                                type="text"
                                value={noteInputStrings[p.id] !== undefined ? noteInputStrings[p.id] : (row.adjustmentNote || '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNoteInputStrings((prev) => ({ ...prev, [p.id]: val }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = noteInputStrings[p.id] !== undefined ? noteInputStrings[p.id] : (row.adjustmentNote || '');
                                    handleSaveReductionNote(p.id, val);
                                  }
                                }}
                                placeholder="Optional note..."
                                className="flex-1 bg-[#090D14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = noteInputStrings[p.id] !== undefined ? noteInputStrings[p.id] : (row.adjustmentNote || '');
                                  handleSaveReductionNote(p.id, val);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
                              >
                                Save
                              </button>
                              {row.adjustmentNote && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveReductionNote(p.id, '')}
                                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setReductionNoteProductId(null)}
                                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer shrink-0"
                              >
                                Skip
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Minimal subtle drop-down directly beneath product row */}
                      {expandedDetailsId === p.id && (
                        <tr key={`${p.id}-dropdown`} className="bg-[#0b0e14]/90 border-b border-slate-800/80 animate-in fade-in duration-150">
                          <td colSpan={5} className="py-3 px-3 sm:px-4">
                            <div className="p-3.5 rounded-xl bg-[#111622] border border-[#1E2638] space-y-2.5 text-xs sm:text-[13px] font-sans shadow-inner">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                <span className="font-semibold text-slate-100 text-xs sm:text-sm flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                  {p.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDetailsId(null)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>Close</span>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
                                  <div className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">Price</div>
                                  <div className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5">
                                    {row.isValue ? 'By Value' : `KES ${row.sellingPrice.toLocaleString()}`}
                                  </div>
                                </div>

                                <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
                                  <div className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">Category</div>
                                  <div className="font-mono text-slate-200 text-xs sm:text-sm mt-0.5 truncate">
                                    {p.category || 'General'}
                                  </div>
                                </div>

                                <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
                                  <div className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">Sold Stock</div>
                                  <div className="font-mono font-bold text-emerald-400 text-xs sm:text-sm mt-0.5">
                                    {row.hasClosingEntered
                                      ? row.isValue
                                        ? `KES ${row.salesUnits.toLocaleString()}`
                                        : `${row.salesUnits} units`
                                      : '0 (pending closing)'}
                                  </div>
                                </div>

                                <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
                                  <div className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">
                                    {row.addedStock < 0 ? 'Stock Reduced' : 'Stock Added'}
                                  </div>
                                  <div className={`font-mono font-bold text-xs sm:text-sm mt-0.5 ${row.addedStock > 0 ? 'text-emerald-400' : row.addedStock < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                    {row.addedStock > 0 ? `+${row.addedStock}` : row.addedStock < 0 ? row.addedStock : '0'} {row.isValue ? 'KES' : 'units'}
                                  </div>
                                  {row.adjustmentNote && (
                                    <div className="text-[11px] text-amber-300 font-sans mt-1 truncate" title={row.adjustmentNote}>
                                      Note: {row.adjustmentNote}
                                    </div>
                                  )}
                                </div>

                                {row.ssi?.ownerAdjustments !== undefined && row.ssi.ownerAdjustments !== 0 && (
                                  <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80 col-span-2 sm:col-span-4 flex items-center justify-between">
                                    <span className="text-[11px] text-slate-400 uppercase font-mono">Owner Audit Adjust</span>
                                    <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm">
                                      {row.ssi.ownerAdjustments > 0 ? `+${row.ssi.ownerAdjustments}` : row.ssi.ownerAdjustments}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Grand Totals Footer */}
            <tfoot className="bg-[#0D1117] font-mono text-xs sm:text-sm font-bold border-t border-[#1E2638]">
              <tr>
                <td className="py-3 px-3 sm:px-4 text-white">
                  TOTAL
                </td>
                <td className="py-3 px-2 sm:px-2.5"></td>
                <td className="py-3 px-2 sm:px-2.5"></td>
                <td className="py-3 px-2 sm:px-2.5"></td>
                <td className="py-3 px-2 sm:px-2.5"></td>
                <td className="py-3 px-2 sm:px-2.5"></td>
                <td className="py-3 px-3 sm:px-4 text-right text-emerald-400">
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
     <div className="bg-[#111622] border border-[#1E2638] rounded-2xl overflow-hidden shadow-sm max-w-sm">
       <button
         type="button"
         onClick={() => setIsExpenseListExpanded((prev) => !prev)}
         className="w-full p-3 bg-[#0D1117] flex items-center justify-between text-left hover:bg-[#131A26] transition-colors cursor-pointer"
         aria-expanded={isExpenseListExpanded}
       >
         <div className="flex items-center gap-2">
           {isExpenseListExpanded ? (
             <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
           ) : (
             <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
           )}
         </div>
         <span className="text-xs font-mono font-bold text-rose-400">
           KES {totalExpenses.toLocaleString()}
         </span>
       </button>

       {isExpenseListExpanded && (
         <div className="overflow-x-auto border-t border-[#1E2638]">
         <table className="w-full text-left text-xs border-collapse">
           <tbody className="divide-y divide-slate-800/50 text-xs">
             {expenses.map((exp) => (
               <tr 
                 key={exp.id} 
                 className="hover:bg-slate-800/20 transition-colors select-none group relative"
                 onMouseDown={() => startExpenseLongPress(exp.id)}
                 onMouseUp={cancelExpenseLongPress}
                 onMouseLeave={cancelExpenseLongPress}
                 onTouchStart={(e) => handleExpenseTouchStart(exp.id, e)}
                 onTouchEnd={cancelExpenseLongPress}
                 onTouchMove={handleExpenseTouchMove}
               >
                 <td className="py-2.5 px-3.5">
                   <div className="flex flex-col">
                     <span className="font-semibold text-slate-100 font-sans">{exp.description}</span>
                     <span className="text-[10px] text-slate-500 font-mono">
                       {exp.timestamp
                         ? new Date(exp.timestamp).toLocaleTimeString([], {
                             hour: '2-digit',
                             minute: '2-digit',
                           })
                         : '-'}
                     </span>
                   </div>
                 </td>
                 <td className="py-2.5 px-3 text-right font-bold text-rose-400 font-mono">
                   KES {exp.amount.toLocaleString()}
                 </td>
                 <td className="py-2.5 px-2 text-center w-12">
                   {deletingExpenseId === exp.id && (
                     <button
                       type="button"
                       onClick={() => handleDeleteExpense(exp)}
                       className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-500 transition-colors animate-in zoom-in duration-150"
                       title="Delete"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
         </div>
       )}
     </div>
   )}

   {/* 2. Inline Expense Form (Forms right above the '+ Add Expense' button when toggled) */}
   {isInlineExpenseOpen && (
     <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-4 shadow-lg space-y-3.5 animate-in fade-in duration-150 max-w-sm">

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

   {/* 3. The 'Add Expense' Button Row (Compact Ghost Icon Button) */}
   <div className="flex items-center gap-2">
     <button
       type="button"
       onClick={() => setIsInlineExpenseOpen((prev) => !prev)}
       title={isInlineExpenseOpen ? 'Close expense form' : 'Add shift expense'}
       aria-label={isInlineExpenseOpen ? 'Close expense form' : 'Add shift expense'}
       className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
         isInlineExpenseOpen
           ? 'bg-[#1C273E] border-amber-500/50 text-amber-300 ring-1 ring-amber-500/20'
           : 'bg-[#111622] hover:bg-[#161F30] border-[#1E2638] hover:border-slate-700 text-slate-400 hover:text-amber-400'
       }`}
     >
       <Receipt className="w-4 h-4" />
     </button>
   </div>
 </div>

 {/* Subtly show Expected Amount */}

 <div className="flex justify-start px-1 mt-2 mb-1">

   <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 font-mono">

     Expected: kes {(cashFloat + mpesaFloat + summaryTotals.totalAmount - totalExpenses).toLocaleString()}

   </span>

 </div>



 {/* 2. Isolated Shift Submission Bar (Minimal bottom-left cash/mpesa form + compact bottom-right End Shift button) */}
 <div className="mt-5 pt-4 border-t border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
   {/* Minimal Simple Entry Form on Bottom-Left */}
   <div className="flex items-center gap-4">
     <div className="flex items-center gap-2">
       <label className="text-xs font-medium text-slate-400 select-none">Cash:</label>
       <input
         type="number"
         step="any"
         min="0"
         value={closingCashInput}
         onChange={(e) => setClosingCashInput(e.target.value)}
         className="w-24 sm:w-28 bg-[#0D1117] border border-slate-800 focus:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
       />
     </div>

     <div className="flex items-center gap-2">
       <label className="text-xs font-medium text-slate-400 select-none">Mpesa:</label>
       <input
         type="number"
         step="any"
         min="0"
         value={closingMpesaInput}
         onChange={(e) => setClosingMpesaInput(e.target.value)}
         className="w-24 sm:w-28 bg-[#0D1117] border border-slate-800 focus:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
       />
     </div>
   </div>

   {/* Compact 1/4 Size End Shift Button on Bottom-Right */}
   <div className="flex justify-end">
     <button
       type="button"
       onClick={() => {
         if (!isDrawerFilled) {
           showToast('Please enter both Cash and Mpesa before ending shift.');
           return;
         }
         setShowCloseModal(true);
       }}
       disabled={!isDrawerFilled}
       title={!isDrawerFilled ? 'Fill Cash and Mpesa to end shift' : 'End Shift'}
       className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
     >
       <LogOut className="w-3.5 h-3.5" />
       <span>End Shift</span>
     </button>
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
  {/* 6. MODAL: CLOSE SHIFT CONFIRMATION (MINIMAL) */}
  {/* ============================================================ */}
  {showCloseModal && activeShift && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111622] border border-[#1E2638] rounded-2xl p-6 shadow-xl space-y-6 text-center">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white tracking-tight">Are you sure?</h2>
          <p className={`text-xs font-mono font-bold ${
            financialVariance === 0 ? 'text-emerald-500' : 
            financialVariance < 0 ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {financialVariance === 0 ? 'Matched' : 
             financialVariance < 0 ? `Short: ${Math.abs(financialVariance).toLocaleString()}` : 
             `Tip: ${financialVariance.toLocaleString()}`}
          </p>
        </div>
        
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={() => setShowCloseModal(false)}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmCloseShift}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Confirm
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
