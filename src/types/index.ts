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

export interface InventoryItem {
  id?: string;
  productId: string;
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
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'DAMAGE_BREAKAGE'
  | 'CLOSING_COUNT';

export interface StockMovement {
  id: string;
  shiftId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number;
  timestamp: string;
  note?: string;
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
    | 'EXPENSE_LOGGED'
    | 'DISCREPANCY_FLAGGED'
    | 'INTER_BAR_DISPATCH'
    | 'INTER_BAR_ACCEPTED'
    | 'INTER_BAR_REJECTED'
    | 'INFO'
    | 'SYNC_COMPLETED';
  title: string;
  description: string;
  timestamp: string;
  actorName: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  amount?: number;
  currency?: string;
}

export interface User {
  id: string;
  businessId?: string;
  username: string;
  name: string;
  role: Role;
  pinCode: string;
  password?: string;
  createdAt?: string;
}

// --- Inter-Business Connection & Stock Transfer Types ---

export interface BusinessProfile {
  id: string;
  name: string;
  connectCode: string; // 6-digit code e.g. "849201"
  phone: string;       // e.g. "0722 841 902"
  ownerName: string;
  address?: string;
}

export interface BusinessPartner {
  id: string;
  businessId: string;
  partnerBusinessId: string;
  partnerName: string;
  partnerPhone: string;
  partnerConnectCode: string;
  netCostBalance: number; // Positive = partner owes us cost value; Negative = we owe partner
  connectedAt: string;
}

export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface InterBusinessTransfer {
  id: string;
  fromBusinessId: string;
  fromBusinessName: string;
  fromShiftId: string;
  senderWorkerName: string;

  toBusinessId: string;
  toBusinessName: string;
  toShiftId?: string;
  receiverWorkerName?: string;

  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;       // cost price per unit
  totalCostValue: number; // quantity * unitCost

  status: TransferStatus;
  dispatchedAt: string;
  acceptedAt?: string;
  notes?: string;
}
