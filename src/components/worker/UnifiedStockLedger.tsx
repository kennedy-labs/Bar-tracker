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
 ChevronDown,
 ChevronUp,
 AlertCircle,
 Info,
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

 // Selected / expanded row for viewing hidden details (Total, Sold, Sales, Profit, Cost)
 const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
 const trimmed = valueStr.trim();
 const parsed = trimmed === '' ? undefined : Math.max(0, parseFloat(trimmed));
 const num = parsed !== undefined && !isNaN(parsed) ? parsed : undefined;

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
 type="number" step="any"
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
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
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
 {/* Mobile Helpful Hint */}
 <div className="px-3.5 py-2 bg-[#0D1117] border-b border-[#1E2638] flex items-center justify-between text-[11px] text-slate-400">
 <div className="flex items-center gap-1.5">
 <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
 <span>Tap any beverage row to inspect live sales, revenue & profit breakdown.</span>
 </div>
 <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 bg-[#161F30] px-2 py-0.5 rounded-md">
 Editable: Opening · Add · Closing
 </span>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs border-collapse">
 <thead>
 <tr className="bg-[#0D1117] text-slate-400 font-mono text-[11px] border-b border-[#1E2638]">
 <th className="py-2.5 px-3 sm:px-3.5 font-semibold text-slate-300">Beverage</th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-semibold text-slate-300 w-20 sm:w-24">
 <div className="leading-tight">Opening</div>
 <div className="text-[9px] text-slate-400 font-normal hidden sm:block">Edit to reconcile</div>
 </th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-semibold text-slate-300 w-16 sm:w-20">
 <div className="leading-tight">Add</div>
 <div className="text-[9px] text-slate-400 font-normal hidden sm:block">Stock in</div>
 </th>
 <th className="py-2.5 px-1.5 sm:px-2 text-center font-semibold text-slate-300 w-20 sm:w-24">
 <div className="leading-tight">Closing</div>
 <div className="text-[9px] text-slate-400 font-normal hidden sm:block">Final count</div>
 </th>
 <th className="py-2.5 px-2 text-center font-semibold text-slate-300 w-12 sm:w-14">
 <span className="sr-only sm:not-sr-only text-[10px]">Details</span>
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
 const isExpanded = expandedItemId === p.id;
 const hasDiscrepancy = row.hasOverage;

 return (
 <React.Fragment key={p.id}>
 {/* Compact 3-Input Row */}
 <tr
 onClick={() => setExpandedItemId(isExpanded ? null : p.id)}
 className={`transition-colors cursor-pointer select-none ${isExpanded ? "bg-[#161F30]/70" : "hover:bg-slate-900/40"}`}
 >
 {/* 1. Beverage Name & Meta */}
 <td className="py-2.5 px-3 sm:px-3.5 font-sans">
 <div className="flex items-center gap-2">
 <div className="min-w-0">
 <div className="font-medium text-slate-100 truncate text-xs sm:text-sm">
 {p.name}
 </div>
 <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
 <span>KES {row.sellingPrice.toLocaleString()}</span>
 <span>·</span>
 <span className="text-slate-400 truncate">{p.category}</span>
 {row.salesUnits > 0 && !isExpanded && (
 <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-1 rounded text-[9px]">
 {row.salesUnits} sold
 </span>
 )}
 </div>
 </div>
 </div>
 </td>

 {/* 2. Opening Stock Input */}
 <td
 className="py-2 px-1.5 sm:px-2 text-center"
 onClick={(e) => e.stopPropagation()}
 >
 <input
 type="number" step="any"
 min="0"
 value={row.openingStock !== undefined ? row.openingStock : ''}
 onFocus={(e) => e.target.select()}
 onChange={(e) => handleCellChange(p.id, 'opening', e.target.value)}
 title="Opening stock count (edit to trigger reconciliation)"
 className="w-14 sm:w-16 text-center py-1.5 px-1 rounded-lg bg-[#0D1117] border border-slate-800 text-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
 />
 </td>

 {/* 3. Add Stock Input */}
 <td
 className="py-2 px-1.5 sm:px-2 text-center"
 onClick={(e) => e.stopPropagation()}
 >
 <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.addedStock !== undefined && row.addedStock > 0 ? row.addedStock : ''}
 onFocus={(e) => e.target.select()}
 onChange={(e) => handleCellChange(p.id, 'added', e.target.value)}
 title="Added restock quantity"
 className={`w-12 sm:w-16 text-center py-1.5 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${row.addedStock > 0 ? "border-emerald-600/70 text-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" : "border-slate-800 text-slate-300 focus:border-slate-600"}`}
 />
 </td>

 {/* 4. Closing Stock Input */}
 <td
 className="py-2 px-1.5 sm:px-2 text-center"
 onClick={(e) => e.stopPropagation()}
 >
 <input
 type="number" step="any"
 min="0"
 value={row.closingStock !== undefined ? row.closingStock : ''}
 onFocus={(e) => e.target.select()}
 onChange={(e) => handleCellChange(p.id, 'closing', e.target.value)}
 title="Closing stock count at shift handover"
 className={`w-14 sm:w-16 text-center py-1.5 px-1 rounded-lg bg-[#0D1117] border text-xs sm:text-sm font-semibold focus:outline-none ${row.hasClosingEntered ? "border-slate-500 text-white font-bold" : "border-slate-800 text-slate-400 focus:border-slate-600"}`}
 />
 </td>

 {/* 5. Details Disclosure Trigger */}
 <td className="py-2 px-1.5 sm:px-2 text-center text-slate-400">
 <div className="flex items-center justify-center p-1 rounded-md hover:bg-slate-800 transition-colors">
 {isExpanded ? (
 <ChevronUp className="w-4 h-4 text-emerald-400" />
 ) : (
 <ChevronDown className="w-4 h-4 text-slate-400" />
 )}
 </div>
 </td>
 </tr>

 {/* Expanded Full-Column Breakdown Drawer */}
 {isExpanded && (
 <tr className="bg-[#0B0F17] border-b border-[#1E2638]">
 <td colSpan={5} className="p-3 sm:p-4">
 <div className="bg-[#111622] rounded-xl border border-[#1E2638] p-3 sm:p-4 space-y-3 font-sans shadow-inner">
 <div className="flex items-center justify-between pb-2 border-b border-slate-800">
 <div>
 <span className="text-xs font-bold text-white uppercase tracking-wider">
 Full Stock & Financial Details
 </span>
 <p className="text-[11px] text-slate-400">
 Complete breakdown for {p.name}
 </p>
 </div>
 <span className="text-[11px] font-mono text-slate-400 bg-[#0D1117] px-2 py-0.5 rounded border border-slate-800">
 Cost: KES {row.costPrice.toLocaleString()} · Price: KES {row.sellingPrice.toLocaleString()}
 </span>
 </div>

 {/* Grid of all remaining columns: Total | Sold | Sales | Profit */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
 {/* Column: Total Available */}
 <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
 <div className="text-[10px] text-slate-400 uppercase font-sans mb-1 flex items-center justify-between">
 <span>Total Stock</span>
 <span className="text-[9px] text-slate-400">(Open + Add)</span>
 </div>
 <div className="text-sm sm:text-base font-bold text-white">
 {row.totalStock} <span className="text-[10px] text-slate-400 font-normal">units</span>
 </div>
 <div className="text-[10px] text-slate-400 mt-0.5">
 {row.openingStock || 0} + {row.addedStock || 0}
 </div>
 </div>

 {/* Column: Sold Units */}
 <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
 <div className="text-[10px] text-slate-400 uppercase font-sans mb-1 flex items-center justify-between">
 <span>Sold / Dispatched</span>
 <span className="text-[9px] text-slate-400">(Total - Close)</span>
 </div>
 <div className="text-sm sm:text-base font-bold">
 {row.hasOverage ? (
 <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
 <AlertCircle className="w-3 h-3" /> Overage Count
 </span>
 ) : row.hasClosingEntered ? (
 <span className={row.salesUnits > 0 ? 'text-white' : 'text-slate-400'}>
 {row.salesUnits} <span className="text-[10px] text-slate-400 font-normal">units</span>
 </span>
 ) : (
 <span className="text-slate-400 text-xs">Enter closing</span>
 )}
 </div>
 <div className="text-[10px] text-slate-400 mt-0.5">
 {(row.closingStock !== undefined ? "Closing: " + row.closingStock : "Closing pending")}
 </div>
 </div>

 {/* Column: Sales Revenue (KES) */}
 <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
 <div className="text-[10px] text-slate-400 uppercase font-sans mb-1">
 Sales Amount
 </div>
 <div className="text-sm sm:text-base font-bold text-emerald-400">
 {(row.amountKes > 0 ? "KES " + row.amountKes.toLocaleString() : "KES 0")}
 </div>
 <div className="text-[10px] text-slate-400 mt-0.5">
 {row.salesUnits} × KES {row.sellingPrice.toLocaleString()}
 </div>
 </div>

 {/* Column: Profit (KES) */}
 <div className="bg-[#0D1117] p-2.5 rounded-lg border border-slate-800/80">
 <div className="text-[10px] text-slate-400 uppercase font-sans mb-1">
 Gross Profit
 </div>
 <div className="text-sm sm:text-base font-bold text-slate-200">
 {(row.profitKes > 0 ? "KES " + row.profitKes.toLocaleString() : "KES 0")}
 </div>
 <div className="text-[10px] text-slate-400 mt-0.5">
 Margin: KES {Math.max(0, row.sellingPrice - row.costPrice).toLocaleString()}/unit
 </div>
 </div>
 </div>

 {/* Explanation / Status footer */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-1 gap-1">
 <div>
 {row.hasClosingEntered ? (
 <span className="text-emerald-400/90 flex items-center gap-1">
 <CheckCircle2 className="w-3 h-3 text-emerald-400" />
 Closing stock accounted for ({row.closingStock} remaining).
 </span>
 ) : (
 <span className="text-slate-400">
 Tip: Type the closing count into the Closing input above to tally sales and cash due.
 </span>
 )}
 </div>
 <button
 type="button"
 onClick={() => setExpandedItemId(null)}
 className="text-slate-400 hover:text-slate-200 text-[11px] self-end sm:self-auto cursor-pointer underline"
 >
 Collapse details
 </button>
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
 <tfoot className="bg-[#0D1117] font-mono text-xs font-bold border-t border-[#1E2638]">
 <tr>
 <td className="py-3 px-3 sm:px-3.5 text-white">
 TOTAL ({rowDataList.length} items)
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-slate-300">
 {summaryTotals.totalOpening}
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-emerald-400">
 +{summaryTotals.totalAdded}
 </td>
 <td className="py-3 px-1.5 sm:px-2 text-center text-slate-300">
 {summaryTotals.totalClosing > 0 ? summaryTotals.totalClosing : '-'}
 </td>
 <td className="py-3 px-2 text-center text-slate-400">
 {/* Summary expand badge */}
 <span className="text-[10px] text-emerald-400 font-bold block sm:hidden">
 KES {summaryTotals.totalAmount.toLocaleString()}
 </span>
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
 <p className="text-xs text-slate-400 mt-0.5 font-mono">Shift #{activeShift.shiftNumber}</p>
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
 className="w-full bg-[#0D1117] border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
 />
 
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
