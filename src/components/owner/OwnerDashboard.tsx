import React, { useState, useEffect } from 'react';
import {
  Shift,
  Product,
  Discrepancy,
  OperationalEvent,
  InventoryItem,
  User,
} from '../../types';
import { store } from '../../services/store';
import { ShiftDetailModal } from './ShiftDetailModal';
import { DiscrepancyResolveModal } from './DiscrepancyResolveModal';
import { PartnerBarsManager } from './PartnerBarsManager';
import { StaffManager } from './StaffManager';
import { CatalogManager } from './CatalogManager';
import { MpesaConfigManager } from './MpesaConfigManager';
import { RestockAuditManager } from './RestockAuditManager';
import { EndOfShiftScreen } from '../worker/EndOfShiftScreen';
import {
  TrendingUp,
  AlertTriangle,
  Smartphone,
  Banknote,
  Receipt,
  Layers,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  Edit2,
  Check,
  CheckCheck,
  RefreshCw,
  Wine,
  PackagePlus,
  Lock,
} from 'lucide-react';

interface OwnerDashboardProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
}) => {
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<Shift | null>(null);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Filters
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'FLAGGED' | 'RESOLVED'>('ALL');
  const [eventSeverityFilter, setEventSeverityFilter] = useState<string>('ALL');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');

  const shifts = store.getShifts();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const events = store.getEvents(50);
  const discrepancies = store.getDiscrepancies();
  const additions = store.getStockAdditions();
  const pendingRestocksCount = additions.filter((a) => a.status === 'PENDING_OWNER_CONFIRMATION').length;

  const activeShifts = shifts.filter((s) => s.status === 'ACTIVE');
  const closedShifts = shifts.filter((s) => s.status === 'CLOSED');

  // Target ONE shift for the 4 banners: default to selected shift, or newest unreviewed shift, or most recent closed shift
  const targetShift =
    (selectedShiftId ? closedShifts.find((s) => s.id === selectedShiftId) : null) ||
    closedShifts.find((s) => !s.isReviewedByOwner) ||
    closedShifts[0] ||
    null;

  const isShiftRead = Boolean(targetShift?.isReviewedByOwner);
  const shiftExpectedSales = targetShift?.expectedSalesRevenue || 0;
  const shiftNetMpesa = targetShift?.calculatedMpesaIncome || 0;
  const shiftNetCash = targetShift?.calculatedCashIncome || 0;
  const shiftNetProfit = targetShift?.netProfit || 0;
  const shiftExpenses = targetShift?.totalExpenses || 0;

  const handleToggleShiftRead = (shiftId: string, currentReadState: boolean) => {
    store.markShiftReviewed(shiftId, currentUser.name, !currentReadState);
  };

  const pendingDiscrepancies = discrepancies.filter(
    (d) => d.status === 'FLAGGED' || d.status === 'INVESTIGATING'
  );

  // Price Edit Handlers
  const handleStartEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setEditSellingPrice(String(prod.sellingPrice));
    setEditCostPrice(String(prod.costPrice));
  };

  const handleSaveProductPricing = (productId: string) => {
    const sp = parseFloat(editSellingPrice);
    const cp = parseFloat(editCostPrice);
    if (!isNaN(sp) && !isNaN(cp)) {
      store.updateProductPricing(productId, sp, cp);
    }
    setEditingProductId(null);
  };

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (discrepancyFilter === 'ALL') return true;
    return d.status === discrepancyFilter;
  });

  const filteredEvents = events.filter((e) => {
    if (eventSeverityFilter === 'ALL') return true;
    return e.severity === eventSeverityFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-28 md:pb-16 w-full">
      {/* Real-time Status Pulse Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#121824] border border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <span>Real-Time Business Command</span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                {activeShifts.length} Station(s) Online
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Live automated status feeds, stock accountability, and financial calculations.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap w-full sm:w-auto">
          {pendingDiscrepancies.length > 0 && (
            <button
              onClick={() => setActiveTab('discrepancies')}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-red-950/60 border border-red-800 text-red-300 font-bold flex items-center justify-center gap-1.5 hover:bg-red-900/60 transition-colors cursor-pointer text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{pendingDiscrepancies.length} Alerts</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('events')}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700 text-xs"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Event Stream</span>
          </button>
        </div>
      </div>

      {/* 1. EXECUTIVE COMMAND CENTER OVERVIEW TAB */}
      {(activeTab === 'overview' || !activeTab) && (
        <div className="space-y-6">
          {/* Pending Restock Deliveries Alert Banner */}
          {pendingRestocksCount > 0 && (
            <div className="p-4 rounded-3xl bg-amber-950/40 border-2 border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                    Worker Restock Deliveries Reported
                  </div>
                  <div className="text-sm font-bold text-white">
                    {pendingRestocksCount} restock addition(s) awaiting your verification and lock.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('stock')}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Review & Lock Restock ({pendingRestocksCount})</span>
              </button>
            </div>
          )}

          {/* ONE-SHIFT SUMMARY HERO CONTAINER (WhatsApp-style Read/Unread) */}
          {targetShift ? (
            <div
              className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl transition-all duration-300 ${
                isShiftRead
                  ? 'bg-[#0E131E] border border-slate-800/80 shadow-md'
                  : 'bg-gradient-to-b from-[#111A29] via-[#0E1522] to-[#0A0E17] border-2 border-sky-500/70 shadow-xl shadow-sky-950/40 ring-1 ring-sky-500/25'
              }`}
            >
              {/* Header: Shift Identity + WhatsApp Read Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isShiftRead
                        ? 'bg-slate-800/50 text-sky-400 border-slate-700/60'
                        : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    }`}
                  >
                    {isShiftRead ? (
                      <CheckCheck className="w-5 h-5 text-sky-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-sky-400 animate-pulse" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                        Shift #{targetShift.shiftNumber}
                      </span>
                      <span className="text-xs text-slate-300 font-mono">
                        Attendant: <strong className="text-white font-bold">{targetShift.workerName}</strong>
                      </span>
                      {targetShift.closedAt && (
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                          • {new Date(targetShift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                          {new Date(targetShift.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* WhatsApp Status Indicator */}
                    <div className="flex items-center gap-2 mt-1">
                      {isShiftRead ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-slate-900/90 px-2.5 sm:px-3 py-1 rounded-full border border-slate-800 flex-wrap">
                          {/* WhatsApp iconic Double Blue Ticks */}
                          <span className="inline-flex items-center -space-x-1.5 text-sky-400">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                          <span className="text-sky-300 font-bold">Marked as Read</span>
                          {targetShift.reviewedAt && (
                            <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                              • By {targetShift.reviewedBy || 'Owner'} at{' '}
                              {new Date(targetShift.reviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-200 bg-sky-950/80 border border-sky-500/50 px-2.5 sm:px-3 py-1 rounded-full animate-pulse shadow-sm">
                          {/* WhatsApp Single Grey Tick */}
                          <Check className="w-3.5 h-3.5 text-slate-400 stroke-[2]" />
                          <span>New Shift Submitted • Unread</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Mark as Read / Unread / Inspect / Switch Shift */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto mt-1 sm:mt-0">
                  {isShiftRead ? (
                    <button
                      onClick={() => handleToggleShiftRead(targetShift.id, true)}
                      className="flex-1 sm:flex-initial text-xs text-slate-400 hover:text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition-colors cursor-pointer text-center"
                      title="Mark this shift as unread"
                    >
                      Mark as Unread
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleShiftRead(targetShift.id, false)}
                      className="flex-1 sm:flex-initial text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 px-4 py-2.5 rounded-xl transition-all shadow-md shadow-sky-950 flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Mark shift as reviewed and read"
                    >
                      <span className="inline-flex items-center -space-x-1 text-slate-950">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                      <span>Mark as Read</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedShiftForAudit(targetShift)}
                    className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 bg-slate-900/60 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Full Audit</span>
                  </button>

                  {/* If multiple closed shifts exist, mini selector */}
                  {closedShifts.length > 1 && (
                    <select
                      value={targetShift.id}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="w-full sm:w-auto text-xs bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-2.5 py-2 cursor-pointer font-mono"
                    >
                      {closedShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          Shift #{s.shiftNumber} ({s.workerName}) {s.isReviewedByOwner ? '✓✓ Read' : '✓ New'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* High-level KPI Cards (FOR THIS ONE SHIFT ONLY) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {/* 1. Total Expected Sales */}
                <div
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                    isShiftRead
                      ? 'bg-[#121824]/60 border-slate-800/80'
                      : 'bg-[#121824] border-slate-700/80 ring-1 ring-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 sm:mb-1">
                    <span className="font-medium text-[11px] sm:text-xs">Total Expected Sales</span>
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-white tabular-nums">
                    KES {shiftExpectedSales.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    Shift #{targetShift.shiftNumber} ({targetShift.workerName})
                  </div>
                </div>

                {/* 2. Net M-Pesa Received (READ ONLY - NO SETUP TILLS ENDPOINT) */}
                <div
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-default select-none ${
                    isShiftRead
                      ? 'bg-[#121824]/60 border-slate-800/80'
                      : 'bg-[#121824] border-slate-700/80 ring-1 ring-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 sm:mb-1">
                    <span className="flex items-center gap-1 font-medium text-[11px] sm:text-xs">
                      <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                      <span>Net M-Pesa</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                      Read Only
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                    KES {shiftNetMpesa.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    Closing - Opening delta
                  </div>
                </div>

                {/* 3. Net Cash Returned */}
                <div
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                    isShiftRead
                      ? 'bg-[#121824]/60 border-slate-800/80'
                      : 'bg-[#121824] border-slate-700/80 ring-1 ring-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 sm:mb-1">
                    <span className="flex items-center gap-1 font-medium text-[11px] sm:text-xs">
                      <Banknote className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                      <span>Net Cash</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/60">
                      Float Deducted
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-amber-400 tabular-nums">
                    KES {shiftNetCash.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    Drawer - KES {targetShift.openingCashFloat.toLocaleString()} float
                  </div>
                </div>

                {/* 4. Net Bar Profit */}
                <div
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                    isShiftRead
                      ? 'bg-[#121824]/60 border-slate-800/80'
                      : 'bg-[#121824] border-slate-700/80 ring-1 ring-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 sm:mb-1">
                    <span className="font-medium text-[11px] sm:text-xs">Net Bar Profit</span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 font-bold">
                      {shiftExpectedSales > 0
                        ? `${Math.round((shiftNetProfit / shiftExpectedSales) * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-300 tabular-nums">
                    KES {shiftNetProfit.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    After COGS & expenses
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty state when no shift is submitted yet */
            <div className="p-8 rounded-3xl bg-[#121824] border border-[#1E293B] text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-base font-bold text-white">Awaiting Shift Submission</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                When a counter attendant finishes and submits their shift handover, the 4 shift financial banners (Sales, M-Pesa, Cash, Profit) will appear here for review with WhatsApp-style read verification.
              </p>
            </div>
          )}

          {/* Active Counters Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Currently Active Shifts</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {activeShifts.length} Online
                </span>
              </h3>
            </div>

            {activeShifts.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#121824] border border-slate-800 text-center">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-300">No Counter Currently Active</div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Workers have not yet verified opening counts for this cycle.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {activeShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] shadow-lg relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                      <div>
                        <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <span>Shift #{shift.shiftNumber}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Attendant: <span className="text-slate-200 font-medium">{shift.workerName}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedShiftForAudit(shift)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Shift</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-xs">
                      <div className="p-2 sm:p-3 rounded-xl bg-[#0E1420] border border-slate-800">
                        <div className="text-[10px] text-slate-400 truncate">Entry M-Pesa</div>
                        <div className="font-mono font-bold text-emerald-400 text-xs sm:text-sm mt-0.5 truncate">
                          KES {shift.openingMpesaBalance.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 sm:p-3 rounded-xl bg-[#0E1420] border border-slate-800">
                        <div className="text-[10px] text-slate-400 truncate">Cash Float</div>
                        <div className="font-mono font-bold text-amber-400 text-xs sm:text-sm mt-0.5 truncate">
                          KES {shift.openingCashFloat.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 sm:p-3 rounded-xl bg-[#0E1420] border border-slate-800">
                        <div className="text-[10px] text-slate-400 truncate">Drinks Sold</div>
                        <div className="font-mono font-bold text-white text-xs sm:text-sm mt-0.5 truncate">
                          {shift.recordedSalesCount || 0} units
                        </div>
                      </div>
                    </div>

                    {shift.openingInconsistencyNote && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300">
                        <span className="font-bold">Opening Flag: </span>
                        {shift.openingInconsistencyNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Discrepancy Radar Preview on Overview */}
          {pendingDiscrepancies.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-red-950/20 border border-red-900/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-red-400 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Immediate Discrepancies Requiring Investigation</span>
                </div>
                <button
                  onClick={() => setActiveTab('discrepancies')}
                  className="text-xs font-semibold text-red-300 hover:text-white underline self-start sm:self-auto"
                >
                  View All ({pendingDiscrepancies.length})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {pendingDiscrepancies.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#121824] border border-red-900/40 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{d.itemName}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        Attendant: {d.workerName}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-red-400 mt-0.5">
                        Variance: {d.variance} (KES {d.monetaryValue.toLocaleString()})
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedDiscrepancy(d)}
                      className="px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer border border-red-700 shrink-0"
                    >
                      Investigate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Recent Event Ticker */}
          <div className="p-5 rounded-3xl bg-[#121824] border border-[#1E293B]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Operations Stream
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('events')}
                className="text-xs text-emerald-400 hover:underline font-mono"
              >
                Inspect All Events →
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {events.slice(0, 6).map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-[#0E1420] border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{evt.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {evt.description} · <span className="font-mono text-slate-500">By {evt.actorName}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE TICKER TAB */}
      {activeTab === 'events' && (
        <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <span>Automated Real-Time Status Stream</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of every bottle sold, cash movement, M-Pesa receipt, and shift change
              </p>
            </div>

            {/* Severity Filter (Horizontal Scrollable on Mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 w-full sm:w-auto">
              {['ALL', 'ALERT', 'WARNING', 'SUCCESS', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setEventSeverityFilter(sev)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    eventSeverityFilter === sev
                      ? 'bg-slate-700 text-white border-slate-600 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800/80">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="py-2.5 sm:py-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-900/30 px-1 sm:px-2 rounded-xl transition-colors"
              >
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      evt.severity === 'ALERT'
                        ? 'bg-red-500 ring-4 ring-red-500/20'
                        : evt.severity === 'WARNING'
                        ? 'bg-amber-400 ring-4 ring-amber-400/20'
                        : evt.severity === 'SUCCESS'
                        ? 'bg-emerald-400'
                        : 'bg-blue-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs sm:text-sm truncate">{evt.title}</div>
                    <div className="text-slate-300 text-xs mt-0.5 line-clamp-2">{evt.description}</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-1 truncate">
                      Recorded by {evt.actorName}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-[10px] sm:text-[11px] text-slate-400">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {evt.amount && (
                    <div className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
                      KES {evt.amount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. DISCREPANCY RADAR TAB */}
      {activeTab === 'discrepancies' && (
        <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
                <span>Discrepancy Investigation Desk</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatic differences flagged between expected physical reality & reported counts
              </p>
            </div>

            {/* Filter buttons (Horizontal Scrollable on Mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 w-full sm:w-auto">
              {(['ALL', 'FLAGGED', 'RESOLVED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setDiscrepancyFilter(st)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    discrepancyFilter === st
                      ? 'bg-slate-700 text-white border-slate-600 font-bold'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredDiscrepancies.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="text-base font-bold text-white">No Discrepancies Under This Filter</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Every shift physical count and M-Pesa balance has matched expected mathematical parameters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredDiscrepancies.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all ${
                    d.status === 'RESOLVED'
                      ? 'bg-[#151D2C] border-slate-800 opacity-75'
                      : 'bg-[#151D2C] border-red-900/60 shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-white">{d.itemName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Shift #{d.shiftNumber}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                        d.status === 'RESOLVED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 my-3 text-xs font-mono">
                    <div className="p-2 rounded-xl bg-[#0E1420] border border-slate-800">
                      <div className="text-[10px] text-slate-400">Expected</div>
                      <div className="font-bold text-slate-300 mt-0.5">{d.expected}</div>
                    </div>

                    <div className="p-2 rounded-xl bg-[#0E1420] border border-slate-800">
                      <div className="text-[10px] text-slate-400">Actual</div>
                      <div className="font-bold text-white mt-0.5">{d.actual}</div>
                    </div>

                    <div className="p-2 rounded-xl bg-[#0E1420] border border-slate-800">
                      <div className="text-[10px] text-slate-400">Variance</div>
                      <div className="font-bold text-red-400 mt-0.5">
                        {d.variance} (KES {d.monetaryValue.toLocaleString()})
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 mb-3 space-y-1">
                    <div>Attendant reporting: <span className="text-slate-200 font-medium">{d.workerName}</span></div>
                    {d.responsibleWorkerName && (
                      <div className="p-2 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-[11px] font-sans">
                        <strong className="text-red-300">⚠️ Liable for Missing Handover:</strong>{' '}
                        <span className="text-white font-bold">{d.responsibleWorkerName}</span>
                        <div className="text-[10px] text-red-400 mt-0.5">
                          Missing items identified during counter shift verification by incoming worker.
                        </div>
                      </div>
                    )}
                    {d.ownerNotes && (
                      <div className="mt-1 text-slate-300 italic bg-[#0E1420] p-2 rounded-lg border border-slate-800">
                        Remarks: {d.ownerNotes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedDiscrepancy(d)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{d.status === 'RESOLVED' ? 'Edit Resolution Note' : 'Investigate & Resolve'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SHIFTS TAB (HISTORICAL ACCOUNTABILITY) */}
      {activeTab === 'shifts' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Shift Records & Handover Receipts</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed record of every shift worked, money collected, and stock balances
              </p>
            </div>
          </div>

          {/* Mobile Shift Cards (for Phones) */}
          <div className="md:hidden space-y-3">
            {shifts.map((s) => {
              const netMpesa =
                s.calculatedMpesaIncome !== undefined
                  ? s.calculatedMpesaIncome
                  : (s.closingMpesaBalance || 0) - s.openingMpesaBalance;
              const netCash =
                s.calculatedCashIncome !== undefined
                  ? s.calculatedCashIncome
                  : (s.closingCashActual || 0) - s.openingCashFloat;
              const totalInc = s.totalIncomeReturned || netCash + netMpesa;
              const variance = s.financialVariance || 0;

              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-[#0E1420] border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{s.workerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Shift #{s.shiftNumber} · {new Date(s.openedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        s.status === 'ACTIVE'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : Math.abs(variance) <= 10
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {s.status === 'ACTIVE'
                        ? '🟢 Live'
                        : Math.abs(variance) <= 10
                        ? '✅ Balanced'
                        : `⚠️ Short KES ${Math.abs(variance).toLocaleString()}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div className="p-2 rounded-xl bg-[#151D2C]">
                      <div className="text-[10px] text-slate-400 uppercase">Money Collected</div>
                      <div className="font-mono font-bold text-white mt-0.5">
                        KES {totalInc.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#151D2C]">
                      <div className="text-[10px] text-slate-400 uppercase">Net Profit</div>
                      <div className="font-mono font-bold text-emerald-400 mt-0.5">
                        {s.netProfit !== undefined ? `KES ${s.netProfit.toLocaleString()}` : '-'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedShiftForAudit(s)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Receipt & Audit</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop Shift Table (for Larger Screens) */}
          <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Shift #</th>
                  <th className="p-3">Attendant</th>
                  <th className="p-3 text-right">Entry M-Pesa</th>
                  <th className="p-3 text-right">Closing M-Pesa</th>
                  <th className="p-3 text-right text-emerald-400">Net M-Pesa</th>
                  <th className="p-3 text-right text-amber-400">Net Cash</th>
                  <th className="p-3 text-right font-bold text-white">Total Income</th>
                  <th className="p-3 text-right">Net Profit</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {shifts.map((s) => {
                  const netMpesa =
                    s.calculatedMpesaIncome !== undefined
                      ? s.calculatedMpesaIncome
                      : (s.closingMpesaBalance || 0) - s.openingMpesaBalance;
                  const netCash =
                    s.calculatedCashIncome !== undefined
                      ? s.calculatedCashIncome
                      : (s.closingCashActual || 0) - s.openingCashFloat;
                  const totalInc = s.totalIncomeReturned || netCash + netMpesa;

                  return (
                    <tr key={s.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-white">{s.shiftNumber}</td>
                      <td className="p-3 font-sans">
                        <div className="font-semibold text-slate-200">{s.workerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(s.openedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        {s.openingMpesaBalance.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {s.closingMpesaBalance ? s.closingMpesaBalance.toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400">
                        {s.closingMpesaBalance ? netMpesa.toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-400">
                        {s.closingCashActual ? netCash.toLocaleString() : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        {s.status === 'CLOSED' ? `KES ${totalInc.toLocaleString()}` : 'In Progress'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-300">
                        {s.netProfit !== undefined ? `KES ${s.netProfit.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                            s.status === 'CLOSED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-blue-950 text-blue-400 border border-blue-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedShiftForAudit(s)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans text-xs transition-colors cursor-pointer border border-slate-700"
                        >
                          Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. STOCK AUDIT TAB */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <RestockAuditManager currentUser={currentUser} />

          <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Wine className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                  <span>Real-Time Bar Inventory Balances</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Physical bottle counts vs. reorder safety thresholds
                </p>
              </div>
            </div>

            {/* Mobile Inventory Cards (for Phones) */}
            <div className="md:hidden space-y-2.5">
              {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
                const inv = inventory.find((i) => i.productId === p.id);
                const stockOnHand = inv ? inv.quantityOnHand : 0;
                const isLow = stockOnHand <= p.reorderLevel;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#0E1420] border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono capitalize">
                          {p.category.replace('_', ' ').toLowerCase()} · {p.unit.toLowerCase()}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-sans px-2 py-0.5 rounded font-bold shrink-0 ${
                          isLow
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {isLow ? 'Restock Needed' : 'Adequate'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-[#151D2C]">
                        <div className="text-[9px] text-slate-400 uppercase">On Hand</div>
                        <div className={`font-bold mt-0.5 ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {stockOnHand}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#151D2C]">
                        <div className="text-[9px] text-slate-400 uppercase">Reorder At</div>
                        <div className="text-slate-300 font-bold mt-0.5">
                          {p.reorderLevel}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#151D2C]">
                        <div className="text-[9px] text-slate-400 uppercase">Sell Price</div>
                        <div className="text-white font-bold mt-0.5">
                          KES {p.sellingPrice}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (for Tablets & Desktops) */}
            <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Selling Price</th>
                    <th className="p-3 text-center">Cost Price</th>
                    <th className="p-3 text-center text-emerald-400">Stock On Hand</th>
                    <th className="p-3 text-center text-slate-400">Reorder Safety Level</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
                    const inv = inventory.find((i) => i.productId === p.id);
                    const stockOnHand = inv ? inv.quantityOnHand : 0;
                    const isLow = stockOnHand <= p.reorderLevel;

                    return (
                      <tr key={p.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-sans font-medium text-white">{p.name}</td>
                        <td className="p-3 font-sans text-slate-400 capitalize">{p.category.replace('_', ' ').toLowerCase()}</td>
                        <td className="p-3 text-center text-slate-200">KES {p.sellingPrice}</td>
                        <td className="p-3 text-center text-slate-400">KES {p.costPrice}</td>
                        <td className="p-3 text-center font-bold text-emerald-400">
                          {stockOnHand} {p.unit.toLowerCase()}s
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          {p.reorderLevel} {p.unit.toLowerCase()}s
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-sans px-2 py-0.5 rounded font-bold ${
                              isLow
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {isLow ? 'Restock Needed' : 'Adequate'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
      </div>
      )}

      {/* 6. PRICING & CATALOG TAB */}
      {activeTab === 'catalog' && (
        <CatalogManager />
      )}

      {/* 7. M-PESA TILL & PAYBILL CONFIGURATION TAB */}
      {activeTab === 'mpesa' && (
        <MpesaConfigManager />
      )}

      {/* 8. PARTNER BARS & TRANSFERS TAB */}
      {activeTab === 'partners' && (
        <PartnerBarsManager />
      )}

      {/* 8. STAFF & SECURITY ACCESS TAB */}
      {activeTab === 'staff' && (
        <StaffManager currentUser={currentUser} />
      )}

      {/* 9. END OF SHIFT HANDOVER / AUDIT TAB */}
      {activeTab === 'end_shift' && (
        <EndOfShiftScreen
          currentUser={currentUser}
          onGoToStartScreen={() => setActiveTab('overview')}
          onGoToCounter={() => setActiveTab('shifts')}
        />
      )}

      {/* Audit Detail Modal */}
      {selectedShiftForAudit && (
        <ShiftDetailModal
          shift={selectedShiftForAudit}
          onClose={() => setSelectedShiftForAudit(null)}
        />
      )}

      {/* Discrepancy Investigation Modal */}
      {selectedDiscrepancy && (
        <DiscrepancyResolveModal
          discrepancy={selectedDiscrepancy}
          onClose={() => setSelectedDiscrepancy(null)}
          onResolve={(id, notes, status) => {
            store.resolveDiscrepancy(id, notes, status);
          }}
        />
      )}
    </div>
  );
};
