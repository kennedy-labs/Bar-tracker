import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Shift, Product, ShiftStockItem, Expense, ExpenseCategory, StockAdditionRecord } from '../../types';
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
  Banknote,
  Plus,
  Minus,
  Edit2,
} from 'lucide-react';
import { WeightCalculatorModal } from '../common/WeightCalculatorModal';
import { useBackHandler } from '../../services/navigationHistory';

const DEFAULT_REASON_STRINGS = new Set([
  'stock addition',
  'stock reduction',
  'store restock delivery',
  'stock restock delivery',
  'restock / delivery',
  'restock',
  'delivery',
  'counter sheet restock',
  'counter sheet reduction',
  'returned to store / recount',
  'returned / recount',
  'central warehouse / storekeeper',
]);

const isDefaultReason = (reason?: string | null): boolean => {
  if (!reason || !reason.trim()) return true;
  return DEFAULT_REASON_STRINGS.has(reason.trim().toLowerCase());
};

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

  // Phone back-button integration: undoes modal opening & returns to counter sheet
  useBackHandler(showExpenseModal, () => setShowExpenseModal(false), 'worker-expense-modal');
  useBackHandler(isInlineExpenseOpen, () => setIsInlineExpenseOpen(false), 'worker-inline-expense');
  useBackHandler(showCloseModal, () => setShowCloseModal(false), 'worker-close-modal');
  useBackHandler(showWeightModal, () => setShowWeightModal(false), 'worker-weight-modal');

 // New shift opening inputs if no active shift
 const [openingCashInput, setOpeningCashInput] = useState<string>('0');
 const [openingMpesaInput, setOpeningMpesaInput] = useState<string>('0');
 const [adjustmentModes, setAdjustmentModes] = useState<Record<string, 'ADD' | 'SUBTRACT'>>({});

 // Selected item for soft missing details modal (Price, Category, Sold Stock)
 // Inline collapsible details drop-down row & option menu popup
 const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
 useBackHandler(Boolean(expandedDetailsId), () => {
   setExpandedDetailsId(null);
 }, 'worker-item-details');

 // Selected item for adjusting opening stock during an active shift
 const [editOpeningProductId, setEditOpeningProductId] = useState<string | null>(null);
 const [editOpeningInput, setEditOpeningInput] = useState<string>('');
 useBackHandler(Boolean(editOpeningProductId), () => setEditOpeningProductId(null), 'worker-edit-opening');

  // Mini Add Input State (medium + icon near item name)
  const [miniAddProductId, setMiniAddProductId] = useState<string | null>(null);
  const [miniAddQty, setMiniAddQty] = useState<string>('');
  const [miniAddMode, setMiniAddMode] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [miniAddNote, setMiniAddNote] = useState<string>('');
  const miniAddContainerRef = useRef<HTMLDivElement | null>(null);
  const miniAddProductIdRef = useRef<string | null>(miniAddProductId);
  miniAddProductIdRef.current = miniAddProductId;
  const miniAddQtyRef = useRef<string>(miniAddQty);
  miniAddQtyRef.current = miniAddQty;
  const miniAddModeRef = useRef<'ADD' | 'SUBTRACT'>(miniAddMode);
  miniAddModeRef.current = miniAddMode;
  const miniAddNoteRef = useRef<string>(miniAddNote);
  miniAddNoteRef.current = miniAddNote;

  useBackHandler(Boolean(miniAddProductId), () => {
    if (miniAddProductIdRef.current) {
      setMiniAddProductId(null);
    }
  }, 'worker-mini-add');

  // Manage Added Events Modal State (options: edit and delete)
  const [manageEventsProductId, setManageEventsProductId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventQty, setEditingEventQty] = useState<string>('');
  const [editingEventReason, setEditingEventReason] = useState<string>('');
  useBackHandler(Boolean(manageEventsProductId), () => {
    setManageEventsProductId(null);
    setEditingEventId(null);
  }, 'worker-manage-additions');


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


  const [closingCoinsInput, setClosingCoinsInput] = useState<string>("");
  const [isMoneyDropdownOpen, setIsMoneyDropdownOpen] = useState<boolean>(false);
 // Closing cash & M-pesa inputs for handover modal
 const [closingCashInput, setClosingCashInput] = useState<string>('');
 const [closingMpesaInput, setClosingMpesaInput] = useState<string>('');
 const [closingNotesInput, setClosingNotesInput] = useState<string>('');

 // Minimal subtle form state for optional stock reduction note
 const [reductionNoteProductId, setReductionNoteProductId] = useState<string | null>(null);
 const [noteInputStrings, setNoteInputStrings] = useState<Record<string, string>>({});

 // Long-press state on Closing column header for autofilling unsold drinks
 const [showAutofillClosing, setShowAutofillClosing] = useState<boolean>(false);
 const closingHeaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const closingHeaderTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
 const closingHeaderLongPressedRef = useRef<boolean>(false);

 useBackHandler(Boolean(showAutofillClosing), () => setShowAutofillClosing(false), 'worker-autofill-closing');

 const startClosingHeaderPress = () => {
   if (closingHeaderTimerRef.current) clearTimeout(closingHeaderTimerRef.current);
   closingHeaderLongPressedRef.current = false;
   closingHeaderTimerRef.current = setTimeout(() => {
     closingHeaderLongPressedRef.current = true;
     try {
       if (typeof window !== 'undefined' && 'vibrate' in navigator) {
         navigator.vibrate?.(50);
       }
     } catch (_) {}
     setShowAutofillClosing(true);
   }, 400);
 };

 const cancelClosingHeaderPress = () => {
   if (closingHeaderTimerRef.current) {
     clearTimeout(closingHeaderTimerRef.current);
     closingHeaderTimerRef.current = null;
   }
 };

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
 const stockAdditions: StockAdditionRecord[] = activeShift ? store.getStockAdditions(activeShift.id) : [];

 const currentDateStr = new Date().toLocaleDateString(undefined, {
   weekday: 'short',
   month: 'short',
   day: 'numeric',
 });

 const shiftStartTime = activeShift?.openedAt || (activeShift as any)?.startTime;
 const shiftStartTimeStr = shiftStartTime
   ? (() => {
       try {
         return new Date(shiftStartTime).toLocaleTimeString(undefined, {
           hour: '2-digit',
           minute: '2-digit',
         });
       } catch {
         return '';
       }
     })()
   : '';

 const commitOrCancelMiniAdd = (productId?: string | null) => {
   const targetId = productId || miniAddProductIdRef.current;
   if (!targetId) return;

   const trimmed = miniAddQtyRef.current.trim();
   const qty = parseFloat(trimmed);

   if (activeShift && !isNaN(qty) && qty > 0) {
     try {
       const mode = miniAddModeRef.current;
       const note = miniAddNoteRef.current.trim();
       store.recordStockAdjustment({
         shiftId: activeShift.id,
         productId: targetId,
         quantity: qty,
         type: mode === 'SUBTRACT' ? 'REDUCE' : 'ADD',
         reason: note || '',
         workerName: currentUser.name || activeShift.workerName,
       });
       showToast(mode === 'SUBTRACT' ? `Reduced -${qty}` : `Added +${qty}`);
     } catch (err: any) {
       showToast(err.message || 'Error recording stock');
     }
   }

   setMiniAddProductId(null);
   setMiniAddQty('');
   setMiniAddNote('');
   setMiniAddMode('ADD');
 };

 const handleToggleMiniAdd = (productId: string) => {
   if (miniAddProductId === productId) {
     commitOrCancelMiniAdd(productId);
   } else {
     if (miniAddProductId) {
       commitOrCancelMiniAdd(miniAddProductId);
     }
     setMiniAddProductId(productId);
     setMiniAddQty('');
     setMiniAddMode('ADD');
     setMiniAddNote('');
   }
 };

 const handleSaveMiniAdd = (productId: string) => {
   commitOrCancelMiniAdd(productId);
 };

 // Outside click/touch listener: saves if input has a valid quantity, or cancels if empty
 useEffect(() => {
   if (!miniAddProductId) return;

   const handleOutsidePress = (e: MouseEvent | TouchEvent) => {
     if (
       miniAddContainerRef.current &&
       !miniAddContainerRef.current.contains(e.target as Node)
     ) {
       commitOrCancelMiniAdd(miniAddProductIdRef.current);
     }
   };

   const timer = setTimeout(() => {
     document.addEventListener('mousedown', handleOutsidePress, true);
     document.addEventListener('touchstart', handleOutsidePress, true);
   }, 40);

   return () => {
     clearTimeout(timer);
     document.removeEventListener('mousedown', handleOutsidePress, true);
     document.removeEventListener('touchstart', handleOutsidePress, true);
   };
 }, [miniAddProductId, activeShift, currentUser]);

 const handleDeleteEvent = (additionId: string) => {
   try {
     store.deleteStockAddition(additionId);
     showToast('Stock event removed');
   } catch (err: any) {
     showToast(err.message || 'Error removing event');
   }
 };

 const handleSaveEditEvent = (additionId: string) => {
   const qty = parseFloat(editingEventQty.trim());
   if (isNaN(qty) || qty === 0) {
     showToast('Enter a valid quantity');
     return;
   }
   try {
     store.updateStockAddition(additionId, {
       quantity: qty,
       reason: editingEventReason.trim(),
     });
     setEditingEventId(null);
     showToast('Event updated');
   } catch (err: any) {
     showToast(err.message || 'Error updating event');
   }
 };

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
    Record<string, { opening?: string; added?: string; closing?: string; sales?: string }>
  >({});


 // Extract categories for clean filter tabs
 const categories = useMemo(() => {
 const set = new Set<string>();
 products.forEach((p) => {
 if (p.category) set.add(p.category.trim());
 });
 return Array.from(set).sort();
 }, [products]);

  // Computed row data for each beverage (matches owner page product order)
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

      // 2. Added stock: real-time sum of confirmed addition events for this drink
      const productAdditions = stockAdditions.filter((a) => a.productId === product.id);
      const addedStock = productAdditions.length > 0
        ? productAdditions.reduce((sum, a) => sum + Number(a.quantity || 0), 0)
        : (ssi?.additions !== undefined ? ssi.additions : 0);
      const ownerAdjustments = ssi?.ownerAdjustments !== undefined ? ssi.ownerAdjustments : 0;

      // 3. Total stock = Opening + Added + TransfersIn - TransfersOut - Damages + OwnerAdjustments
      const totalStock =
        Number(openingStock || 0) +
        Number(addedStock || 0) +
        Number(ssi?.transfersIn || 0) -
        Number(ssi?.transfersOut || 0) -
        Number(ssi?.damages || 0) +
        Number(ownerAdjustments || 0);

      // 4. Sales and Closing stock: real-time live from cell inputs
      let salesUnits = 0;
      let closingStock: number | undefined = undefined;
      let hasOverage = false;

      const rawSales = cellInputStrings[product.id]?.sales;
      const rawClosing = cellInputStrings[product.id]?.closing;

      if (rawSales !== undefined) {
        const trimmedSales = rawSales.trim();
        if (trimmedSales !== '') {
          const parsed = parseFloat(trimmedSales);
          if (!isNaN(parsed)) {
            // Enforce rule: cannot sell more than total stock
            salesUnits = Math.min(totalStock, Math.max(0, parsed));
            closingStock = Math.max(0, totalStock - salesUnits);
          }
        }
      } else if (rawClosing !== undefined) {
        const trimmedClosing = rawClosing.trim();
        if (trimmedClosing !== '') {
          const parsed = parseFloat(trimmedClosing);
          if (!isNaN(parsed)) {
            closingStock = Math.max(0, parsed);
            salesUnits = Math.round(Math.max(0, totalStock - closingStock) * 100) / 100;
          }
        }
      } else if (ssi?.closingPhysicalCount !== undefined) {
        closingStock = ssi.closingPhysicalCount;
        salesUnits = Math.round(Math.max(0, totalStock - closingStock) * 100) / 100;
      }

      if (closingStock !== undefined && closingStock > totalStock) {
        hasOverage = true;
      }

      // 5. Amount (Sales Revenue)
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
    return list;
  }, [products, shiftStockItems, inventory, activeShift, cellInputStrings, stockAdditions]);

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

 const unfilledRows = useMemo(() => {
   return rowDataList.filter((r) => !r.hasClosingEntered);
 }, [rowDataList]);

 const handleAutofillUnsold = () => {
   if (!activeShift) return;
   setShowAutofillClosing(false);

   const itemsToUpdate = rowDataList.filter((r) => !r.hasClosingEntered);
   if (itemsToUpdate.length === 0) return;

   const updates: Array<{ productId: string; closingPhysicalCount: number }> = [];
   const nextStrings = { ...cellInputStrings };

   itemsToUpdate.forEach((row) => {
     const val = row.totalStock;
     updates.push({
       productId: row.product.id,
       closingPhysicalCount: val,
     });
     nextStrings[row.product.id] = {
       ...nextStrings[row.product.id],
       closing: String(val),
     };
   });

   setCellInputStrings(nextStrings);
   store.bulkUpdateShiftClosingStock(activeShift.id, updates);
 };

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

  // Handle cell edit - instant local keystrokes, no premature network sync
  const handleCellChange = (
    productId: string,
    field: 'opening' | 'added' | 'closing' | 'sales',
    valueStr: string
  ) => {
    // Pure local update: immediate math (Total, Sales, Closing, Amount, Footer) on every keystroke with 0ms lag
    setCellInputStrings((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: valueStr,
      },
    }));
  };

  const handleCellBlur = (productId: string, field: 'opening' | 'added' | 'closing' | 'sales') => {
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

    const ssi = shiftStockItems.find((s) => s.productId === productId);

    if (field === 'opening') {
      const currentVal = ssi?.openingPhysicalCount ?? 0;
      const targetVal = num !== undefined ? num : 0;
      if (currentVal !== targetVal) {
        store.updateShiftStockItemRow({
          shiftId: activeShift.id,
          productId,
          openingPhysicalCount: targetVal,
        });
      }
    } else if (field === 'added') {
      const currentVal = ssi?.additions ?? 0;
      const targetVal = num !== undefined ? num : 0;
      if (currentVal !== targetVal) {
        store.updateShiftStockItemRow({
          shiftId: activeShift.id,
          productId,
          additions: targetVal,
        });
        // When attendant reduces stock (< 0), open minimal subtle prompt for optional note
        if (targetVal < 0) {
          setReductionNoteProductId(productId);
        } else if (targetVal >= 0 && reductionNoteProductId === productId) {
          setReductionNoteProductId(null);
        }
      }
    } else if (field === 'sales') {
      const row = rowDataList.find((r) => r.product.id === productId);
      const totalStock = row ? row.totalStock : (ssi?.openingPhysicalCount || 0) + (ssi?.additions || 0);
      
      // Enforce the rule: cap sales at totalStock
      let finalSales = num;
      if (finalSales !== undefined && finalSales > totalStock) {
        finalSales = totalStock;
      }
      
      const targetClosing = finalSales !== undefined ? Math.max(0, totalStock - finalSales) : undefined;
      const currentVal = ssi?.closingPhysicalCount;
      if (currentVal !== targetClosing) {
        store.updateShiftStockItemRow({
          shiftId: activeShift.id,
          productId,
          closingPhysicalCount: targetClosing,
        });
      }
      // Update num so the formatted value in cellInputStrings is capped
      num = finalSales;
    } else if (field === 'closing') {
      const currentVal = ssi?.closingPhysicalCount;
      if (currentVal !== num) {
        store.updateShiftStockItemRow({
          shiftId: activeShift.id,
          productId,
          closingPhysicalCount: num,
        });
      }
    }

    // Retain the formatted value in cellInputStrings and clear the opposing field to prevent collision
    setCellInputStrings((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      const updated = { ...current };
      updated[field] = num !== undefined ? String(num) : '';
      if (field === 'sales') {
        delete updated.closing;
      } else if (field === 'closing') {
        delete updated.sales;
      }
      return {
        ...prev,
        [productId]: updated,
      };
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

  // Financial reconciliation math
  const rawOpeningCoins = activeShift?.openingCoinsFloat;
  const rawOpeningCash = activeShift?.openingCashFloat || 0;
  // If openingCoinsFloat was not explicitly recorded or is 0, but openingCashFloat was set (from pre-split shifts),
  // use openingCashFloat as the coinsFloat and zero out cashFloat so money isn't double-counted
  const coinsFloat = (rawOpeningCoins !== undefined && rawOpeningCoins > 0)
    ? rawOpeningCoins
    : rawOpeningCash;
  const cashFloat = (rawOpeningCoins !== undefined && rawOpeningCoins > 0)
    ? rawOpeningCash
    : 0;
  const mpesaFloat = activeShift?.openingMpesaBalance || 0;
  const parsedCoinsActual = closingCoinsInput.trim() !== "" ? parseFloat(closingCoinsInput) || 0 : 0;
  const parsedCashActual = closingCashInput.trim() !== '' ? parseFloat(closingCashInput) || 0 : 0;
  const parsedMpesaClosing = closingMpesaInput.trim() !== '' ? parseFloat(closingMpesaInput) || 0 : 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netCoinsCollected = closingCoinsInput.trim() !== "" ? parsedCoinsActual - coinsFloat : 0;
  const netCashCollected = closingCashInput.trim() !== '' ? parsedCashActual - cashFloat : 0;
  const netMpesaCollected = closingMpesaInput.trim() !== '' ? parsedMpesaClosing - mpesaFloat : 0;
  const totalMoneyCollected = netCoinsCollected + netCashCollected + netMpesaCollected;

  const hasEnteredDrawer = closingCoinsInput.trim() !== '' || closingCashInput.trim() !== '' || closingMpesaInput.trim() !== '';
  const isDrawerFilled = closingCoinsInput.trim() !== '' && closingCashInput.trim() !== '' && closingMpesaInput.trim() !== '';
  const financialVariance = hasEnteredDrawer
    ? (totalMoneyCollected + totalExpenses) - summaryTotals.totalAmount
    : 0;

 // Complete and close shift
 const handleConfirmCloseShift = () => {
 if (!activeShift) return;
 if (!isDrawerFilled) {
   showToast('Please enter Coins, Cash and Mpesa before submitting shift.');
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
  closingCoinsActual: parsedCoinsActual,
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
      onConfirmOpen={({ openingCoinsFloat, openingCashFloat, openingMpesaBalance, physicalCounts }: { openingCoinsFloat: number; openingCashFloat: number; openingMpesaBalance: number; physicalCounts: Record<string, number> }) => {
        store.openShift({
          workerId: currentUser.id,
          workerName: currentUser.name,
          openingCoinsFloat,
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
 

  {/* Date, Start Time & Search Bar */}
  <div className="flex flex-wrap items-center justify-between gap-2.5">
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="font-medium text-slate-200">{currentDateStr}</span>
      {shiftStartTimeStr && (
        <>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-mono">Started {shiftStartTimeStr}</span>
        </>
      )}
    </div>
    <div className="relative w-44 sm:w-60 shrink-0">
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
                <th className="py-3 px-2 sm:px-2.5 text-center font-bold text-sky-400 w-20 sm:w-24">
                  <div className="leading-tight">sales</div>
                </th>
                <th
                  className="py-3 px-2 sm:px-2.5 text-center font-bold text-slate-100 w-22 sm:w-26 select-none cursor-pointer active:bg-slate-800/60 transition-colors"
                  style={{
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    touchAction: 'manipulation',
                  }}
                  title="Tap or hold to autofill unsold drinks"
                  onClick={() => {
                    setShowAutofillClosing(true);
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 0) startClosingHeaderPress();
                  }}
                  onMouseUp={cancelClosingHeaderPress}
                  onMouseLeave={cancelClosingHeaderPress}
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    closingHeaderTouchStartPosRef.current = { x: t.clientX, y: t.clientY };
                    startClosingHeaderPress();
                  }}
                  onTouchMove={(e) => {
                    if (!closingHeaderTouchStartPosRef.current) return;
                    const t = e.touches[0];
                    const dx = Math.abs(t.clientX - closingHeaderTouchStartPosRef.current.x);
                    const dy = Math.abs(t.clientY - closingHeaderTouchStartPosRef.current.y);
                    if (dx > 25 || dy > 25) {
                      cancelClosingHeaderPress();
                    }
                  }}
                  onTouchEnd={(e) => {
                    cancelClosingHeaderPress();
                    if (closingHeaderLongPressedRef.current) {
                      e.preventDefault();
                    }
                  }}
                  onTouchCancel={cancelClosingHeaderPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowAutofillClosing(true);
                  }}
                >
                  <div className="leading-tight flex items-center justify-center gap-1">
                    <span>Closing</span>
                  </div>
                </th>
                <th className="py-3 px-3 sm:px-4 text-right font-bold text-slate-100 w-28 sm:w-32">
                  <div className="leading-tight">Amount</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-sans text-sm">
                    No beverages found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const p = row.product;

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="transition-colors hover:bg-slate-900/30">
                        {/* 1. Name: Item details */}
                        <td
                          className="py-3 px-3 sm:px-4 text-left group relative cursor-pointer hover:bg-slate-800/40 transition-colors"
                          onClick={() => setExpandedDetailsId(expandedDetailsId === p.id ? null : p.id)}
                          title="Click to toggle category"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-100 truncate text-[13px] sm:text-[15px]">
                              {p.name}
                            </span>
                            {expandedDetailsId === p.id && (
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                                {p.category || 'General'}
                              </span>
                            )}
                          </div>

                          {!p.isMeasured && p.unit !== 'KG' && p.unit !== 'VALUE_KES' && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 tracking-tight">
                              KES {(p.sellingPrice || 0).toLocaleString()}
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

                        {/* 3. Add Stock Column: Shows recorded events & the finger-comfortable + button */}
                        <td
                          className={`py-2 px-1.5 sm:px-2 text-center transition-colors relative ${
                            row.addedStock < 0 ? 'bg-rose-950/20' : row.addedStock > 0 ? 'bg-emerald-950/15' : ''
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {miniAddProductId === p.id ? (
                            <div
                              ref={miniAddContainerRef}
                              className="p-1.5 rounded-lg bg-[#090D14] border border-slate-700/90 flex flex-col items-center gap-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 cursor-default min-w-[70px] max-w-[95px] mx-auto z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* + icon sitting on TOP of the input field (tap or hold to toggle - for subtract) */}
                              <button
                                type="button"
                                onClick={() => setMiniAddMode((m) => (m === 'ADD' ? 'SUBTRACT' : 'ADD'))}
                                onMouseDown={(e) => {
                                  const timer = setTimeout(() => {
                                    setMiniAddMode((m) => (m === 'ADD' ? 'SUBTRACT' : 'ADD'));
                                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                      navigator.vibrate?.(40);
                                    }
                                  }, 450);
                                  (e.target as any)._pressTimer = timer;
                                }}
                                onMouseUp={(e) => clearTimeout((e.target as any)._pressTimer)}
                                onMouseLeave={(e) => clearTimeout((e.target as any)._pressTimer)}
                                onTouchStart={(e) => {
                                  const timer = setTimeout(() => {
                                    setMiniAddMode((m) => (m === 'ADD' ? 'SUBTRACT' : 'ADD'));
                                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                      navigator.vibrate?.(40);
                                    }
                                  }, 450);
                                  (e.target as any)._pressTimer = timer;
                                }}
                                onTouchEnd={(e) => clearTimeout((e.target as any)._pressTimer)}
                                className={`h-5 px-2 rounded font-bold text-xs flex items-center justify-center transition-all cursor-pointer select-none border leading-none shrink-0 ${
                                  miniAddMode === 'SUBTRACT'
                                    ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                                    : 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                                }`}
                                title="Tap or hold to switch between Add (+) and Subtract (-)"
                              >
                                {miniAddMode === 'SUBTRACT' ? '-' : '+'}
                              </button>

                              {/* Quantity input directly underneath + icon */}
                              <input
                                type="number"
                                step="any"
                                inputMode="decimal"
                                autoFocus
                                placeholder="0"
                                value={miniAddQty}
                                onChange={(e) => setMiniAddQty(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveMiniAdd(p.id);
                                  if (e.key === 'Escape') setMiniAddProductId(null);
                                }}
                                className={`w-14 h-7 text-center rounded-md bg-[#111622] border font-mono font-bold text-xs focus:outline-none transition-colors ${
                                  miniAddMode === 'SUBTRACT'
                                    ? 'border-rose-600/70 text-rose-300 focus:border-rose-500'
                                    : 'border-emerald-600/70 text-emerald-300 focus:border-emerald-500'
                                }`}
                              />

                              {/* Optional note when in subtract mode */}
                              {miniAddMode === 'SUBTRACT' && (
                                <input
                                  type="text"
                                  placeholder="Note (optional)"
                                  value={miniAddNote}
                                  onChange={(e) => setMiniAddNote(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveMiniAdd(p.id);
                                    if (e.key === 'Escape') setMiniAddProductId(null);
                                  }}
                                  className="w-full h-6 px-1.5 text-[10px] rounded-md bg-[#111622] border border-rose-800/60 text-rose-200 placeholder:text-rose-500/40 focus:outline-none focus:border-rose-500"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* Event pills (if any additions/reductions recorded) */}
                              {(() => {
                                const itemEvents = stockAdditions.filter((a) => a.productId === p.id);
                                if (itemEvents.length === 0) return null;

                                return (
                                  <div
                                    className="flex flex-wrap items-center justify-center gap-1 max-w-[120px] cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setManageEventsProductId(p.id);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setManageEventsProductId(p.id);
                                    }}
                                    onTouchStart={(e) => {
                                      e.stopPropagation();
                                      const timer = setTimeout(() => {
                                        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                          navigator.vibrate?.(40);
                                        }
                                        setManageEventsProductId(p.id);
                                      }, 450);
                                      (e.target as any)._pressTimer = timer;
                                    }}
                                    onTouchEnd={(e) => clearTimeout((e.target as any)._pressTimer)}
                                    onTouchMove={(e) => clearTimeout((e.target as any)._pressTimer)}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      const timer = setTimeout(() => {
                                        setManageEventsProductId(p.id);
                                      }, 450);
                                      (e.target as any)._pressTimer = timer;
                                    }}
                                    onMouseUp={(e) => clearTimeout((e.target as any)._pressTimer)}
                                    onMouseLeave={(e) => clearTimeout((e.target as any)._pressTimer)}
                                    title="Tap or long press to edit / delete events"
                                  >
                                    {itemEvents.map((ev) => (
                                      <span
                                        key={ev.id}
                                        className={`text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                          ev.quantity >= 0
                                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                            : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                                        }`}
                                        title={ev.reason && !isDefaultReason(ev.reason) ? ev.reason : (ev.quantity >= 0 ? `+${ev.quantity}` : `${ev.quantity}`)}
                                      >
                                        {ev.quantity >= 0 ? `+${ev.quantity}` : ev.quantity}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Simple plain white + sign with no padding */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleMiniAdd(p.id);
                                }}
                                title="Add stock"
                                className="p-0 bg-transparent border-0 text-white hover:text-slate-300 active:scale-90 text-lg sm:text-xl font-bold leading-none cursor-pointer select-none flex items-center justify-center mx-auto"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Read-only Total Stock Column */}
                        <td className="py-3 px-2 sm:px-2.5 text-center font-mono font-bold text-emerald-400 text-xs sm:text-sm bg-emerald-950/5">
                          {row.totalStock}
                        </td>

                        {/* 3. Sales Input */}
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
                            value={cellInputStrings[p.id]?.sales !== undefined ? cellInputStrings[p.id]?.sales : (cellInputStrings[p.id]?.closing !== undefined || row.closingStock !== undefined ? (row.salesUnits !== 0 ? String(row.salesUnits) : '') : '')}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleCellBlur(p.id, 'sales')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onChange={(e) => handleCellChange(p.id, 'sales', e.target.value)}
                            onTouchStart={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.stopPropagation()}
                            title="Sales quantity"
                            className={`w-15 sm:w-18 text-center py-2 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${cellInputStrings[p.id]?.sales !== undefined && cellInputStrings[p.id]?.sales !== '' ? "border-sky-500 text-sky-300 font-bold" : "border-slate-800 text-slate-300 focus:border-slate-600"}`}
                          />
                        </td>

                        {/* 4. Read-only Closing Stock Column */}
                        <td className="py-3 px-2 sm:px-2.5 text-center font-mono font-bold text-slate-200 text-xs sm:text-sm bg-slate-900/40">
                          {row.closingStock !== undefined ? row.closingStock : row.totalStock}
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
                          <td colSpan={7} className="py-2.5 px-3 sm:px-4">
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
 {/* 2. Isolated Shift Submission Bar (Minimal bottom-left cash/mpesa form + compact bottom-right End Shift button) */}
 <div className="mt-5 pt-4 border-t border-[#1E2638] space-y-3">
   {/* Subtly show Expected Amount */}
    <div className="flex flex-col gap-0.5 px-1">
      <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 font-mono">
        Coins: kes {coinsFloat.toLocaleString()}
      </span>
     <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 font-mono">
        Expected: kes {(coinsFloat + cashFloat + mpesaFloat + summaryTotals.totalAmount - totalExpenses).toLocaleString()}     </span>
   </div>

    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      {/* Vertical Mini Drop-down for Coins, Cash, M-Pesa */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMoneyDropdownOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer shadow-xs ${isMoneyDropdownOpen ? "bg-[#161F30] border-slate-700 text-white" : "bg-[#0D1117] hover:bg-[#131A26] border-slate-800 text-slate-300"}`}
          title={isMoneyDropdownOpen ? 'Close money inputs' : 'Open money inputs'}
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
          </div>
          {isDrawerFilled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          {isMoneyDropdownOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {isMoneyDropdownOpen && (
          <div className="mt-2 p-2 bg-[#0D1117] border border-[#1E2638] rounded-xl shadow-xl flex flex-col gap-2 w-fit animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Coins */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Coins className="w-3 h-3" />
              </div>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Coins"
                value={closingCoinsInput}
                onChange={(e) => setClosingCoinsInput(e.target.value)}
                className="w-24 bg-[#111622] border border-slate-800 focus:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            {/* Cash */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Banknote className="w-3 h-3" />
              </div>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Cash"
                value={closingCashInput}
                onChange={(e) => setClosingCashInput(e.target.value)}
                className="w-24 bg-[#111622] border border-slate-800 focus:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            {/* Mpesa */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                <Smartphone className="w-3 h-3" />
              </div>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Mpesa"
                value={closingMpesaInput}
                onChange={(e) => setClosingMpesaInput(e.target.value)}
                className="w-24 bg-[#111622] border border-slate-800 focus:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Compact 1/4 Size End Shift Button on Bottom-Right */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!isDrawerFilled) {
              setIsMoneyDropdownOpen(true);
              showToast('Please enter Coins, Cash and Mpesa before ending shift.');
              return;
            }
            setShowCloseModal(true);
          }}
          disabled={!isDrawerFilled}
          title={!isDrawerFilled ? 'Fill Coins, Cash and Mpesa to end shift' : 'End Shift'}
          className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>End Shift</span>
        </button>
      </div>
    </div>

 </div>
  </div>
 )}

 {/* Phone-first Floating Autofill Action Pill */}
 {showAutofillClosing && activeShift && (
   <>
     <div
       className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
       onClick={() => setShowAutofillClosing(false)}
       onTouchEnd={(e) => {
         e.preventDefault();
         setShowAutofillClosing(false);
       }}
     />
     <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-200">
       <div
         className="pointer-events-auto bg-[#161D2B] border border-[#2B3855] text-white rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 max-w-sm w-full mx-auto"
         onClick={(e) => e.stopPropagation()}
       >
         <div className="flex-1 min-w-0">
           <div className="text-xs font-bold text-slate-100 truncate">Autofill Unsold Drinks</div>
           <div className="text-[11px] text-slate-400">Match {unfilledRows.length} remaining drinks with total</div>
         </div>
         <div className="flex items-center gap-1.5 shrink-0">
           <button
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               handleAutofillUnsold();
             }}
             onTouchEnd={(e) => {
               e.stopPropagation();
               e.preventDefault();
               handleAutofillUnsold();
             }}
             className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
           >
             Fill ({unfilledRows.length})
           </button>
           <button
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               setShowAutofillClosing(false);
             }}
             onTouchEnd={(e) => {
               e.stopPropagation();
               e.preventDefault();
               setShowAutofillClosing(false);
             }}
             className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 active:bg-slate-700 cursor-pointer"
             title="Cancel"
           >
             ✕
           </button>
         </div>
       </div>
     </div>
   </>
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

   {/* MODAL: ADJUST OPENING STOCK FOR ACTIVE SHIFT */}
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

    {/* Weight & Keg Scale Valuation Modal */}
 <WeightCalculatorModal
   isOpen={showWeightModal}
   onClose={() => setShowWeightModal(false)}
 />

    {/* MODAL: MANAGE ADDED EVENTS (OPTIONS: EDIT AND DELETE) */}
    {manageEventsProductId && activeShift && (() => {
      const prod = products.find((p) => p.id === manageEventsProductId);
      const events = stockAdditions.filter((a) => a.productId === manageEventsProductId);
      if (!prod) return null;

      return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111622] border border-[#1E2638] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Added Events</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">{prod.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManageEventsProductId(null);
                  setEditingEventId(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No events recorded.</p>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-[#0D1117] border border-slate-800 flex items-center justify-between gap-2"
                  >
                    {editingEventId === ev.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={editingEventQty}
                            onChange={(e) => setEditingEventQty(e.target.value)}
                            placeholder="Qty"
                            className="w-20 px-2 py-1 rounded bg-[#111622] border border-slate-700 text-white font-mono font-bold text-xs"
                          />
                          <input
                            type="text"
                            value={editingEventReason}
                            onChange={(e) => setEditingEventReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 px-2 py-1 rounded bg-[#111622] border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingEventId(null)}
                            className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditEvent(ev.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              ev.quantity >= 0
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            {ev.quantity >= 0 ? `+${ev.quantity}` : ev.quantity}
                          </span>
                          <div className="flex flex-col min-w-0">
                            {ev.reason && !isDefaultReason(ev.reason) && (
                              <span className="text-xs text-slate-200 truncate">
                                {ev.reason}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEventId(ev.id);
                              setEditingEventQty(String(ev.quantity));
                              setEditingEventReason(isDefaultReason(ev.reason) ? '' : (ev.reason || ''));
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit event"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteEvent(ev.id);
                              if (events.length <= 1) {
                                setManageEventsProductId(null);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setManageEventsProductId(null);
                  setEditingEventId(null);
                }}
                className="py-1.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}
 </div>
 );
};
