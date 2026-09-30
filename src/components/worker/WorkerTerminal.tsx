import React, { useState } from 'react';
import {
  User,
  Product,
  ProductCategory,
  StockLocation,
  Shift,
  ShiftStockItem,
  Expense,
  Transfer,
} from '../../types';
import { store } from '../../services/store';
import { ShiftOpeningModal } from './ShiftOpeningModal';
import { FastSaleModal } from './FastSaleModal';
import { StockAdditionModal } from './StockAdditionModal';
import { StockTransferModal } from './StockTransferModal';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { ShiftClosingModal } from './ShiftClosingModal';
import {
  Beer,
  Wine,
  GlassWater,
  Sparkles,
  Smartphone,
  Coins,
  PackagePlus,
  ArrowRightLeft,
  Receipt,
  Lock,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface WorkerTerminalProps {
  currentUser: User;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({ currentUser }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'FAST_SALE' | 'ADD_STOCK' | 'TRANSFER' | 'EXPENSE' | 'CLOSE_SHIFT'
  >('NONE');
  const [selectedProductForSale, setSelectedProductForSale] = useState<Product | null>(null);

  const locations = store.getLocations();
  const products = store.getProducts();
  const assignedLocationId = currentUser.assignedLocationId || 'loc-counter-1';
  const activeShift = store.getActiveShift(assignedLocationId) || store.getActiveShift();
  const inventory = store.getInventory(activeShift?.locationId || assignedLocationId);
  const shiftStockItems = activeShift ? store.getShiftStockItems(activeShift.id) : [];
  const expenses = activeShift ? store.getExpenses(activeShift.id) : [];
  const pendingTransfers = store
    .getTransfers()
    .filter((t) => t.toLocationId === (activeShift?.locationId || assignedLocationId) && t.status === 'PENDING');

  // Handle Opening Shift
  const handleConfirmOpen = (data: {
    locationId: string;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
    inconsistencyNote?: string;
  }) => {
    store.openShift({
      workerId: currentUser.id,
      workerName: currentUser.name,
      locationId: data.locationId,
      openingCashFloat: data.openingCashFloat,
      openingMpesaBalance: data.openingMpesaBalance,
      physicalCounts: data.physicalCounts,
      inconsistencyNote: data.inconsistencyNote,
    });
  };

  // Quick Sale Trigger from Product Card
  const handleQuickSaleClick = (prod: Product) => {
    setSelectedProductForSale(prod);
    setActiveModal('FAST_SALE');
  };

  const handleConfirmSale = (params: {
    productId: string;
    quantity: number;
    paymentMethod: 'CASH' | 'MPESA';
    mpesaAccountType?: any;
    transactionRef?: string;
  }) => {
    if (!activeShift) return;
    store.recordSale({
      shiftId: activeShift.id,
      ...params,
    });
    setActiveModal('NONE');
  };

  const handleConfirmAddition = (params: {
    productId: string;
    quantity: number;
    source: string;
    note?: string;
  }) => {
    if (!activeShift) return;
    store.recordStockAddition({
      shiftId: activeShift.id,
      ...params,
    });
    setActiveModal('NONE');
  };

  const handleConfirmTransfer = (params: {
    productId: string;
    toLocationId: string;
    quantity: number;
    senderName: string;
  }) => {
    if (!activeShift) return;
    store.createTransfer({
      shiftId: activeShift.id,
      ...params,
    });
    setActiveModal('NONE');
  };

  const handleConfirmExpense = (params: {
    category: any;
    amount: number;
    paymentMethod: 'CASH' | 'MPESA';
    description: string;
    receiptRef?: string;
  }) => {
    if (!activeShift) return;
    store.recordExpense({
      shiftId: activeShift.id,
      ...params,
    });
    setActiveModal('NONE');
  };

  const handleConfirmCloseShift = (params: {
    closingPhysicalCounts: Record<string, number>;
    closingCashActual: number;
    closingMpesaBalance: number;
    closingNotes?: string;
  }) => {
    if (!activeShift) return;
    store.closeShift({
      shiftId: activeShift.id,
      ...params,
    });
    setActiveModal('NONE');
  };

  // Category filter items
  const categories: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'ALL', label: 'All Items', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'BEER', label: 'Beers', icon: <Beer className="w-3.5 h-3.5" /> },
    { id: 'CIDER', label: 'Ciders', icon: <Beer className="w-3.5 h-3.5" /> },
    { id: 'SPIRIT', label: 'Spirits & Tots', icon: <Wine className="w-3.5 h-3.5" /> },
    { id: 'SOFT_DRINK', label: 'Soft Drinks', icon: <GlassWater className="w-3.5 h-3.5" /> },
  ];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'ALL') return true;
    return p.category === selectedCategory;
  });

  // Calculate live shift revenue snapshot for worker reference
  const currentSalesTotal = shiftStockItems.reduce(
    (sum, item) => sum + item.recordedSales * item.sellingPrice,
    0
  );

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-12">
      {/* 1. NO ACTIVE SHIFT: RENDER NON-BYPASSABLE OPENING MODAL */}
      {!activeShift ? (
        <ShiftOpeningModal
          locations={locations}
          products={products}
          inventory={inventory}
          workerName={currentUser.name}
          defaultLocationId={assignedLocationId}
          onConfirmOpen={handleConfirmOpen}
        />
      ) : (
        /* 2. ACTIVE SHIFT SCREEN */
        <div className="space-y-4">
          {/* Active Shift Header Card */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {activeShift.locationName}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                      Active Shift
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{activeShift.shiftNumber}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Opened {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Shift Trigger Button */}
              <button
                onClick={() => setActiveModal('CLOSE_SHIFT')}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/80 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Transition to Closing</span>
              </button>
            </div>

            {/* Handover Balances & Real-Time Shift Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  <span>Entry M-Pesa</span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-sm mt-0.5 tabular-nums">
                  KES {activeShift.openingMpesaBalance.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800/80">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>Cash Float</span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-sm mt-0.5 tabular-nums">
                  KES {activeShift.openingCashFloat.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Total Drinks Sold</div>
                <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5 tabular-nums">
                  {activeShift.recordedSalesCount || 0} units
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Sales Value</div>
                <div className="font-mono font-bold text-slate-100 text-sm mt-0.5 tabular-nums">
                  KES {currentSalesTotal.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Inconsistency notice if shift opened with mismatch */}
            {activeShift.openingInconsistencyNote && (
              <div className="mt-3 p-2 rounded-xl bg-amber-950/20 border border-amber-800/50 text-[11px] text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="truncate">
                  Opening Note: {activeShift.openingInconsistencyNote}
                </span>
              </div>
            )}
          </div>

          {/* Pending Incoming Transfers Notice */}
          {pendingTransfers.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/80 text-xs text-amber-200">
              <div className="font-bold flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                  <span>{pendingTransfers.length} Incoming Transfer Pending</span>
                </span>
              </div>
              <div className="space-y-2">
                {pendingTransfers.map((trf) => (
                  <div
                    key={trf.id}
                    className="p-2.5 rounded-xl bg-[#121824] border border-amber-900/60 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {trf.quantity}x {trf.productName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Dispatched by {trf.senderName} from {trf.fromLocationName}
                      </div>
                    </div>
                    <button
                      onClick={() => store.acceptTransfer(trf.id, currentUser.name)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Accept Stock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Pills (Touch-first button elements) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                    : 'bg-[#121824] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Product Grid for Rapid Touch Sales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const inv = inventory.find((i) => i.productId === product.id);
              const stockOnHand = inv ? inv.quantityOnHand : 0;
              const isLow = stockOnHand <= product.reorderLevel;
              const isOut = stockOnHand <= 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleQuickSaleClick(product)}
                  className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[110px] ${
                    isOut
                      ? 'bg-[#101520] border-slate-800/60 opacity-60'
                      : 'bg-[#121824] hover:bg-[#182132] border-[#1E293B] hover:border-emerald-500/50 shadow-md'
                  }`}
                >
                  <div className="w-full">
                    <div className="text-xs font-bold text-white line-clamp-2 leading-tight">
                      {product.name}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 font-bold mt-1 tabular-nums">
                      KES {product.sellingPrice.toLocaleString()}
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800/80 mt-2">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isOut
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : isLow
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {stockOnHand} in shelf
                    </span>

                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sticky Quick-Action Bar in Ergonomic Thumb Zone (Bottom <= 15% Viewport) */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800 px-4 py-2.5">
            <div className="max-w-4xl mx-auto grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedProductForSale(products[0]);
                  setActiveModal('FAST_SALE');
                }}
                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer shadow-md shadow-emerald-950/50"
              >
                <Plus className="w-4 h-4 mb-0.5" />
                <span className="leading-none text-[10px]">Record Sale</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('ADD_STOCK')}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer border border-slate-700"
              >
                <PackagePlus className="w-4 h-4 mb-0.5 text-emerald-400" />
                <span className="leading-none text-[10px]">Restock</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('TRANSFER')}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer border border-slate-700"
              >
                <ArrowRightLeft className="w-4 h-4 mb-0.5 text-amber-400" />
                <span className="leading-none text-[10px]">Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('EXPENSE')}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer border border-slate-700"
              >
                <Receipt className="w-4 h-4 mb-0.5 text-red-400" />
                <span className="leading-none text-[10px]">Expense</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {activeModal === 'FAST_SALE' && selectedProductForSale && (
        <FastSaleModal
          product={selectedProductForSale}
          currentStock={
            inventory.find((i) => i.productId === selectedProductForSale.id)?.quantityOnHand || 0
          }
          onClose={() => setActiveModal('NONE')}
          onConfirmSale={handleConfirmSale}
        />
      )}

      {activeModal === 'ADD_STOCK' && (
        <StockAdditionModal
          products={products}
          onClose={() => setActiveModal('NONE')}
          onConfirmAddition={handleConfirmAddition}
        />
      )}

      {activeModal === 'TRANSFER' && (
        <StockTransferModal
          products={products}
          locations={locations}
          currentLocationId={activeShift?.locationId || assignedLocationId}
          workerName={currentUser.name}
          onClose={() => setActiveModal('NONE')}
          onConfirmTransfer={handleConfirmTransfer}
        />
      )}

      {activeModal === 'EXPENSE' && (
        <ShiftExpenseModal
          onClose={() => setActiveModal('NONE')}
          onConfirmExpense={handleConfirmExpense}
        />
      )}

      {activeModal === 'CLOSE_SHIFT' && activeShift && (
        <ShiftClosingModal
          shift={activeShift}
          shiftStockItems={shiftStockItems}
          expenses={expenses}
          onClose={() => setActiveModal('NONE')}
          onConfirmClose={handleConfirmCloseShift}
        />
      )}
    </div>
  );
};
