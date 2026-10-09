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
import { NeonDatabaseManager } from './NeonDatabaseManager';
import { ProfileManager } from './ProfileManager';
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
  Users,
  Building2,
  SlidersHorizontal,
  Plus,
  Sparkles,
  ChevronRight,
  Store,
  FileText,
  Database,
  UserCheck,
} from 'lucide-react';

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
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Settings Sub-tab State
  const [settingsSubTab, setSettingsSubTab] = useState<'mpesa' | 'staff' | 'partners' | 'database' | 'profile'>(() => {
    if (['mpesa', 'staff', 'partners', 'database', 'profile'].includes(activeTab)) {
      return activeTab as any;
    }
    return 'mpesa';
  });

  useEffect(() => {
    if (activeTab === 'catalog') {
      setActiveTab('stock');
    } else if (['mpesa', 'staff', 'partners', 'database', 'profile'].includes(activeTab)) {
      setSettingsSubTab(activeTab as any);
    }
  }, [activeTab, setActiveTab]);

  const currentBiz = store.getCurrentBusiness();

  // Filters
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'FLAGGED' | 'RESOLVED'>('ALL');
  const [eventSeverityFilter, setEventSeverityFilter] = useState<string>('ALL');

  const shifts = store.getShifts();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const events = store.getEvents(50);
  const discrepancies = store.getDiscrepancies();
  const additions = store.getStockAdditions();
  const pendingRestocksCount = additions.filter((a) => a.status === 'PENDING_OWNER_CONFIRMATION').length;
  const registeredWorkers = store
    .getUsers()
    .filter((u) => (!u.businessId || u.businessId === currentBiz.id) && u.role !== 'OWNER' && !u.isArchived);

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
  const shiftExpenses = targetShift?.totalExpenses || 0;

  const handleToggleShiftRead = (shiftId: string, currentReadState: boolean) => {
    store.markShiftReviewed(shiftId, currentUser.name, !currentReadState);
  };

  const pendingDiscrepancies = discrepancies.filter(
    (d) => d.status === 'FLAGGED' || d.status === 'INVESTIGATING'
  );


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
      {/* Clean Owner Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#111622] border border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Bar Operations Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {currentBiz.name} · Real-time sales, attendant shifts, and stock reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1117] border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                activeShifts.length > 0 ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {activeShifts.length > 0 ? `${activeShifts.length} Counter Active` : 'Counters Closed'}
            </span>
          </div>

          {pendingRestocksCount > 0 && (
            <button
              onClick={() => setActiveTab('stock')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium text-xs hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>{pendingRestocksCount} Restock Pending</span>
            </button>
          )}

          {pendingDiscrepancies.length > 0 && (
            <button
              onClick={() => setActiveTab('discrepancies')}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium text-xs hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{pendingDiscrepancies.length} Shortage Alert{pendingDiscrepancies.length > 1 ? 's' : ''}</span>
            </button>
          )}
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

          {/* Quick Onboarding / Real Data Setup Card */}
          {(products.length === 0 || registeredWorkers.length === 0) && (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#121824] via-[#151D2C] to-[#0E1522] border-2 border-emerald-500/40 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Welcome to {currentBiz.name}! Setup Checklist
                    </h3>
                    <p className="text-xs text-slate-400">
                      Complete these 2 simple steps to get your bar ready for real shift trading:
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Step 1: Real Drinks */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    products.length > 0
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#0E1420] border-slate-800 ring-1 ring-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Wine className="w-4 h-4 text-emerald-400" />
                      <span>1. Real Drinks & Prices</span>
                    </span>
                    {products.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{products.length} Drinks Active</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-950 text-amber-400 border border-amber-800">
                        Needs Real Products
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {products.length > 0
                      ? `Your catalog has ${products.length} drink(s) configured with wholesale costs and retail prices.`
                      : 'You chose a clean slate with zero test data. Add your real drinks and selling prices so attendants can record sales.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('stock')}
                      className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{products.length > 0 ? 'Manage Drinks & Prices' : 'Add Bar Drinks'}</span>
                    </button>
                  </div>
                </div>

                {/* Step 2: Attendants */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    registeredWorkers.length > 0
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[#0E1420] border-slate-800 ring-1 ring-sky-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>2. Counter Attendants</span>
                    </span>
                    {registeredWorkers.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{registeredWorkers.length} Staff Registered</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-950 text-amber-400 border border-amber-800">
                        No Attendants Yet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {registeredWorkers.length > 0
                      ? `${registeredWorkers.length} counter attendant(s) registered with active 4-digit PINs for terminal access.`
                      : 'Only you (the Owner) register staff. Add your counter attendants and bartenders and assign their 4-digit PINs.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('staff')}
                      className="py-2 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{registeredWorkers.length > 0 ? 'Manage Attendants' : 'Register Attendants & PINs'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SHIFT SUMMARY CONTAINER */}
          {targetShift ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#111622] border border-[#1E2638] space-y-4">
              {/* Header: Shift Identity */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                      Shift #{targetShift.shiftNumber} Report
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Attendant: <strong className="text-slate-200">{targetShift.workerName}</strong>
                    </span>
                    {targetShift.closedAt && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        · {new Date(targetShift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                        {new Date(targetShift.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {isShiftRead ? (
                      <span className="text-emerald-400">Reviewed by {targetShift.reviewedBy || 'Owner'}</span>
                    ) : (
                      <span className="text-amber-400">New Shift Handover · Awaiting Review</span>
                    )}
                  </div>
                </div>

                {/* Actions: Mark as Reviewed / Full Audit / Switch Shift */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggleShiftRead(targetShift.id, isShiftRead)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isShiftRead
                        ? 'border-slate-800 text-slate-400 hover:text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-emerald-600'
                    }`}
                  >
                    {isShiftRead ? 'Mark as Unread' : 'Mark as Reviewed'}
                  </button>

                  <button
                    onClick={() => setSelectedShiftForAudit(targetShift)}
                    className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 bg-[#0D1117] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Full Audit</span>
                  </button>

                  {/* If multiple closed shifts exist, clean selector */}
                  {closedShifts.length > 1 && (
                    <select
                      value={targetShift.id}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="text-xs bg-[#0D1117] border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 cursor-pointer font-mono"
                    >
                      {closedShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          Shift #{s.shiftNumber} ({s.workerName})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* High-level KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Expected Sales Revenue</span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    KES {shiftExpectedSales.toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Net M-Pesa Collected</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    KES {shiftNetMpesa.toLocaleString()}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Net Cash in Drawer</span>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                    KES {shiftNetCash.toLocaleString()}
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
                When a counter attendant finishes and submits their shift handover, the 3 shift financial banners (Sales, M-Pesa, Cash) will appear here for review with WhatsApp-style read verification.
              </p>
            </div>
          )}

          {/* Active Shift Attendant Section */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active Shift Attendant
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  activeShifts.length > 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {activeShifts.length > 0 ? `${activeShifts.length} Attendant Online` : 'Counter Closed'}
              </span>
            </div>

            {activeShifts.length === 0 ? (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0E1420] border border-slate-800/80 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-500 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-300">No Attendant Currently on Shift</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Counters are closed. Waiting for attendant to log in with their PIN and open a shift.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {activeShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#0E1420] via-[#121A28] to-[#0E1420] border-2 border-emerald-500/40 shadow-lg relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                          {shift.workerName ? shift.workerName.charAt(0).toUpperCase() : '🍸'}
                        </div>
                        <div>
                          <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <span>{shift.workerName}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Opened{' '}
                            {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedShiftForAudit(shift)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 shrink-0 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Shift</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#0A0F18] border border-slate-800">
                        <div className="text-[10px] text-slate-400 truncate">Entry M-Pesa</div>
                        <div className="font-mono font-bold text-emerald-400 text-xs sm:text-sm mt-0.5 truncate">
                          KES {shift.openingMpesaBalance.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#0A0F18] border border-slate-800">
                        <div className="text-[10px] text-slate-400 truncate">Cash Float</div>
                        <div className="font-mono font-bold text-amber-400 text-xs sm:text-sm mt-0.5 truncate">
                          KES {shift.openingCashFloat.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#0A0F18] border border-slate-800">
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
        </div>
      )}

      {/* 2. LIVE TICKER TAB */}
      {activeTab === 'events' && (
        <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <span>Recent Bar Activity</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Timeline of drinks sold, shifts opened, restocks, and cash movements
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
                <span>Shortages & Missing Stock</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Items flagged when shelf bottle counts or cash did not match drinks sold
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
                  {st === 'ALL' ? 'All' : st === 'FLAGGED' ? 'Needs Review' : 'Resolved'}
                </button>
              ))}
            </div>
          </div>

          {filteredDiscrepancies.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="text-base font-bold text-white">No Shortages Found</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                All bottle counts and money balanced with expected numbers.
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
                        Reported {new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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
                      <div
                        className={`font-bold mt-0.5 ${
                          d.variance > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {d.variance > 0 ? `+${d.variance}` : d.variance} (KES{' '}
                        {d.monetaryValue.toLocaleString()})
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 mb-3 space-y-1">
                    <div>
                      Attendant reporting:{' '}
                      <span className="text-slate-200 font-medium">{d.workerName}</span>
                    </div>
                    {d.responsibleWorkerName && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] font-sans ${
                          d.variance > 0
                            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                            : 'bg-red-950/60 border-red-800 text-red-200'
                        }`}
                      >
                        {d.variance > 0 ? (
                          <>
                            <strong className="text-emerald-300">
                              ⚖️ Handover Surplus Credited:
                            </strong>{' '}
                            <span className="text-white font-bold">{d.responsibleWorkerName}</span>
                            <div className="text-[10px] text-emerald-400 mt-0.5">
                              Extra bottles counted during opening handover credited to balance previous attendant's record.
                            </div>
                          </>
                        ) : (
                          <>
                            <strong className="text-red-300">
                              ⚠️ Handover Shortage Flagged:
                            </strong>{' '}
                            <span className="text-white font-bold">{d.responsibleWorkerName}</span>
                            <div className="text-[10px] text-red-400 mt-0.5">
                              Missing items identified during counter shift verification by incoming worker.
                            </div>
                          </>
                        )}
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

      {/* STOCK AUDIT TAB */}
      {(activeTab === 'stock' || activeTab === 'catalog') && (
        <div className="space-y-6">
          <RestockAuditManager currentUser={currentUser} />

          {/* Unified Drinks Catalog & Stock Audit Item List */}
          <CatalogManager />
        </div>
      )}

      {/* 6. UNIFIED BAR SETUP & SETTINGS TAB */}
      {(activeTab === 'settings' ||
        ['mpesa', 'partners', 'staff', 'database', 'profile'].includes(activeTab)) && (
        <div className="space-y-4 sm:space-y-5">
          {/* Sub-navigation Segment Switcher */}
          <div className="p-2 sm:p-3 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] shadow-lg">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider px-2 pt-1 pb-2">
              Bar Settings & Configuration
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSettingsSubTab('mpesa');
                  setActiveTab('mpesa');
                }}
                className={`py-3 px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'mpesa'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="truncate">M-Pesa Till</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsSubTab('staff');
                  setActiveTab('staff');
                }}
                className={`py-3 px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'staff'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="truncate">Staff PINs</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsSubTab('partners');
                  setActiveTab('partners');
                }}
                className={`py-3 px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'partners'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Partner Bars</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsSubTab('database');
                  setActiveTab('database');
                }}
                className={`py-3 px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'database'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Database className="w-4 h-4 shrink-0 text-cyan-400" />
                <span className="truncate">Neon Database</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsSubTab('profile');
                  setActiveTab('profile');
                }}
                className={`py-3 px-3 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  settingsSubTab === 'profile'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-[#0E1420] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">My Profile</span>
              </button>
            </div>
          </div>

          {/* Sub-component Container */}
          <div className="animate-in fade-in duration-200">
            {settingsSubTab === 'mpesa' && <MpesaConfigManager />}
            {settingsSubTab === 'staff' && <StaffManager currentUser={currentUser} />}
            {settingsSubTab === 'partners' && <PartnerBarsManager />}
            {settingsSubTab === 'database' && <NeonDatabaseManager />}
            {settingsSubTab === 'profile' && (
              <ProfileManager
                currentUser={currentUser}
                onUpdateProfile={onUpdateProfile}
              />
            )}
          </div>
        </div>
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
