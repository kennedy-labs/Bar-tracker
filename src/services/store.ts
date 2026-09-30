import {
  Product,
  StockLocation,
  MpesaAccount,
  Shift,
  ShiftStockItem,
  StockMovement,
  Transfer,
  Expense,
  MpesaTransaction,
  Discrepancy,
  OperationalEvent,
  User,
  InventoryItem,
  ExpenseCategory,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_LOCATIONS,
  INITIAL_MPESA_ACCOUNTS,
  INITIAL_USERS,
  INITIAL_INVENTORY,
} from './mockData';

const STORAGE_KEYS = {
  PRODUCTS: 'pombetrack_products',
  LOCATIONS: 'pombetrack_locations',
  MPESA_ACCOUNTS: 'pombetrack_mpesa_accounts',
  USERS: 'pombetrack_users',
  INVENTORY: 'pombetrack_inventory',
  SHIFTS: 'pombetrack_shifts',
  SHIFT_STOCK_ITEMS: 'pombetrack_shift_stock_items',
  STOCK_MOVEMENTS: 'pombetrack_stock_movements',
  TRANSFERS: 'pombetrack_transfers',
  EXPENSES: 'pombetrack_expenses',
  MPESA_TXNS: 'pombetrack_mpesa_txns',
  DISCREPANCIES: 'pombetrack_discrepancies',
  EVENTS: 'pombetrack_events',
  OFFLINE_QUEUE: 'pombetrack_offline_queue',
  IS_ONLINE: 'pombetrack_is_online',
};

type Listener = () => void;

class OperationalRealityStore {
  private listeners: Listener[] = [];

