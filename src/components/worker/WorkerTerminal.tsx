import React, { useState } from 'react';
import {
  User,
  Product,
  Shift,
  ShiftStockItem,
  Expense,
} from '../../types';
import { store } from '../../services/store';
import { ShiftOpeningModal } from './ShiftOpeningModal';
import { StockAdditionModal } from './StockAdditionModal';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { ShiftClosingModal } from './ShiftClosingModal';
import {
  Smartphone,
  Coins,
  PackagePlus,
  Receipt,
  Lock,
  Clock,
  AlertCircle,
  Search,
  ShieldCheck,
  Wine,
} from 'lucide-react';

interface WorkerTerminalProps {
  currentUser: User;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'ADD_STOCK' | 'EXPENSE' | 'CLOSE_SHIFT'
  >('NONE');

  const products = store.getProducts();
  const activeShift = store.getActiveShift();
  const inventory = store.getInventory();
  const shiftStockItems = activeShift ? store.getShiftStockItems(activeShift.id) : [];
  const expenses = activeShift ? store.getExpenses(activeShift.id) : [];

  // Handle Opening Shift
  const handleConfirmOpen = (data: {
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
    inconsistencyNote?: string;
  }) => {
    store.openShift({
      workerId: currentUser.id,
      workerName: currentUser.name,
      openingCashFloat: data.openingCashFloat,
      openingMpesaBalance: data.openingMpesaBalance,
      physicalCounts: data.physicalCounts,
      inconsistencyNote: data.inconsistencyNote,
    });
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

  // Sort products alphabetically A to Z (Single column specification)
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const filteredProducts = sortedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total initial units on bar counter
  const totalStartingUnits = shiftStockItems.reduce(
    (sum, item) => sum + item.openingPhysicalCount + item.additions,
    0
  );

  return (
    <div className="max-w-3xl mx-auto pb-24 md:pb-12 space-y-4">
      {/* 1. NO ACTIVE SHIFT: RENDER OPENING MODAL */}
      {!activeShift ? (
        <ShiftOpeningModal
          products={products}
          inventory={inventory}
          workerName={currentUser.name}
          onConfirmOpen={handleConfirmOpen}
        />
      ) : (
        /* 2. ACTIVE SHIFT SCREEN */
        <div className="space-y-4">
          {/* Active Shift Header Card */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white tracking-tight">
                      Active Bar Shift
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                      Live
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>Attendant: <strong className="text-slate-200">{activeShift.workerName}</strong></span>
                    <span>·</span>
                    <span>{activeShift.shiftNumber}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Opened {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Close Shift Action */}
              <button
                onClick={() => setActiveModal('CLOSE_SHIFT')}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-950/40"
              >
                <Lock className="w-4 h-4" />
                <span>End Shift & Count Remaining</span>
              </button>
            </div>

            {/* Shift Starting Baselines */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs font-mono">
              <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Entry M-Pesa Balance</span>
                </div>
                <div className="font-bold text-slate-100 text-sm mt-1 tabular-nums">
                  KES {activeShift.openingMpesaBalance.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Recorded at clock-in</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Opening Cash Float</span>
                </div>
                <div className="font-bold text-slate-100 text-sm mt-1 tabular-nums">
                  KES {activeShift.openingCashFloat.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Change in till drawer</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Wine className="w-3.5 h-3.5 text-blue-400" />
                  <span>Bar Starting Stock</span>
                </div>
                <div className="font-bold text-slate-100 text-sm mt-1 tabular-nums">
                  {totalStartingUnits} bottles
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Physical custody verified</div>
              </div>
            </div>

            {/* Inconsistency notice if shift opened with mismatch */}
            {activeShift.openingInconsistencyNote && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/50 text-[11px] text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="truncate">
                  Handover Remarks: {activeShift.openingInconsistencyNote}
                </span>
              </div>
            )}
          </div>

          {/* Quick Shift Operations Bar (Delivery Restock & Expenses) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setActiveModal('ADD_STOCK')}
              className="p-3.5 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-[#1E293B] text-left transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                <PackagePlus className="w-4 h-4" />
                <span>Receive Stock Restock / Delivery</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Add crates received from distributor or supplier
              </div>
            </button>

            <button
              onClick={() => setActiveModal('EXPENSE')}
              className="p-3.5 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-[#1E293B] text-left transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
                <Receipt className="w-4 h-4" />
                <span>Record Till Expense</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Ice, lemons, transport paid out of cash/till
              </div>
            </button>
          </div>

          {/* Counter Inventory Reference (1 Single Column, Arranged Alphabetically A to Z) */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Bar Stock Reference (Alphabetical A to Z)
                </h3>
                <p className="text-xs text-slate-400">
                  No need to log individual sales. When leaving, simply tap "End Shift & Count Remaining".
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter drink..."
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                />
              </div>
            </div>

            {/* 1 Single Column List */}
            <div className="border border-slate-800/80 rounded-2xl divide-y divide-slate-800/80 bg-[#0E1420] max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => {
                const ssi = shiftStockItems.find((i) => i.productId === product.id);
                const inv = inventory.find((i) => i.productId === product.id);
                const opening = ssi ? ssi.openingPhysicalCount : (inv ? inv.quantityOnHand : 0);
                const additions = ssi ? ssi.additions : 0;
                const totalAvailable = opening + additions;

                return (
                  <div
                    key={product.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 truncate text-sm">
                        {product.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                        <span className="capitalize">{product.category.replace('_', ' ').toLowerCase()}</span>
                        <span>·</span>
                        <span className="text-emerald-400 font-bold">KES {product.sellingPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-xs font-bold text-white">
                        {totalAvailable} {product.unit.toLowerCase()}s
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {opening} started {additions > 0 && `(+${additions} added)`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operational Workflow Reminder Banner */}
          <div className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-200">Zero In-Shift POS Friction</div>
              <div className="mt-0.5 text-[11px] leading-relaxed">
                Serve your customers freely throughout your shift. When taking handover or clocking out, count what remains in the bar. The system calculates sold bottles and expected revenue automatically.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {activeModal === 'ADD_STOCK' && activeShift && (
        <StockAdditionModal
          products={products}
          onClose={() => setActiveModal('NONE')}
          onConfirmAddition={handleConfirmAddition}
        />
      )}

      {activeModal === 'EXPENSE' && activeShift && (
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
