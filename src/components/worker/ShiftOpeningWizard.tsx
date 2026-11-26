import React, { useMemo, useState } from 'react';
import { Product, InventoryItem } from '../../types';
import { store } from '../../services/store';
import {
  Smartphone,
  Coins,
  X,
  Check,
  AlertTriangle,
  Search,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ShiftOpeningWizardProps {
  products: Product[];
  inventory: InventoryItem[];
  workerName: string;
  onConfirmOpen: (data: {
    openingCoinsFloat: number;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
    inconsistencyNote?: string;
  }) => void;
  isRevision?: boolean;
  initialStep?: 1 | 2;
  onCancel?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  BEER: 'Beers',
  CIDER: 'Ciders',
  SPIRIT: 'Spirits',
  WINE: 'Wines',
  SOFT_DRINK: 'Soft Drinks',
  CIGARETTE: 'Cigarettes',
};

export const ShiftOpeningWizard: React.FC<ShiftOpeningWizardProps> = ({
  products,
  inventory,
  workerName,
  onConfirmOpen,
  isRevision = false,
  onCancel,
}) => {
  const activeShift = isRevision ? store.getActiveShift() : null;
  const lastClosedShift = store.getLastClosedShift();
  const shiftStockItems = isRevision && activeShift ? store.getShiftStockItems(activeShift.id) : [];

  const [openingCoinsFloat, setOpeningCoinsFloat] = useState<string>(
    activeShift
      ? String(activeShift.openingCoinsFloat ?? activeShift.openingCashFloat ?? 0)
      : String(lastClosedShift?.closingCoinsActual ?? 0)
  );
  const [openingMpesaBalance, setOpeningMpesaBalance] = useState<string>(
    activeShift
      ? String(activeShift.openingMpesaBalance ?? 0)
      : String(lastClosedShift?.closingMpesaBalance ?? 0)
  );
  const [showMismatchPanel, setShowMismatchPanel] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inconsistencyNote, setInconsistencyNote] = useState<string>('');

  const systemCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (isRevision && activeShift) {
        const ssi = shiftStockItems.find((s) => s.productId === p.id);
        map[p.id] = ssi ? ssi.openingPhysicalCount : 0;
      } else {
        const inv = inventory.find((i) => i.productId === p.id);
        map[p.id] = inv ? Number(inv.quantityOnHand || 0) : 0;
      }
    });
    return map;
  }, [products, inventory, isRevision, activeShift, shiftStockItems]);

  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...systemCounts }));

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const totalExpectedUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + (systemCounts[p.id] || 0), 0);
  }, [products, systemCounts]);

  const mismatchItems = useMemo(() => {
    return products.filter((p) => (counts[p.id] ?? systemCounts[p.id] ?? 0) !== (systemCounts[p.id] ?? 0));
  }, [products, counts, systemCounts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleAdjustCount = (productId: string, nextVal: number) => {
    const clean = Math.max(0, Math.round(nextVal * 100) / 100);
    setCounts((prev) => ({ ...prev, [productId]: clean }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmOpen({
      openingCoinsFloat: parseFloat(openingCoinsFloat) || 0,
      openingCashFloat: 0,
      openingMpesaBalance: parseFloat(openingMpesaBalance) || 0,
      physicalCounts: counts,
      inconsistencyNote: inconsistencyNote.trim() || undefined,
    });
  };

  return (
    <div className="max-w-xl mx-auto py-2 sm:py-4">
      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-line-soft">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
              {isRevision ? 'Revise Opening Floats' : 'Shift Handover Verification'}
            </div>
            <h2 className="text-lg font-bold text-content mt-0.5">
              {isRevision ? 'Update Drawer & M-Pesa Float' : `Opening Counter · ${workerName}`}
            </h2>
            {!isRevision && lastClosedShift && (
              <p className="text-xs text-muted mt-1">
                Inherited from {lastClosedShift.workerName} ·{' '}
                {new Date(lastClosedShift.closedAt || lastClosedShift.openedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          {isRevision && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-w-[44px] min-h-[44px] rounded-xl text-muted hover:text-content hover:bg-surface-2 flex items-center justify-center cursor-pointer"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Summary Strip */}
        {!isRevision && (
          <div className="grid grid-cols-3 divide-x divide-line-soft bg-ink-soft border border-line rounded-xl py-2.5 text-center">
            <div className="px-2">
              <span className="text-[11px] text-muted block">Menu Items</span>
              <span className="text-sm font-mono font-bold text-content tabular-nums">
                {products.length}
              </span>
            </div>
            <div className="px-2">
              <span className="text-[11px] text-muted block">Expected Stock</span>
              <span className="text-sm font-mono font-bold text-brand-strong tabular-nums">
                {totalExpectedUnits.toLocaleString()}
              </span>
            </div>
            <div className="px-2">
              <span className="text-[11px] text-muted block">Mismatches</span>
              <span
                className={`text-sm font-mono font-bold tabular-nums ${
                  mismatchItems.length > 0 ? 'text-warn' : 'text-content'
                }`}
              >
                {mismatchItems.length}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Opening Floats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-ink-soft border border-line rounded-xl p-3.5 space-y-1.5">
              <label className="text-[11px] font-semibold text-warn uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>Opening Coins (KES)</span>
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min="0"
                value={openingCoinsFloat}
                onChange={(e) => setOpeningCoinsFloat(e.target.value)}
                className="w-full min-h-[44px] bg-surface-2 border border-line-strong focus:border-brand rounded-xl px-3.5 py-2 text-base font-bold font-mono text-content focus:outline-none tabular-nums"
                placeholder="0"
              />
            </div>

            <div className="bg-ink-soft border border-line rounded-xl p-3.5 space-y-1.5">
              <label className="text-[11px] font-semibold text-brand-strong uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Opening M-Pesa (KES)</span>
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min="0"
                value={openingMpesaBalance}
                onChange={(e) => setOpeningMpesaBalance(e.target.value)}
                className="w-full min-h-[44px] bg-surface-2 border border-line-strong focus:border-brand rounded-xl px-3.5 py-2 text-base font-bold font-mono text-content focus:outline-none tabular-nums"
                placeholder="0"
              />
            </div>
          </div>

          {/* Expandable Flag Opening Mismatch */}
          {!isRevision && products.length > 0 && (
            <div className="border border-line rounded-xl overflow-hidden bg-ink-soft">
              <button
                type="button"
                onClick={() => setShowMismatchPanel((v) => !v)}
                className="w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between text-left hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${mismatchItems.length > 0 ? 'text-warn' : 'text-muted'}`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-content">
                      Flag Opening Stock Mismatch
                    </div>
                    <div className="text-[11px] text-muted truncate">
                      {mismatchItems.length > 0
                        ? `${mismatchItems.length} item(s) differ from handover`
                        : 'Only open if shelf bottles do not match handover'}
                    </div>
                  </div>
                </div>
                {showMismatchPanel ? (
                  <ChevronUp className="w-4 h-4 text-muted shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                )}
              </button>

              {showMismatchPanel && (
                <div className="border-t border-line p-3.5 space-y-3">
                  {/* Search & Category Tabs */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Find mismatched drink..."
                      className="w-full min-h-[42px] bg-surface border border-line rounded-xl pl-9 pr-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                        selectedCategory === 'ALL'
                          ? 'bg-brand-tint text-brand-strong border border-brand-line'
                          : 'bg-surface text-muted border border-line'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-brand-tint text-brand-strong border border-brand-line'
                            : 'bg-surface text-muted border border-line'
                        }`}
                      >
                        {CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Items */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-line-soft border border-line rounded-xl bg-surface">
                    {filteredProducts.map((p) => {
                      const expected = systemCounts[p.id] ?? 0;
                      const actual = counts[p.id] ?? expected;
                      const diff = actual - expected;

                      return (
                        <div key={p.id} className="p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 basis-36">
                            <div className="text-xs font-semibold text-content truncate">{p.name}</div>
                            <div className="text-[11px] text-muted font-mono tabular-nums mt-0.5">
                              Expected {expected}
                              {diff !== 0 && (
                                <span className={diff < 0 ? ' text-danger font-bold' : ' text-brand-strong font-bold'}>
                                  {' · '}
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleAdjustCount(p.id, actual - 1)}
                              className="w-11 h-11 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer active:scale-95"
                              aria-label={`Decrease ${p.name}`}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              min="0"
                              value={actual}
                              onChange={(e) => {
                                const parsed = parseFloat(e.target.value);
                                handleAdjustCount(p.id, isNaN(parsed) ? 0 : parsed);
                              }}
                              className="w-16 h-11 rounded-xl bg-ink-soft border border-line-strong text-center font-mono text-sm font-bold text-content tabular-nums focus:outline-none focus:border-brand"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustCount(p.id, actual + 1)}
                              className="w-11 h-11 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer active:scale-95"
                              aria-label={`Increase ${p.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {mismatchItems.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                        Handover Discrepancy Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={inconsistencyNote}
                        onChange={(e) => setInconsistencyNote(e.target.value)}
                        placeholder="e.g. 2 Tusker bottles missing on top shelf at handover"
                        className="w-full min-h-[42px] bg-surface border border-line rounded-xl px-3 text-xs text-content placeholder:text-faint focus:outline-none focus:border-warn"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            {isRevision && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[48px] py-3 px-4 rounded-xl bg-surface-2 hover:bg-surface-3 text-muted hover:text-content font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 min-h-[50px] py-3.5 px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {isRevision
                  ? 'Save Opening Floats'
                  : mismatchItems.length > 0
                  ? `Flag ${mismatchItems.length} Mismatch & Start Shift`
                  : 'Accept Opening Stock & Start Shift'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
