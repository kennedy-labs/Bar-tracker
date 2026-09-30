import React from 'react';
import { Shift } from '../../types';
import { store } from '../../services/store';
import { X, Smartphone, Banknote, ShieldAlert, CheckCircle2, Receipt } from 'lucide-react';

interface ShiftDetailModalProps {
  shift: Shift;
  onClose: () => void;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({ shift, onClose }) => {
  const stockItems = store.getShiftStockItems(shift.id);
  const expenses = store.getExpenses(shift.id);
  const movements = store.getStockMovements(shift.id);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#121824] border border-[#1E293B] rounded-3xl p-5 md:p-7 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">
                Shift Audit Ledger: {shift.shiftNumber}
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                  shift.status === 'CLOSED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-blue-950 text-blue-400 border border-blue-800'
                }`}
              >
                {shift.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Attendant: {shift.workerName} · {shift.locationName} · {new Date(shift.openedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* M-PESA & CASH FORMULA BREAKDOWN CARD */}
          <div className="p-4 rounded-2xl bg-[#151D2C] border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              M-Pesa & Cash Financial Handover (Verified Equation)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* M-Pesa Delta Calculation */}
              <div className="p-3 rounded-xl bg-[#0E1420] border border-emerald-900/40">
                <div className="flex items-center justify-between text-emerald-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>M-Pesa Account Delta</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">Till Handover</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span>Shift Closing Balance:</span>
                    <span className="font-bold text-white">
                      KES {(shift.closingMpesaBalance || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shift Opening Balance:</span>
                    <span className="text-slate-400">
                      -KES {shift.openingMpesaBalance.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
                    <span>Net M-Pesa Generated:</span>
                    <span>KES {netMpesa.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Cash Drawer Delta Calculation */}
              <div className="p-3 rounded-xl bg-[#0E1420] border border-amber-900/40">
                <div className="flex items-center justify-between text-amber-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" />
                    <span>Cash Drawer Delta</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">Physical Float</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span>Ending Cash in Drawer:</span>
                    <span className="font-bold text-white">
                      KES {(shift.closingCashActual || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opening Cash Float:</span>
                    <span className="text-slate-400">
                      -KES {shift.openingCashFloat.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-amber-400">
                    <span>Net Cash Generated:</span>
                    <span>KES {netCash.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Income & Reconciliation Balance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Total Money Returned</div>
                <div className="font-mono font-bold text-emerald-400 mt-0.5 text-sm tabular-nums">
                  KES {totalReturned.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Expected Sales Revenue</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5 text-sm tabular-nums">
                  KES {(shift.expectedSalesRevenue || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Approved Shift Expenses</div>
                <div className="font-mono font-bold text-red-400 mt-0.5 text-sm tabular-nums">
                  -KES {(shift.totalExpenses || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0E1420] border border-slate-800">
                <div className="text-[10px] text-slate-400">Financial Variance</div>
                <div
                  className={`font-mono font-bold mt-0.5 text-sm tabular-nums ${
                    (shift.financialVariance || 0) < 0
                      ? 'text-red-400'
                      : (shift.financialVariance || 0) > 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {(shift.financialVariance || 0) > 0 ? '+' : ''}
                  KES {(shift.financialVariance || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* ITEM-BY-ITEM STOCK RECONCILIATION TABLE */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Stock Accountability & Physical Counts
            </h4>
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-[#0E1420]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#151D2C] text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Beverage Item</th>
                    <th className="p-2.5 text-center">Open</th>
                    <th className="p-2.5 text-center">+In</th>
                    <th className="p-2.5 text-center">Sold</th>
                    <th className="p-2.5 text-center">Expected</th>
                    <th className="p-2.5 text-center">Physical</th>
                    <th className="p-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {stockItems.map((item) => {
                    const diff = item.discrepancyCount || 0;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-900/40 ${
                          diff < 0 ? 'bg-red-950/20' : diff > 0 ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-2.5 font-sans font-medium text-slate-200">
                          {item.productName}
                        </td>
                        <td className="p-2.5 text-center text-slate-400">
                          {item.openingPhysicalCount}
                        </td>
                        <td className="p-2.5 text-center text-emerald-400">
                          +{item.additions + item.transfersIn}
                        </td>
                        <td className="p-2.5 text-center text-amber-400">
                          {item.recordedSales}
                        </td>
                        <td className="p-2.5 text-center text-slate-300 font-bold">
                          {item.expectedClosingCount ?? item.openingPhysicalCount - item.recordedSales}
                        </td>
                        <td className="p-2.5 text-center text-white font-bold">
                          {item.closingPhysicalCount ?? '-'}
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          {diff < 0 ? (
                            <span className="text-red-400">{diff} units</span>
                          ) : diff > 0 ? (
                            <span className="text-amber-400">+{diff} units</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* EXPENSES RECORDED */}
          {expenses.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Shift Operational Expenses
              </h4>
              <div className="border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-[#0E1420]">
                {expenses.map((exp) => (
                  <div key={exp.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">{exp.description}</div>
                      <div className="text-[10px] text-slate-400">
                        {exp.category} · Paid via {exp.paymentMethod}
                        {exp.receiptRef ? ` · Receipt ${exp.receiptRef}` : ''}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-red-400">
                      -KES {exp.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Notes */}
          {(shift.openingInconsistencyNote || shift.closingNotes) && (
            <div className="p-3 rounded-2xl bg-[#151D2C] border border-slate-800 text-xs space-y-1">
              {shift.openingInconsistencyNote && (
                <div>
                  <span className="text-amber-400 font-bold">Opening Handover Note: </span>
                  <span className="text-slate-300">{shift.openingInconsistencyNote}</span>
                </div>
              )}
              {shift.closingNotes && (
                <div>
                  <span className="text-slate-400 font-bold">Closing Note: </span>
                  <span className="text-slate-300">{shift.closingNotes}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
