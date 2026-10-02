import React, { useState } from 'react';
import {
  User,
  Product,
} from '../../types';
import { store } from '../../services/store';
import { ShiftOpeningModal } from './ShiftOpeningModal';
import { StockAdditionModal } from './StockAdditionModal';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { ShiftClosingModal } from './ShiftClosingModal';
import { InterBusinessDispatchModal } from './InterBusinessDispatchModal';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import {
  PackagePlus,
  Receipt,
  Search,
  ShieldCheck,
  Wine,
  Truck,
  X,
  LogOut,
  Clock,
} from 'lucide-react';

interface WorkerTerminalProps {
  currentUser: User;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'ADD_STOCK' | 'EXPENSE' | 'CLOSE_SHIFT' | 'INTER_TRANSFER'
  >('NONE');
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);

  const products = store.getProducts();
  const activeShift = store.getActiveShift();
  const inventory = store.getInventory();
  const incomingTransfers = store.getPendingIncomingTransfers();
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

  const handleDispatchSuccess = (info: {
    partnerName: string;
    productName: string;
    quantity: number;
    cost: number;
  }) => {
    setActiveModal('NONE');
    setDispatchToast(
      `Sent ${info.quantity}x ${info.productName} to ${info.partnerName}.`
    );
    setTimeout(() => setDispatchToast(null), 5000);
  };

  // Sort products alphabetically
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const filteredProducts = sortedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStartingUnits = shiftStockItems.reduce(
    (sum, item) => sum + item.openingPhysicalCount + item.additions,
    0
  );

  return (
    <div className="max-w-xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
      {/* 1. NO ACTIVE SHIFT: GUIDED OPENING TRAINER */}
      {!activeShift ? (
        <ShiftOpeningModal
          products={products}
          inventory={inventory}
          workerName={currentUser.name}
          onConfirmOpen={handleConfirmOpen}
        />
      ) : (
        /* 2. ACTIVE SHIFT SCREEN (SIMPLIFIED MOBILE WORKSPACE) */
        <div className="space-y-4">
          {/* Dispatch Toast */}
          {dispatchToast && (
            <div className="p-3.5 rounded-2xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-medium">{dispatchToast}</span>
              </div>
              <button onClick={() => setDispatchToast(null)} className="p-1 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* INCOMING STOCK LOANS BANNER */}
          <IncomingTransferBanner transfers={incomingTransfers} />

          {/* Clean Shift Status Card */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
                <div>
                  <div className="text-sm sm:text-base font-black text-white">
                    Shift in Progress
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>Attendant: <strong className="text-emerald-400">{activeShift.workerName.split(' ')[0]}</strong></span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Started {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* End Shift Button on Header */}
              <button
                onClick={() => setActiveModal('CLOSE_SHIFT')}
                className="py-2 px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/40 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Finish Shift</span>
              </button>
            </div>

            {/* Quick Shift Summary Pills */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Cash Float</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  KES {activeShift.openingCashFloat.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">M-Pesa Float</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  KES {activeShift.openingMpesaBalance.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Operational Quick Actions (Big Thumb Buttons) */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Receive Restock */}
            <button
              onClick={() => setActiveModal('ADD_STOCK')}
              className="p-3 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-[#1E293B] text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <PackagePlus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Receive Drinks</span>
              <span className="text-[10px] text-slate-400">New Delivery</span>
            </button>

            {/* 2. Borrow / Lend */}
            <button
              onClick={() => setActiveModal('INTER_TRANSFER')}
              className="p-3 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-amber-500/30 text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Lend / Borrow</span>
              <span className="text-[10px] text-slate-400">Neighbor Bar</span>
            </button>

            {/* 3. Record Expense */}
            <button
              onClick={() => setActiveModal('EXPENSE')}
              className="p-3 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-[#1E293B] text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-white">Pay Expense</span>
              <span className="text-[10px] text-slate-400">Ice, Lemons</span>
            </button>
          </div>

          {/* Clean Drink Shelf Reference */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Drinks on Counter
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total starting stock: {totalStartingUnits} bottles
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-36 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find drink..."
                  className="w-full bg-[#0E1420] border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Drink List */}
            <div className="space-y-2">
              {filteredProducts.map((p) => {
                const ssi = shiftStockItems.find((item) => item.productId === p.id);
                const count = ssi
                  ? ssi.openingPhysicalCount + ssi.additions + ssi.transfersIn - ssi.transfersOut - ssi.damages
                  : 0;

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#0E1420] border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 shrink-0">
                        <Wine className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{p.name}</div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          KES {p.sellingPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-mono font-bold text-white">
                        {count}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">bottles</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persistent Sticky Finish Shift Button on Mobile */}
          <div className="pt-2">
            <button
              onClick={() => setActiveModal('CLOSE_SHIFT')}
              className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Finish Shift & Hand Over 🔒</span>
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
      {activeModal === 'ADD_STOCK' && (
        <StockAdditionModal
          products={products}
          onClose={() => setActiveModal('NONE')}
          onConfirmAddition={handleConfirmAddition}
        />
      )}

      {activeModal === 'EXPENSE' && (
        <ShiftExpenseModal
          onClose={() => setActiveModal('NONE')}
          onConfirmExpense={handleConfirmExpense}
        />
      )}

      {activeModal === 'INTER_TRANSFER' && (
        <InterBusinessDispatchModal
          products={products}
          inventory={inventory}
          partners={store.getPartners()}
          onClose={() => setActiveModal('NONE')}
          onSuccess={handleDispatchSuccess}
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
