import React, { useMemo, useState } from 'react';
import { Product, ShiftStockItem } from '../../types';
import { store } from '../../services/store';
import { useBackHandler } from '../../services/navigationHistory';
import { intelligentMatch } from '../../utils/searchMatcher';
import {
  X,
  Search,
  Plus,
  Minus,
  Check,
  Banknote,
  PackagePlus,
  AlertTriangle,
} from 'lucide-react';

export type QuickActionMode = 'RESTOCK' | 'REDUCE' | 'EXPENSE';

interface QuickActionSheetProps {
  mode: QuickActionMode;
  shiftId: string;
  workerName: string;
  products: Product[];
  shiftStockItems: ShiftStockItem[];
  initialProductId?: string;
  onClose: () => void;
  onDone: (toastMessage: string) => void;
}

const EXPENSE_PRESETS = ['Ice Cubes', 'Cooking Gas', 'Transport / Boda', 'Cleaning', 'Airtime / Data'];
const RESTOCK_PRESETS = [1, 6, 12, 24];
const REDUCE_PRESETS = [1, 2, 3];

export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  mode,
  shiftId,
  workerName,
  products,
  shiftStockItems,
  initialProductId,
  onClose,
  onDone,
}) => {
  useBackHandler(true, onClose, `quick-action-${mode.toLowerCase()}`);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '');
  const [quantityStr, setQuantityStr] = useState<string>(mode === 'RESTOCK' ? '6' : '1');
  const [reason, setReason] = useState<string>('');

  const [expenseDesc, setExpenseDesc] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ssiMap = useMemo(() => new Map(shiftStockItems.map((s) => [s.productId, s])), [shiftStockItems]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return products;
    return products.filter((p) => intelligentMatch(q, p.name) || p.category.toLowerCase().includes(q.toLowerCase()));
  }, [products, searchQuery]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const getAvailableForProduct = (productId: string) => {
    const ssi = ssiMap.get(productId);
    if (!ssi) return 0;
    return (
      Number(ssi.openingPhysicalCount || 0) +
      Number(ssi.additions || 0) +
      Number(ssi.transfersIn || 0) -
      Number(ssi.transfersOut || 0) -
      Number(ssi.damages || 0) +
      Number(ssi.ownerAdjustments || 0)
    );
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedProduct) {
      setErrorMsg('Select a drink first.');
      return;
    }
    const qty = parseFloat(quantityStr);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Enter a quantity greater than 0.');
      return;
    }

    try {
      store.recordStockAdjustment({
        shiftId,
        productId: selectedProduct.id,
        quantity: qty,
        type: mode === 'RESTOCK' ? 'ADD' : 'REDUCE',
        reason: reason.trim() || (mode === 'RESTOCK' ? 'Restock Delivery' : 'Breakage / Adjustment'),
        workerName,
      });
      onDone(
        mode === 'RESTOCK'
          ? `Added +${qty} ${selectedProduct.name}`
          : `Logged -${qty} ${selectedProduct.name}`
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update stock.');
    }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc.trim()) {
      setErrorMsg('Enter what was paid for.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Enter a valid KES amount.');
      return;
    }

    try {
      store.recordExpense({
        shiftId,
        description: expenseDesc.trim(),
        amount,
        category: 'OTHER',
        paymentMethod: 'CASH',
      });
      onDone(`Logged expense: ${expenseDesc.trim()} (KES ${amount.toLocaleString()})`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save expense.');
    }
  };

  const title =
    mode === 'RESTOCK'
      ? 'Log Restock / Delivery'
      : mode === 'REDUCE'
      ? 'Log Breakage / Reduction'
      : 'Log Shift Expense';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-surface border-t sm:border border-line rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 pb-safe">
        <div className="w-10 h-1 rounded-full bg-line-strong mx-auto mt-2.5 sm:hidden shrink-0" />
        {/* Header */}
        <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            {mode === 'RESTOCK' ? (
              <PackagePlus className="w-5 h-5 text-brand-strong shrink-0" />
            ) : mode === 'REDUCE' ? (
              <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
            ) : (
              <Banknote className="w-5 h-5 text-danger shrink-0" />
            )}
            <h3 className="text-base font-bold text-content">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-content hover:bg-surface-2 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger-tint border border-danger-line text-xs text-content">
              {errorMsg}
            </div>
          )}

          {mode === 'EXPENSE' ? (
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Quick Picks
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExpenseDesc(preset)}
                      className={`min-h-[38px] px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        expenseDesc === preset
                          ? 'bg-brand-tint border-brand-line text-brand-strong'
                          : 'bg-ink-soft border-line text-muted hover:text-content'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Ice cubes or delivery boda"
                  className="w-full min-h-[46px] bg-ink-soft border border-line-strong focus:border-brand rounded-xl px-3.5 text-sm text-content placeholder:text-faint focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Amount Paid (KES)
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="1"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[48px] bg-ink-soft border border-line-strong focus:border-brand rounded-xl px-3.5 text-lg font-mono font-bold text-content tabular-nums focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Expense</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleStockSubmit} className="space-y-4">
              {!selectedProduct ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search drink name..."
                      className="w-full min-h-[44px] bg-ink-soft border border-line-strong focus:border-brand rounded-xl pl-9 pr-3 text-sm text-content placeholder:text-faint focus:outline-none"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-line-soft border border-line rounded-xl bg-ink-soft">
                    {filteredProducts.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted">No matching drinks found.</div>
                    ) : (
                      filteredProducts.map((p) => {
                        const avail = getAvailableForProduct(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedProductId(p.id)}
                            className="w-full min-h-[52px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-surface-2 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-content truncate">{p.name}</div>
                              <div className="text-[11px] text-muted font-mono tabular-nums">
                                Avail {avail} · KES {p.sellingPrice.toLocaleString()}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-brand-strong shrink-0">Select</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-ink-soft border border-line flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-content truncate">{selectedProduct.name}</div>
                      <div className="text-xs text-muted font-mono tabular-nums">
                        Available now: {getAvailableForProduct(selectedProduct.id)}
                      </div>
                    </div>
                    {!initialProductId && (
                      <button
                        type="button"
                        onClick={() => setSelectedProductId('')}
                        className="min-h-[38px] px-3 rounded-lg bg-surface-2 text-xs font-semibold text-muted hover:text-content cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {/* Quick Quantity Presets */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                      Quick Quantity
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(mode === 'RESTOCK' ? RESTOCK_PRESETS : REDUCE_PRESETS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuantityStr(String(preset))}
                          className={`min-h-[42px] min-w-[54px] px-3 rounded-xl font-mono text-sm font-bold border transition-colors cursor-pointer tabular-nums ${
                            quantityStr === String(preset)
                              ? 'bg-brand-tint border-brand-line text-brand-strong'
                              : 'bg-ink-soft border-line text-content hover:bg-surface-2'
                          }`}
                        >
                          {mode === 'RESTOCK' ? `+${preset}` : `-${preset}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stepper Input */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(quantityStr) || 0;
                        setQuantityStr(String(Math.max(1, cur - 1)));
                      }}
                      className="min-w-[48px] min-h-[48px] rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      min="0.01"
                      required
                      value={quantityStr}
                      onChange={(e) => setQuantityStr(e.target.value)}
                      className="flex-1 min-h-[48px] bg-ink-soft border border-line-strong focus:border-brand rounded-xl text-center font-mono text-xl font-bold text-content tabular-nums focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(quantityStr) || 0;
                        setQuantityStr(String(cur + 1));
                      }}
                      className="min-w-[48px] min-h-[48px] rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={mode === 'RESTOCK' ? 'e.g. Store crate restock' : 'e.g. Broken bottle on shelf'}
                      className="w-full min-h-[44px] bg-ink-soft border border-line rounded-xl px-3.5 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand"
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full min-h-[48px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      mode === 'RESTOCK'
                        ? 'bg-brand hover:bg-brand-strong text-ink'
                        : 'bg-warn hover:opacity-90 text-ink'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {mode === 'RESTOCK'
                        ? `Add +${quantityStr || 0} to Counter`
                        : `Log -${quantityStr || 0} Reduction`}
                    </span>
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
