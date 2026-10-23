import React, { useState, useMemo } from 'react';
import { Shift } from '../../types';
import { store } from '../../services/store';
import { exportAllShiftsSummaryCsv } from '../../services/exportCsv';
import {
  Search,
  X,
  Calendar,
  User,
  ArrowRight,
  Download,
  Clock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface ShiftHistoryManagerProps {
  onSelectShift: (shift: Shift) => void;
  isSearchOnly?: boolean;
}

export const ShiftHistoryManager: React.FC<ShiftHistoryManagerProps> = ({ 
  onSelectShift,
  isSearchOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllLimit, setShowAllLimit] = useState(false);
  const currentBiz = store.getCurrentBusiness();
  const rawShifts = store.getShifts();

  // Purge/exclude shift #SH-261022-676
  const shifts = useMemo(() => {
    return rawShifts.filter(
      (s) => s.shiftNumber !== 'SH-261022-676' && !s.shiftNumber?.includes('261022-676')
    );
  }, [rawShifts]);

  // Sort newest shifts first
  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const timeA = new Date(a.closedAt || a.openedAt).getTime();
      const timeB = new Date(b.closedAt || b.openedAt).getTime();
      return timeB - timeA;
    });
  }, [shifts]);

  // Unique attendant names for quick filters (excluding "lucy")
  const attendants = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => {
      if (s.workerName && s.workerName.trim().toLowerCase() !== 'lucy') {
        set.add(s.workerName.trim());
      }
    });
    return Array.from(set).sort();
  }, [shifts]);

  // Search filter across attendant name, dates, and shift number
  const filteredShifts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return showAllLimit ? sortedShifts : sortedShifts.slice(0, 15);
    }

    const tokens = query.split(/\s+/).filter(Boolean);

    return sortedShifts.filter((shift) => {
      const openDate = shift.openedAt ? new Date(shift.openedAt) : null;
      const closeDate = shift.closedAt ? new Date(shift.closedAt) : null;

      const dateStrings: string[] = [];
      [openDate, closeDate].forEach((d) => {
        if (!d || isNaN(d.getTime())) return;
        dateStrings.push(
          d.toISOString().toLowerCase(),
          d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase(), // "oct 22, 2026"
          d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toLowerCase(),  // "october 22, 2026"
          d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase(), // "22 oct 2026"
          d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toLowerCase(),  // "22 october 2026"
          d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(),                                 // "wed"
          d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),                                  // "wednesday"
          `${d.getDate()}`,
          `${d.getFullYear()}`,
          d.toLocaleDateString('en-GB'),                                                                    // "22/10/2026"
          d.toLocaleDateString('en-US')                                                                     // "10/22/2026"
        );
      });

      const shiftSearchText = [
        shift.workerName || '',
        shift.shiftNumber || '',
        shift.status || '',
        shift.closingNotes || '',
        shift.openingInconsistencyNote || '',
        ...dateStrings,
      ]
        .join(' ')
        .toLowerCase();

      // Every word in the query must match either the attendant name, date, or shift number
      return tokens.every((token) => shiftSearchText.includes(token));
    });
  }, [sortedShifts, searchQuery, showAllLimit]);

  const handleExportCsv = () => {
    exportAllShiftsSummaryCsv(sortedShifts, currentBiz.name || 'Bar');
  };

  const formatShiftDate = (openedAt: string, closedAt?: string) => {
    const o = new Date(openedAt);
    if (isNaN(o.getTime())) return 'Unknown Date';

    const dateStr = o.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const openTime = o.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (!closedAt) {
      return `${dateStr} · Started ${openTime} (Active)`;
    }

    const c = new Date(closedAt);
    const closeTime = c.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${dateStr} · ${openTime} – ${closeTime}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Export - Hidden in search-only mode */}
      {!isSearchOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121824] border border-[#1E293B] p-4 sm:p-5 rounded-3xl shadow-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Shift History</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery.trim()
                ? `Found ${filteredShifts.length} shift(s) matching "${searchQuery}"`
                : `Viewing the past 15 shifts. Use the search bar to look up any shift in history.`}
            </p>
          </div>

          {shifts.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="self-start sm:self-auto py-2 px-3.5 rounded-xl bg-[#0E1420] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Summary CSV</span>
            </button>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#121824] border border-[#1E293B] p-3 sm:p-4 rounded-2xl shadow-md space-y-2.5">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowAllLimit(false);
            }}
            placeholder="Search shift by attendant name, date, or both (e.g. John Oct 22)..."
            className="w-full bg-[#0E1420] border border-slate-700 focus:border-emerald-500 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        {attendants.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-slate-400 scrollbar-none">
            <span className="font-semibold text-slate-500 uppercase text-[10px] shrink-0 mr-1">
              Quick Filter:
            </span>
            {attendants.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSearchQuery(name)}
                className={`px-2 py-0.5 rounded-lg border text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                  searchQuery.toLowerCase().includes(name.toLowerCase())
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-[#0E1420] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setSearchQuery(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
              }}
              className="px-2 py-0.5 rounded-lg bg-[#0E1420] text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white text-xs font-medium shrink-0 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {/* Shifts List Container (Scrollable) */}
      {(!isSearchOnly || searchQuery.trim()) && (
        <div className="space-y-3">
          {filteredShifts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-[#121824] border border-[#1E293B] rounded-3xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-white">
              {searchQuery ? `No shifts found matching "${searchQuery}"` : 'No shifts recorded yet'}
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'Try searching with just the first name (e.g. John), month (e.g. Oct), or date number (e.g. 22).'
                : 'When workers open and close shifts at the counter, they will appear here.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Search</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filteredShifts.map((shift) => {
              const variance = shift.financialVariance || 0;
              const isClosed = shift.status === 'CLOSED';
              const isActive = shift.status === 'ACTIVE' || shift.status === 'OPENING_VERIFICATION';

              return (
                <div
                  key={shift.id}
                  onClick={() => onSelectShift(shift)}
                  className="bg-[#121824] hover:bg-[#151D2C] border border-[#1E293B] hover:border-slate-700 p-4 rounded-2xl transition-all cursor-pointer shadow-sm group"
                >
                  {/* Top Bar: Status and Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/80 animate-pulse'
                            : isClosed
                            ? 'bg-slate-800 text-slate-300 border border-slate-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {shift.status.replace(/_/g, ' ')}
                      </span>
                      {shift.isReviewedByOwner && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                          <span>Reviewed</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{formatShiftDate(shift.openedAt, shift.closedAt)}</span>
                    </div>
                  </div>

                  {/* Attendant & Overview */}
                  <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#0E1420] border border-slate-800 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-600 transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
                          {shift.workerName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {shift.recordedSalesCount || 0} drinks sold
                        </div>
                      </div>
                    </div>

                    {/* Financial Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-right">
                      {/* 1. Total Amount */}
                      <div className="bg-[#0E1420] px-2.5 py-1.5 rounded-xl border border-slate-800 text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Total Amount</div>
                        <div className="text-xs font-mono font-bold text-white">
                          KES {(shift.expectedSalesRevenue || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* 2. Cash Returned */}
                      <div className="bg-[#0E1420] px-2.5 py-1.5 rounded-xl border border-slate-800 text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">Cash Returned</div>
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          KES {(shift.calculatedCashIncome || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* 3. M-Pesa Income */}
                      <div className="bg-[#0E1420] px-2.5 py-1.5 rounded-xl border border-slate-800 text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">M-Pesa Income</div>
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          KES {(shift.calculatedMpesaIncome || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* 4. Variance renamed to Short / Tip / Balanced */}
                      <div className="bg-[#0E1420] px-2.5 py-1.5 rounded-xl border border-slate-800 text-left sm:text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-sans">
                          {variance < 0 ? 'Short' : variance > 0 ? 'Tip' : 'Balanced'}
                        </div>
                        <div
                          className={`text-xs font-mono font-bold ${
                            variance === 0
                              ? 'text-emerald-400'
                              : variance < 0
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {variance === 0
                            ? 'Balanced'
                            : variance < 0
                            ? `-KES ${Math.abs(variance).toLocaleString()}`
                            : `+KES ${variance.toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400">
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1 group-hover:translate-x-1 transition-all"
                    >
                      <span>Inspect Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer controls when not searching */}
        {!searchQuery && sortedShifts.length > 15 && (
          <div className="text-center pt-2">
            {!showAllLimit ? (
              <button
                type="button"
                onClick={() => setShowAllLimit(true)}
                className="py-2 px-4 rounded-xl bg-[#121824] hover:bg-[#151D2C] border border-[#1E293B] text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Load all {sortedShifts.length} historical shifts
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllLimit(false)}
                className="py-2 px-4 rounded-xl bg-[#121824] hover:bg-[#151D2C] border border-[#1E293B] text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Show past 15 shifts only
              </button>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  );
};
