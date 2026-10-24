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
import { ShiftHistoryManager } from './ShiftHistoryManager';
import { RestockAuditManager } from './RestockAuditManager';
import { ProfileManager } from './ProfileManager';
import { LiveLaunchManager } from './LiveLaunchManager';
import { exportShiftToCsv, exportAllShiftsSummaryCsv } from '../../services/exportCsv';
import { useBackHandler } from '../../services/navigationHistory';
import {
  Download,
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
  Edit2,
  Check,
  CheckCheck,
  RefreshCw,
  Wine,
  PackagePlus,
  Building2,
  SlidersHorizontal,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Store,
  FileText,
  UserCheck,
  Rocket,
  X,
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
  const [isShiftSearchVisible, setIsShiftSearchVisible] = useState(false);
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
  // Phone back-button integration: close inspect/resolve modals and undo selections
  useBackHandler(Boolean(selectedShiftForAudit), () => setSelectedShiftForAudit(null), 'owner-shift-audit');
  useBackHandler(Boolean(selectedDiscrepancy), () => setSelectedDiscrepancy(null), 'owner-discrepancy-resolve');

  useEffect(() => {
    if (activeTab === 'catalog') {
      setActiveTab('stock');
    }
  }, [activeTab, setActiveTab]);

  const currentBiz = store.getCurrentBusiness();

  // Filters
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'FLAGGED' | 'RESOLVED'>('ALL');
  const [eventSeverityFilter, setEventSeverityFilter] = useState<string>('ALL');
  const [eventLimit, setEventLimit] = useState(6);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [, setStoreTick] = useState(0);
  useEffect(() => {
    return store.subscribe(() => {
      setStoreTick((t) => t + 1);
    });
  }, []);

  const shifts = store.getShifts();
  const products = store.getProducts();
  const inventory = store.getInventory();
  const events = store.getEvents(eventLimit + 1); // +1 to check if there are more
  const discrepancies = store.getDiscrepancies();
  const additions = store.getStockAdditions();
  const registeredWorkers = store
    .getUsers()
    .filter((u) => (!u.businessId || u.businessId === currentBiz.id) && u.role !== 'OWNER' && !u.isArchived);

  const pendingDiscrepancies = discrepancies.filter(
    (d) => d.status === 'FLAGGED' || d.status === 'INVESTIGATING'
  );

  const activeShifts = shifts.filter((s) => s.status === 'ACTIVE');
  const activeShift = activeShifts[0];
  const activeShiftIds = activeShifts.map((s) => s.id);

  const activeAdditions = additions.filter((a) => activeShiftIds.includes(a.shiftId));
  const activeExpenses = store.getExpenses().filter((e) => activeShiftIds.includes(e.shiftId));

  const hasUnreadActivity = activeAdditions.some((a) => !a.isReadByOwner) || activeExpenses.some((e) => !e.isReadByOwner);


  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (discrepancyFilter === 'ALL') return true;
    return d.status === discrepancyFilter;
  });

  const filteredEvents = events.filter((e) => {
    // Hide technical sync events from the owner report
    if (e.title === 'Cloud Persistence Reconciled') return false;
    
    if (eventSeverityFilter === 'ALL') return true;
    return e.severity === eventSeverityFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-28 md:pb-16 w-full">


      {/* 1. EXECUTIVE COMMAND CENTER OVERVIEW TAB */}
      {(activeTab === 'overview' || !activeTab) && (
        <div className="space-y-4 sm:space-y-6">
          {/* ACTIVE SHIFT BANNER (Pinned at the top) */}
          {activeShift && (
            <div className="sticky top-14 z-20 p-3.5 sm:p-4 rounded-2xl bg-[#111622]/95 backdrop-blur-md border border-emerald-500/30 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-sm font-bold text-white">
                  Active Shift: {activeShift.workerName}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Started {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          {/* ACTIVE SHIFT ACTIVITY HIGHLIGHTS (Persists until shift close) */}
          {(activeAdditions.length > 0 || activeExpenses.length > 0) && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-slate-500" />
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Active Shift Report
                  </h3>
                </div>
                {hasUnreadActivity && (
                  <button
                    onClick={() => {
                      store.markAllStockAdditionsRead();
                      store.markAllExpensesRead();
                    }}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Stock Additions */}
                {activeAdditions.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => store.markStockAdditionRead(a.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative overflow-hidden group ${
                      !a.isReadByOwner
                        ? 'bg-sky-950/20 border-sky-500/40 shadow-lg'
                        : 'bg-[#0E1420]/60 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      !a.isReadByOwner ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      <PackagePlus className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono font-bold text-sky-400/80 uppercase">Stock Delivery</div>
                      <div className="text-sm font-bold text-white truncate">
                        +{a.quantity} {a.productName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Reported by {a.workerName}
                      </div>
                    </div>
                    {!a.isReadByOwner && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-pulse" />
                    )}
                  </div>
                ))}

                {/* 2. Expenses */}
                {activeExpenses.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => store.markExpenseRead(e.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative overflow-hidden group ${
                      !e.isReadByOwner
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-lg'
                        : 'bg-[#0E1420]/60 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      !e.isReadByOwner ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      <Banknote className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono font-bold text-amber-400/80 uppercase">{e.category.replace('_', ' ')}</div>
                      <div className="text-sm font-bold text-white truncate">
                        KES {e.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {e.description}
                      </div>
                    </div>
                    {!e.isReadByOwner && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Onboarding / Real Data Setup Card */}
          {showChecklist && (products.length === 0 || registeredWorkers.length === 0) && (
            <div className="p-5 rounded-3xl bg-[#121824] border-2 border-emerald-500/40 shadow-xl space-y-4 relative">
              <button 
                onClick={handleDismissChecklist}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-white">Welcome! Setup Checklist</h3>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setActiveTab('stock')}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-between"
                >
                  <span>Add Bar Drinks</span>
                  {products.length > 0 && <CheckCircle2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setActiveTab('staff')}
                  className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center justify-between"
                >
                  <span>Register Attendant</span>
                  {registeredWorkers.length > 0 && <CheckCircle2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}





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

      {/* 2. REPORTS TAB (Unified logging and searchable shift history) */}
      {activeTab === 'reports' && (
        <div className="space-y-4 relative">
          <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl bg-[#121824] border border-[#1E293B] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                  <span>Recent Bar Activity</span>
                </h3>
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
              {filteredEvents.slice(0, eventLimit).map((evt) => {
                const isExpanded = expandedEventId === evt.id;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    className="py-2.5 sm:py-3 flex flex-col gap-1 text-xs hover:bg-slate-900/30 px-1 sm:px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
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
                          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                            {evt.actorName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-[10px] sm:text-[11px] text-slate-400">
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-1 pl-7 pr-1 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200 border-l border-slate-800 ml-1">
                        <div className="text-slate-300 text-[11px] leading-relaxed italic">
                          {evt.description}
                        </div>
                        {evt.amount && (
                          <div className="font-mono font-bold text-emerald-400 text-[10px]">
                            Transaction: KES {evt.amount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load More Events Button */}
            {filteredEvents.length > eventLimit && (
              <div className="pt-2 border-t border-slate-800/50">
                <button
                  onClick={() => setEventLimit((prev) => prev + 10)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer group"
                >
                  <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  <span>Show 10 More Activity Logs</span>
                </button>
              </div>
            )}
          </div>

          {/* Searchable Shift History Overlay/Section */}
          {isShiftSearchVisible && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Shift History Lookup
                </h3>
                <button 
                  onClick={() => setIsShiftSearchVisible(false)}
                  className="text-xs font-bold text-slate-500 hover:text-white px-2 py-1"
                >
                  Close Search
                </button>
              </div>
              <ShiftHistoryManager 
                onSelectShift={(shift) => setSelectedShiftForAudit(shift)} 
                isSearchOnly={true} 
              />
            </div>
          )}

          {/* Floating Shift History Search Toggle */}
          {!isShiftSearchVisible && (
            <button
              onClick={() => setIsShiftSearchVisible(true)}
              className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-30 group"
              title="Search Shift History"
            >
              <Search className="w-6 h-6" />
              <span className="absolute -top-10 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                SHIFT SEARCH
              </span>
            </button>
          )}
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
          {/* Unified Drinks Catalog & Stock Audit Item List */}
          <CatalogManager />
        </div>
      )}


      {/* 7. STAFF ATTENDANTS MANAGEMENT (Subtle Overlay) */}
      {activeTab === 'staff' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setActiveTab('overview')}
              className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <StaffManager currentUser={currentUser} />
          </div>
        </div>
      )}

      {/* 8. PARTNER BARS MANAGEMENT */}
      {activeTab === 'partners' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          <PartnerBarsManager />
        </div>
      )}

      {/* 9. MY PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          <ProfileManager
            currentUser={currentUser}
            onUpdateProfile={onUpdateProfile}
          />
        </div>
      )}

      {/* 10. LIVE LAUNCH */}
      {activeTab === 'launch' && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          <LiveLaunchManager currentUser={currentUser} />
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