  constructor() {
    this.ensureInitialized();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }

  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
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
    this.set(STORAGE_KEYS.LOCATIONS, INITIAL_LOCATIONS);
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS, INITIAL_MPESA_ACCOUNTS);
    this.set(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.set(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY);
    // Seed sample closed shift matching user's exact example:
    // Opening M-Pesa 10,000, Closing M-Pesa 17,000 -> Net M-Pesa 7,000
    // Opening Cash 3,000, Ending Cash 14,500 -> Net Cash 11,500 -> Total Returned: 18,500
    const sampleClosedShift: Shift = {
      id: 'shift-sample-closed',
      shiftNumber: 'SH-260929-101',
      branchId: 'branch-1',
      branchName: 'Nairobi Central Flagship',
      locationId: 'loc-counter-1',
      locationName: 'Main Counter Station',
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
        description: 'Fresh cocktail limes from City Market',
        receiptRef: 'RCP-402',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
    ];

    this.set(STORAGE_KEYS.SHIFTS, [sampleClosedShift]);
    this.set(STORAGE_KEYS.EXPENSES, sampleExpenses);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    this.set(STORAGE_KEYS.TRANSFERS, []);
    this.set(STORAGE_KEYS.MPESA_TXNS, []);
    this.set(STORAGE_KEYS.DISCREPANCIES, []);
    this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);
    this.set(STORAGE_KEYS.IS_ONLINE, true);

    const initialEvents: OperationalEvent[] = [
      {
        id: 'evt-init-1',
        type: 'SHIFT_CLOSED',
        title: 'Shift SH-260929-101 Reconciled',
        description: 'Total Returned: KES 18,500 (M-Pesa Net: KES 7,000 [17,000 - 10,000] | Cash Net: KES 11,500). Net Profit: KES 5,500.',
        timestamp: new Date(Date.now() - 3600000 * 10).toISOString(),
        locationName: 'Main Counter Station',
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
        locationName: 'Main Counter Station',
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
      // Sync queued events
      const queue = this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
      if (queue.length > 0) {
        this.addEvent({
          type: 'INFO',
          title: 'Offline Queue Synchronized',
          description: `Device re-connected. Successfully synced ${queue.length} offline operations to the central register.`,
          locationName: 'Local Terminal',
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
    this.set(STORAGE_KEYS.EVENTS, events.slice(0, 100)); // retain last 100 events
  }

  // --- Read Entities ---
  public getUsers(): User[] {
    return this.get<User[]>(STORAGE_KEYS.USERS, []);
  }

  public getProducts(): Product[] {
    return this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  }

  public getLocations(): StockLocation[] {
    return this.get<StockLocation[]>(STORAGE_KEYS.LOCATIONS, []);
  }

  public getMpesaAccounts(): MpesaAccount[] {
    return this.get<MpesaAccount[]>(STORAGE_KEYS.MPESA_ACCOUNTS, []);
  }

  public getInventory(locationId?: string): InventoryItem[] {
    const items = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    return locationId ? items.filter((i) => i.locationId === locationId) : items;
  }

  public getShifts(): Shift[] {
    return this.get<Shift[]>(STORAGE_KEYS.SHIFTS, []);
  }

  public getActiveShift(locationId?: string): Shift | undefined {
    const shifts = this.getShifts();
    return shifts.find(
      (s) =>
        (s.status === 'ACTIVE' || s.status === 'OPENING_VERIFICATION') &&
        (!locationId || s.locationId === locationId)
    );
  }

  public getShiftById(shiftId: string): Shift | undefined {
    return this.getShifts().find((s) => s.id === shiftId);
  }

  public getShiftStockItems(shiftId: string): ShiftStockItem[] {
    const items = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    return items.filter((i) => i.shiftId === shiftId);
  }

  public getTransfers(shiftId?: string): Transfer[] {
    const transfers = this.get<Transfer[]>(STORAGE_KEYS.TRANSFERS, []);
    return shiftId ? transfers.filter((t) => t.shiftId === shiftId) : transfers;
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
    locationId: string;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>; // productId -> physical count counted
    inconsistencyNote?: string;
  }): Shift {
    this.queueOfflineOperation('openShift', params);

    const locations = this.getLocations();
    const location = locations.find((l) => l.id === params.locationId) || locations[1];
    const products = this.getProducts();
    const currentInventory = this.getInventory(params.locationId);

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

      // Record movement for opening baseline
      stockMovements.push({
        id: `mov-${Date.now()}-${product.id}`,
        shiftId,
        productId: product.id,
        productName: product.name,
        locationId: params.locationId,
        locationName: location.name,
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
      const existing = allInventory.find(
        (i) => i.locationId === params.locationId && i.productId === ssi.productId
      );
      if (existing) {
        existing.quantityOnHand = ssi.openingPhysicalCount;
        existing.updatedAt = new Date().toISOString();
      } else {
        allInventory.push({
          id: `inv-${Date.now()}-${ssi.productId}`,
          productId: ssi.productId,
          locationId: params.locationId,
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
      branchId: location.branchId,
      branchName: 'Nairobi Central Flagship',
      locationId: params.locationId,
      locationName: location.name,
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
      title: `Shift Opened: ${location.name}`,
      description: `${params.workerName} opened shift ${shiftNumber}. Cash Float: KES ${params.openingCashFloat.toLocaleString()}, M-Pesa Entry Balance: KES ${params.openingMpesaBalance.toLocaleString()}${
        hasOpeningInconsistency ? ' [FLAGGED: Stock count mismatch noted]' : ''
      }`,
      locationName: location.name,
      actorName: params.workerName,
      severity: hasOpeningInconsistency ? 'WARNING' : 'SUCCESS',
      amount: params.openingMpesaBalance,
      currency: 'KES',
    });

    if (hasOpeningInconsistency) {
      const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
      discrepancies.unshift({
        id: `disc-open-${Date.now()}`,
        shiftId,
        shiftNumber,
        branchName: 'Nairobi Central Flagship',
        locationName: location.name,
        workerName: params.workerName,
        type: 'OPENING_MISMATCH',
        itemName: 'Opening Stock Inconsistency',
        expected: 0,
        actual: 0,
        variance: 0,
        monetaryValue: 0,
        severity: 'MEDIUM',
        status: 'FLAGGED',
        ownerNotes: params.inconsistencyNote || 'Physical stock at shift start differed from system expectation.',
        timestamp: new Date().toISOString(),
      });
      this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);
    }

    this.notify();
    return newShift;
  }

  /**
   * Operation: Record a physical drink sale
   * Decrements counter inventory, logs movement, increments shift sales
   */
  public recordSale(params: {
    shiftId: string;
    productId: string;
    quantity: number;
    paymentMethod: 'CASH' | 'MPESA';
    mpesaAccountType?: 'BUY_GOODS_TILL' | 'PAYBILL' | 'POCHI_LA_BIASHARA' | 'SEND_MONEY';
    transactionRef?: string;
  }) {
    this.queueOfflineOperation('recordSale', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift || shift.status !== 'ACTIVE') {
      throw new Error('Shift is not active.');
    }

    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');

    const qty = Number(params.quantity) || 1;
    const totalAmount = qty * product.sellingPrice;

    // 1. Update ShiftStockItem
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find(
      (item) => item.shiftId === params.shiftId && item.productId === params.productId
    );
    if (ssi) {
      ssi.recordedSales += qty;
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // 2. Decrement physical inventory
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const inv = inventory.find(
      (i) => i.locationId === shift.locationId && i.productId === params.productId
    );
    if (inv) {
      inv.quantityOnHand = Math.max(0, inv.quantityOnHand - qty);
      inv.updatedAt = new Date().toISOString();
      this.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    // 3. Record stock movement
    const movements = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.unshift({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      shiftId: params.shiftId,
      productId: params.productId,
      productName: product.name,
      locationId: shift.locationId,
      locationName: shift.locationName,
      type: 'SALE',
      quantity: qty,
      unitPrice: product.sellingPrice,
      timestamp: new Date().toISOString(),
      note: `Sold via ${params.paymentMethod}${
        params.transactionRef ? ` (Ref: ${params.transactionRef})` : ''
      }`,
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // 4. Update Shift sales counter
    const shifts = this.getShifts();
    const currentShift = shifts.find((s) => s.id === params.shiftId);
    if (currentShift) {
      currentShift.recordedSalesCount = (currentShift.recordedSalesCount || 0) + qty;
      this.set(STORAGE_KEYS.SHIFTS, shifts);
    }

    // 5. If M-Pesa, optionally log transaction record
    if (params.paymentMethod === 'MPESA') {
      const mpesaTxns = this.get<MpesaTransaction[]>(STORAGE_KEYS.MPESA_TXNS, []);
      const mpesaAccounts = this.getMpesaAccounts();
      const account = mpesaAccounts[0];
      mpesaTxns.unshift({
        id: `mpesa-${Date.now()}`,
        shiftId: params.shiftId,
        mpesaAccountId: account?.id || 'till-1',
        accountType: params.mpesaAccountType || 'BUY_GOODS_TILL',
        transactionCode:
          params.transactionRef ||
          `QA${Math.floor(10000000 + Math.random() * 90000000)}`,
        amount: totalAmount,
        timestamp: new Date().toISOString(),
        note: `${qty}x ${product.name}`,
      });
      this.set(STORAGE_KEYS.MPESA_TXNS, mpesaTxns);
    }

    // 6. Operational event
    this.addEvent({
      type: 'SALE_RECORDED',
      title: `${qty}x ${product.name} Sold`,
      description: `${qty} ${product.unit.toLowerCase()}(s) paid via ${params.paymentMethod} (KES ${totalAmount.toLocaleString()})`,
      locationName: shift.locationName,
      actorName: shift.workerName,
      severity: 'INFO',
      amount: totalAmount,
      currency: 'KES',
    });

    this.notify();
  }

  /**
   * Operation: Record Stock Addition (e.g. Restock from supplier or issue from main warehouse)
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

    // Increment counter inventory
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const inv = inventory.find(
      (i) => i.locationId === shift.locationId && i.productId === params.productId
    );
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
      locationId: shift.locationId,
      locationName: shift.locationName,
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
      description: `Added to counter from ${params.source}`,
      locationName: shift.locationName,
      actorName: shift.workerName,
      severity: 'SUCCESS',
    });

    this.notify();
  }

  /**
   * Operation: Stock Transfer between Bar locations
   */
  public createTransfer(params: {
    shiftId: string;
    productId: string;
    toLocationId: string;
    quantity: number;
    senderName: string;
  }): Transfer {
    this.queueOfflineOperation('createTransfer', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');
    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');
    const locations = this.getLocations();
    const toLocation = locations.find((l) => l.id === params.toLocationId);
    if (!toLocation) throw new Error('Destination location not found.');

    const qty = Number(params.quantity);

    // Update SSI transfersOut
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find(
      (item) => item.shiftId === params.shiftId && item.productId === params.productId
    );
    if (ssi) {
      ssi.transfersOut += qty;
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // Decrement from sender location
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const senderInv = inventory.find(
      (i) => i.locationId === shift.locationId && i.productId === params.productId
    );
    if (senderInv) {
      senderInv.quantityOnHand = Math.max(0, senderInv.quantityOnHand - qty);
      senderInv.updatedAt = new Date().toISOString();
      this.set(STORAGE_KEYS.INVENTORY, inventory);
    }

    const transfer: Transfer = {
      id: `trf-${Date.now()}`,
      shiftId: params.shiftId,
      productId: params.productId,
      productName: product.name,
      fromLocationId: shift.locationId,
      fromLocationName: shift.locationName,
      toLocationId: toLocation.id,
      toLocationName: toLocation.name,
      quantity: qty,
      status: 'PENDING',
      senderName: params.senderName,
      timestamp: new Date().toISOString(),
    };

    const transfers = this.get<Transfer[]>(STORAGE_KEYS.TRANSFERS, []);
    transfers.unshift(transfer);
    this.set(STORAGE_KEYS.TRANSFERS, transfers);

    this.addEvent({
      type: 'TRANSFER_DISPATCHED',
      title: `Transfer: ${qty}x ${product.name}`,
      description: `Dispatched from ${shift.locationName} to ${toLocation.name}`,
      locationName: shift.locationName,
      actorName: params.senderName,
      severity: 'WARNING',
    });

    this.notify();
    return transfer;
  }

  public acceptTransfer(transferId: string, receiverName: string) {
    const transfers = this.get<Transfer[]>(STORAGE_KEYS.TRANSFERS, []);
    const transfer = transfers.find((t) => t.id === transferId);
    if (!transfer || transfer.status !== 'PENDING') return;

    transfer.status = 'ACCEPTED';
    transfer.receiverName = receiverName;
    this.set(STORAGE_KEYS.TRANSFERS, transfers);

    // Increment inventory in receiver location
    const inventory = this.get<InventoryItem[]>(STORAGE_KEYS.INVENTORY, []);
    const receiverInv = inventory.find(
      (i) => i.locationId === transfer.toLocationId && i.productId === transfer.productId
    );
    if (receiverInv) {
      receiverInv.quantityOnHand += transfer.quantity;
      receiverInv.updatedAt = new Date().toISOString();
    } else {
      inventory.push({
        id: `inv-${Date.now()}`,
        productId: transfer.productId,
        locationId: transfer.toLocationId,
        quantityOnHand: transfer.quantity,
        updatedAt: new Date().toISOString(),
      });
    }
    this.set(STORAGE_KEYS.INVENTORY, inventory);

    this.addEvent({
      type: 'TRANSFER_RECEIVED',
      title: `Transfer Accepted: ${transfer.quantity}x ${transfer.productName}`,
      description: `Received at ${transfer.toLocationName} by ${receiverName}`,
      locationName: transfer.toLocationName,
      actorName: receiverName,
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
      locationName: shift.locationName,
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
   * Deterministically calculates:
   * 1. Net M-Pesa Income = Closing M-Pesa - Opening M-Pesa
   * 2. Net Cash Income = Closing Cash in Drawer - Opening Cash Float
   * 3. Total Income Returned = Net Cash + Net M-Pesa
   * 4. Expected Stock Sales Revenue = sum(recordedSales * sellingPrice)
   * 5. Total Expenses = sum(expenses)
   * 6. Financial Variance = (Total Income + Expenses) - Expected Stock Sales Revenue
   * 7. Expected Closing Stock per item & Discrepancies
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

    // M-Pesa and Cash calculations as explicitly specified by user
    const openingMpesa = shift.openingMpesaBalance || 0;
    const closingMpesa = Number(params.closingMpesaBalance) || 0;
    const calculatedMpesaIncome = closingMpesa - openingMpesa; // e.g. 17,000 - 10,000 = 7,000 KES

    const openingCashFloat = shift.openingCashFloat || 0;
    const closingCashActual = Number(params.closingCashActual) || 0;
    const calculatedCashIncome = closingCashActual - openingCashFloat; // Net cash from sales

    const totalIncomeReturned = calculatedCashIncome + calculatedMpesaIncome; // Total money brought in

    let expectedSalesRevenue = 0;
    let totalCostOfGoodsSold = 0;

    const reconciledStockItems = shiftStockItems.map((item) => {
      // Expected stock calculation
      const expectedClosing =
        item.openingPhysicalCount +
        item.additions +
        item.transfersIn -
        item.recordedSales -
        item.transfersOut -
        item.damages;

      const physicalClosing =
        params.closingPhysicalCounts[item.productId] !== undefined
          ? params.closingPhysicalCounts[item.productId]
          : expectedClosing;

      const discrepancyCount = physicalClosing - expectedClosing; // negative = shortage, positive = overage
      const discrepancyValue = discrepancyCount * item.sellingPrice;

      expectedSalesRevenue += item.recordedSales * item.sellingPrice;
      totalCostOfGoodsSold += item.recordedSales * item.costPrice;

      return {
        ...item,
        closingPhysicalCount: physicalClosing,
        expectedClosingCount: expectedClosing,
        discrepancyCount,
        discrepancyValue,
      };
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = expectedSalesRevenue - totalCostOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    // Financial variance:
    // If bartender paid expenses out of cash or mpesa during shift, then
    // (money collected in till + money spent on authorized expenses) should equal expected drink sales!
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
   * Finalizes shift state, records discrepancies, and fires alerts to Owner
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

    // Update Shift record
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
      const inv = inventory.find(
        (i) => i.locationId === shift.locationId && i.productId === item.productId
      );
      if (inv && item.closingPhysicalCount !== undefined) {
        inv.quantityOnHand = item.closingPhysicalCount;
        inv.updatedAt = new Date().toISOString();
      }
    });
    this.set(STORAGE_KEYS.INVENTORY, inventory);

    // Generate Discrepancies if any
    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);

    // 1. Stock discrepancies
    recon.reconciledStockItems.forEach((item) => {
      if (item.discrepancyCount && item.discrepancyCount !== 0) {
        discrepancies.unshift({
          id: `disc-stock-${Date.now()}-${item.productId}`,
          shiftId: shift.id,
          shiftNumber: shift.shiftNumber,
          branchName: shift.branchName,
          locationName: shift.locationName,
          workerName: shift.workerName,
          type: item.discrepancyCount < 0 ? 'STOCK_SHORTAGE' : 'STOCK_OVERAGE',
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
        branchName: shift.branchName,
        locationName: shift.locationName,
        workerName: shift.workerName,
        type:
          recon.financialVariance < 0 ? 'FINANCIAL_SHORTAGE' : 'FINANCIAL_OVERAGE',
        itemName:
          recon.financialVariance < 0
            ? 'Cash / M-Pesa Shortage'
            : 'Cash / M-Pesa Surplus',
        expected: recon.expectedSalesRevenue,
        actual: recon.totalIncomeReturned + recon.totalExpenses,
        variance: recon.financialVariance,
        monetaryValue: Math.abs(recon.financialVariance),
        severity: Math.abs(recon.financialVariance) > 500 ? 'HIGH' : 'MEDIUM',
        status: 'FLAGGED',
        ownerNotes: '',
        timestamp: new Date().toISOString(),
      });
    }

    this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);

    // Event broadcast
    const stockDiscrepancyCount = recon.reconciledStockItems.filter(
      (i) => i.discrepancyCount && i.discrepancyCount !== 0
    ).length;

    this.addEvent({
      type: 'SHIFT_CLOSED',
      title: `Shift Closed: ${shift.locationName}`,
      description: `Total Returned: KES ${recon.totalIncomeReturned.toLocaleString()} (M-Pesa: ${recon.calculatedMpesaIncome.toLocaleString()} | Cash: ${recon.calculatedCashIncome.toLocaleString()}). Net Profit: KES ${recon.netProfit.toLocaleString()}.${
        stockDiscrepancyCount > 0 || Math.abs(recon.financialVariance) > 5
          ? ` [ALERT: ${stockDiscrepancyCount} stock & financial variance flagged]`
          : ' [Reconciliation Balanced]'
      }`,
      locationName: shift.locationName,
      actorName: shift.workerName,
      severity:
        stockDiscrepancyCount > 0 || Math.abs(recon.financialVariance) > 5
          ? 'ALERT'
          : 'SUCCESS',
      amount: recon.totalIncomeReturned,
      currency: 'KES',
    });

    this.notify();
    return shift;
  }

  public resolveDiscrepancy(
    discrepancyId: string,
    ownerNotes: string,
    status: 'INVESTIGATING' | 'RESOLVED' = 'RESOLVED'
  ) {
    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
    const item = discrepancies.find((d) => d.id === discrepancyId);
    if (item) {
      item.status = status;
      item.ownerNotes = ownerNotes;
      this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);

      this.addEvent({
        type: 'INFO',
        title: `Discrepancy Updated (${status})`,
        description: `${item.itemName} on ${item.shiftNumber}: ${ownerNotes}`,
        locationName: item.locationName,
        actorName: 'Maina Mwangi (Proprietor)',
        severity: 'INFO',
      });

      this.notify();
    }
  }

  // --- Product Catalog Management (Owner action) ---
  public updateProductPricing(productId: string, sellingPrice: number, costPrice: number) {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      product.sellingPrice = Number(sellingPrice);
      product.costPrice = Number(costPrice);
      this.set(STORAGE_KEYS.PRODUCTS, products);

      this.addEvent({
        type: 'INFO',
        title: `Catalog Updated: ${product.name}`,
        description: `New Sell: KES ${product.sellingPrice.toLocaleString()}, Cost: KES ${product.costPrice.toLocaleString()}`,
        locationName: 'Headquarters',
        actorName: 'Proprietor',
        severity: 'INFO',
      });

      this.notify();
    }
  }
}

export const store = new OperationalRealityStore();
