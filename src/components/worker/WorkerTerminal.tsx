import React, { useState } from 'react';
import { User, Shift } from '../../types';
import { store } from '../../services/store';
import { UnifiedStockLedger } from './UnifiedStockLedger';
import { ShiftDetailModal } from '../owner/ShiftDetailModal';
import { History, Eye, ArrowLeft, Clock } from 'lucide-react';

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

  const activeShift = store.getActiveShift();
  const shifts = store.getShifts();

  // -------------------------------------------------------------
  // TAB: PAST SHIFTS (HISTORY LOG)
  // -------------------------------------------------------------
  if (activeTab === 'history') {
    return (
      <div className="max-w-3xl mx-auto pb-28 md:pb-12 px-3 sm:px-0 space-y-4">
        <div className="bg-[#121824] border border-[#1E293B] rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-white">Past Shift Records</h1>
                <p className="text-xs text-slate-400">
                  Full shift logs, drink units sold, and handover receipts
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('counter')}
              className="py-1.5 px-3 rounded-xl bg-[#0E1420] border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Counter Sheet</span>
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {shifts.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                No closed shifts yet. Complete a shift on the Counter Sheet to see its record here.
              </div>
            ) : (
              shifts.map((s) => {
                const variance = s.financialVariance || 0;
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl bg-[#0E1420] border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">
                          {new Date(s.openedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                            s.status === 'CLOSED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-blue-950 text-blue-400 border border-blue-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>Attendant: {s.workerName}</span>
                        <span>·</span>
                        <span className="text-slate-300 font-mono">
                          {s.recordedSalesCount || 0} drinks sold
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        KES {(s.totalIncomeReturned || s.expectedSalesRevenue || 0).toLocaleString()}
                      </div>
                      <div
                        className={`text-[10px] font-mono mt-0.5 ${
                          variance === 0
                            ? 'text-emerald-400'
                            : variance < 0
                            ? 'text-red-400 font-bold'
                            : 'text-amber-400 font-bold'
                        }`}
                      >
                        {variance === 0
                          ? 'Balanced 🟢'
                          : variance < 0
                          ? `-KES ${Math.abs(variance).toLocaleString()}`
                          : `+KES ${variance.toLocaleString()}`}
                      </div>
                      <button
                        onClick={() => setSelectedHistoricalShift(s)}
                        className="mt-1 py-1 px-2.5 rounded-lg bg-[#151D2C] hover:bg-slate-800 text-[10px] font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-emerald-400" />
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
  // Columns: Opening Stock | Added Stock | Total | Closing Stock | Sales | Amount | Profit
  // -------------------------------------------------------------
  return (
    <UnifiedStockLedger
      currentUser={currentUser}
      onGoToHistory={() => setActiveTab('history')}
    />
  );
};
