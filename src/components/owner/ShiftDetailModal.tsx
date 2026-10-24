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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#111622] border border-[#1E2638] rounded-2xl p-5 md:p-6 shadow-xl my-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Shift Audit Ledger
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                ({shift.status})
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Reconciled
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Attendant: {shift.workerName} · {new Date(shift.openedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const currentBiz = store.getCurrentBusiness();
                exportShiftToCsv(shift, stockItems, expenses, currentBiz.name);
              }}
              className="py-1.5 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Download Full Shift Audit Report (.csv)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Financial Reconciliation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>M-Pesa Till Handover</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Closing Balance:</span>
                <span className="text-white font-semibold">
                  KES {(shift.closingMpesaBalance || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>-KES {shift.openingMpesaBalance.toLocaleString()}</span>
              </div>
              <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
                <span>Net M-Pesa Income:</span>
                <span>KES {netMpesa.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0D1117] border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <Banknote className="w-4 h-4 text-amber-400" />
              <span>Cash Drawer Handover</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Ending Cash Count:</span>
                <span className="text-white font-semibold">
                  KES {(shift.closingCashActual || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Starting Float:</span>
                <span>-KES {shift.openingCashFloat.toLocaleString()}</span>
              </div>
              <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-amber-400">
                <span>Net Cash Income:</span>
                <span>KES {netCash.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Total Returned:</span>
            <span className="font-bold text-white text-sm mt-0.5 block">
              KES {totalReturned.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Expected Sales:</span>
            <span className="font-bold text-emerald-400 text-sm mt-0.5 block">
              KES {(shift.expectedSalesRevenue || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Expenses Paid:</span>
            <span className="font-bold text-rose-400 text-sm mt-0.5 block">
              -KES {(shift.totalExpenses || 0).toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0D1117] border border-slate-800">
            <span className="text-[10px] text-slate-500 font-sans block">Variance:</span>
            <span
              className={`font-bold text-sm mt-0.5 block ${
                (shift.financialVariance || 0) === 0
                  ? 'text-emerald-400'
                  : (shift.financialVariance || 0) < 0
                  ? 'text-rose-400'
                  : 'text-amber-400'
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

        {/* Item Stock Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Stock Count Breakdown
          </h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#0D1117]">
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
                      KES {((item.isMeasured || item.unit === 'VALUE_KES') ? item.recordedSales : item.recordedSales * item.sellingPrice).toLocaleString()}
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
