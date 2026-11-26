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

export type ProductUnit =
  | 'BOTTLE'
  | 'CAN'
  | 'SHOT_TOT'
  | 'CRATE'
  | 'PACK'
  | 'LITRE'
  | 'JUG'
  | 'CUP'
  | 'KEG'
  | 'PORTION'
  | 'CUSTOM';

export type MeasurementMode = 'STANDARD' | 'MAKALI' | 'MURATINA' | 'KEG';

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  sellingPrice: number; // in KES (retail / counter selling price)
  buyingPrice?: number; // optional wholesale cost per unit in KES for real-time net profit
  reorderLevel: number;
  volumeMl?: number;
  isArchived?: boolean;

  // Generalized Measured Product Engine Config (Non-hardcoded)
  measurementMode?: MeasurementMode;
  pricePerUnit?: number; // For Makali / packed unit pricing
  volumeTotal?: number;  // For Muratina total volume (e.g. 10 litres)
  fullWeightKg?: number; // For Keg full tank gross weight (e.g. 60kg)
  emptyWeightKg?: number;// For Keg empty tank tare weight (e.g. 12kg)
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
  businessId?: string;
  accountName: string;
  accountType: MpesaAccountType;
  identifier: string; // Till number, Paybill shortcode, phone
  accountNumber?: string; // For Paybill shortcodes: specific account identifier (e.g. BAR)
  currentBalance?: number;
  isPrimary?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftStockItem {
  id: string;
  shiftId: string;
  businessId?: string;
  productId: string;
  productName: string;
  unit: ProductUnit;
  sellingPrice: number;
  buyingPrice?: number;
  openingSystemCount: number;
  openingPhysicalCount: number;
  openingVerified: boolean;
  additions: number;
  recordedSales: number;
  transfersIn: number;
  transfersOut: number;
  damages: number;
  ownerAdjustments?: number; // Delta applied by owner during mid-shift audit (can be positive or negative)
  closingPhysicalCount?: number;
  expectedClosingCount?: number;
  discrepancyCount?: number; // actual - expected
  discrepancyValue?: number; // in KES
  adjustmentNote?: string;
  closingNote?: string;
  updatedAt?: string;

  // Raw measured product closing inputs
  closingUnits?: number;
  closingValueRemainder?: number;
  closingLitres?: number;
  closingGrossWeightKg?: number;
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
  openingCoinsFloat: number; // KES business float
  openingCashFloat: number; // KES (usually 0 if not entered at start)
  openingMpesaBalance: number; // KES entry balance on business M-Pesa

  // Active inputs
  recordedSalesCount: number;

  // Closing inputs
  closingCoinsActual?: number; // KES business float left for next shift
  closingCashActual?: number; // KES physical cash (notes) taken to owner
  closingMpesaBalance?: number; // KES exit balance on business M-Pesa

  // Automated System Calculations
  calculatedMpesaIncome?: number; // closingMpesaBalance - openingMpesaBalance
  calculatedCashIncome?: number; // closingCashActual - openingCashFloat
  calculatedCoinsIncome?: number; // closingCoinsActual - openingCoinsFloat
  totalIncomeReturned?: number; // calculatedCashIncome + calculatedMpesaIncome + calculatedCoinsIncome
  expectedSalesRevenue?: number; // sum(item.recordedSales * item.sellingPrice) or sum of sales value
  estimatedCogs?: number; // sum(item.recordedSales * buyingPrice) for costed items
  estimatedGrossProfit?: number; // expectedSalesRevenue - estimatedCogs
  estimatedNetProfit?: number; // estimatedGrossProfit - totalExpenses
  costedRevenueShare?: number; // 0..1 fraction of revenue backed by entered buying costs
  previousShiftId?: string;
  previousWorkerName?: string;
  handoverMismatchCount?: number;
  totalExpenses?: number; // Cash + Mpesa expenses
  financialVariance?: number; // (totalIncomeReturned + totalExpenses) - expectedSalesRevenue

  // Audit notes
  openingInconsistencyNote?: string;
  closingNotes?: string;

  // Progressive work routine tracking
  counterFinished?: boolean;

  // WhatsApp-style owner review tracking
  isReviewedByOwner?: boolean;
  reviewedAt?: string;
  reviewedBy?: string;

  businessId?: string;
  updatedAt?: string;
}

export interface HandoverDraft {
  step: 1 | 2 | 3;
  closingPhysicalCounts: Record<string, number>;
  countedProductIds?: string[];
  activeCategory?: string;
  closingCoinsActual: string;
  closingCashActual: string;
  closingMpesaBalance: string;
  closingNotes: string;
}

export type StockMovementType =
  | 'OPENING_COUNT'
  | 'SALE'
  | 'ADDITION'
  | 'REDUCTION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'DAMAGE_BREAKAGE'
  | 'CLOSING_COUNT';

export interface StockMovement {
  id: string;
  shiftId: string;
  businessId?: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number;
  timestamp: string;
  note?: string;
}

export interface StockAdditionRecord {
  id: string;
  shiftId: string;
  shiftNumber?: string;
  productId: string;
  productName: string;
  quantity: number;
  workerName: string;
  timestamp: string;
  status: 'PENDING_OWNER_CONFIRMATION' | 'SAVED_LOCKED';
  savedAt?: string;
  savedBy?: string;
  isImmutable: boolean;
  adjustmentType?: 'ADD' | 'REDUCE';
  reason?: string;
  businessId?: string;
  updatedAt?: string;
  isReadByOwner?: boolean;
  readAt?: string;
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
  businessId?: string;
  shiftId: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: 'CASH' | 'MPESA';
  description: string;
  receiptRef?: string;
  timestamp: string;
  updatedAt?: string;
  isReadByOwner?: boolean;
  readAt?: string;
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
  businessId?: string;
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
  updatedAt?: string;
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

export interface Loan {
  id: string;
  businessId?: string;
  name: string;
  amount: number;
  note?: string;
  createdAt: string;
  status: 'ACTIVE' | 'PAID';
}

export interface User {
  id: string;
  businessId?: string;
  username: string;
  name: string;
  role: Role;
  pinCode?: string;
  pinSalt?: string;
  password?: string;
  passwordSalt?: string;
  plainPassword?: string;
  createdAt?: string;
  isArchived?: boolean;
}

// --- Inter-Business Connection & Stock Transfer Types ---

export interface BusinessProfile {
  id: string;
  name: string;
  connectCode?: string;
  activeShiftTransferCode?: string; // Ephemeral 6-digit one-time code valid strictly for current shift
  activeShiftId?: string; // ID of the shift this code is locked to
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
  netTransferBalance: number; // Positive = partner owes us stock value; Negative = we owe partner
  connectedAt: string;
}

export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type LoanStatus = 'ACTIVE' | 'PAID';

export interface Loan {
  id: string;
  businessId?: string;
  name: string;
  amount: number;
  note?: string;
  status: LoanStatus;
  createdAt: string;
}

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
  unitPrice: number;       // selling / retail price per unit
  totalTransferValue: number; // quantity * unitPrice

  status: TransferStatus;
  dispatchedAt: string;
  acceptedAt?: string;
  notes?: string;
}
