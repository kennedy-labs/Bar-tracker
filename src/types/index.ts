export type Role = 'WORKER' | 'OWNER';

export type ShiftStatus =
  | 'PENDING_OPENING'
  | 'OPENING_VERIFICATION'
  | 'ACTIVE'
  | 'CLOSING_COUNT'
  | 'RECONCILED'
  | 'CLOSED';

export type ProductCategory =
  | 'BEER'
  | 'CIDER'
  | 'SPIRIT'
  | 'WINE'
  | 'SOFT_DRINK'
  | 'CIGARETTE';

export type ProductUnit = 'BOTTLE' | 'CAN' | 'SHOT_TOT' | 'CRATE' | 'PACK';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: number; // in KES
  sellingPrice: number; // in KES
  reorderLevel: number;
  volumeMl?: number;
}

export interface ProductCostHistory {
  id: string;
  productId: string;
  previousCost: number;
  newCost: number;
  effectiveDate: string;
}

export interface StockLocation {
  id: string;
  name: string;
  branchId: string;
  isCounter: boolean;
}

export interface InventoryItem {
  id?: string;
  productId: string;
  locationId: string;
  quantityOnHand: number;
  updatedAt: string;
}

export type MpesaAccountType =
  | 'BUY_GOODS_TILL'
  | 'PAYBILL'
  | 'POCHI_LA_BIASHARA'
  | 'SEND_MONEY';

export interface MpesaAccount {
  id: string;
  branchId: string;
  accountName: string;
  accountType: MpesaAccountType;
  identifier: string; // Till number, Paybill shortcode, phone
  currentBalance: number;
}

export interface ShiftStockItem {
  id: string;
  shiftId: string;
  productId: string;
  productName: string;
  unit: ProductUnit;
  sellingPrice: number;
  costPrice: number;
  openingSystemCount: number;
  openingPhysicalCount: number;
  openingVerified: boolean;
  additions: number;
  recordedSales: number;
  transfersIn: number;
  transfersOut: number;
  damages: number;
  closingPhysicalCount?: number;
  expectedClosingCount?: number;
  discrepancyCount?: number; // actual - expected
  discrepancyValue?: number; // in KES
}

export interface Shift {
  id: string;
  shiftNumber: string;
  branchId: string;
  branchName: string;
  locationId: string;
  locationName: string;
  workerId: string;
  workerName: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string;

  // Opening inputs
  openingCashFloat: number; // KES
  openingMpesaBalance: number; // KES entry balance on business M-Pesa

  // Active inputs
  recordedSalesCount: number;

  // Closing inputs
  closingCashActual?: number; // KES physical cash in drawer
  closingMpesaBalance?: number; // KES exit balance on business M-Pesa

  // Automated System Calculations
  calculatedMpesaIncome?: number; // closingMpesaBalance - openingMpesaBalance
  calculatedCashIncome?: number; // closingCashActual - openingCashFloat
  totalIncomeReturned?: number; // calculatedCashIncome + calculatedMpesaIncome
  expectedSalesRevenue?: number; // sum(item.recordedSales * item.sellingPrice)
  totalExpenses?: number; // Cash + Mpesa expenses
  totalCostOfGoodsSold?: number; // sum(item.recordedSales * item.costPrice)
  grossProfit?: number; // expectedSalesRevenue - totalCostOfGoodsSold
  netProfit?: number; // grossProfit - totalExpenses
  financialVariance?: number; // (totalIncomeReturned + totalExpenses) - expectedSalesRevenue

  // Audit notes
  openingInconsistencyNote?: string;
  closingNotes?: string;
}

export type StockMovementType =
  | 'OPENING_COUNT'
  | 'SALE'
  | 'ADDITION'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'DAMAGE_BREAKAGE'
  | 'CLOSING_COUNT';

export interface StockMovement {
  id: string;
  shiftId: string;
  productId: string;
  productName: string;
  locationId: string;
  locationName: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number;
  timestamp: string;
  note?: string;
}

export interface Transfer {
  id: string;
  shiftId: string;
  productId: string;
  productName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  senderName: string;
  receiverName?: string;
  timestamp: string;
}

export type ExpenseCategory =
  | 'ICE'
  | 'LEMONS_LIMES'
  | 'CLEANING'
  | 'CASUAL_WAGES'
  | 'TRANSPORT'
  | 'BREAKAGE'
  | 'SUPPLIES'
  | 'OTHER';

export interface Expense {
  id: string;
  shiftId: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: 'CASH' | 'MPESA';
  description: string;
  receiptRef?: string;
  timestamp: string;
}

export interface MpesaTransaction {
  id: string;
  shiftId: string;
  mpesaAccountId: string;
  accountType: MpesaAccountType;
  transactionCode: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  timestamp: string;
  note?: string;
}

export type DiscrepancyType =
  | 'STOCK_SHORTAGE'
  | 'STOCK_OVERAGE'
  | 'FINANCIAL_SHORTAGE'
  | 'FINANCIAL_OVERAGE'
  | 'OPENING_MISMATCH';

export interface Discrepancy {
  id: string;
  shiftId: string;
  shiftNumber: string;
  branchName: string;
  locationName: string;
  workerName: string;
  responsibleWorkerName?: string;
  previousShiftId?: string;
  type: DiscrepancyType;
  itemId?: string;
  itemName: string;
  expected: number;
  actual: number;
  variance: number; // actual - expected
  monetaryValue: number; // in KES
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'FLAGGED' | 'INVESTIGATING' | 'RESOLVED';
  ownerNotes?: string;
  timestamp: string;
}

export interface OperationalEvent {
  id: string;
  type:
    | 'SHIFT_OPENED'
    | 'SHIFT_CLOSED'
    | 'SALE_RECORDED'
    | 'ADDITION_RECORDED'
    | 'TRANSFER_DISPATCHED'
    | 'TRANSFER_RECEIVED'
    | 'EXPENSE_LOGGED'
    | 'DISCREPANCY_FLAGGED'
    | 'INFO'
    | 'SYNC_COMPLETED';
  title: string;
  description: string;
  timestamp: string;
  locationName: string;
  actorName: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  amount?: number;
  currency?: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  pinCode: string;
  assignedLocationId?: string;
}
