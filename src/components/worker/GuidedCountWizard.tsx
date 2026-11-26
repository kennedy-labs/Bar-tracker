import React, { useMemo, useState, useEffect } from 'react';
import { Product, Shift, ShiftStockItem, StockAdditionRecord } from '../../types';
import { store } from '../../services/store';
import { useBackHandler } from '../../services/navigationHistory';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Coins,
  Banknote,
  Smartphone,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';

interface GuidedCountWizardProps {
  shift: Shift;
  products: Product[];
  shiftStockItems: ShiftStockItem[];
  stockAdditions: StockAdditionRecord[];
  onExitToHub: () => void;
  onShiftClosed: () => void;
  onToast: (msg: string) => void;
}

const CATEGORY_ORDER = [
  'BEER',
  'CIDER',
  'SPIRIT',
  'WINE',
  'SOFT_DRINK',
  'CIGARETTE',
];

const CATEGORY_LABELS: Record<string, string> = {
  BEER: 'Beers',
  CIDER: 'Ciders',
  SPIRIT: 'Spirits',
  WINE: 'Wines',
  SOFT_DRINK: 'Soft Drinks',
  CIGARETTE: 'Cigarettes',
  DRAWER: 'Drawer Cash',
};

export const GuidedCountWizard: React.FC<GuidedCountWizardProps> = ({
  shift,
  products,
  shiftStockItems,
  onExitToHub,
  onShiftClosed,
  onToast,
}) => {
  useBackHandler(true, onExitToHub, 'guided-count-wizard');

  const initialDraft = useMemo(() => store.getHandoverDraft(shift.id), [shift.id]);

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const ordered = CATEGORY_ORDER.filter((c) => present.has(c as any));
    products.forEach((p) => {
      if (p.category && !ordered.includes(p.category)) {
        ordered.push(p.category);
      }
    });
    return ordered;
  }, [products]);

  const steps = useMemo(() => [...categories, 'DRAWER'], [categories]);

  const [activeStep, setActiveStep] = useState<string>(() => {
    if (initialDraft?.activeCategory && steps.includes(initialDraft.activeCategory)) {
      return initialDraft.activeCategory;
    }
    return steps[0] || 'DRAWER';
  });

  const [countedIds, setCountedIds] = useState<string[]>(() => {
    const fromSsi = shiftStockItems
      .filter((s) => s.closingPhysicalCount !== undefined)
      .map((s) => s.productId);
    const merged = new Set([...(initialDraft?.countedProductIds || []), ...fromSsi]);
    return Array.from(merged);
  });

  const [closingCoinsStr, setClosingCoinsStr] = useState<string>(() =>
    initialDraft?.closingCoinsActual !== undefined ? String(initialDraft.closingCoinsActual) : ''
  );
  const [closingCashStr, setClosingCashStr] = useState<string>(() =>
    initialDraft?.closingCashActual !== undefined ? String(initialDraft.closingCashActual) : ''
  );
  const [closingMpesaStr, setClosingMpesaStr] = useState<string>(() =>
    initialDraft?.closingMpesaBalance !== undefined ? String(initialDraft.closingMpesaBalance) : ''
  );
  const [closingNotes, setClosingNotes] = useState<string>(() => initialDraft?.closingNotes || '');
  const [localInputs, setLocalInputs] = useState<Record<string, string>>({});
  const [filterQuery, setFilterQuery] = useState<string>('');

  const ssiMap = useMemo(() => new Map(shiftStockItems.map((s) => [s.productId, s])), [shiftStockItems]);
  const countedSet = useMemo(() => new Set(countedIds), [countedIds]);

  const getAvailable = (p: Product): number => {
    const ssi = ssiMap.get(p.id);
    if (!ssi) return 0;
    return Math.max(
      0,
      Math.round(
        (Number(ssi.openingPhysicalCount || 0) +
          Number(ssi.additions || 0) +
          Number(ssi.transfersIn || 0) -
          Number(ssi.transfersOut || 0) -
          Number(ssi.damages || 0) +
          Number(ssi.ownerAdjustments || 0)) *
          100
      ) / 100
    );
  };

  const getClosingValue = (p: Product): number => {
    const ssi = ssiMap.get(p.id);
    if (ssi?.closingPhysicalCount !== undefined) return Number(ssi.closingPhysicalCount);
    const draftVal = initialDraft?.closingPhysicalCounts?.[p.id];
    if (draftVal !== undefined) return Number(draftVal);
    return getAvailable(p);
  };

  const persistDraft = (
    nextStep: string,
    nextCountedIds: string[],
    overrides?: Partial<{
      closingCoinsActual: string;
      closingCashActual: string;
      closingMpesaBalance: string;
      closingNotes: string;
    }>
  ) => {
    const existingCounts: Record<string, number> = {};
    products.forEach((p) => {
      const ssi = ssiMap.get(p.id);
      if (ssi?.closingPhysicalCount !== undefined) {
        existingCounts[p.id] = Number(ssi.closingPhysicalCount);
      }
    });

    store.saveHandoverDraft(shift.id, {
      step: nextStep === 'DRAWER' ? 3 : 2,
      closingPhysicalCounts: existingCounts,
      countedProductIds: nextCountedIds,
      activeCategory: nextStep,
      closingCoinsActual: overrides?.closingCoinsActual ?? closingCoinsStr,
      closingCashActual: overrides?.closingCashActual ?? closingCashStr,
      closingMpesaBalance: overrides?.closingMpesaBalance ?? closingMpesaStr,
      closingNotes: overrides?.closingNotes ?? closingNotes,
    });
  };

  // Persist draft when money inputs or step change
  useEffect(() => {
    const timer = setTimeout(() => {
      persistDraft(activeStep, countedIds);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, closingCoinsStr, closingCashStr, closingMpesaStr, closingNotes]);

  const setProductClosing = (product: Product, nextClosing: number) => {
    const clean = Math.max(0, Math.round(nextClosing * 100) / 100);
    store.updateShiftStockItemRow({
      shiftId: shift.id,
      productId: product.id,
      closingPhysicalCount: clean,
    });
    const nextCounted = countedSet.has(product.id) ? countedIds : [...countedIds, product.id];
    setCountedIds(nextCounted);
    setLocalInputs((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
    persistDraft(activeStep, nextCounted);
  };

  const setMakaliClosing = (product: Product, units: number, valueRemainder: number) => {
    const pricePerUnit = product.pricePerUnit || product.sellingPrice || 1;
    const cleanUnits = Math.max(0, Math.floor(units));
    const cleanRem = Math.max(0, valueRemainder);
    const effectivePhysical = cleanUnits + (cleanRem / pricePerUnit);

    store.updateShiftStockItemRow({
      shiftId: shift.id,
      productId: product.id,
      closingUnits: cleanUnits,
      closingValueRemainder: cleanRem,
      closingPhysicalCount: effectivePhysical,
    });
    const nextCounted = countedSet.has(product.id) ? countedIds : [...countedIds, product.id];
    setCountedIds(nextCounted);
    persistDraft(activeStep, nextCounted);
  };

  const setMuratinaClosing = (product: Product, litres: number) => {
    const volTotal = product.volumeTotal || 10;
    const cleanLitres = Math.max(0, litres);
    const effectivePhysical = cleanLitres / volTotal;

    store.updateShiftStockItemRow({
      shiftId: shift.id,
      productId: product.id,
      closingLitres: cleanLitres,
      closingPhysicalCount: effectivePhysical,
    });
    const nextCounted = countedSet.has(product.id) ? countedIds : [...countedIds, product.id];
    setCountedIds(nextCounted);
    persistDraft(activeStep, nextCounted);
  };

  const setKegClosing = (product: Product, grossWeightKg: number) => {
    const fullWt = product.fullWeightKg || 60;
    const emptyWt = product.emptyWeightKg || 12;
    const netPerTank = Math.max(1, fullWt - emptyWt);
    const cleanGross = Math.max(0, grossWeightKg);
    const netClosingKg = Math.max(0, cleanGross - emptyWt);
    const effectivePhysical = netClosingKg / netPerTank;

    store.updateShiftStockItemRow({
      shiftId: shift.id,
      productId: product.id,
      closingGrossWeightKg: cleanGross,
      closingPhysicalCount: effectivePhysical,
    });
    const nextCounted = countedSet.has(product.id) ? countedIds : [...countedIds, product.id];
    setCountedIds(nextCounted);
    persistDraft(activeStep, nextCounted);
  };

  const stepIndex = steps.indexOf(activeStep);
  const currentCategoryProducts = useMemo(() => {
    if (activeStep === 'DRAWER') return [];
    const catProducts = products.filter((p) => p.category === activeStep);
    const q = filterQuery.trim().toLowerCase();
    if (!q) return catProducts;
    return catProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, activeStep, filterQuery]);

  const totalVerifiedOverall = useMemo(() => {
    return products.filter((p) => countedSet.has(p.id) || ssiMap.get(p.id)?.closingPhysicalCount !== undefined).length;
  }, [products, countedSet, ssiMap]);

  const handleMarkRemainingUnsoldAndNext = () => {
    if (activeStep !== 'DRAWER') {
      const catAll = products.filter((p) => p.category === activeStep);
      const updates: Array<{ productId: string; closingPhysicalCount: number }> = [];
      const newlyCounted = new Set(countedIds);

      catAll.forEach((p) => {
        const ssi = ssiMap.get(p.id);
        const alreadyVerified = countedSet.has(p.id) || ssi?.closingPhysicalCount !== undefined;
        if (!alreadyVerified) {
          updates.push({
            productId: p.id,
            closingPhysicalCount: getAvailable(p),
          });
        }
        newlyCounted.add(p.id);
      });

      if (updates.length > 0) {
        store.bulkUpdateShiftClosingStock(shift.id, updates);
      }

      const nextCountedArr = Array.from(newlyCounted);
      setCountedIds(nextCountedArr);

      const nextStep = steps[stepIndex + 1] || 'DRAWER';
      setFilterQuery('');
      setActiveStep(nextStep);
      persistDraft(nextStep, nextCountedArr);
    }
  };

  const handlePrevStep = () => {
    if (stepIndex > 0) {
      setFilterQuery('');
      setActiveStep(steps[stepIndex - 1]);
    } else {
      onExitToHub();
    }
  };

  // Live final drawer reconciliation
  const closingCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      map[p.id] = getClosingValue(p);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, shiftStockItems]);

  const coinsVal = parseFloat(closingCoinsStr) || 0;
  const cashVal = parseFloat(closingCashStr) || 0;
  const mpesaVal = parseFloat(closingMpesaStr) || 0;

  const reconciliation = useMemo(() => {
    try {
      return store.calculateShiftReconciliation({
        shiftId: shift.id,
        closingPhysicalCounts: closingCountsMap,
        closingCoinsActual: coinsVal,
        closingCashActual: cashVal,
        closingMpesaBalance: mpesaVal,
      });
    } catch {
      return null;
    }
  }, [shift.id, closingCountsMap, coinsVal, cashVal, mpesaVal]);

  const isDrawerEntered =
    closingCoinsStr.trim() !== '' && closingCashStr.trim() !== '' && closingMpesaStr.trim() !== '';

  const handleConfirmClose = () => {
    if (!isDrawerEntered) {
      onToast('Enter Coins, Cash Notes, and M-Pesa Closing Balance before closing.');
      return;
    }
    try {
      store.closeShift({
        shiftId: shift.id,
        closingPhysicalCounts: closingCountsMap,
        closingCoinsActual: coinsVal,
        closingCashActual: cashVal,
        closingMpesaBalance: mpesaVal,
        closingNotes: closingNotes.trim() || undefined,
      });
      onToast('Shift closed and handed over.');
      onShiftClosed();
    } catch (err: any) {
      onToast(err?.message || 'Error closing shift.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-4">
      {/* Progress Header & Category Tabs (Scrollable in normal flow to keep fixed chrome <= 15%) */}
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
              Guided Closing Count
            </div>
            <h2 className="text-lg font-bold text-content">
              {CATEGORY_LABELS[activeStep] || activeStep.replace(/_/g, ' ')}
            </h2>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs font-mono font-bold text-content tabular-nums">
              {totalVerifiedOverall} / {products.length} verified
            </div>
            <button
              type="button"
              onClick={onExitToHub}
              className="min-h-[36px] px-2 -mr-2 text-xs font-medium text-muted hover:text-content underline cursor-pointer inline-flex items-center"
            >
              Pause to Hub
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-ink-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{
              width: `${products.length > 0 ? Math.min(100, Math.round((totalVerifiedOverall / products.length) * 100)) : 0}%`,
            }}
          />
        </div>

        {/* Category Segmented Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {steps.map((step) => {
            const isCurrent = activeStep === step;
            if (step === 'DRAWER') {
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep('DRAWER')}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-brand-tint border-brand-line text-brand-strong'
                      : 'bg-ink-soft border-line text-muted hover:text-content'
                  }`}
                >
                  Drawer Cash
                </button>
              );
            }

            const catItems = products.filter((p) => p.category === step);
            const catCounted = catItems.filter(
              (p) => countedSet.has(p.id) || ssiMap.get(p.id)?.closingPhysicalCount !== undefined
            ).length;
            const catDone = catItems.length > 0 && catCounted === catItems.length;

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  setFilterQuery('');
                  setActiveStep(step);
                }}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 tabular-nums ${
                  isCurrent
                    ? 'bg-brand-tint border-brand-line text-brand-strong font-semibold'
                    : catDone
                    ? 'bg-ink-soft border-brand-line/60 text-brand-strong'
                    : 'bg-ink-soft border-line text-muted hover:text-content'
                }`}
              >
                <span>{CATEGORY_LABELS[step] || step.replace(/_/g, ' ')}</span>
                <span className="font-mono text-[11px]">
                  {catCounted}/{catItems.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Drink Cards OR Final Drawer Reconciliation */}
      {activeStep !== 'DRAWER' ? (
        <div className="space-y-3">
          {products.filter((p) => p.category === activeStep).length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={`Filter ${CATEGORY_LABELS[activeStep] || activeStep.toLowerCase()}...`}
                className="w-full min-h-[42px] bg-surface border border-line rounded-xl pl-10 pr-9 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-muted hover:text-content cursor-pointer"
                  aria-label="Clear filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="bg-surface border border-line rounded-2xl divide-y divide-line-soft overflow-hidden">
            {currentCategoryProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">No drinks match "{filterQuery}".</div>
            ) : (
              currentCategoryProducts.map((p) => {
                const ssi = ssiMap.get(p.id);
                const open = Number(ssi?.openingPhysicalCount || 0);
                const added = Number(ssi?.additions || 0);
                const available = getAvailable(p);
                const closing = getClosingValue(p);
                const isVerified = countedSet.has(p.id) || ssi?.closingPhysicalCount !== undefined;

                const sold = Math.round(Math.max(0, available - closing) * 100) / 100;
                const rate = p.sellingPrice || 0;
                const revenue = Math.round(sold * rate * 100) / 100;
                const displayInput = localInputs[p.id] !== undefined ? localInputs[p.id] : String(closing);

                return (
                  <div key={p.id} className="p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isVerified ? 'text-brand-strong' : 'text-line-strong'
                            }`}
                          />
                          <span className="text-sm sm:text-base font-semibold text-content truncate">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-xs text-muted font-mono tabular-nums mt-0.5 sm:pl-5.5">
                          Open {open} · {added >= 0 ? `+${added}` : added} · Avail {available} · KES{' '}
                          {rate.toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-mono font-bold tabular-nums ${
                            sold > 0 ? 'text-brand-strong' : 'text-muted'
                          }`}
                        >
                          {sold > 0 ? `Sold ${sold}` : '0 sold'}
                        </div>
                        <div className="text-[11px] font-mono text-muted tabular-nums">
                          KES {revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Measured Inputs or Touch Stepper */}
                    {p.measurementMode === 'MAKALI' ? (
                      <div className="grid grid-cols-2 gap-2 sm:pl-5.5 pt-1">
                        <div>
                          <label className="text-[10px] font-mono uppercase text-muted">Whole Units</label>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            min="0"
                            value={localInputs[`${p.id}_units`] !== undefined ? localInputs[`${p.id}_units`] : String(ssi?.closingUnits ?? Math.floor(closing))}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalInputs((prev) => ({ ...prev, [`${p.id}_units`]: val }));
                            }}
                            onBlur={() => {
                              const u = parseFloat(localInputs[`${p.id}_units`] ?? String(ssi?.closingUnits ?? Math.floor(closing))) || 0;
                              const r = ssi?.closingValueRemainder || 0;
                              setMakaliClosing(p, u, r);
                            }}
                            className="w-full min-h-[42px] rounded-xl bg-ink-soft border border-line px-3 text-sm font-mono font-bold text-content focus:outline-none focus:border-brand"
                            placeholder="Units"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono uppercase text-muted">Extra Value (sh)</label>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            min="0"
                            value={localInputs[`${p.id}_rem`] !== undefined ? localInputs[`${p.id}_rem`] : String(ssi?.closingValueRemainder ?? 0)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalInputs((prev) => ({ ...prev, [`${p.id}_rem`]: val }));
                            }}
                            onBlur={() => {
                              const u = ssi?.closingUnits ?? Math.floor(closing);
                              const r = parseFloat(localInputs[`${p.id}_rem`] ?? String(ssi?.closingValueRemainder ?? 0)) || 0;
                              setMakaliClosing(p, u, r);
                            }}
                            className="w-full min-h-[42px] rounded-xl bg-ink-soft border border-line px-3 text-sm font-mono font-bold text-content focus:outline-none focus:border-brand"
                            placeholder="sh"
                          />
                        </div>
                      </div>
                    ) : p.measurementMode === 'MURATINA' ? (
                      <div className="sm:pl-5.5 pt-1 space-y-1">
                        <label className="text-[10px] font-mono uppercase text-muted">Remaining Litres (L)</label>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          min="0"
                          value={localInputs[`${p.id}_litres`] !== undefined ? localInputs[`${p.id}_litres`] : String(ssi?.closingLitres ?? (closing * (p.volumeTotal || 10)))}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocalInputs((prev) => ({ ...prev, [`${p.id}_litres`]: val }));
                          }}
                          onBlur={() => {
                            const l = parseFloat(localInputs[`${p.id}_litres`] ?? String(ssi?.closingLitres ?? (closing * (p.volumeTotal || 10)))) || 0;
                            setMuratinaClosing(p, l);
                          }}
                          className="w-full min-h-[42px] rounded-xl bg-ink-soft border border-line px-3 text-sm font-mono font-bold text-content focus:outline-none focus:border-brand"
                          placeholder="Litres"
                        />
                      </div>
                    ) : p.measurementMode === 'KEG' ? (
                      <div className="sm:pl-5.5 pt-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-mono uppercase text-muted">Scale Gross Weight (kg)</label>
                          <span className="text-[10px] font-mono text-brand-strong">
                            Tare: {p.emptyWeightKg || 12}kg · Net:{' '}
                            {Math.max(
                              0,
                              (parseFloat(localInputs[`${p.id}_keg`] ?? String(ssi?.closingGrossWeightKg ?? (closing * ((p.fullWeightKg || 60) - (p.emptyWeightKg || 12)) + (p.emptyWeightKg || 12)))) || 0) -
                                (p.emptyWeightKg || 12)
                            ).toFixed(1)}
                            kg
                          </span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          min="0"
                          value={localInputs[`${p.id}_keg`] !== undefined ? localInputs[`${p.id}_keg`] : String(ssi?.closingGrossWeightKg ?? (closing * ((p.fullWeightKg || 60) - (p.emptyWeightKg || 12)) + (p.emptyWeightKg || 12)))}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocalInputs((prev) => ({ ...prev, [`${p.id}_keg`]: val }));
                          }}
                          onBlur={() => {
                            const gross = parseFloat(localInputs[`${p.id}_keg`] ?? String(ssi?.closingGrossWeightKg ?? 0)) || 0;
                            setKegClosing(p, gross);
                          }}
                          className="w-full min-h-[42px] rounded-xl bg-ink-soft border border-line px-3 text-sm font-mono font-bold text-content focus:outline-none focus:border-brand"
                          placeholder="Gross kg"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2 sm:pl-5.5">
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setProductClosing(p, Math.max(0, closing - 1))}
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                            aria-label={`Decrease closing count for ${p.name}`}
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            min="0"
                            value={displayInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalInputs((prev) => ({ ...prev, [p.id]: val }));
                            }}
                            onBlur={() => {
                              const raw = localInputs[p.id];
                              if (raw === undefined) return;
                              const parsed = parseFloat(raw);
                              setProductClosing(p, isNaN(parsed) ? available : parsed);
                            }}
                            className={`w-16 sm:w-20 min-h-[44px] rounded-xl bg-ink-soft border text-center font-mono text-base font-bold text-content tabular-nums focus:outline-none focus:border-brand ${
                              isVerified ? 'border-brand-line' : 'border-line-strong'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => setProductClosing(p, closing + 1)}
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                            aria-label={`Increase closing count for ${p.name}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setProductClosing(p, available)}
                          className={`min-h-[44px] px-2.5 sm:px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap tabular-nums shrink-0 ${
                            isVerified && closing === available
                              ? 'bg-brand-tint border-brand-line text-brand-strong'
                              : 'bg-surface-2 hover:bg-surface-3 border-line text-content'
                          }`}
                        >
                          Same ({available})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* FINAL STEP: DRAWER MONEY & HANDOVER SIGN-OFF */
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-content">Count Cash & M-Pesa Drawer</h3>
              <p className="text-xs text-muted mt-0.5">
                Enter what is physically left in the coins tray, cash notes box, and M-Pesa till.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-ink-soft border border-line rounded-xl p-3.5 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-warn flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Closing Coins (KES)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="0"
                  value={closingCoinsStr}
                  onChange={(e) => setClosingCoinsStr(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[48px] bg-surface-2 border border-line-strong focus:border-brand rounded-xl px-3 text-lg font-mono font-bold text-content tabular-nums focus:outline-none"
                />
              </div>

              <div className="bg-ink-soft border border-line rounded-xl p-3.5 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-content flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-brand-strong" />
                  <span>Cash Notes (KES)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="0"
                  value={closingCashStr}
                  onChange={(e) => setClosingCashStr(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[48px] bg-surface-2 border border-line-strong focus:border-brand rounded-xl px-3 text-lg font-mono font-bold text-content tabular-nums focus:outline-none"
                />
              </div>

              <div className="bg-ink-soft border border-line rounded-xl p-3.5 space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-brand-strong flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>M-Pesa Balance (KES)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min="0"
                  value={closingMpesaStr}
                  onChange={(e) => setClosingMpesaStr(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[48px] bg-surface-2 border border-line-strong focus:border-brand rounded-xl px-3 text-lg font-mono font-bold text-content tabular-nums focus:outline-none"
                />
              </div>
            </div>

            {reconciliation && (
              <div className="border-t border-line-soft pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center bg-ink-soft border border-line rounded-xl p-3">
                  <div>
                    <span className="text-[11px] text-muted block">Expected Sales</span>
                    <span className="text-sm font-mono font-bold text-content tabular-nums">
                      KES {reconciliation.expectedSalesRevenue.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Expenses Paid</span>
                    <span className="text-sm font-mono font-bold text-warn tabular-nums">
                      KES {reconciliation.totalExpenses.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Money Collected</span>
                    <span className="text-sm font-mono font-bold text-brand-strong tabular-nums">
                      KES {reconciliation.totalIncomeReturned.toLocaleString()}
                    </span>
                  </div>
                </div>

                {isDrawerEntered && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
                      reconciliation.financialVariance === 0
                        ? 'bg-brand-tint border-brand-line text-brand-strong'
                        : reconciliation.financialVariance < 0
                        ? 'bg-danger-tint border-danger-line text-danger'
                        : 'bg-warn-tint border-warn-line text-warn'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {reconciliation.financialVariance === 0 ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {reconciliation.financialVariance === 0
                          ? 'Drawer Balanced'
                          : reconciliation.financialVariance < 0
                          ? 'Cash / M-Pesa Shortage'
                          : 'Surplus / Tip'}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {reconciliation.financialVariance === 0
                        ? 'KES 0'
                        : reconciliation.financialVariance < 0
                        ? `-KES ${Math.abs(reconciliation.financialVariance).toLocaleString()}`
                        : `+KES ${reconciliation.financialVariance.toLocaleString()}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Handover Notes for Next Attendant & Owner (Optional)
              </label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="e.g. Left 2 cold crates in lower fridge; paid boda KES 200"
                className="w-full bg-ink-soft border border-line rounded-xl p-3 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>
      )}

      {/* Slim Sticky Bottom Bar (compact height + safe area) */}
      <div className="fixed bottom-0 inset-x-0 z-30 min-h-[58px] py-1.5 pb-safe bg-ink/95 backdrop-blur-md border-t border-line px-3 flex items-center">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevStep}
            className="min-h-[44px] px-3.5 rounded-xl bg-surface border border-line text-content text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{stepIndex > 0 ? 'Prev' : 'Hub'}</span>
          </button>

          {activeStep !== 'DRAWER' ? (
            <button
              type="button"
              onClick={handleMarkRemainingUnsoldAndNext}
              className="flex-1 min-h-[44px] px-3 sm:px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
            >
              <span className="truncate">
                {stepIndex === steps.length - 2
                  ? 'Mark Unsold & Drawer'
                  : 'Unsold & Next'}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmClose}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Confirm & Close Shift</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
