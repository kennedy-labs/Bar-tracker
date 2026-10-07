import React, { useState } from 'react';
import { User, Shift, Product } from '../../types';
import { store } from '../../services/store';
import { StartScreen } from './StartScreen';
import { EndOfShiftScreen } from './EndOfShiftScreen';
import { ShiftOpeningModal } from './ShiftOpeningModal';
import { ItemRestockModal } from './ItemRestockModal';
import { ShiftExpenseModal } from './ShiftExpenseModal';
import { InterBusinessDispatchModal } from './InterBusinessDispatchModal';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import { ShiftDetailModal } from '../owner/ShiftDetailModal';
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
  History,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Eye,
  Calendar,
  Layers,
  MoreVertical,
  Lock,
  Undo2,
  Scale,
} from 'lucide-react';

interface WorkerTerminalProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'OPEN_SHIFT' | 'EXPENSE' | 'INTER_TRANSFER'
  >('NONE');
  const [restockTarget, setRestockTarget] = useState<{ product: Product; count: number } | null>(null);
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);
  const [selectedHistoricalShift, setSelectedHistoricalShift] = useState<Shift | null>(null);

  const products = store.getProducts();
  const activeShift = store.getActiveShift();
  const inventory = store.getInventory();
  const shifts = store.getShifts();
  const incomingTransfers = store.getPendingIncomingTransfers();
  const shiftStockItems = activeShift ? store.getShiftStockItems(activeShift.id) : [];
  const shiftAdditions = activeShift ? store.getStockAdditions(activeShift.id) : [];

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
    setActiveModal('NONE');
    setActiveTab('counter');
  };

  const handleConfirmItemRestock = (quantity: number) => {
    if (!activeShift || !restockTarget) return;
    store.recordStockAddition({
      shiftId: activeShift.id,
      productId: restockTarget.product.id,
      quantity,
      workerName: currentUser.name,
    });
    setDispatchToast(
      `Restocked +${quantity} ${restockTarget.product.name}. Recorded & reported to owner.`
    );
    setRestockTarget(null);
    setTimeout(() => setDispatchToast(null), 5000);
  };

  const handleUndoRestock = (additionId: string) => {
    try {
      store.deleteStockAddition(additionId);
      setDispatchToast('Restock addition cancelled and counter stock reverted.');
      setTimeout(() => setDispatchToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Cannot delete restock record.');
    }
  };

  const handleConfirmExpense = (params: {
    description: string;
    amount: number;
  }) => {
    if (!activeShift) return;
    store.recordExpense({
      shiftId: activeShift.id,
      description: params.description,
      amount: params.amount,
      category: 'OTHER',
      paymentMethod: 'CASH',
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

  // -------------------------------------------------------------
  // TAB 1: START SCREEN
  // -------------------------------------------------------------
  if (activeTab === 'start') {
    return (
      <>
        <StartScreen
          currentUser={currentUser}
          onStartShift={() => setActiveModal('OPEN_SHIFT')}
          onGoToCounter={() => setActiveTab('counter')}
          onGoToEndShift={() => setActiveTab('end_shift')}
          onGoToHistory={() => setActiveTab('history')}
        />

        {activeModal === 'OPEN_SHIFT' && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="w-full max-w-xl my-auto">
              <div className="text-right pb-2">
                <button
                  onClick={() => setActiveModal('NONE')}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Close & Return
                </button>
              </div>
              <ShiftOpeningModal
                products={products}
                inventory={inventory}
                workerName={currentUser.name}
                onConfirmOpen={handleConfirmOpen}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // TAB 2: END OF SHIFT SCREEN
  // -------------------------------------------------------------
  if (activeTab === 'end_shift') {
    return (
      <EndOfShiftScreen
        currentUser={currentUser}
        onGoToStartScreen={() => setActiveTab('start')}
        onGoToCounter={() => {
          if (activeShift) {
            store.markCounterFinished(activeShift.id, false);
          }
          setActiveTab('counter');
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // TAB 3: PAST SHIFTS (HISTORY)
  // -------------------------------------------------------------
  if (activeTab === 'history') {
    return (
      <div className="max-w-2xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Past Shift Records</h1>
                <p className="text-xs text-slate-400">
                  Full shift logs, drink units sold, and handover receipts
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab(activeShift ? 'counter' : 'start')}
              className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer"
            >
              {activeShift ? 'Back to Counter' : 'Back to Start'}
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {shifts.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No shift records yet. Open your first shift from the Start Screen.
              </div>
            ) : (
              shifts.map((s) => {
                const variance = s.financialVariance || 0;
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">
                          {s.shiftNumber}
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                            s.status === 'CLOSED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-blue-950 text-blue-400 border border-blue-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>Attendant: {s.workerName}</span>
                        <span>·</span>
                        <span>{new Date(s.openedAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="text-slate-300 font-mono">
                          {s.recordedSalesCount || 0} drinks sold
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-white">
                        KES {(s.totalIncomeReturned || 0).toLocaleString()}
                      </div>
                      <div
                        className={`text-[10px] font-mono mt-0.5 ${
                          variance === 0
                            ? 'text-emerald-400'
                            : variance < 0
                            ? 'text-red-400 font-bold'
                            : 'text-amber-400 font-bold'
                        }`}
                      >
                        {variance === 0
                          ? 'Balanced'
                          : variance < 0
                          ? `-KES ${Math.abs(variance).toLocaleString()}`
                          : `+KES ${variance.toLocaleString()}`}
                      </div>
                      <button
                        onClick={() => setSelectedHistoricalShift(s)}
                        className="mt-1 py-1 px-2.5 rounded-lg bg-[#151D2C] hover:bg-slate-800 text-[10px] font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-emerald-400" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedHistoricalShift && (
          <ShiftDetailModal
            shift={selectedHistoricalShift}
            onClose={() => setSelectedHistoricalShift(null)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TAB 4: ACTIVE COUNTER (MY SHIFT)
  // -------------------------------------------------------------
  return (
    <div className="max-w-xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
      {/* 1. NO ACTIVE SHIFT: PROMPT TO START SCREEN */}
      {!activeShift ? (
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <PlayCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">No Shift in Progress</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You must open the counter and verify your starting cash float and bottles before serving drinks.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setActiveTab('start')}
              className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              Go to Start Screen
            </button>
            <button
              onClick={() => setActiveModal('OPEN_SHIFT')}
              className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-[#0E1420] border border-slate-700 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
            >
              Open Shift Now
            </button>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE SHIFT SCREEN (COUNTER WORKSPACE) */
        <div className="space-y-4">
          {/* Dispatch Toast */}
          {dispatchToast && (
            <div className="p-3.5 rounded-2xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-medium">{dispatchToast}</span>
              </div>
              <button onClick={() => setDispatchToast(null)} className="p-1 hover:text-white cursor-pointer">
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
                    Shift in Progress · #{activeShift.shiftNumber}
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

              {/* Active Badge */}
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold shrink-0">
                ACTIVE
              </span>
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

          {/* Operational Quick Actions (Receive Drinks banner removed as per request) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Borrow / Lend */}
            <button
              onClick={() => setActiveModal('INTER_TRANSFER')}
              className="p-3.5 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-amber-500/30 text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Lend / Borrow</span>
              <span className="text-[10px] text-slate-400">Neighbor Bar</span>
            </button>

            {/* 2. Record Simplified Expense */}
            <button
              onClick={() => setActiveModal('EXPENSE')}
              className="p-3.5 rounded-2xl bg-[#121824] hover:bg-[#182132] border border-[#1E293B] text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-sm"
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
                  Tap the 3-dot icon on any drink to restock
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
                const invQty = inventory.find((i) => i.productId === p.id)?.quantityOnHand ?? 0;
                const count = ssi
                  ? (Number(ssi.openingPhysicalCount || 0) + Number(ssi.additions || 0) + Number(ssi.transfersIn || 0) - Number(ssi.transfersOut || 0) - Number(ssi.damages || 0))
                  : Number(invQty);
                const addedQty = ssi ? Number(ssi.additions || 0) : 0;

                const isMeasured = p.isMeasured;
                const isValue = isMeasured && (p.measurementType === 'VALUE' || p.unit === 'VALUE_KES');
                const measureUnit = isValue ? 'worth' : p.measureUnitLabel || (p.unit === 'VALUE_KES' ? 'KES' : 'bottles');

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-2xl bg-[#0E1420] border transition-colors ${
                      addedQty > 0
                        ? 'border-emerald-500/40 hover:border-emerald-500/60 bg-gradient-to-r from-[#0E1420] to-emerald-950/20'
                        : isMeasured
                        ? 'border-cyan-900/60 hover:border-cyan-700 bg-gradient-to-r from-[#0E1420] to-cyan-950/10'
                        : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-xl ${isMeasured ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/50' : 'bg-slate-800/80 text-slate-400'} flex items-center justify-center shrink-0`}>
                        {isMeasured ? <Scale className="w-4 h-4" /> : <Wine className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{p.name}</span>
                          {isMeasured && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-950/90 text-cyan-400 border border-cyan-600/80 shrink-0">
                              Measured
                            </span>
                          )}
                          {addedQty > 0 && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-600/80 shrink-0 animate-in fade-in">
                              +{addedQty} added
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>KES {p.sellingPrice.toLocaleString()}</span>
                          {addedQty > 0 && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-400 text-[10px]">
                                Start: {ssi?.openingPhysicalCount || 0} · <strong className="text-emerald-400 font-semibold">+{addedQty} restocked</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-base font-bold text-white">
                            {isValue ? `KES ${count.toLocaleString()}` : count}
                          </span>
                          <span className="text-[11px] text-slate-500 font-sans">{measureUnit}</span>
                        </div>
                        {addedQty > 0 && (
                          <div className="text-[10px] text-emerald-400 font-bold">
                            +{addedQty} added
                          </div>
                        )}
                      </div>

                      {/* 3-DOT RESTOCK BUTTON */}
                      <button
                        type="button"
                        onClick={() => setRestockTarget({ product: p, count })}
                        title={`Restock ${p.name}`}
                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer border border-slate-700/80 transition-colors shadow-sm"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shift Restock Audit Trail */}
          {shiftAdditions.length > 0 && (
            <div className="p-4 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Shift Restock Activity ({shiftAdditions.length})
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Reported to Owner
                </span>
              </div>

              <div className="divide-y divide-slate-800 text-xs">
                {shiftAdditions.map((item) => {
                  const isLocked = item.isImmutable || item.status === 'SAVED_LOCKED';

                  return (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.productName}</span>
                          <span className="font-mono font-black text-emerald-400 text-[11px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800">
                            +{item.quantity}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {isLocked ? (
                            <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Saved & Locked by Owner (Immutable)
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">
                              Pending Owner Verification
                            </span>
                          )}
                        </div>
                      </div>

                      {!isLocked ? (
                        <button
                          type="button"
                          onClick={() => handleUndoRestock(item.id)}
                          className="py-1 px-2.5 rounded-lg bg-[#0E1420] hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-400" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Finish Shift Button at Bottom of Active Counter Page */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (activeShift) {
                  store.markCounterFinished(activeShift.id, true);
                }
                setActiveTab('end_shift');
              }}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-red-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-red-950/60 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>Finish Shift & Close Counter</span>
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2">
              Ready to reconcile remaining bottles, cash drawer, and M-Pesa till balance.
            </p>
          </div>
        </div>
      )}

      {/* MODAL 1: OPEN SHIFT MODAL */}
      {activeModal === 'OPEN_SHIFT' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-xl my-auto">
            <div className="text-right pb-2">
              <button
                onClick={() => setActiveModal('NONE')}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Close & Return
              </button>
            </div>
            <ShiftOpeningModal
              products={products}
              inventory={inventory}
              workerName={currentUser.name}
              onConfirmOpen={handleConfirmOpen}
            />
          </div>
        </div>
      )}

      {/* MODAL 2: 3-DOT PER-ITEM RESTOCK MODAL */}
      {restockTarget && (
        <ItemRestockModal
          product={restockTarget.product}
          currentCount={restockTarget.count}
          onClose={() => setRestockTarget(null)}
          onConfirmRestock={handleConfirmItemRestock}
        />
      )}

      {/* MODAL 3: SIMPLIFIED EXPENSE MODAL */}
      {activeModal === 'EXPENSE' && (
        <ShiftExpenseModal
          onClose={() => setActiveModal('NONE')}
          onConfirmExpense={handleConfirmExpense}
        />
      )}

      {/* MODAL 4: INTER-BUSINESS STOCK DISPATCH */}
      {activeModal === 'INTER_TRANSFER' && activeShift && (
        <InterBusinessDispatchModal
          products={products}
          inventory={inventory}
          partners={store.getPartners()}
          onClose={() => setActiveModal('NONE')}
          onSuccess={handleDispatchSuccess}
        />
      )}
    </div>
  );
};
