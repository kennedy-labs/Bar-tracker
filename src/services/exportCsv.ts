import { Shift, ShiftStockItem, Expense } from '../types';

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportShiftToCsv(
  shift: Shift,
  stockItems: ShiftStockItem[],
  expenses: Expense[],
  businessName: string = 'Bar Establishment'
): void {
  const rows: string[][] = [];

  // 1. Establishment & Shift Header
  rows.push(['BAR TRACK SHIFT AUDIT REPORT']);
  rows.push(['Establishment', businessName]);
  rows.push(['Shift Number', `#${shift.shiftNumber}`]);
  rows.push(['Attendant / Worker', shift.workerName]);
  rows.push(['Status', shift.status]);
  rows.push(['Opened At', new Date(shift.openedAt).toLocaleString()]);
  rows.push(['Closed At', shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'In Progress']);
  rows.push(['Export Timestamp', new Date().toLocaleString()]);
  rows.push([]);

  // 2. Financial Reconciliation Summary
  const netCash =
    shift.calculatedCashIncome !== undefined
      ? shift.calculatedCashIncome
      : (shift.closingCashActual || 0) - (shift.openingCashFloat || 0);

  const netMpesa =
    shift.calculatedMpesaIncome !== undefined
      ? shift.calculatedMpesaIncome
      : (shift.closingMpesaBalance || 0) - (shift.openingMpesaBalance || 0);

  const totalReturned = shift.totalIncomeReturned !== undefined ? shift.totalIncomeReturned : netCash + netMpesa;
  const totalExpenses = shift.totalExpenses !== undefined ? shift.totalExpenses : expenses.reduce((s, e) => s + e.amount, 0);
  const expectedSales = shift.expectedSalesRevenue || 0;
  const variance = shift.financialVariance !== undefined ? shift.financialVariance : (totalReturned + totalExpenses - expectedSales);

  rows.push(['FINANCIAL HANDOVER RECONCILIATION']);
  rows.push(['Metric', 'Amount (KES)']);
  rows.push(['Opening Cash Float', String(shift.openingCashFloat || 0)]);
  rows.push(['Closing Physical Cash', String(shift.closingCashActual || 0)]);
  rows.push(['Calculated Net Cash Income', String(netCash)]);
  rows.push(['Opening M-Pesa Till Balance', String(shift.openingMpesaBalance || 0)]);
  rows.push(['Closing M-Pesa Till Balance', String(shift.closingMpesaBalance || 0)]);
  rows.push(['Calculated Net M-Pesa Income', String(netMpesa)]);
  rows.push(['Total Money Handed Over (Cash + M-Pesa)', String(totalReturned)]);
  rows.push(['Total Operational Expenses Paid Out', String(totalExpenses)]);
  rows.push(['Expected Sales Revenue (From Drinks Counted)', String(expectedSales)]);
  rows.push(['Financial Variance (Returned + Expenses - Expected)', String(variance)]);
  rows.push(['Variance Classification', variance === 0 ? 'BALANCED' : variance < 0 ? `DEFICIT / SHORTAGE (-KES ${Math.abs(variance).toLocaleString()})` : `SURPLUS / OVERAGE (+KES ${variance.toLocaleString()})`]);
  if (shift.closingNotes) {
    rows.push(['Shift Closing Notes', shift.closingNotes]);
  }
  rows.push([]);

  // 3. Itemized Stock Count & Sales Audit Ledger
  rows.push(['ITEMIZED DRINK STOCK AUDIT LEDGER']);
  rows.push([
    'Drink Name',
    'Unit',
    'Price (KES)',
    'Opening Physical Count',
    'Restocks Added',
    'Transfers In',
    'Transfers Out',
    'Damages / Spillage',
    'Owner Audit Adjustments',
    'Available Counter Stock',
    'Closing Physical Count',
    'Quantity Sold',
    'Sales Revenue (KES)',
    'Discrepancy (Units)',
    'Discrepancy Value (KES)',
  ]);

  stockItems.forEach((item) => {
    const available =
      item.openingPhysicalCount +
      item.additions +
      item.transfersIn -
      item.transfersOut -
      item.damages +
      (item.ownerAdjustments || 0);
    const closing = item.closingPhysicalCount !== undefined ? item.closingPhysicalCount : available;
    const sold = item.recordedSales !== undefined ? item.recordedSales : Math.max(0, available - closing);
    const revenue = sold * item.sellingPrice;
    const discCount = item.discrepancyCount || 0;
    const discValue = item.discrepancyValue || 0;

    rows.push([
      item.productName,
      item.unit,
      String(item.sellingPrice),
      String(item.openingPhysicalCount),
      String(item.additions),
      String(item.transfersIn),
      String(item.transfersOut),
      String(item.damages),
      String(item.ownerAdjustments || 0),
      String(available),
      String(closing),
      String(sold),
      String(revenue),
      String(discCount),
      String(discValue),
    ]);
  });
  rows.push([]);

  // 4. Itemized Shift Expenses
  rows.push(['SHIFT EXPENSES BREAKDOWN']);
  rows.push(['Category', 'Description', 'Payment Method', 'Receipt / M-Pesa Ref', 'Amount (KES)']);
  if (expenses.length === 0) {
    rows.push(['None', 'No expenses logged during this shift', '-', '-', '0']);
  } else {
    expenses.forEach((e) => {
      rows.push([
        e.category,
        e.description,
        e.paymentMethod,
        e.receiptRef || 'N/A',
        String(e.amount),
      ]);
    });
  }

  // Build CSV String
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeShiftNum = String(shift.shiftNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date(shift.openedAt).toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `BarTrack_Shift_${safeShiftNum}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAllShiftsSummaryCsv(
  shifts: Shift[],
  businessName: string = 'Bar Establishment'
): void {
  const rows: string[][] = [];
  rows.push(['BAR TRACK ALL SHIFTS SUMMARY EXPORT']);
  rows.push(['Establishment', businessName]);
  rows.push(['Total Shifts Exported', String(shifts.length)]);
  rows.push(['Generated At', new Date().toLocaleString()]);
  rows.push([]);

  rows.push([
    'Shift Number',
    'Attendant',
    'Status',
    'Opened Date',
    'Closed Date',
    'Opening Float (KES)',
    'Closing Cash (KES)',
    'Net Cash Income (KES)',
    'Opening M-Pesa (KES)',
    'Closing M-Pesa (KES)',
    'Net M-Pesa Income (KES)',
    'Total Returned (KES)',
    'Expenses (KES)',
    'Expected Sales (KES)',
    'Financial Variance (KES)',
    'Review Status',
    'Reviewed By',
  ]);

  shifts.forEach((s) => {
    const netCash =
      s.calculatedCashIncome !== undefined
        ? s.calculatedCashIncome
        : (s.closingCashActual || 0) - (s.openingCashFloat || 0);

    const netMpesa =
      s.calculatedMpesaIncome !== undefined
        ? s.calculatedMpesaIncome
        : (s.closingMpesaBalance || 0) - (s.openingMpesaBalance || 0);

    const totalRet = s.totalIncomeReturned !== undefined ? s.totalIncomeReturned : netCash + netMpesa;

    rows.push([
      `#${s.shiftNumber}`,
      s.workerName,
      s.status,
      new Date(s.openedAt).toLocaleDateString(),
      s.closedAt ? new Date(s.closedAt).toLocaleDateString() : 'Active',
      String(s.openingCashFloat || 0),
      String(s.closingCashActual || 0),
      String(netCash),
      String(s.openingMpesaBalance || 0),
      String(s.closingMpesaBalance || 0),
      String(netMpesa),
      String(totalRet),
      String(s.totalExpenses || 0),
      String(s.expectedSalesRevenue || 0),
      String(s.financialVariance || 0),
      s.isReviewedByOwner ? 'VERIFIED' : 'PENDING_REVIEW',
      s.reviewedBy || 'N/A',
    ]);
  });

  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `BarTrack_All_Shifts_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
