import {
  Product,
  MpesaAccount,
  User,
  InventoryItem,
  Shift,
  ShiftStockItem,
  Expense,
  ExpenseCategory,
  Discrepancy,
  OperationalEvent,
  StockMovement,
  MpesaTransaction,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_MPESA_ACCOUNTS,
  INITIAL_USERS,
  INITIAL_INVENTORY,
} from './mockData';

const STORAGE_KEYS = {
  PRODUCTS: 'bar_track_products',
  MPESA_ACCOUNTS: 'bar_track_mpesa_accounts',
  USERS: 'bar_track_users',
  INVENTORY: 'bar_track_inventory',
  SHIFTS: 'bar_track_shifts',
  SHIFT_STOCK_ITEMS: 'bar_track_shift_stock_items',
  EXPENSES: 'bar_track_expenses',
  STOCK_MOVEMENTS: 'bar_track_stock_movements',
  DISCREPANCIES: 'bar_track_discrepancies',
  EVENTS: 'bar_track_events',
  MPESA_TXNS: 'bar_track_mpesa_txns',
  OFFLINE_QUEUE: 'bar_track_offline_queue',
  IS_ONLINE: 'bar_track_is_online',
};

class StoreService {
  private subscribers: (() => void)[] = [];

  constructor() {
    this.ensureInitialized();
  }

