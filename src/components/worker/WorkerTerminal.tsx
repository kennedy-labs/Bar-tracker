import React, { useState } from 'react';
import { User, Shift } from '../../types';
import { store } from '../../services/store';
import { UnifiedStockLedger } from './UnifiedStockLedger';
import { ShiftDetailModal } from '../owner/ShiftDetailModal';
import { History, Eye, ArrowLeft } from 'lucide-react';

interface WorkerTerminalProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const WorkerTerminal: React.FC<WorkerTerminalProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
}) => {
  const [selectedHistoricalShift, setSelectedHistoricalShift] = useState<Shift | null>(null);

  const shifts = store.getShifts();

  // -------------------------------------------------------------
  // TAB: PAST SHIFTS (HISTORY LOG)
  // -------------------------------------------------------------
  if (activeTab === 'history') {
    return (
      <div className="max-w-4xl mx-auto pb-20 space-y-4">
        <div className="bg-[#111622] border border-[#1E2638] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Past Shift Records</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Shift audit logs, drinks sold, and financial handover receipts.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('counter')}
              className="py-1.5 px-3 rounded-lg bg-[#161F30] hover:bg-[#1B263C] text-xs text-slate-200 font-medium cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Counter Sheet</span>
            </button>
          </div>

          <div className="space-y-2">
            {shifts.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-mono">
                No past shifts recorded yet.
              </div>
            ) : (
              shifts.map((s) => {
                const variance = s.financialVariance || 0;
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">
                          {new Date(s.openedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Shift #{s.shiftNumber}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-[11px] text-slate-400">
                          {s.workerName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-3">
                        <span>{s.recordedSalesCount || 0} drinks sold</span>
                        <span>·</span>
                        <span className="text-slate-300">
                          Sales: KES {(s.expectedSalesRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-slate-200">
                          KES {(s.totalIncomeReturned || 0).toLocaleString()}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
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

                      <button
                        onClick={() => setSelectedHistoricalShift(s)}
                        className="py-1 px-2.5 rounded-lg bg-[#161F30] hover:bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3 h-3 text-slate-400" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedHistoricalShift && (
          <ShiftDetailModal
            shift={selectedHistoricalShift}
            onClose={() => setSelectedHistoricalShift(null)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PRIMARY WORKSTATION: UNIFIED COUNTER STOCK SHEET ("THE ONE LIST")
  // -------------------------------------------------------------
  return (
    <UnifiedStockLedger
      currentUser={currentUser}
      onGoToHistory={() => setActiveTab('history')}
    />
  );
};
