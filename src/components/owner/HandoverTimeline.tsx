import React, { useState } from 'react';
import { Shift } from '../../types';
import { store } from '../../services/store';
import { exportAllShiftsSummaryCsv } from '../../services/exportCsv';
import { ShiftHistoryManager } from './ShiftHistoryManager';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Search,
  X,
} from 'lucide-react';

interface HandoverTimelineProps {
  ownerName: string;
  onInspectShift: (shift: Shift) => void;
}

export const HandoverTimeline: React.FC<HandoverTimelineProps> = ({
  ownerName,
  onInspectShift,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const currentBiz = store.getCurrentBusiness();
  const trail = store.getHandoverTrail(16);
  const allShifts = store.getShifts();

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-content tracking-tight">
            Shift Handover Accountability Trail
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Track consecutive shift transitions, shelf mismatches, cash shortages, and net profit per shift.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowSearch((s) => !s)}
            className={`min-h-[44px] flex-1 sm:flex-none px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              showSearch
                ? 'bg-brand-tint border-brand-line text-brand-strong'
                : 'bg-ink-soft border-line text-content hover:bg-surface-2'
            }`}
          >
            {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            <span>{showSearch ? 'Close Search' : 'Search All Shifts'}</span>
          </button>

          {allShifts.length > 0 && (
            <button
              type="button"
              onClick={() => exportAllShiftsSummaryCsv(allShifts, currentBiz.name || 'Bar')}
              className="min-h-[44px] flex-1 sm:flex-none px-3.5 rounded-xl bg-ink-soft hover:bg-surface-2 border border-line text-xs font-semibold text-content flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-brand-strong" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <ShiftHistoryManager onSelectShift={onInspectShift} isSearchOnly={true} />
      )}

      {/* Handover Timeline List */}
      {trail.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-10 text-center text-xs text-muted">
          No shifts recorded yet. Once an attendant opens a shift, handover accountability records appear here.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl divide-y divide-line-soft overflow-hidden">
          {trail.map(({ shift, previousWorkerName, previousShiftNumber, openingIssues, flaggedCount }) => {
            const variance = shift.financialVariance || 0;
            const isClosed = shift.status === 'CLOSED';
            const liveEst = !isClosed ? store.getLiveShiftEstimate(shift.id) : null;
            const revenue = isClosed ? shift.expectedSalesRevenue || 0 : liveEst?.revenue || 0;
            const netProfit = isClosed ? shift.estimatedNetProfit : liveEst?.netProfit;
            const expenses = isClosed ? shift.totalExpenses || 0 : liveEst?.totalExpenses || 0;

            return (
              <div key={shift.id} className="p-4 sm:p-5 space-y-3 hover:bg-surface-2/40 transition-colors">
                {/* Top Line: Shift Number, Worker, Transition & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-content">{shift.workerName}</span>
                      <span className="text-xs font-mono text-muted">
                        #{shift.shiftNumber} · {isClosed ? 'Closed' : 'Active Now'}
                      </span>
                      {shift.isReviewedByOwner && (
                        <span className="text-xs font-medium text-info flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Reviewed</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted mt-0.5">
                      {formatTime(shift.openedAt)}
                      {shift.closedAt ? ` – ${formatTime(shift.closedAt)}` : ' – Present'}
                      {previousWorkerName && (
                        <span>
                          {' · '}Took over from <strong className="text-content font-medium">{previousWorkerName}</strong>
                          {previousShiftNumber ? ` (#${previousShiftNumber})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => store.markShiftReviewed(shift.id, ownerName, !shift.isReviewedByOwner)}
                      className={`min-h-[44px] flex-1 sm:flex-none px-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center ${
                        shift.isReviewedByOwner
                          ? 'bg-info-tint border-info-line text-info'
                          : 'bg-ink-soft border-line text-muted hover:text-content hover:bg-surface-2'
                      }`}
                    >
                      {shift.isReviewedByOwner ? 'Reviewed' : 'Mark Reviewed'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspectShift(shift)}
                      className="min-h-[44px] flex-1 sm:flex-none px-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-line text-xs font-semibold text-brand-strong flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Opening Handover Mismatch Alert */}
                {(openingIssues.length > 0 || (shift.handoverMismatchCount || 0) > 0 || Boolean(shift.openingInconsistencyNote) || flaggedCount > 0) && (
                  <div className="p-3 rounded-xl bg-warn-tint border border-warn-line flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-content">
                        {openingIssues.length > 0
                          ? `${openingIssues.length} opening shelf mismatch(es) flagged against ${previousWorkerName || 'outgoing attendant'}`
                          : `${flaggedCount} discrepancy flag(s) linked to this shift`}
                      </div>
                      {shift.openingInconsistencyNote && (
                        <div className="text-muted">{shift.openingInconsistencyNote}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4 Tabular Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-ink-soft border border-line rounded-xl px-3 py-2">
                    <div className="text-[11px] text-muted">Sales Revenue</div>
                    <div className="font-mono font-bold text-content tabular-nums mt-0.5">
                      KES {revenue.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-ink-soft border border-line rounded-xl px-3 py-2">
                    <div className="text-[11px] text-muted">Est. Net Profit</div>
                    <div className="font-mono font-bold text-brand-strong tabular-nums mt-0.5">
                      {netProfit !== undefined ? `KES ${netProfit.toLocaleString()}` : '—'}
                    </div>
                  </div>

                  <div className="bg-ink-soft border border-line rounded-xl px-3 py-2">
                    <div className="text-[11px] text-muted">Expenses</div>
                    <div className="font-mono font-bold text-warn tabular-nums mt-0.5">
                      KES {expenses.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-ink-soft border border-line rounded-xl px-3 py-2">
                    <div className="text-[11px] text-muted">
                      {!isClosed ? 'Drawer Status' : variance < 0 ? 'Shortage' : variance > 0 ? 'Surplus' : 'Drawer'}
                    </div>
                    <div
                      className={`font-mono font-bold tabular-nums mt-0.5 ${
                        !isClosed
                          ? 'text-muted'
                          : variance === 0
                          ? 'text-brand-strong'
                          : variance < 0
                          ? 'text-danger'
                          : 'text-warn'
                      }`}
                    >
                      {!isClosed
                        ? 'Open'
                        : variance === 0
                        ? 'Balanced'
                        : variance < 0
                        ? `-KES ${Math.abs(variance).toLocaleString()}`
                        : `+KES ${variance.toLocaleString()}`}
                    </div>
                  </div>
                </div>

                {shift.closingNotes && (
                  <div className="text-xs text-muted">
                    Handover note: <span className="text-content">{shift.closingNotes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
