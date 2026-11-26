import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Shift, Discrepancy, User } from '../../types';
import { store } from '../../services/store';
import { useBackHandler } from '../../services/navigationHistory';
import {
  Banknote,
  ShieldAlert,
  CheckCircle2,
  Edit2,
  PackagePlus,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react';

const ShiftDetailModal = React.lazy(() =>
  import('./ShiftDetailModal').then((m) => ({ default: m.ShiftDetailModal }))
);
const DiscrepancyResolveModal = React.lazy(() =>
  import('./DiscrepancyResolveModal').then((m) => ({ default: m.DiscrepancyResolveModal }))
);
const PartnerBarsManager = React.lazy(() =>
  import('./PartnerBarsManager').then((m) => ({ default: m.PartnerBarsManager }))
);
const StaffManager = React.lazy(() =>
  import('./StaffManager').then((m) => ({ default: m.StaffManager }))
);
const CatalogManager = React.lazy(() =>
  import('./CatalogManager').then((m) => ({ default: m.CatalogManager }))
);
const HandoverTimeline = React.lazy(() =>
  import('./HandoverTimeline').then((m) => ({ default: m.HandoverTimeline }))
);
const ProfileManager = React.lazy(() =>
  import('./ProfileManager').then((m) => ({ default: m.ProfileManager }))
);
const LiveLaunchManager = React.lazy(() =>
  import('./LiveLaunchManager').then((m) => ({ default: m.LiveLaunchManager }))
);

const SectionFallback: React.FC = () => (
  <div className="p-8 rounded-2xl bg-surface border border-line flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
  </div>
);

interface OwnerDashboardProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUpdateProfile?: (updatedUser: User) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onUpdateProfile,
}) => {
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<Shift | null>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [periodDays, setPeriodDays] = useState<1 | 7 | 30>(7);

  const checklistKey = `bar_track_hide_checklist_${currentUser.businessId || 'default'}`;
  const [showChecklist, setShowChecklist] = useState(() => {
    try {
      return localStorage.getItem(checklistKey) !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissChecklist = () => {
    setShowChecklist(false);
    try {
      localStorage.setItem(checklistKey, 'true');
    } catch {
      // ignore
    }
  };

  useBackHandler(Boolean(selectedShiftForAudit), () => setSelectedShiftForAudit(null), 'owner-shift-audit');
  useBackHandler(Boolean(selectedDiscrepancy), () => setSelectedDiscrepancy(null), 'owner-discrepancy-resolve');

  useEffect(() => {
    if (activeTab === 'catalog') {
      setActiveTab('stock');
    } else if (activeTab === 'reports' || activeTab === 'shifts') {
      setActiveTab('handovers');
    }
  }, [activeTab, setActiveTab]);

  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'FLAGGED' | 'RESOLVED'>('ALL');
  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    return store.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const currentBiz = store.getCurrentBusiness();
  const shifts = store.getShifts();
  const products = store.getProducts();
  const discrepancies = store.getDiscrepancies();
  const additions = store.getStockAdditions();
  const registeredWorkers = store
    .getUsers()
    .filter((u) => (!u.businessId || u.businessId === currentBiz.id) && u.role !== 'OWNER' && !u.isArchived);

  const pendingDiscrepancies = discrepancies.filter(
    (d) => d.status === 'FLAGGED' || d.status === 'INVESTIGATING'
  );

  const activeShifts = shifts.filter((s) => s.status === 'ACTIVE' || s.status === 'OPENING_VERIFICATION');
  const activeShift = activeShifts[0];
  const activeShiftIds = activeShifts.map((s) => s.id);
  const activeAdditions = additions.filter((a) => activeShiftIds.includes(a.shiftId));
  const activeExpenses = store.getExpenses().filter((e) => activeShiftIds.includes(e.shiftId));
  const hasUnreadActivity =
    activeAdditions.some((a) => !a.isReadByOwner) || activeExpenses.some((e) => !e.isReadByOwner);

  const liveActiveEstimate = useMemo(
    () => (activeShift ? store.getLiveShiftEstimate(activeShift.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeShift?.id, storeTick]
  );

  // Executive KPIs across selected period
  const pulseMetrics = useMemo(() => {
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const closedInPeriod = shifts.filter((s) => {
      if (s.status !== 'CLOSED') return false;
      const ts = new Date(s.closedAt || s.openedAt).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });

    let closedRevenue = 0;
    let closedCogs = 0;
    let closedExpenses = 0;
    let netVariance = 0;
    let shortageTotal = 0;
    let shortageCount = 0;
    let costedWeightedSum = 0;

    closedInPeriod.forEach((s) => {
      const rev = Number(s.expectedSalesRevenue || 0);
      closedRevenue += rev;
      closedCogs += Number(s.estimatedCogs || 0);
      closedExpenses += Number(s.totalExpenses || 0);
      costedWeightedSum += rev * Number(s.costedRevenueShare || 0);

      const v = Number(s.financialVariance || 0);
      netVariance += v;
      if (v < 0) {
        shortageTotal += Math.abs(v);
        shortageCount += 1;
      }
    });

    const liveRev = liveActiveEstimate?.revenue || 0;
    const liveCogs = liveActiveEstimate?.cogs || 0;
    const liveExp = liveActiveEstimate?.totalExpenses || 0;
    const liveCostShare = liveActiveEstimate?.costedShare || 0;

    const totalRevenue = Math.round((closedRevenue + liveRev) * 100) / 100;
    const totalCogs = Math.round((closedCogs + liveCogs) * 100) / 100;
    const totalExpenses = Math.round((closedExpenses + liveExp) * 100) / 100;
    const estNetProfit = Math.round((totalRevenue - totalCogs - totalExpenses) * 100) / 100;
    const marginPct = totalRevenue > 0 ? Math.round((estNetProfit / totalRevenue) * 100) : 0;
    const costedShare =
      totalRevenue > 0 ? (costedWeightedSum + liveRev * liveCostShare) / totalRevenue : 0;

    return {
      shiftCount: closedInPeriod.length + (activeShift ? 1 : 0),
      totalRevenue,
      estNetProfit,
      marginPct,
      costedShare,
      netVariance: Math.round(netVariance * 100) / 100,
      shortageTotal: Math.round(shortageTotal * 100) / 100,
      shortageCount,
    };
  }, [shifts, periodDays, liveActiveEstimate, activeShift]);

  const topMovers = useMemo(
    () => store.getTopMovingDrinks({ days: periodDays, limit: 8 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodDays, storeTick]
  );

  const lowStockAlerts = useMemo(
    () => store.getLowStockAlerts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeTick]
  );

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (discrepancyFilter === 'ALL') return true;
    return d.status === discrepancyFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 w-full">
      {/* 1. EXECUTIVE PULSE OVERVIEW */}
      {(activeTab === 'overview' || !activeTab) && (
        <div className="space-y-5">
          {/* Header + Period Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-content tracking-tight">
                {currentBiz.name} Pulse
              </h1>
              <p className="text-xs text-muted mt-0.5">
                {activeShift
                  ? `Active counter: ${activeShift.workerName} · Live Est. KES ${(liveActiveEstimate?.revenue || 0).toLocaleString()}`
                  : 'No active counter shift running right now'}
              </p>
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-line self-start sm:self-auto">
              {([
                { days: 1, label: 'Today' },
                { days: 7, label: '7 Days' },
                { days: 30, label: '30 Days' },
              ] as const).map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setPeriodDays(opt.days)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    periodDays === opt.days
                      ? 'bg-brand-tint text-brand-strong border border-brand-line'
                      : 'text-muted hover:text-content border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setup Checklist if empty */}
          {showChecklist && (products.length === 0 || registeredWorkers.length === 0) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-brand-line space-y-3 relative">
              <button
                type="button"
                onClick={handleDismissChecklist}
                className="absolute top-2.5 right-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-content hover:bg-surface-2 cursor-pointer"
                aria-label="Dismiss checklist"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-content">Bar Setup Checklist</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className="min-h-[46px] px-4 rounded-xl bg-brand hover:bg-brand-strong text-ink font-bold text-xs flex items-center justify-between cursor-pointer"
                >
                  <span>1. Add Bar Drinks & Costs</span>
                  {products.length > 0 && <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('staff')}
                  className="min-h-[46px] px-4 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content font-bold text-xs flex items-center justify-between cursor-pointer"
                >
                  <span>2. Register Attendants</span>
                  {registeredWorkers.length > 0 && <CheckCircle2 className="w-4 h-4 text-brand-strong" />}
                </button>
              </div>
            </div>
          )}

          {/* 4-KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* KPI 1: Revenue */}
            <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 space-y-1 min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted truncate">
                Sales Revenue
              </div>
              <div className="text-base sm:text-xl lg:text-2xl font-mono font-bold text-content tabular-nums truncate">
                KES {pulseMetrics.totalRevenue.toLocaleString()}
              </div>
              <div className="text-[11px] sm:text-xs text-muted truncate">
                {pulseMetrics.shiftCount} shift(s) · {periodDays === 1 ? '24h' : `${periodDays}d`}
              </div>
            </div>

            {/* KPI 2: Net Profit & Margin */}
            <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted truncate">
                  Est. Profit
                </span>
                {pulseMetrics.totalRevenue > 0 && (
                  <span className="text-[11px] font-mono font-bold text-brand-strong tabular-nums shrink-0">
                    {pulseMetrics.marginPct}%
                  </span>
                )}
              </div>
              <div className="text-base sm:text-xl lg:text-2xl font-mono font-bold text-brand-strong tabular-nums truncate">
                KES {pulseMetrics.estNetProfit.toLocaleString()}
              </div>
              {pulseMetrics.costedShare < 0.8 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className="text-[11px] sm:text-xs font-semibold text-warn hover:underline cursor-pointer text-left leading-tight"
                >
                  Add wholesale costs →
                </button>
              ) : (
                <div className="text-[11px] sm:text-xs text-muted truncate">After cost & expenses</div>
              )}
            </div>

            {/* KPI 3: Instant Cash & M-Pesa Shortage Detector */}
            <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 space-y-1 min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted truncate">
                Drawer Variance
              </div>
              <div
                className={`text-base sm:text-xl lg:text-2xl font-mono font-bold tabular-nums truncate ${
                  pulseMetrics.netVariance < 0
                    ? 'text-danger'
                    : pulseMetrics.netVariance > 0
                    ? 'text-warn'
                    : 'text-brand-strong'
                }`}
              >
                {pulseMetrics.netVariance === 0
                  ? 'Balanced'
                  : pulseMetrics.netVariance < 0
                  ? `-KES ${Math.abs(pulseMetrics.netVariance).toLocaleString()}`
                  : `+KES ${pulseMetrics.netVariance.toLocaleString()}`}
              </div>
              <div className="text-[11px] sm:text-xs text-muted truncate">
                {pulseMetrics.shortageCount > 0
                  ? `${pulseMetrics.shortageCount} short · -KES ${pulseMetrics.shortageTotal.toLocaleString()}`
                  : 'All closed reconciled'}
              </div>
            </div>

            {/* KPI 4: Active Shift & Alerts */}
            <div className="bg-surface border border-line rounded-2xl p-3.5 sm:p-4 space-y-1 min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted truncate">
                Counter & Alerts
              </div>
              <div className="text-base sm:text-xl lg:text-2xl font-mono font-bold text-content tabular-nums truncate">
                {activeShift ? activeShift.workerName : 'Idle'}
              </div>
              <div className="text-[11px] sm:text-xs text-muted truncate">
                {pendingDiscrepancies.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('discrepancies')}
                    className="text-danger font-semibold hover:underline cursor-pointer"
                  >
                    {pendingDiscrepancies.length} open alert(s) →
                  </button>
                ) : activeShift ? (
                  `${liveActiveEstimate?.countedCount || 0}/${liveActiveEstimate?.totalProducts || products.length} counted`
                ) : (
                  '0 pending alerts'
                )}
              </div>
            </div>
          </div>

          {/* Active Shift Restocks & Expenses Feed */}
          {(activeAdditions.length > 0 || activeExpenses.length > 0) && (
            <div className="bg-surface border border-line rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Live Active Shift Feed
                </span>
                {hasUnreadActivity && (
                  <button
                    type="button"
                    onClick={() => {
                      store.markAllStockAdditionsRead();
                      store.markAllExpensesRead();
                    }}
                    className="text-xs font-semibold text-info hover:underline cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>
              <div className="divide-y divide-line-soft">
                {activeAdditions.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => store.markStockAdditionRead(a.id)}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-2/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PackagePlus className={`w-4 h-4 shrink-0 ${!a.isReadByOwner ? 'text-info' : 'text-muted'}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-content truncate">
                          {a.quantity >= 0 ? `+${a.quantity}` : a.quantity} {a.productName}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {a.workerName} · {a.reason || 'Stock adjustment'}
                        </div>
                      </div>
                    </div>
                    {!a.isReadByOwner && (
                      <span className="text-[11px] font-semibold text-info shrink-0">New</span>
                    )}
                  </div>
                ))}

                {activeExpenses.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => store.markExpenseRead(e.id)}
                    className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-2/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Banknote className={`w-4 h-4 shrink-0 ${!e.isReadByOwner ? 'text-warn' : 'text-muted'}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-content truncate">
                          {e.description}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          Expense · {e.category.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-warn tabular-nums shrink-0">
                      KES {e.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Immediate Shortage & Discrepancy Radar */}
          {pendingDiscrepancies.length > 0 && (
            <div className="bg-surface border border-danger-line rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-danger">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Unresolved Shortages ({pendingDiscrepancies.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('discrepancies')}
                  className="text-xs font-semibold text-content hover:text-brand-strong cursor-pointer"
                >
                  View All →
                </button>
              </div>
              <div className="divide-y divide-line-soft">
                {pendingDiscrepancies.slice(0, 4).map((d) => (
                  <div key={d.id} className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="text-sm font-semibold text-content truncate">{d.itemName}</div>
                      <div className="text-xs text-muted font-mono tabular-nums leading-relaxed">
                        {d.responsibleWorkerName || d.workerName} · Exp {d.expected} · Act {d.actual} ·{' '}
                        <span className="text-danger font-bold">
                          KES {d.monetaryValue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDiscrepancy(d)}
                      className="min-h-[42px] px-3.5 rounded-xl bg-danger-tint border border-danger-line text-xs font-semibold text-content hover:opacity-90 cursor-pointer shrink-0 ml-auto"
                    >
                      Investigate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2-Column Split: Fastest Moving Drinks & Low-Stock Reorder Watchlist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Fastest Moving Drinks */}
            <div className="bg-surface border border-line rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-strong" />
                  <h2 className="text-sm font-bold text-content">Fastest Moving Drinks</h2>
                </div>
                <span className="text-xs text-muted font-mono">
                  Last {periodDays === 1 ? '24h' : `${periodDays}d`}
                </span>
              </div>

              {topMovers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  Sales leaderboard fills automatically once shifts record sold bottles.
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {topMovers.map((m, idx) => (
                    <div key={m.productId} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-right font-mono font-bold text-muted tabular-nums shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-content truncate">{m.name}</div>
                          <div className="text-[11px] text-muted font-mono tabular-nums">
                            {m.unitsSold} sold · On shelf {m.stockOnHand}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-content tabular-nums">
                          KES {m.revenue.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums">
                          {m.hasCost ? (
                            <span className="text-brand-strong">+KES {m.profit.toLocaleString()} profit</span>
                          ) : (
                            <span className="text-faint">Cost not set</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low-Stock Reorder Watchlist */}
            <div className="bg-surface border border-line rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warn" />
                  <h2 className="text-sm font-bold text-content">Reorder Watchlist</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stock')}
                  className="text-xs font-semibold text-brand-strong hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Stock & Costs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {lowStockAlerts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  All drinks are above their reorder threshold.
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {lowStockAlerts.slice(0, 8).map((item) => (
                    <div key={item.product.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-content truncate">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-muted font-mono tabular-nums">
                          Alert threshold ≤ {item.reorderLevel} {item.product.unit.toLowerCase()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            item.severity === 'OUT' ? 'text-danger' : 'text-warn'
                          }`}
                        >
                          {item.severity === 'OUT' ? 'OUT (0)' : `${item.quantityOnHand} left`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. HANDOVER ACCOUNTABILITY TRAIL TAB */}
      {(activeTab === 'handovers' || activeTab === 'reports' || activeTab === 'shifts') && (
        <Suspense fallback={<SectionFallback />}>
          <HandoverTimeline
            ownerName={currentUser.name}
            onInspectShift={(shift) => setSelectedShiftForAudit(shift)}
          />
        </Suspense>
      )}

      {/* 3. DISCREPANCY RADAR TAB */}
      {activeTab === 'discrepancies' && (
        <div className="bg-surface border border-line rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line-soft">
            <div>
              <h2 className="text-lg font-bold text-content flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-danger shrink-0" />
                <span>Shortages & Missing Stock</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Cash, M-Pesa, or shelf bottle mismatches flagged at opening or closing handover.
              </p>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['ALL', 'FLAGGED', 'RESOLVED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setDiscrepancyFilter(st)}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                    discrepancyFilter === st
                      ? 'bg-brand-tint border-brand-line text-brand-strong'
                      : 'bg-ink-soft border-line text-muted hover:text-content'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'FLAGGED' ? 'Needs Review' : 'Resolved'}
                </button>
              ))}
            </div>
          </div>

          {filteredDiscrepancies.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-9 h-9 text-brand mx-auto mb-2" />
              <div className="text-sm font-bold text-content">No Shortages Found</div>
              <p className="text-xs text-muted mt-1">
                All bottle counts and drawer totals match expected sales.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDiscrepancies.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    d.status === 'RESOLVED'
                      ? 'bg-ink-soft border-line opacity-80'
                      : 'bg-ink-soft border-danger-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-line-soft">
                    <div>
                      <div className="text-sm font-bold text-content">{d.itemName}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        {new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · Reported by{' '}
                        {d.workerName}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold uppercase ${
                        d.status === 'RESOLVED' ? 'text-brand-strong' : 'text-danger'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-[11px] text-muted font-sans">Expected</div>
                      <div className="font-bold text-content">{d.expected}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted font-sans">Actual</div>
                      <div className="font-bold text-content">{d.actual}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted font-sans">Variance</div>
                      <div className={`font-bold ${d.variance > 0 ? 'text-brand-strong' : 'text-danger'}`}>
                        {d.variance > 0 ? `+${d.variance}` : d.variance} (KES {d.monetaryValue.toLocaleString()})
                      </div>
                    </div>
                  </div>

                  {d.responsibleWorkerName && (
                    <div className="text-xs text-muted">
                      Accountable: <strong className="text-content">{d.responsibleWorkerName}</strong>
                    </div>
                  )}

                  {d.ownerNotes && (
                    <div className="text-xs text-muted">{d.ownerNotes}</div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedDiscrepancy(d)}
                    className="w-full min-h-[40px] rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-content font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{d.status === 'RESOLVED' ? 'Edit Note' : 'Investigate & Resolve'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. STOCK, PRICING & WHOLESALE COSTS */}
      {(activeTab === 'stock' || activeTab === 'catalog') && (
        <Suspense fallback={<SectionFallback />}>
          <CatalogManager />
        </Suspense>
      )}

      {/* 5. STAFF MANAGEMENT MODAL */}
      {activeTab === 'staff' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-surface border-t sm:border border-line shadow-2xl overflow-hidden pb-safe">
            <div className="w-10 h-1 rounded-full bg-line-strong mx-auto mt-2.5 sm:hidden shrink-0" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Staff Management
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-surface-2 hover:bg-surface-3 text-muted hover:text-content flex items-center justify-center cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              <Suspense fallback={<SectionFallback />}>
                <StaffManager currentUser={currentUser} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'partners' && (
        <Suspense fallback={<SectionFallback />}>
          <PartnerBarsManager />
        </Suspense>
      )}

      {activeTab === 'profile' && (
        <Suspense fallback={<SectionFallback />}>
          <ProfileManager currentUser={currentUser} onUpdateProfile={onUpdateProfile} />
        </Suspense>
      )}

      {activeTab === 'launch' && (
        <Suspense fallback={<SectionFallback />}>
          <LiveLaunchManager currentUser={currentUser} />
        </Suspense>
      )}

      {selectedShiftForAudit && (
        <Suspense fallback={null}>
          <ShiftDetailModal
            shift={selectedShiftForAudit}
            onClose={() => setSelectedShiftForAudit(null)}
          />
        </Suspense>
      )}

      {selectedDiscrepancy && (
        <Suspense fallback={null}>
          <DiscrepancyResolveModal
            discrepancy={selectedDiscrepancy}
            onClose={() => setSelectedDiscrepancy(null)}
            onResolve={(id, notes, status) => {
              store.resolveDiscrepancy(id, notes, status);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