  public subscribe(callback: () => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Subscriber callback error:', e);
      }
    });
  }

  private get<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Failed to read from localStorage for key ${key}:`, err);
      return defaultValue;
    }
  }

  private set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to write to localStorage for key ${key}:`, err);
    }
  }

  private ensureInitialized() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.resetToDefaults();
    }
  }

  public resetToDefaults() {
    this.set(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS, INITIAL_MPESA_ACCOUNTS);
    this.set(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.set(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY);

    const sampleClosedShift: Shift = {
      id: 'shift-sample-closed',
      shiftNumber: 'SH-260929-101',
      workerId: 'user-1',
      workerName: 'Wanjiku Kamau (Bar Tender)',
      status: 'CLOSED',
      openedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      closedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      openingCashFloat: 3000,
      openingMpesaBalance: 10000,
      closingCashActual: 14500,
      closingMpesaBalance: 17000,
      calculatedMpesaIncome: 7000, // 17,000 - 10,000 = 7,000 KES
      calculatedCashIncome: 11500, // 14,500 - 3,000 = 11,500 KES
      totalIncomeReturned: 18500, // 11,500 + 7,000 = 18,500 KES
      recordedSalesCount: 71,
      expectedSalesRevenue: 18500,
      totalExpenses: 800,
      totalCostOfGoodsSold: 12200,
      grossProfit: 6300,
      netProfit: 5500,
      financialVariance: 800,
      closingNotes: 'Handover complete. Shift balanced.',
    };

    const sampleExpenses: Expense[] = [
      {
        id: 'exp-seed-1',
        shiftId: 'shift-sample-closed',
        category: 'ICE',
        amount: 500,
        paymentMethod: 'CASH',
        description: '2 Bags Crushed Ice from Ice Vendor',
        receiptRef: 'RCP-401',
        timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
      },
      {
        id: 'exp-seed-2',
        shiftId: 'shift-sample-closed',
        category: 'LEMONS_LIMES',
        amount: 300,
        paymentMethod: 'CASH',
        description: 'Fresh cocktail limes from Market',
        receiptRef: 'RCP-402',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
    ];

    this.set(STORAGE_KEYS.SHIFTS, [sampleClosedShift]);
    this.set(STORAGE_KEYS.EXPENSES, sampleExpenses);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    this.set(STORAGE_KEYS.MPESA_TXNS, []);
    this.set(STORAGE_KEYS.DISCREPANCIES, []);
    this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);
    this.set(STORAGE_KEYS.IS_ONLINE, true);

    const initialEvents: OperationalEvent[] = [
      {
        id: 'evt-init-1',
        type: 'SHIFT_CLOSED',
        title: 'Shift SH-260929-101 Reconciled',
        description: 'Total Returned: KES 18,500 (M-Pesa Net: KES 7,000 | Cash Net: KES 11,500). Net Profit: KES 5,500.',
        timestamp: new Date(Date.now() - 3600000 * 10).toISOString(),
        actorName: 'Wanjiku Kamau (Bar Tender)',
        severity: 'SUCCESS',
        amount: 18500,
        currency: 'KES',
      },
      {
        id: 'evt-init-2',
        type: 'SHIFT_OPENED',
        title: 'Shift SH-260929-101 Opened',
        description: 'Opening Cash Float: KES 3,000, M-Pesa Entry Balance: KES 10,000. Verified.',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        actorName: 'Wanjiku Kamau (Bar Tender)',
        severity: 'INFO',
      },
    ];
    this.set(STORAGE_KEYS.EVENTS, initialEvents);
    this.notify();
  }

  // --- Network simulator ---
  public isOnline(): boolean {
    return this.get<boolean>(STORAGE_KEYS.IS_ONLINE, true);
  }

  public toggleOnlineStatus(): boolean {
    const next = !this.isOnline();
    this.set(STORAGE_KEYS.IS_ONLINE, next);

    if (next) {
      const queue = this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
      if (queue.length > 0) {
        this.addEvent({
          type: 'INFO',
          title: 'Offline Queue Synchronized',
          description: `Device re-connected. Successfully synced ${queue.length} offline operations to the central register.`,
          actorName: 'System Sync Engine',
          severity: 'SUCCESS',
        });
        this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);
      }
    }
    this.notify();
    return next;
  }

  public getOfflineQueueCount(): number {
    return this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []).length;
  }

  private queueOfflineOperation(operationName: string, payload: unknown) {
    if (!this.isOnline()) {
      const queue = this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
      queue.push({
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        operationName,
        payload,
        queuedAt: new Date().toISOString(),
      });
      this.set(STORAGE_KEYS.OFFLINE_QUEUE, queue);
    }
  }

  // --- Events and Live Ticker ---
  public getEvents(limit = 40): OperationalEvent[] {
    const events = this.get<OperationalEvent[]>(STORAGE_KEYS.EVENTS, []);
    return events.slice(0, limit);
  }

  private addEvent(eventData: Omit<OperationalEvent, 'id' | 'timestamp'>) {
    const events = this.get<OperationalEvent[]>(STORAGE_KEYS.EVENTS, []);
    const newEvent: OperationalEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    events.unshift(newEvent);
    this.set(STORAGE_KEYS.EVENTS, events.slice(0, 100));
  }

  // --- Read Entities ---
  public getUsers(): User[] {
    return this.get<User[]>(STORAGE_KEYS.USERS, []);
  }

  public getProducts(): Product[] {
    return this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  }

  public getMpesaAccounts(): MpesaAccount[] {
    return this.get<MpesaAccount[]>(STORAGE_KEYS.MPESA_ACCOUNTS, []);
  }

  public getInventory(): InventoryItem[] {
    return this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
  }

  public getShifts(): Shift[] {
    return this.get<Shift[]>(STORAGE_KEYS.SHIFTS, []);
  }

  public getActiveShift(): Shift | undefined {
    const shifts = this.getShifts();
    return shifts.find(
      (s) => s.status === 'ACTIVE' || s.status === 'OPENING_VERIFICATION'
    );
  }

  public getLastClosedShift(): Shift | undefined {
    const shifts = this.getShifts();
    return shifts.find((s) => s.status === 'CLOSED');
  }

  public getShiftById(shiftId: string): Shift | undefined {
    return this.getShifts().find((s) => s.id === shiftId);
  }

  public getShiftStockItems(shiftId: string): ShiftStockItem[] {
    const items = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    return items.filter((i) => i.shiftId === shiftId);
  }

  public getExpenses(shiftId?: string): Expense[] {
    const expenses = this.get<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    return shiftId ? expenses.filter((e) => e.shiftId === shiftId) : expenses;
  }

  public getStockMovements(shiftId?: string): StockMovement[] {
    const movements = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    return shiftId ? movements.filter((m) => m.shiftId === shiftId) : movements;
  }

  public getDiscrepancies(filter?: { status?: string }): Discrepancy[] {
    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
    if (filter?.status) {
      return discrepancies.filter((d) => d.status === filter.status);
    }
    return discrepancies;
  }

  // --- Business Operations & Transitions ---

  /**
   * Transition: Initiate & Open Shift
   * Worker inputs starting M-Pesa balance, opening cash float, and verifies physical stock count.
   */
  public openShift(params: {
    workerId: string;
    workerName: string;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>; // productId -> physical count counted
    inconsistencyNote?: string;
  }): Shift {
    this.queueOfflineOperation('openShift', params);

    const products = this.getProducts();
    const currentInventory = this.getInventory();

    const shiftId = `shift-${Date.now()}`;
    const shiftNumber = `SH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    let hasOpeningInconsistency = false;
    const shiftStockItems: ShiftStockItem[] = [];
    const stockMovements: StockMovement[] = [];

    products.forEach((product) => {
      const inv = currentInventory.find((i) => i.productId === product.id);
      const systemCount = inv ? inv.quantityOnHand : 0;
      const physicalCount =
        params.physicalCounts[product.id] !== undefined
          ? params.physicalCounts[product.id]
          : systemCount;

      if (physicalCount !== systemCount) {
        hasOpeningInconsistency = true;
      }

      const item: ShiftStockItem = {
        id: `ssi-${Date.now()}-${product.id}`,
        shiftId,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        openingSystemCount: systemCount,
        openingPhysicalCount: physicalCount,
        openingVerified: true,
        additions: 0,
        recordedSales: 0,
        transfersIn: 0,
        transfersOut: 0,
        damages: 0,
      };
      shiftStockItems.push(item);

      stockMovements.push({
        id: `mov-${Date.now()}-${product.id}`,
        shiftId,
        productId: product.id,
        productName: product.name,
        type: 'OPENING_COUNT',
        quantity: physicalCount,
        unitPrice: product.sellingPrice,
        timestamp: new Date().toISOString(),
        note: `Opening physical count verified by ${params.workerName}`,
      });
    });

    // Update actual inventory to reflect opening physical reality
    const allInventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    shiftStockItems.forEach((ssi) => {
      const existing = allInventory.find((i) => i.productId === ssi.productId);
      if (existing) {
        existing.quantityOnHand = ssi.openingPhysicalCount;
        existing.updatedAt = new Date().toISOString();
      } else {
        allInventory.push({
          id: `inv-${Date.now()}-${ssi.productId}`,
          productId: ssi.productId,
          quantityOnHand: ssi.openingPhysicalCount,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    this.set(STORAGE_KEYS.INVENTORY, allInventory);

    // Save shift stock items
    const existingSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, [...shiftStockItems, ...existingSSIs]);

    // Save movements
    const existingMovs = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, [...stockMovements, ...existingMovs]);

    const newShift: Shift = {
      id: shiftId,
      shiftNumber,
      workerId: params.workerId,
      workerName: params.workerName,
      status: 'ACTIVE',
      openedAt: new Date().toISOString(),
      openingCashFloat: Number(params.openingCashFloat) || 0,
      openingMpesaBalance: Number(params.openingMpesaBalance) || 0,
      recordedSalesCount: 0,
      openingInconsistencyNote: params.inconsistencyNote,
    };

    const shifts = this.getShifts();
    shifts.unshift(newShift);
    this.set(STORAGE_KEYS.SHIFTS, shifts);

    // Log operational events
    this.addEvent({
      type: 'SHIFT_OPENED',
      title: `Shift Opened`,
      description: `${params.workerName} opened shift ${shiftNumber}. Cash Float: KES ${params.openingCashFloat.toLocaleString()}, M-Pesa Entry Balance: KES ${params.openingMpesaBalance.toLocaleString()}${
        hasOpeningInconsistency ? ' [FLAGGED: Stock count mismatch noted]' : ''
      }`,
      actorName: params.workerName,
      severity: hasOpeningInconsistency ? 'WARNING' : 'SUCCESS',
      amount: params.openingMpesaBalance,
      currency: 'KES',
    });

    if (hasOpeningInconsistency) {
      const lastClosedShift = this.getLastClosedShift();
      const prevWorker = lastClosedShift ? lastClosedShift.workerName : 'Previous Shift Attendant';
      const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);

      products.forEach((product) => {
        const inv = currentInventory.find((i) => i.productId === product.id);
        const systemCount = inv ? inv.quantityOnHand : 0;
        const physicalCount =
          params.physicalCounts[product.id] !== undefined
            ? params.physicalCounts[product.id]
            : systemCount;

        if (physicalCount !== systemCount) {
          const variance = physicalCount - systemCount;
          const isShortage = variance < 0;
          const missingUnits = Math.abs(variance);
          const monetaryValue = missingUnits * product.sellingPrice;

          discrepancies.unshift({
            id: `disc-open-${Date.now()}-${product.id}`,
            shiftId,
            shiftNumber,
            workerName: params.workerName,
            responsibleWorkerName: isShortage ? prevWorker : undefined,
            previousShiftId: lastClosedShift?.id,
            type: isShortage ? 'STOCK_SHORTAGE' : 'STOCK_OVERAGE',
            itemId: product.id,
            itemName: `${product.name} (Handover Count)`,
            expected: systemCount,
            actual: physicalCount,
            variance,
            monetaryValue,
            severity: missingUnits >= 2 ? 'HIGH' : 'MEDIUM',
            status: 'FLAGGED',
            ownerNotes: isShortage
              ? `Missing ${missingUnits} unit(s) of ${product.name} (KES ${monetaryValue.toLocaleString()}). Identified during handover takeover by ${params.workerName}. ${prevWorker} is held accountable for missing items.`
              : `Found +${missingUnits} extra unit(s) of ${product.name} during handover count by ${params.workerName}.`,
            timestamp: new Date().toISOString(),
          });
        }
      });

      this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);

      this.addEvent({
        type: 'DISCREPANCY_FLAGGED',
        title: `Handover Shortage Flagged (${prevWorker} Liable)`,
        description: `${params.workerName} took over shift and reported missing items left from ${prevWorker}'s shift. ${params.inconsistencyNote || ''}`,
        actorName: params.workerName,
        severity: 'WARNING',
      });
    }

    this.notify();
    return newShift;
  }

  /**
   * Operation: Record Stock Addition (e.g. Delivery from supplier/distributor)
   */
  public recordStockAddition(params: {
    shiftId: string;
    productId: string;
    quantity: number;
    source: string;
    note?: string;
  }) {
    this.queueOfflineOperation('recordStockAddition', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');
    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');

    const qty = Number(params.quantity);
    if (qty <= 0) return;

    // Update SSI additions
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find(
      (item) => item.shiftId === params.shiftId && item.productId === params.productId
    );
    if (ssi) {
      ssi.additions += qty;
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // Increment bar inventory
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const inv = inventory.find((i) => i.productId === params.productId);
    if (inv) {
      inv.quantityOnHand += qty;
      inv.updatedAt = new Date().toISOString();
      this.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    // Log movement
    const movements = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      shiftId: params.shiftId,
      productId: params.productId,
      productName: product.name,
      type: 'ADDITION',
      quantity: qty,
      unitPrice: product.costPrice,
      timestamp: new Date().toISOString(),
      note: `Received ${qty} from ${params.source}. ${params.note || ''}`,
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    this.addEvent({
      type: 'ADDITION_RECORDED',
      title: `+${qty} ${product.name} Restocked`,
      description: `Added to bar from ${params.source}`,
      actorName: shift.workerName,
      severity: 'SUCCESS',
    });

    this.notify();
  }

  /**
   * Operation: Record Shift Expense (e.g. Ice, Lemons, Cleaning, Transport, Casual Wages)
   */
  public recordExpense(params: {
    shiftId: string;
    category: ExpenseCategory;
    amount: number;
    paymentMethod: 'CASH' | 'MPESA';
    description: string;
    receiptRef?: string;
  }): Expense {
    this.queueOfflineOperation('recordExpense', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      shiftId: params.shiftId,
      category: params.category,
      amount: Number(params.amount) || 0,
      paymentMethod: params.paymentMethod,
      description: params.description,
      receiptRef: params.receiptRef,
      timestamp: new Date().toISOString(),
    };

    const expenses = this.get<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    expenses.unshift(expense);
    this.set(STORAGE_KEYS.EXPENSES, expenses);

    this.addEvent({
      type: 'EXPENSE_LOGGED',
      title: `Expense: KES ${expense.amount.toLocaleString()} (${params.category})`,
      description: `${params.description} paid via ${params.paymentMethod}`,
      actorName: shift.workerName,
      severity: 'INFO',
      amount: expense.amount,
      currency: 'KES',
    });

    this.notify();
    return expense;
  }

  /**
   * Transition: Calculate Shift Closing Preview
   */
  public calculateShiftReconciliation(params: {
    shiftId: string;
    closingPhysicalCounts: Record<string, number>;
    closingCashActual: number;
    closingMpesaBalance: number;
  }) {
    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');

    const shiftStockItems = this.getShiftStockItems(params.shiftId);
    const expenses = this.getExpenses(params.shiftId);

    const openingMpesa = shift.openingMpesaBalance || 0;
    const closingMpesa = Number(params.closingMpesaBalance) || 0;
    const calculatedMpesaIncome = closingMpesa - openingMpesa;

    const openingCashFloat = shift.openingCashFloat || 0;
    const closingCashActual = Number(params.closingCashActual) || 0;
    const calculatedCashIncome = closingCashActual - openingCashFloat;

    const totalIncomeReturned = calculatedCashIncome + calculatedMpesaIncome;

    let expectedSalesRevenue = 0;
    let totalCostOfGoodsSold = 0;

    const reconciledStockItems = shiftStockItems.map((item) => {
      const availableStock =
        item.openingPhysicalCount +
        item.additions +
        item.transfersIn -
        item.transfersOut -
        item.damages;

      const physicalClosing =
        params.closingPhysicalCounts[item.productId] !== undefined
          ? params.closingPhysicalCounts[item.productId]
          : availableStock;

      const calculatedSold = Math.max(0, availableStock - physicalClosing);
      const overageCount = physicalClosing > availableStock ? physicalClosing - availableStock : 0;
      const discrepancyValue = overageCount * item.sellingPrice;

      expectedSalesRevenue += calculatedSold * item.sellingPrice;
      totalCostOfGoodsSold += calculatedSold * item.costPrice;

      return {
        ...item,
        recordedSales: calculatedSold,
        closingPhysicalCount: physicalClosing,
        expectedClosingCount: availableStock,
        discrepancyCount: overageCount,
        discrepancyValue,
      };
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = expectedSalesRevenue - totalCostOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    const financialVariance =
      totalIncomeReturned + totalExpenses - expectedSalesRevenue;

    return {
      shift,
      openingMpesa,
      closingMpesa,
      calculatedMpesaIncome,
      openingCashFloat,
      closingCashActual,
      calculatedCashIncome,
      totalIncomeReturned,
      expectedSalesRevenue,
      totalCostOfGoodsSold,
      totalExpenses,
      grossProfit,
      netProfit,
      financialVariance,
      reconciledStockItems,
    };
  }

  /**
   * Transition: Close Shift & Commit Reconciliation
   */
  public closeShift(params: {
    shiftId: string;
    closingPhysicalCounts: Record<string, number>;
    closingCashActual: number;
    closingMpesaBalance: number;
    closingNotes?: string;
  }): Shift {
    this.queueOfflineOperation('closeShift', params);

    const recon = this.calculateShiftReconciliation(params);
    const shifts = this.getShifts();
    const shift = shifts.find((s) => s.id === params.shiftId);
    if (!shift) throw new Error('Shift not found.');

    shift.status = 'CLOSED';
    shift.closedAt = new Date().toISOString();
    shift.closingCashActual = recon.closingCashActual;
    shift.closingMpesaBalance = recon.closingMpesa;
    shift.calculatedMpesaIncome = recon.calculatedMpesaIncome;
    shift.calculatedCashIncome = recon.calculatedCashIncome;
    shift.totalIncomeReturned = recon.totalIncomeReturned;
    shift.expectedSalesRevenue = recon.expectedSalesRevenue;
    shift.totalExpenses = recon.totalExpenses;
    shift.totalCostOfGoodsSold = recon.totalCostOfGoodsSold;
    shift.grossProfit = recon.grossProfit;
    shift.netProfit = recon.netProfit;
    shift.financialVariance = recon.financialVariance;
    shift.closingNotes = params.closingNotes;
    shift.recordedSalesCount = recon.reconciledStockItems.reduce(
      (sum, item) => sum + item.recordedSales,
      0
    );

    this.set(STORAGE_KEYS.SHIFTS, shifts);

    // Update Shift Stock Items
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const remainingSSIs = allSSIs.filter((i) => i.shiftId !== params.shiftId);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, [
      ...recon.reconciledStockItems,
      ...remainingSSIs,
    ]);

    // Update physical inventory to the closing verified counts
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    recon.reconciledStockItems.forEach((item) => {
      const inv = inventory.find((i) => i.productId === item.productId);
      if (inv && item.closingPhysicalCount !== undefined) {
        inv.quantityOnHand = item.closingPhysicalCount;
        inv.updatedAt = new Date().toISOString();
      }
    });
    this.set(STORAGE_KEYS.INVENTORY, inventory);

    // Generate Discrepancies if any
    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);

    // 1. Stock overages
    recon.reconciledStockItems.forEach((item) => {
      if (item.discrepancyCount && item.discrepancyCount > 0) {
        discrepancies.unshift({
          id: `disc-stock-${Date.now()}-${item.productId}`,
          shiftId: shift.id,
          shiftNumber: shift.shiftNumber,
          workerName: shift.workerName,
          type: 'STOCK_OVERAGE',
          itemId: item.productId,
          itemName: item.productName,
          expected: item.expectedClosingCount || 0,
          actual: item.closingPhysicalCount || 0,
          variance: item.discrepancyCount,
          monetaryValue: Math.abs(item.discrepancyValue || 0),
          severity: Math.abs(item.discrepancyCount) >= 3 ? 'HIGH' : 'MEDIUM',
          status: 'FLAGGED',
          ownerNotes: '',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 2. Financial discrepancy
    if (Math.abs(recon.financialVariance) > 5) {
      discrepancies.unshift({
        id: `disc-fin-${Date.now()}`,
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        workerName: shift.workerName,
        type:
          recon.financialVariance < 0 ? 'FINANCIAL_SHORTAGE' : 'FINANCIAL_OVERAGE',
        itemName:
          recon.financialVariance < 0
            ? 'Cash & M-Pesa Shortage'
            : 'Cash & M-Pesa Surplus',
        expected: recon.expectedSalesRevenue,
        actual: recon.totalIncomeReturned + recon.totalExpenses,
        variance: recon.financialVariance,
        monetaryValue: Math.abs(recon.financialVariance),
        severity: Math.abs(recon.financialVariance) >= 2000 ? 'HIGH' : 'MEDIUM',
        status: 'FLAGGED',
        ownerNotes:
          recon.financialVariance < 0
            ? `Net returned funds (KES ${recon.totalIncomeReturned.toLocaleString()} + KES ${recon.totalExpenses.toLocaleString()} expenses) fell short of calculated consumption (KES ${recon.expectedSalesRevenue.toLocaleString()}).`
            : `Collected funds exceed calculated drink consumption.`,
        timestamp: new Date().toISOString(),
      });
    }
    this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);

    this.addEvent({
      type: 'SHIFT_CLOSED',
      title: `Shift Closed: ${shift.shiftNumber}`,
      description: `Reconciled by ${shift.workerName}. Net Money Returned: KES ${recon.totalIncomeReturned.toLocaleString()} | Sales: KES ${recon.expectedSalesRevenue.toLocaleString()} | Net Profit: KES ${recon.netProfit.toLocaleString()}`,
      actorName: shift.workerName,
      severity:
        Math.abs(recon.financialVariance) > 5 ? 'WARNING' : 'SUCCESS',
      amount: recon.totalIncomeReturned,
      currency: 'KES',
    });

    this.notify();
    return shift;
  }

  public updateProductPricing(productId: string, sellingPrice: number, costPrice: number) {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    product.sellingPrice = sellingPrice;
    product.costPrice = costPrice;
    this.set(STORAGE_KEYS.PRODUCTS, products);

    this.addEvent({
      type: 'INFO',
      title: `Price Updated: ${product.name}`,
      description: `Selling: KES ${sellingPrice.toLocaleString()} | Cost: KES ${costPrice.toLocaleString()}`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
  }

  public resolveDiscrepancy(
    idOrParams: string | { discrepancyId: string; resolutionStatus: 'RESOLVED' | 'INVESTIGATING'; ownerNotes: string },
    notes?: string,
    status?: 'RESOLVED' | 'INVESTIGATING'
  ) {
    const discrepancyId = typeof idOrParams === 'string' ? idOrParams : idOrParams.discrepancyId;
    const ownerNotes = typeof idOrParams === 'string' ? (notes || '') : idOrParams.ownerNotes;
    const resolutionStatus = typeof idOrParams === 'string' ? (status || 'RESOLVED') : idOrParams.resolutionStatus;

    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
    const item = discrepancies.find((d) => d.id === discrepancyId);
    if (!item) throw new Error('Discrepancy not found.');

    item.status = resolutionStatus;
    item.ownerNotes = ownerNotes;
    this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);

    this.addEvent({
      type: 'INFO',
      title: `Discrepancy ${resolutionStatus}`,
      description: `Shift #${item.shiftNumber} (${item.itemName}): ${ownerNotes}`,
      actorName: 'Owner Audit Desk',
      severity: resolutionStatus === 'RESOLVED' ? 'SUCCESS' : 'INFO',
    });

    this.notify();
  }
}

export const store = new StoreService();
