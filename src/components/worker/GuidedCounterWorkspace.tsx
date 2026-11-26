import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, ShiftStockItem, Expense, StockAdditionRecord } from '../../types';
import { store } from '../../services/store';
import { ShiftOpeningWizard } from './ShiftOpeningWizard';
import { IncomingTransferBanner } from '../common/IncomingTransferBanner';
import { QuickActionSheet, QuickActionMode } from './QuickActionSheet';
import { GuidedCountWizard } from './GuidedCountWizard';
import { InterBusinessDispatchModal } from './InterBusinessDispatchModal';
import { intelligentMatch } from '../../utils/searchMatcher';
import {
  CheckCircle2,
  PackagePlus,
  AlertTriangle,
  Banknote,
  PlayCircle,
  Search,
  X,
  Truck,
  Trash2,
  Edit2,
} from 'lucide-react';

interface GuidedCounterWorkspaceProps {
  currentUser: User;
  initialOpenWizard?: boolean;
}

export const GuidedCounterWorkspace: React.FC<GuidedCounterWorkspaceProps> = ({
  currentUser,
  initialOpenWizard = false,
}) => {
  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    return store.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(initialOpenWizard);
  const [isRevisingFloats, setIsRevisingFloats] = useState<boolean>(false);
  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode | null>(null);
  const [quickActionProductId, setQuickActionProductId] = useState<string | undefined>(undefined);
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingAdditionId, setEditingAdditionId] = useState<string | null>(null);
  const [editingQtyStr, setEditingQtyStr] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const activeShift = store.getActiveShift();
  const activeShiftId = activeShift?.id || '';
  const products = useMemo(() => store.getProducts(), [storeTick]);
  const inventory = useMemo(() => store.getInventory(), [storeTick]);
  const incomingTransfers = useMemo(() => store.getPendingIncomingTransfers(), [storeTick]);
  const partners = useMemo(() => store.getPartners(), [storeTick]);

  const shiftStockItems: ShiftStockItem[] = useMemo(
    () => (activeShiftId ? store.getShiftStockItems(activeShiftId) : []),
    [activeShiftId, storeTick]
  );
  const expenses: Expense[] = useMemo(
    () => (activeShiftId ? store.getExpenses(activeShiftId) : []),
    [activeShiftId, storeTick]
  );
  const stockAdditions: StockAdditionRecord[] = useMemo(
    () => (activeShiftId ? store.getStockAdditions(activeShiftId) : []),
    [activeShiftId, storeTick]
  );

  const liveEstimate = useMemo(
    () => (activeShiftId ? store.getLiveShiftEstimate(activeShiftId) : null),
    [activeShiftId, storeTick]
  );

  const ssiMap = useMemo(() => new Map(shiftStockItems.map((s) => [s.productId, s])), [shiftStockItems]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return products
      .filter((p) => intelligentMatch(q, p.name) || p.category.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  }, [products, searchQuery]);

  const shiftStartStr = activeShift?.openedAt
    ? new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-surface-2 border border-line-strong text-content text-xs font-medium shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-strong shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <IncomingTransferBanner transfers={incomingTransfers} />

      {/* SCENARIO 1: NO ACTIVE SHIFT -> HANDOVER VERIFICATION & START */}
      {!activeShift ? (
        <ShiftOpeningWizard
          products={products}
          inventory={inventory}
          workerName={currentUser.name}
          onConfirmOpen={({
            openingCoinsFloat,
            openingCashFloat,
            openingMpesaBalance,
            physicalCounts,
            inconsistencyNote,
          }) => {
            store.openShift({
              workerId: currentUser.id,
              workerName: currentUser.name,
              openingCoinsFloat,
              openingCashFloat,
              openingMpesaBalance,
              physicalCounts,
              inconsistencyNote,
            });
            setIsWizardOpen(false);
            showToast('Shift started.');
          }}
        />
      ) : isRevisingFloats ? (
        <ShiftOpeningWizard
          products={products}
          inventory={inventory}
          workerName={activeShift.workerName}
          isRevision={true}
          onCancel={() => setIsRevisingFloats(false)}
          onConfirmOpen={({ openingCoinsFloat, openingCashFloat, openingMpesaBalance }) => {
            store.updateShiftOpeningFloats(activeShift.id, {
              openingCoinsFloat,
              openingCashFloat,
              openingMpesaBalance,
            });
            setIsRevisingFloats(false);
            showToast('Opening floats updated.');
          }}
        />
      ) : isWizardOpen ? (
        /* SCENARIO 2B: GUIDED CATEGORY-BY-CATEGORY CLOSING COUNT WIZARD */
        <GuidedCountWizard
          shift={activeShift}
          products={products}
          shiftStockItems={shiftStockItems}
          stockAdditions={stockAdditions}
          onExitToHub={() => setIsWizardOpen(false)}
          onShiftClosed={() => setIsWizardOpen(false)}
          onToast={showToast}
        />
      ) : (
        /* SCENARIO 2A: ACTIVE SHIFT ACTION HUB */
        <div className="space-y-4 pb-6">
          {/* Shift Header & Live Pulse Strip */}
          <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line-soft">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
                  Active Counter Shift
                </div>
                <div className="text-base font-bold text-content mt-0.5">
                  {activeShift.workerName} · Started {shiftStartStr}
                </div>
                {activeShift.previousWorkerName && (
                  <div className="text-xs text-muted mt-0.5">
                    Handed over from {activeShift.previousWorkerName}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsRevisingFloats(true)}
                className="min-h-[44px] px-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-muted hover:text-content cursor-pointer shrink-0"
              >
                Edit Opening Floats
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-line-soft bg-ink-soft border border-line rounded-xl py-3 text-center">
              <div className="px-2">
                <span className="text-[11px] text-muted block">Est. Sales</span>
                <span className="text-sm sm:text-base font-mono font-bold text-brand-strong tabular-nums">
                  KES {(liveEstimate?.revenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="px-2">
                <span className="text-[11px] text-muted block">Counted</span>
                <span className="text-sm sm:text-base font-mono font-bold text-content tabular-nums">
                  {liveEstimate?.countedCount || 0} / {liveEstimate?.totalProducts || products.length}
                </span>
              </div>
              <div className="px-2">
                <span className="text-[11px] text-muted block">Expenses</span>
                <span className="text-sm sm:text-base font-mono font-bold text-warn tabular-nums">
                  KES {(liveEstimate?.totalExpenses || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Primary Thumb-Zone Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setQuickActionProductId(undefined);
                setQuickActionMode('RESTOCK');
              }}
              className="min-h-[56px] p-3.5 rounded-2xl bg-surface hover:bg-surface-2 border border-line text-left flex items-center gap-3 transition-colors cursor-pointer"
            >
              <PackagePlus className="w-5 h-5 text-brand-strong shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-content">+ Restock / Delivery</div>
                <div className="text-[11px] text-muted">Add crates or bottles</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionProductId(undefined);
                setQuickActionMode('REDUCE');
              }}
              className="min-h-[56px] p-3.5 rounded-2xl bg-surface hover:bg-surface-2 border border-line text-left flex items-center gap-3 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-content">- Breakage / Adjust</div>
                <div className="text-[11px] text-muted">Broken or returned stock</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickActionProductId(undefined);
                setQuickActionMode('EXPENSE');
              }}
              className="min-h-[56px] p-3.5 rounded-2xl bg-surface hover:bg-surface-2 border border-line text-left flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Banknote className="w-5 h-5 text-danger shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-content">- Log Expense</div>
                <div className="text-[11px] text-muted">Cash paid from drawer</div>
              </div>
            </button>
          </div>

          {/* Dominant Guided Closing Count CTA */}
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="w-full min-h-[56px] px-4 sm:px-5 py-3.5 rounded-2xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm sm:text-base flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0 text-left">
              <PlayCircle className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate">
                  {(liveEstimate?.countedCount || 0) > 0
                    ? `Resume Closing Count (${liveEstimate?.countedCount}/${liveEstimate?.totalProducts})`
                    : 'Start Closing Count'}
                </div>
                <div className="text-[11px] font-semibold opacity-80 sm:hidden">
                  Guided category-by-category count
                </div>
              </div>
            </div>
            <span className="hidden sm:inline text-xs font-mono uppercase tracking-wider shrink-0">
              Category by Category →
            </span>
            <span className="sm:hidden text-xs font-mono font-bold shrink-0">→</span>
          </button>

          {/* Secondary Tools Row */}
          {partners.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(true)}
                className="min-h-[42px] px-3.5 rounded-xl bg-surface border border-line hover:bg-surface-2 text-xs font-semibold text-content flex items-center gap-2 cursor-pointer"
              >
                <Truck className="w-4 h-4 text-brand-strong" />
                <span>Send Stock to Partner Bar</span>
              </button>
            </div>
          )}

          {/* Quick Search Any Drink */}
          <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quick find any drink to restock or check shelf count..."
                className="w-full min-h-[44px] bg-ink-soft border border-line focus:border-brand rounded-xl pl-10 pr-9 text-sm text-content placeholder:text-faint focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted hover:text-content cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {searchQuery.trim() && (
              <div className="divide-y divide-line-soft border border-line rounded-xl bg-ink-soft overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">No matching drinks found.</div>
                ) : (
                  searchResults.map((p) => {
                    const ssi = ssiMap.get(p.id);
                    const avail = ssi
                      ? Number(ssi.openingPhysicalCount || 0) +
                        Number(ssi.additions || 0) +
                        Number(ssi.transfersIn || 0) -
                        Number(ssi.transfersOut || 0) -
                        Number(ssi.damages || 0) +
                        Number(ssi.ownerAdjustments || 0)
                      : 0;

                    return (
                      <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-content truncate">{p.name}</div>
                          <div className="text-xs text-muted font-mono tabular-nums">
                            Avail {avail} · KES {p.sellingPrice.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickActionProductId(p.id);
                              setQuickActionMode('RESTOCK');
                            }}
                            className="min-h-[44px] px-3 rounded-xl bg-brand-tint border border-brand-line text-brand-strong text-xs font-semibold cursor-pointer active:scale-95"
                          >
                            + Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickActionProductId(p.id);
                              setQuickActionMode('REDUCE');
                            }}
                            className="min-h-[44px] px-3 rounded-xl bg-surface-2 border border-line text-warn text-xs font-semibold cursor-pointer active:scale-95"
                          >
                            - Reduce
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Mid-Shift Restocks & Expenses Log */}
          {(stockAdditions.length > 0 || expenses.length > 0) && (
            <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  This Shift's Logged Activity
                </h3>
                <span className="text-xs font-mono text-muted tabular-nums">
                  {stockAdditions.length + expenses.length} entries
                </span>
              </div>

              <div className="divide-y divide-line-soft">
                {stockAdditions.map((ev) => (
                  <div key={ev.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    {editingAdditionId === ev.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-content font-semibold truncate">{ev.productName}</span>
                        <input
                          type="number"
                          step="any"
                          value={editingQtyStr}
                          onChange={(e) => setEditingQtyStr(e.target.value)}
                          className="w-20 min-h-[36px] bg-ink-soft border border-line-strong rounded-lg px-2 text-center font-mono text-content"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseFloat(editingQtyStr);
                            if (!isNaN(val) && val !== 0) {
                              store.updateStockAddition(ev.id, { quantity: val });
                              showToast('Updated restock entry.');
                            }
                            setEditingAdditionId(null);
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-brand text-ink font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAdditionId(null)}
                          className="min-h-[36px] px-2 text-muted hover:text-content cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="font-semibold text-content truncate">
                            <span className={ev.quantity >= 0 ? 'text-brand-strong font-mono' : 'text-warn font-mono'}>
                              {ev.quantity >= 0 ? `+${ev.quantity}` : ev.quantity}
                            </span>{' '}
                            {ev.productName}
                          </div>
                          <div className="text-[11px] text-muted truncate">
                            {ev.reason || (ev.quantity >= 0 ? 'Restock' : 'Reduction')} ·{' '}
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdditionId(ev.id);
                              setEditingQtyStr(String(ev.quantity));
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-content hover:bg-surface-2 cursor-pointer"
                            aria-label="Edit entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              store.deleteStockAddition(ev.id);
                              showToast('Entry removed.');
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-danger-tint/40 cursor-pointer"
                            aria-label="Remove entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {expenses.map((exp) => (
                  <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-content truncate">{exp.description}</div>
                      <div className="text-[11px] text-muted">
                        Expense ·{' '}
                        {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono font-bold text-danger tabular-nums">
                        -KES {exp.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          store.deleteExpense(exp.id);
                          showToast('Expense removed.');
                        }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-danger-tint/40 cursor-pointer"
                        aria-label="Remove expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Modal Sheet */}
      {quickActionMode && activeShift && (
        <QuickActionSheet
          mode={quickActionMode}
          shiftId={activeShift.id}
          workerName={currentUser.name || activeShift.workerName}
          products={products}
          shiftStockItems={shiftStockItems}
          initialProductId={quickActionProductId}
          onClose={() => {
            setQuickActionMode(null);
            setQuickActionProductId(undefined);
          }}
          onDone={showToast}
        />
      )}

      {showDispatchModal && (
        <InterBusinessDispatchModal
          products={products}
          inventory={inventory}
          partners={partners}
          onClose={() => setShowDispatchModal(false)}
          onSuccess={({ partnerName, productName, quantity }) => {
            setShowDispatchModal(false);
            showToast(`Dispatched ${quantity}x ${productName} to ${partnerName}`);
          }}
        />
      )}
    </div>
  );
};
