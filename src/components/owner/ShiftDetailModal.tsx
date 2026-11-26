import React, { useState, useEffect } from 'react';
import { Shift } from '../../types';
import { store } from '../../services/store';
import { X, Smartphone, Banknote, Download } from 'lucide-react';
import { exportShiftToCsv } from '../../services/exportCsv';
import { useBackHandler } from '../../services/navigationHistory';

interface ShiftDetailModalProps {
  shift: Shift;
  onClose: () => void;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({ shift: initialShift, onClose }) => {
  useBackHandler(true, onClose, 'shift-detail-modal');
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const shift = store.getShiftById(initialShift.id) || initialShift;
  const stockItems = store.getShiftStockItems(shift.id);
  const expenses = store.getExpenses(shift.id);

  const netMpesa =
    shift.calculatedMpesaIncome !== undefined
      ? shift.calculatedMpesaIncome
      : (shift.closingMpesaBalance || 0) - shift.openingMpesaBalance;

  const netCash =
    shift.calculatedCashIncome !== undefined
      ? shift.calculatedCashIncome
      : (shift.closingCashActual || 0) - shift.openingCashFloat;

  const totalReturned = shift.totalIncomeReturned || netCash + netMpesa;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto bg-[#111622] border-t sm:border border-[#1E2638] rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 pb-safe">
        <div className="w-10 h-1 rounded-full bg-line-strong mx-auto -mt-1 sm:hidden" />
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2 pb-3 border-b border-line-soft">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-content tracking-tight">
                Shift Audit Ledger
              </h2>
              <span className="text-xs text-muted font-mono">
                {shift.status} · #{shift.shiftNumber}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 truncate">
              Attendant: {shift.workerName} · {new Date(shift.openedAt).toLocaleString()}
              {shift.previousWorkerName ? ` · From ${shift.previousWorkerName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const currentBiz = store.getCurrentBusiness();
                exportShiftToCsv(shift, stockItems, expenses, currentBiz.name);
              }}
              className="min-h-[44px] py-1.5 px-3 rounded-xl bg-brand-tint hover:bg-surface-2 border border-brand-line text-brand-strong text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download Full Shift Audit Report (.csv)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-content rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial Reconciliation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-ink-soft border border-line space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-content">
              <Smartphone className="w-4 h-4 text-brand-strong" />
              <span>M-Pesa Till Handover</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-muted tabular-nums">
              <div className="flex justify-between">
                <span>Closing Balance:</span>
                <span className="text-content font-semibold">
                  KES {(shift.closingMpesaBalance || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>-KES {shift.openingMpesaBalance.toLocaleString()}</span>
              </div>
              <div className="pt-1 border-t border-line-soft flex justify-between font-bold text-brand-strong">
                <span>Net M-Pesa Income:</span>
                <span>KES {netMpesa.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-ink-soft border border-line space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-content">
              <Banknote className="w-4 h-4 text-warn" />
              <span>Cash Drawer Handover</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-muted tabular-nums">
              <div className="flex justify-between">
                <span>Ending Cash Count:</span>
                <span className="text-content font-semibold">
                  KES {(shift.closingCashActual || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Starting Float:</span>
                <span>-KES {shift.openingCashFloat.toLocaleString()}</span>
              </div>
              <div className="pt-1 border-t border-line-soft flex justify-between font-bold text-warn">
                <span>Net Cash Income:</span>
                <span>KES {netCash.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
          <div className="p-3 rounded-xl bg-ink-soft border border-line">
            <span className="text-[11px] text-muted font-sans block">Total Returned</span>
            <span className="font-bold text-content text-sm mt-0.5 block">
              KES {totalReturned.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ink-soft border border-line">
            <span className="text-[11px] text-muted font-sans block">Expected Sales</span>
            <span className="font-bold text-brand-strong text-sm mt-0.5 block">
              KES {(shift.expectedSalesRevenue || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ink-soft border border-line">
            <span className="text-[11px] text-muted font-sans block">Est. Net Profit</span>
            <span className="font-bold text-brand-strong text-sm mt-0.5 block">
              {shift.estimatedNetProfit !== undefined
                ? `KES ${shift.estimatedNetProfit.toLocaleString()}`
                : '—'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ink-soft border border-line">
            <span className="text-[11px] text-muted font-sans block">Expenses Paid</span>
            <span className="font-bold text-danger text-sm mt-0.5 block">
              -KES {(shift.totalExpenses || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-ink-soft border border-line col-span-2 sm:col-span-1">
            <span className="text-[11px] text-muted font-sans block">Variance</span>
            <span
              className={`font-bold text-sm mt-0.5 block ${
                (shift.financialVariance || 0) === 0
                  ? 'text-brand-strong'
                  : (shift.financialVariance || 0) < 0
                  ? 'text-danger'
                  : 'text-warn'
              }`}
            >
              {(shift.financialVariance || 0) === 0
                ? 'Balanced'
                : (shift.financialVariance || 0) < 0
                ? `-KES ${Math.abs(shift.financialVariance || 0).toLocaleString()}`
                : `+KES ${(shift.financialVariance || 0).toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Item Stock Table (Desktop) + Card List (Mobile) */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Stock Count Breakdown
          </h3>

          {/* Phone-first compact card list */}
          <div className="sm:hidden border border-slate-800 rounded-xl bg-[#0D1117] divide-y divide-slate-800/60">
            {stockItems.map((item) => {
              const added = item.additions + (item.transfersIn || 0);
              return (
                <div key={item.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {item.productName}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                      KES {(item.recordedSales * item.sellingPrice).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono tabular-nums text-center bg-[#111622] rounded-lg py-1.5 px-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Open</span>
                      <span className="text-slate-300">{item.openingPhysicalCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">+Add</span>
                      <span className={added > 0 ? 'text-emerald-400' : added < 0 ? 'text-rose-400' : 'text-slate-500'}>
                        {added > 0 ? `+${added}` : added < 0 ? added : '0'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Sold</span>
                      <span className="text-white font-bold">{item.recordedSales}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Close</span>
                      <span className="text-slate-300">{item.closingPhysicalCount ?? '-'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden sm:block overflow-x-auto border border-slate-800 rounded-xl bg-[#0D1117]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111622] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Beverage</th>
                  <th className="py-2 px-2 text-center">Open</th>
                  <th className="py-2 px-2 text-center">+Added</th>
                  <th className="py-2 px-2 text-center">Audit</th>
                  <th className="py-2 px-2 text-center">Sold</th>
                  <th className="py-2 px-2 text-center">Closing</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {stockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="py-2 px-3 font-sans font-medium text-slate-200">
                      {item.productName}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">
                      {item.openingPhysicalCount}
                    </td>
                    <td className={`py-2 px-2 text-center ${item.additions + (item.transfersIn || 0) < 0 ? 'text-rose-400 font-bold' : item.additions + (item.transfersIn || 0) > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                      {item.additions + (item.transfersIn || 0) > 0
                        ? `+${item.additions + (item.transfersIn || 0)}`
                        : item.additions + (item.transfersIn || 0) < 0
                        ? item.additions + (item.transfersIn || 0)
                        : '-'}
                      {item.adjustmentNote && (
                        <div className="text-[10px] text-amber-300 font-normal truncate max-w-[85px] mx-auto" title={item.adjustmentNote}>
                          {item.adjustmentNote}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-xs">
                      {item.ownerAdjustments ? (
                        <span className={item.ownerAdjustments > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                          {item.ownerAdjustments > 0 ? `+${item.ownerAdjustments}` : item.ownerAdjustments}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-white font-bold">
                      {item.recordedSales}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {item.closingPhysicalCount ?? '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-medium">
                      KES {(item.recordedSales * item.sellingPrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shift Expenses */}
        {expenses.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Shift Expenses
            </h3>
            <div className="border border-slate-800 rounded-xl divide-y divide-slate-800 bg-[#0D1117] text-xs">
              {expenses.map((exp) => (
                <div key={exp.id} className="p-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">{exp.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{exp.category} · Cash</div>
                  </div>
                  <div className="font-mono font-semibold text-rose-400">
                    -KES {exp.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
