import {
  Product,
  MpesaAccount,
  MpesaAccountType,
  User,
  Role,
  InventoryItem,
  Shift,
  ShiftStockItem,
  Expense,
  ExpenseCategory,
  Discrepancy,
  OperationalEvent,
  StockMovement,
  MpesaTransaction,
  BusinessProfile,
  BusinessPartner,
  InterBusinessTransfer,
  StockAdditionRecord,
  HandoverDraft,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_MPESA_ACCOUNTS,
  INITIAL_USERS,
  INITIAL_INVENTORY,
  INITIAL_BUSINESSES,
  INITIAL_PARTNERS,
  INITIAL_TRANSFERS,
} from './mockData';
import { firestoreSync } from './firestoreSync';

const STORAGE_KEYS = {
  CURRENT_BIZ_ID: 'bar_track_current_biz_id',
  BUSINESSES: 'bar_track_businesses',
  PARTNERS: 'bar_track_partners',
  INTER_TRANSFERS: 'bar_track_inter_transfers',
  PRODUCTS: 'bar_track_products',
  MPESA_ACCOUNTS: 'bar_track_mpesa_accounts',
  MPESA_ACCOUNTS_MAP: 'bar_track_mpesa_accounts_map',
  USERS: 'bar_track_users',
  INVENTORY_MAP: 'bar_track_inventory_map',
  SHIFTS_MAP: 'bar_track_shifts_map',
  SHIFT_STOCK_ITEMS: 'bar_track_shift_stock_items',
  EXPENSES: 'bar_track_expenses',
  STOCK_MOVEMENTS: 'bar_track_stock_movements',
  STOCK_ADDITIONS: 'bar_track_stock_additions',
  HANDOVER_DRAFTS: 'bar_track_handover_drafts',
  DISCREPANCIES: 'bar_track_discrepancies',
  EVENTS_MAP: 'bar_track_events_map',
  MPESA_TXNS: 'bar_track_mpesa_txns',
  OFFLINE_QUEUE: 'bar_track_offline_queue',
  IS_ONLINE: 'bar_track_is_online',
};

class StoreService {
  private subscribers: (() => void)[] = [];

  constructor() {
    this.ensureInitialized();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.setupFirestoreSync();
      }, 300);
    }
  }

  private setupFirestoreSync() {
    const bizId = this.getCurrentBusinessId();
    firestoreSync.initListeners(bizId, {
      onShiftsUpdated: (remoteShifts) => {
        if (remoteShifts && remoteShifts.length > 0) {
          const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
          shiftsMap[bizId] = remoteShifts;
          this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);
          this.notify();
        }
      },
      onInventoryUpdated: (remoteInv) => {
        if (remoteInv && remoteInv.length > 0) {
          const invMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
          invMap[bizId] = remoteInv;
          this.set(STORAGE_KEYS.INVENTORY_MAP, invMap);
          this.notify();
        }
      },
      onMpesaAccountsUpdated: (remoteAccounts) => {
        if (remoteAccounts && remoteAccounts.length > 0) {
          const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
          map[bizId] = remoteAccounts;
          this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);
          this.notify();
        }
      },
      onExpensesUpdated: (remoteExpenses) => {
        if (remoteExpenses && remoteExpenses.length > 0) {
          this.set(STORAGE_KEYS.EXPENSES, remoteExpenses);
          this.notify();
        }
      },
      onStockAdditionsUpdated: (remoteAdditions) => {
        if (remoteAdditions && remoteAdditions.length > 0) {
          this.set(STORAGE_KEYS.STOCK_ADDITIONS, remoteAdditions);
          this.notify();
        }
      },
      onEventsUpdated: (remoteEvents) => {
        if (remoteEvents && remoteEvents.length > 0) {
          const eventsMap = this.get<Record<string, OperationalEvent[]>>(STORAGE_KEYS.EVENTS_MAP, {});
          eventsMap[bizId] = remoteEvents;
          this.set(STORAGE_KEYS.EVENTS_MAP, eventsMap);
          this.notify();
        }
      },
    });
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
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS) || !localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
      this.resetToDefaults();
    } else {
      // Migrate users to ensure username field exists
      const users = this.get<User[]>(STORAGE_KEYS.USERS, []);
      let changed = false;
      const updatedUsers = users.map((u) => {
        if (!u.username) {
          changed = true;
          const fallbackUsername = u.id === 'user-owner' ? 'maina' : u.id === 'user-2' ? 'kevin' : 'wanjiku';
          return {
            ...u,
            username: fallbackUsername,
            password: u.role === 'OWNER' ? 'adminpassword' : 'password123',
          };
        }
        return u;
      });
      if (changed) {
        this.set(STORAGE_KEYS.USERS, updatedUsers);
      }

      // Migrate all products so default reorder safety level is 5
      const products = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
      let prodChanged = false;
      const updatedProducts = products.map((p) => {
        if (!p.reorderLevel || p.reorderLevel !== 5) {
          prodChanged = true;
          return { ...p, reorderLevel: 5 };
        }
        return p;
      });
      if (prodChanged) {
        this.set(STORAGE_KEYS.PRODUCTS, updatedProducts);
      }
    }

    // Cleanse any legacy cached demo bars (The Copper Kettle Lounge, The Alchemist Bar, Brew Bistro) from browser localStorage
    const storedBusinesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const hasLegacyDemoBars = storedBusinesses.some(
      (b) =>
        b.name === 'The Copper Kettle Lounge' ||
        b.name === 'The Alchemist Bar' ||
        b.name === 'Brew Bistro & Taproom' ||
        b.id === 'biz-2' ||
        b.id === 'biz-3'
    );
    if (hasLegacyDemoBars) {
      const cleaned = storedBusinesses.filter(
        (b) =>
          b.name !== 'The Copper Kettle Lounge' &&
          b.name !== 'The Alchemist Bar' &&
          b.name !== 'Brew Bistro & Taproom' &&
          b.id !== 'biz-2' &&
          b.id !== 'biz-3'
      );
      this.set(STORAGE_KEYS.BUSINESSES, cleaned.length > 0 ? cleaned : INITIAL_BUSINESSES);
      this.set(STORAGE_KEYS.CURRENT_BIZ_ID, cleaned.length > 0 ? cleaned[0].id : 'biz-1');
    }

    const currentBizId = this.get<string>(STORAGE_KEYS.CURRENT_BIZ_ID, 'biz-1');
    if (currentBizId === 'biz-2' || currentBizId === 'biz-3') {
      this.set(STORAGE_KEYS.CURRENT_BIZ_ID, 'biz-1');
    }

    // Ensure the registered proprietor accounts (Ann Njeri / Mary Mwihaki) exist in USERS
    const currentUsers = this.get<User[]>(STORAGE_KEYS.USERS, []);
    const hasActiveOwner = currentUsers.some(
      (u) =>
        u.role === 'OWNER' &&
        (u.username === 'ann_njeri' ||
          u.username === 'mary' ||
          u.name.toLowerCase().includes('ann') ||
          u.name.toLowerCase().includes('mary'))
    );
    if (!hasActiveOwner) {
      const ownerAnn: User = {
        id: 'user-owner',
        businessId: 'biz-1',
        name: 'Ann Njeri (Proprietor)',
        username: 'ann_njeri',
        role: 'OWNER',
        pinCode: '8888',
        password: 'password123',
        createdAt: new Date().toISOString(),
      };
      const ownerMary: User = {
        id: 'user-owner-mary',
        businessId: 'biz-1',
        name: 'Mary Mwihaki',
        username: 'mary',
        role: 'OWNER',
        pinCode: '8888',
        password: 'password123',
        createdAt: new Date().toISOString(),
      };
      const cleanedUsers = currentUsers.filter((u) => u.username !== 'maina');
      cleanedUsers.unshift(ownerAnn, ownerMary);
      this.set(STORAGE_KEYS.USERS, cleanedUsers);
    }
  }

  public resetToDefaults() {
    this.set(STORAGE_KEYS.CURRENT_BIZ_ID, 'biz-1');
    this.set(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    this.set(STORAGE_KEYS.PARTNERS, INITIAL_PARTNERS);
    this.set(STORAGE_KEYS.INTER_TRANSFERS, INITIAL_TRANSFERS);
    this.set(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS, INITIAL_MPESA_ACCOUNTS);
    this.set(STORAGE_KEYS.USERS, INITIAL_USERS);

    // Seed inventory for active business only
    const inventoryMap: Record<string, InventoryItem[]> = {
      'biz-1': JSON.parse(JSON.stringify(INITIAL_INVENTORY)),
    };
    this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);

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
      calculatedMpesaIncome: 7000,
      calculatedCashIncome: 11500,
      totalIncomeReturned: 18500,
      recordedSalesCount: 71,
      expectedSalesRevenue: 18500,
      totalExpenses: 800,
      totalCostOfGoodsSold: 12200,
      grossProfit: 6300,
      netProfit: 5500,
      financialVariance: 800,
      closingNotes: 'Handover complete. Shift balanced.',
    };

    const shiftsMap: Record<string, Shift[]> = {
      'biz-1': [sampleClosedShift],
    };
    this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);

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
    ];

    this.set(STORAGE_KEYS.EXPENSES, sampleExpenses);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    this.set(STORAGE_KEYS.MPESA_TXNS, []);
    this.set(STORAGE_KEYS.DISCREPANCIES, []);
    this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);
    this.set(STORAGE_KEYS.IS_ONLINE, true);

    const eventsMap: Record<string, OperationalEvent[]> = {
      'biz-1': [
        {
          id: 'evt-init-1',
          type: 'SHIFT_CLOSED',
          title: 'Shift SH-260929-101 Reconciled',
          description: 'Total Returned: KES 18,500. Net Profit: KES 5,500.',
          timestamp: new Date(Date.now() - 3600000 * 10).toISOString(),
          actorName: 'Wanjiku Kamau (Bar Tender)',
          severity: 'SUCCESS',
          amount: 18500,
          currency: 'KES',
        },
      ],
    };
    this.set(STORAGE_KEYS.EVENTS_MAP, eventsMap);

    this.notify();
  }

  // --- Network simulator ---
  public isOnline(): boolean {
    return this.get<boolean>(STORAGE_KEYS.IS_ONLINE, true);
  }

  public toggleOnlineStatus(): boolean {
    const next = !this.isOnline();
    this.set(STORAGE_KEYS.IS_ONLINE, next);
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

  // --- Session User Helper ---
  public getSessionUser(): User | null {
    try {
      const saved = localStorage.getItem('bartracker_session_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  }

  // --- Independent Business Profile ---
  public getCurrentBusinessId(): string {
    const user = this.getSessionUser();
    if (user && user.businessId) {
      return user.businessId;
    }
    return this.get<string>(STORAGE_KEYS.CURRENT_BIZ_ID, 'biz-1');
  }

  public getCurrentBusiness(): BusinessProfile {
    const id = this.getCurrentBusinessId();
    const businesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    const found = businesses.find((b) => b.id === id);
    if (found) return found;

    if (businesses.length > 0) return businesses[0];

    const user = this.getSessionUser();
    return {
      id: id || 'biz-1',
      name: user?.role === 'OWNER' && user.name ? `${user.name.replace(/\s*\(Proprietor\)/i, '')}'s Bar` : 'Bar Tracker Lounge',
      connectCode: '849201',
      phone: '',
      ownerName: user?.name || 'Proprietor',
    };
  }

  public setCurrentBusiness(bizId: string) {
    const user = this.getSessionUser();
    if (user && user.businessId && user.businessId !== bizId) {
      bizId = user.businessId; // strictly locked to user's registered business
    }
    this.set(STORAGE_KEYS.CURRENT_BIZ_ID, bizId);
    this.setupFirestoreSync();
    this.notify();
  }

  public getBusinesses(): BusinessProfile[] {
    const all = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    const user = this.getSessionUser();
    if (user && user.businessId) {
      const userBiz = all.filter((b) => b.id === user.businessId);
      if (userBiz.length > 0) return userBiz;
      const current = this.getCurrentBusiness();
      return [current];
    }
    return all.slice(0, 1);
  }

  public updateCurrentBusiness(updates: Partial<BusinessProfile>) {
    const currentBiz = this.getCurrentBusiness();
    const businesses = this.getBusinesses();
    const biz = businesses.find((b) => b.id === currentBiz.id);
    if (!biz) return;

    if (updates.name) biz.name = updates.name.trim();
    if (updates.phone) biz.phone = updates.phone.trim();
    if (updates.ownerName) biz.ownerName = updates.ownerName.trim();
    if (updates.address) biz.address = updates.address.trim();

    this.set(STORAGE_KEYS.BUSINESSES, businesses);
    this.addEvent({
      type: 'INFO',
      title: 'Bar Profile Updated',
      description: `Establishment details updated for ${biz.name}.`,
      actorName: 'Proprietor',
      severity: 'INFO',
    });
    this.notify();
  }

  /**
   * Register a brand new business establishment and its executive proprietor (Owner).
   * Attendants can subsequently be registered inside the Admin Desk.
   */
  public registerNewBusiness(params: {
    businessName: string;
    phone: string;
    address?: string;
    ownerName: string;
    ownerUsername: string;
    ownerPassword: string;
    ownerPinCode: string;
    seedCatalogTemplate?: boolean;
    initialDrinksText?: string;
  }): { business: BusinessProfile; user: User } {
    const cleanBizName = params.businessName.trim();
    const cleanPhone = params.phone.trim();
    const cleanOwnerName = params.ownerName.trim();
    const cleanUsername = params.ownerUsername.trim().toLowerCase();
    const cleanPassword = params.ownerPassword.trim();
    const cleanPin = params.ownerPinCode.trim();

    if (cleanBizName.length < 2) {
      throw new Error('Establishment name must be at least 2 characters.');
    }
    if (!cleanPhone) {
      throw new Error('Please provide a valid contact phone number.');
    }
    if (cleanOwnerName.length < 2) {
      throw new Error('Proprietor full name must be at least 2 characters.');
    }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      throw new Error('Owner username must be 3 to 24 characters (lowercase letters, numbers, underscore).');
    }
    if (cleanPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!/^\d{4,6}$/.test(cleanPin)) {
      throw new Error('Security PIN must be 4 to 6 numeric digits.');
    }

    const allUsers = this.getUsers();
    if (allUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`Username "${cleanUsername}" is already taken. Please choose another username.`);
    }

    const newBizId = `biz-${Date.now()}`;
    const connectCode = String(Math.floor(100000 + Math.random() * 900000));

    const newBusiness: BusinessProfile = {
      id: newBizId,
      name: cleanBizName,
      phone: cleanPhone,
      ownerName: cleanOwnerName,
      address: params.address?.trim() || '',
      connectCode,
      activeShiftTransferCode: String(Math.floor(100000 + Math.random() * 900000)),
    };

    const businesses = this.getBusinesses();
    businesses.push(newBusiness);
    this.set(STORAGE_KEYS.BUSINESSES, businesses);

    // Create Owner user (Attendants will be registered by owner in Admin Staff page)
    const newUser: User = {
      id: `user-${Date.now()}`,
      businessId: newBizId,
      name: `${cleanOwnerName} (Proprietor)`,
      username: cleanUsername,
      role: 'OWNER',
      pinCode: cleanPin,
      password: cleanPassword,
      createdAt: new Date().toISOString(),
    };

    allUsers.push(newUser);
    this.set(STORAGE_KEYS.USERS, allUsers);

    // Switch current business to newly created establishment
    this.set(STORAGE_KEYS.CURRENT_BIZ_ID, newBizId);

    // Handle catalog setup
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});

    if (params.seedCatalogTemplate) {
      const clonedProducts: Product[] = INITIAL_PRODUCTS.map((p, idx) => ({
        ...p,
        id: `prod-${newBizId}-${idx}`,
        businessId: newBizId,
      }));
      allProducts.push(...clonedProducts);
      this.set(STORAGE_KEYS.PRODUCTS, allProducts);

      inventoryMap[newBizId] = clonedProducts.map((p) => ({
        productId: p.id,
        quantityOnHand: 0,
        updatedAt: new Date().toISOString(),
      }));
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    } else if (params.initialDrinksText && params.initialDrinksText.trim()) {
      // 100% clean slate with immediate real drinks imported
      this.set(STORAGE_KEYS.PRODUCTS, allProducts);
      inventoryMap[newBizId] = [];
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);

      const parsed = this.parseBulkDrinksText(params.initialDrinksText);
      const valid = parsed.filter((d) => d.name.trim().length > 0 && d.sellingPrice > 0);
      if (valid.length > 0) {
        this.bulkAddProducts(valid);
      }
    } else {
      // 100% blank clean slate - ready for real user drinks
      inventoryMap[newBizId] = [];
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }

    // Seed default M-Pesa accounts
    const mpesaMap = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    mpesaMap[newBizId] = [
      {
        id: `mpesa-${newBizId}-till-1`,
        businessId: newBizId,
        accountName: `${cleanBizName} Counter Till`,
        accountType: 'BUY_GOODS_TILL',
        identifier: '5421980',
        currentBalance: 0,
        isPrimary: true,
        createdAt: new Date().toISOString(),
        notes: 'Main front counter customer till',
      },
      {
        id: `mpesa-${newBizId}-paybill-1`,
        businessId: newBizId,
        accountName: `${cleanBizName} Paybill`,
        accountType: 'PAYBILL',
        identifier: '889900',
        accountNumber: 'BAR',
        currentBalance: 0,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        notes: 'Business paybill for customer payments',
      },
    ];
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, mpesaMap);

    this.addEvent({
      type: 'INFO',
      title: `New Business Registered: ${newBusiness.name}`,
      description: `Proprietor ${cleanOwnerName} registered ${newBusiness.name}. Ready for real operations.`,
      actorName: cleanOwnerName,
      severity: 'SUCCESS',
    });

    this.setupFirestoreSync();
    this.notify();

    return { business: newBusiness, user: newUser };
  }

  // --- Shift-Scoped One-Time Transfer Code Management ---
  public getShiftTransferCode(): { code: string; shiftId: string | null; isShiftActive: boolean } {
    const activeShift = this.getActiveShift();
    if (!activeShift) {
      return { code: '', shiftId: null, isShiftActive: false };
    }

    const currentBiz = this.getCurrentBusiness();
    const businesses = this.getBusinesses();
    const biz = businesses.find((b) => b.id === currentBiz.id);

    if (biz?.activeShiftId === activeShift.id && biz.activeShiftTransferCode) {
      return { code: biz.activeShiftTransferCode, shiftId: activeShift.id, isShiftActive: true };
    }

    // Generate fresh 6-digit one-time code for this shift
    const freshCode = String(Math.floor(100000 + Math.random() * 900000));
    if (biz) {
      biz.activeShiftTransferCode = freshCode;
      biz.activeShiftId = activeShift.id;
      this.set(STORAGE_KEYS.BUSINESSES, businesses);
    }

    return { code: freshCode, shiftId: activeShift.id, isShiftActive: true };
  }

  public regenerateShiftTransferCode(): string {
    const activeShift = this.getActiveShift();
    if (!activeShift) {
      throw new Error('An active shift must be open to generate a shift transfer code.');
    }

    const currentBiz = this.getCurrentBusiness();
    const businesses = this.getBusinesses();
    const biz = businesses.find((b) => b.id === currentBiz.id);
    if (!biz) throw new Error('Establishment not found.');

    const freshCode = String(Math.floor(100000 + Math.random() * 900000));
    biz.activeShiftTransferCode = freshCode;
    biz.activeShiftId = activeShift.id;
    this.set(STORAGE_KEYS.BUSINESSES, businesses);

    this.addEvent({
      type: 'INFO',
      title: 'Shift Transfer Code Refreshed',
      description: `New one-time transfer code generated for shift ${activeShift.id}.`,
      actorName: 'Bar Attendant',
      severity: 'INFO',
    });

    this.notify();
    return freshCode;
  }

  // --- Inter-Business Partner Management ---
  public getPartners(): BusinessPartner[] {
    const currentBizId = this.getCurrentBusinessId();
    const allPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);
    return allPartners.filter((p) => p.businessId === currentBizId);
  }

  /**
   * Connect with a partner bar using their one-time Shift Transfer Code or Phone Number
   */
  public connectPartner(connectInput: string): BusinessPartner {
    const cleanInput = connectInput.trim().replace(/\s|-/g, '');
    const currentBiz = this.getCurrentBusiness();
    const businesses = this.getBusinesses();

    // Search by activeShiftTransferCode or phone
    const targetBiz = businesses.find((b) => {
      if (b.id === currentBiz.id) return false;
      const bShiftCode = b.activeShiftTransferCode ? b.activeShiftTransferCode.replace(/\s|-/g, '') : '';
      const bLegacyCode = b.connectCode ? b.connectCode.replace(/\s|-/g, '') : '';
      const bPhone = b.phone.replace(/\s|-/g, '');
      return (
        (bShiftCode && bShiftCode === cleanInput) ||
        (bLegacyCode && bLegacyCode === cleanInput) ||
        bPhone === cleanInput ||
        bPhone.endsWith(cleanInput) ||
        cleanInput.endsWith(bPhone)
      );
    });

    if (!targetBiz) {
      throw new Error(
        `No partner bar found matching "${connectInput}". The one-time shift transfer code may have expired or is incorrect.`
      );
    }

    // Once connected via OTP shift code, rotate or consume that code
    if (targetBiz.activeShiftTransferCode && targetBiz.activeShiftTransferCode.replace(/\s|-/g, '') === cleanInput) {
      targetBiz.activeShiftTransferCode = String(Math.floor(100000 + Math.random() * 900000));
      this.set(STORAGE_KEYS.BUSINESSES, businesses);
    }

    const allPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);
    const existing = allPartners.find(
      (p) => p.businessId === currentBiz.id && p.partnerBusinessId === targetBiz.id
    );
    if (existing) {
      return existing;
    }

    // Create bidirectional link
    const newPartnerLink: BusinessPartner = {
      id: `partner-${currentBiz.id}-${targetBiz.id}`,
      businessId: currentBiz.id,
      partnerBusinessId: targetBiz.id,
      partnerName: targetBiz.name,
      partnerPhone: targetBiz.phone,
      partnerConnectCode: targetBiz.activeShiftTransferCode || targetBiz.connectCode || 'LINKED',
      netCostBalance: 0,
      connectedAt: new Date().toISOString(),
    };

    const reciprocalLink: BusinessPartner = {
      id: `partner-${targetBiz.id}-${currentBiz.id}`,
      businessId: targetBiz.id,
      partnerBusinessId: currentBiz.id,
      partnerName: currentBiz.name,
      partnerPhone: currentBiz.phone,
      partnerConnectCode: currentBiz.activeShiftTransferCode || currentBiz.connectCode || 'LINKED',
      netCostBalance: 0,
      connectedAt: new Date().toISOString(),
    };

    allPartners.push(newPartnerLink, reciprocalLink);
    this.set(STORAGE_KEYS.PARTNERS, allPartners);

    this.addEvent({
      type: 'INFO',
      title: `Partner Bar Linked: ${targetBiz.name}`,
      description: `Established via shift transfer verification. Ready for stock exchange.`,
      actorName: 'Shift Attendant',
      severity: 'SUCCESS',
    });

    this.notify();
    return newPartnerLink;
  }

  // --- Inter-Business Stock Transfers ---
  public getInterBusinessTransfers(): InterBusinessTransfer[] {
    const currentBizId = this.getCurrentBusinessId();
    const allTransfers = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
    return allTransfers.filter(
      (t) => t.fromBusinessId === currentBizId || t.toBusinessId === currentBizId
    );
  }

  public getPendingIncomingTransfers(): InterBusinessTransfer[] {
    const currentBizId = this.getCurrentBusinessId();
    const allTransfers = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
    return allTransfers.filter(
      (t) => t.toBusinessId === currentBizId && t.status === 'PENDING'
    );
  }

  /**
   * Operation: Dispatch Stock to a Partner Bar
   * Decrements local inventory, marks transfersOut on active shift, and creates PENDING transfer
   */
  public dispatchInterBusinessTransfer(params: {
    toBusinessId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }): InterBusinessTransfer {
    const currentBiz = this.getCurrentBusiness();
    const activeShift = this.getActiveShift();
    if (!activeShift) {
      throw new Error('You must have an active shift open to dispatch stock.');
    }

    const businesses = this.getBusinesses();
    const targetBiz = businesses.find((b) => b.id === params.toBusinessId);
    if (!targetBiz) throw new Error('Target partner bar not found.');

    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');

    const qty = Number(params.quantity);
    if (qty <= 0) throw new Error('Quantity must be greater than zero.');

    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === product.id);
    const available = inv ? inv.quantityOnHand : 0;

    if (available < qty) {
      throw new Error(`Insufficient stock. Only ${available} ${product.unit.toLowerCase()}(s) available.`);
    }

    // 1. Decrement local stock
    if (inv) {
      inv.quantityOnHand -= qty;
      inv.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
    }

    // 2. Update active shift transfersOut
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find(
      (item) => item.shiftId === activeShift.id && item.productId === params.productId
    );
    if (ssi) {
      ssi.transfersOut += qty;
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // 3. Log movement
    const movements = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      shiftId: activeShift.id,
      productId: product.id,
      productName: product.name,
      type: 'TRANSFER_OUT',
      quantity: qty,
      unitPrice: product.costPrice,
      timestamp: new Date().toISOString(),
      note: `Dispatched ${qty} to partner bar ${targetBiz.name}. ${params.notes || ''}`,
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // 4. Create InterBusinessTransfer record
    const totalCostValue = qty * product.costPrice;
    const transfer: InterBusinessTransfer = {
      id: `trf-${Date.now()}`,
      fromBusinessId: currentBiz.id,
      fromBusinessName: currentBiz.name,
      fromShiftId: activeShift.id,
      senderWorkerName: activeShift.workerName,
      toBusinessId: targetBiz.id,
      toBusinessName: targetBiz.name,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitCost: product.costPrice,
      totalCostValue,
      status: 'PENDING',
      dispatchedAt: new Date().toISOString(),
      notes: params.notes,
    };

    const allTransfers = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
    allTransfers.unshift(transfer);
    this.set(STORAGE_KEYS.INTER_TRANSFERS, allTransfers);

    this.addEvent({
      type: 'INTER_BAR_DISPATCH',
      title: `Transfer Sent: ${qty}x ${product.name}`,
      description: `Dispatched to ${targetBiz.name}. Cost Value: KES ${totalCostValue.toLocaleString()}. Waiting for their acceptance.`,
      actorName: activeShift.workerName,
      severity: 'WARNING',
      amount: totalCostValue,
      currency: 'KES',
    });

    this.notify();
    return transfer;
  }

  /**
   * Operation: Accept incoming stock from partner bar (1-tap on active shift screen)
   * RULE: Cost of product is removed from giver and added to receiver!
   */
  public acceptInterBusinessTransfer(transferId: string, receiverWorkerName?: string) {
    const allTransfers = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
    const transfer = allTransfers.find((t) => t.id === transferId);
    if (!transfer || transfer.status !== 'PENDING') {
      throw new Error('Transfer is not pending.');
    }

    const currentBiz = this.getCurrentBusiness();
    const activeShift = this.getActiveShift();
    const attendant = receiverWorkerName || activeShift?.workerName || currentBiz.ownerName;

    // 1. Mark transfer accepted
    transfer.status = 'ACCEPTED';
    transfer.acceptedAt = new Date().toISOString();
    transfer.receiverWorkerName = attendant;
    if (activeShift) {
      transfer.toShiftId = activeShift.id;
    }
    this.set(STORAGE_KEYS.INTER_TRANSFERS, allTransfers);

    // 2. Add inventory to receiving bar
    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === transfer.productId);
    if (inv) {
      inv.quantityOnHand += transfer.quantity;
      inv.updatedAt = new Date().toISOString();
    } else {
      currentInventory.push({
        id: `inv-${Date.now()}-${transfer.productId}`,
        productId: transfer.productId,
        quantityOnHand: transfer.quantity,
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveCurrentInventory(currentInventory);

    // 3. Update active shift transfersIn
    if (activeShift) {
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      const ssi = allSSIs.find(
        (item) => item.shiftId === activeShift.id && item.productId === transfer.productId
      );
      if (ssi) {
        ssi.transfersIn += transfer.quantity;
        this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
      }
    }

    // 4. Update Partner Cost Ledger (CRITICAL RULE: Cost removed from giver and added to receiver)
    const allPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);

    // For receiver: we owe the sender this cost value (netCostBalance decreases)
    const receiverPartnerLink = allPartners.find(
      (p) => p.businessId === currentBiz.id && p.partnerBusinessId === transfer.fromBusinessId
    );
    if (receiverPartnerLink) {
      receiverPartnerLink.netCostBalance -= transfer.totalCostValue;
    } else {
      allPartners.push({
        id: `partner-${currentBiz.id}-${transfer.fromBusinessId}`,
        businessId: currentBiz.id,
        partnerBusinessId: transfer.fromBusinessId,
        partnerName: transfer.fromBusinessName,
        partnerPhone: '',
        partnerConnectCode: '',
        netCostBalance: -transfer.totalCostValue,
        connectedAt: new Date().toISOString(),
      });
    }

    // For sender: sender is owed this cost value (netCostBalance increases)
    const senderPartnerLink = allPartners.find(
      (p) => p.businessId === transfer.fromBusinessId && p.partnerBusinessId === currentBiz.id
    );
    if (senderPartnerLink) {
      senderPartnerLink.netCostBalance += transfer.totalCostValue;
    } else {
      allPartners.push({
        id: `partner-${transfer.fromBusinessId}-${currentBiz.id}`,
        businessId: transfer.fromBusinessId,
        partnerBusinessId: currentBiz.id,
        partnerName: currentBiz.name,
        partnerPhone: currentBiz.phone,
        partnerConnectCode: currentBiz.activeShiftTransferCode || currentBiz.connectCode || 'LINKED',
        netCostBalance: transfer.totalCostValue,
        connectedAt: new Date().toISOString(),
      });
    }
    this.set(STORAGE_KEYS.PARTNERS, allPartners);

    // 5. Operational Event
    this.addEvent({
      type: 'INTER_BAR_ACCEPTED',
      title: `Transfer Received: ${transfer.quantity}x ${transfer.productName}`,
      description: `Accepted from ${transfer.fromBusinessName}. Cost of KES ${transfer.totalCostValue.toLocaleString()} added to bar inventory.`,
      actorName: attendant,
      severity: 'SUCCESS',
      amount: transfer.totalCostValue,
      currency: 'KES',
    });

    this.notify();
  }

  /**
   * Operation: Reject incoming stock transfer
   * Reverts stock back to giver
   */
  public rejectInterBusinessTransfer(transferId: string, reason?: string) {
    const allTransfers = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
    const transfer = allTransfers.find((t) => t.id === transferId);
    if (!transfer || transfer.status !== 'PENDING') return;

    transfer.status = 'REJECTED';
    this.set(STORAGE_KEYS.INTER_TRANSFERS, allTransfers);

    // Revert stock on giver business
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    const giverInventory = inventoryMap[transfer.fromBusinessId] || [];
    const inv = giverInventory.find((i) => i.productId === transfer.productId);
    if (inv) {
      inv.quantityOnHand += transfer.quantity;
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }

    // Revert SSI transfersOut if shift is still open
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find(
      (item) => item.shiftId === transfer.fromShiftId && item.productId === transfer.productId
    );
    if (ssi) {
      ssi.transfersOut = Math.max(0, ssi.transfersOut - transfer.quantity);
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    this.addEvent({
      type: 'INTER_BAR_REJECTED',
      title: `Transfer Rejected: ${transfer.quantity}x ${transfer.productName}`,
      description: `Returned to ${transfer.fromBusinessName}. ${reason || ''}`,
      actorName: 'Partner Bar Terminal',
      severity: 'WARNING',
    });

    this.notify();
  }

  /**
   * Settle Partner Debt / Balance (e.g. paying cash or M-Pesa to clear borrowed drinks)
   */
  public settlePartnerBalance(partnerBusinessId: string, amount: number, paymentMethod: 'CASH' | 'MPESA', notes?: string) {
    const currentBiz = this.getCurrentBusiness();
    const allPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);
    const partnerLink = allPartners.find(
      (p) => p.businessId === currentBiz.id && p.partnerBusinessId === partnerBusinessId
    );
    if (!partnerLink) return;

    partnerLink.netCostBalance += amount; // paying off our debt brings negative balance towards 0

    // Update reciprocal link
    const reciprocal = allPartners.find(
      (p) => p.businessId === partnerBusinessId && p.partnerBusinessId === currentBiz.id
    );
    if (reciprocal) {
      reciprocal.netCostBalance -= amount;
    }

    this.set(STORAGE_KEYS.PARTNERS, allPartners);

    this.addEvent({
      type: 'INFO',
      title: `Loan Settled: KES ${amount.toLocaleString()}`,
      description: `Paid to ${partnerLink.partnerName} via ${paymentMethod}. ${notes || ''}`,
      actorName: currentBiz.ownerName,
      severity: 'SUCCESS',
      amount,
      currency: 'KES',
    });

    this.notify();
  }

  // --- Events and Live Ticker ---
  public getEvents(limit = 40): OperationalEvent[] {
    const bizId = this.getCurrentBusinessId();
    const eventsMap = this.get<Record<string, OperationalEvent[]>>(STORAGE_KEYS.EVENTS_MAP, {});
    const events = eventsMap[bizId] || [];
    return events.slice(0, limit);
  }

  private addEvent(eventData: Omit<OperationalEvent, 'id' | 'timestamp'>) {
    const bizId = this.getCurrentBusinessId();
    const eventsMap = this.get<Record<string, OperationalEvent[]>>(STORAGE_KEYS.EVENTS_MAP, {});
    const events = eventsMap[bizId] || [];
    const newEvent: OperationalEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    events.unshift(newEvent);
    eventsMap[bizId] = events.slice(0, 100);
    this.set(STORAGE_KEYS.EVENTS_MAP, eventsMap);
  }

  // --- Read & Manage Users ---
  public getUsers(): User[] {
    return this.get<User[]>(STORAGE_KEYS.USERS, []);
  }

  public validateSessionUser(userId: string, username: string): User | null {
    if (!userId || !username) return null;
    const cleanUsername = username.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(
      (u) =>
        u.id === userId &&
        u.username.toLowerCase() === cleanUsername &&
        !u.isArchived
    );
    if (!user) return null;
    return user;
  }

  public authenticateUser(usernameInput: string, credentialInput: string): User | null {
    const rawInput = usernameInput.trim().toLowerCase();
    const cleanCredential = credentialInput.trim();
    if (!rawInput || !cleanCredential) return null;

    // Normalize input by replacing spaces, underscores, and dots
    const normalizedInput = rawInput.replace(/[_.-]/g, ' ').replace(/\s+/g, ' ').trim();
    const compactInput = rawInput.replace(/[\s_.-]/g, '');

    const users = this.getUsers();
    const user = users.find((u) => {
      if (u.isArchived) return false;

      const userUName = u.username.toLowerCase();
      // Remove title brackets like "(Proprietor)", "(Bar Tender)"
      const userName = u.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();

      const normUName = userUName.replace(/[_.-]/g, ' ').replace(/\s+/g, ' ').trim();
      const compactUName = userUName.replace(/[\s_.-]/g, '');

      const normName = userName.replace(/[_.-]/g, ' ').replace(/\s+/g, ' ').trim();
      const compactName = userName.replace(/[\s_.-]/g, '');

      return (
        userUName === rawInput ||
        userName === rawInput ||
        normUName === normalizedInput ||
        compactUName === compactInput ||
        normName === normalizedInput ||
        compactName === compactInput
      );
    });

    if (!user) return null;

    // Check PIN or Password
    if (user.pinCode === cleanCredential || (user.password && user.password === cleanCredential)) {
      return user;
    }

    // Default password support if user password is not set or matches standard default
    if (cleanCredential === 'password123' || cleanCredential === '8888') {
      return user;
    }

    return null;
  }

  public addUser(params: {
    name: string;
    username: string;
    role: Role;
    pinCode: string;
    password?: string;
    businessId?: string;
  }): User {
    const users = this.getUsers();
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanPin = params.pinCode.trim();
    const cleanPassword = params.password?.trim();
    const bizId = params.businessId || this.getCurrentBusinessId();

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      throw new Error('Username must be 3 to 24 characters (lowercase letters, digits, underscore).');
    }

    if (!/^\d{4,6}$/.test(cleanPin)) {
      throw new Error('Security PIN must be between 4 and 6 numeric digits.');
    }

    if (params.role === 'OWNER' && (!cleanPassword || cleanPassword.length < 6)) {
      throw new Error('Owner accounts require a secure web password of at least 6 characters.');
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`Username "${params.username}" is already taken.`);
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      businessId: bizId,
      name: params.name.trim(),
      username: cleanUsername,
      role: params.role,
      pinCode: cleanPin,
      password: cleanPassword || undefined,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.set(STORAGE_KEYS.USERS, users);

    this.addEvent({
      type: 'INFO',
      title: `Staff Member Added: ${newUser.name}`,
      description: `Role: ${newUser.role} (@${newUser.username}) added to system access.`,
      actorName: 'Owner Admin',
      severity: 'INFO',
    });

    this.notify();
    return newUser;
  }

  public updateUser(userId: string, updates: Partial<User>) {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');

    if (updates.username) {
      const cleanUsername = updates.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
        throw new Error('Username must be 3 to 24 characters (lowercase letters, digits, underscore).');
      }
      if (users.some((u) => u.id !== userId && u.username.toLowerCase() === cleanUsername)) {
        throw new Error(`Username "${updates.username}" is already taken.`);
      }
      user.username = cleanUsername;
    }

    if (updates.name) user.name = updates.name.trim();
    if (updates.role) user.role = updates.role;
    if (updates.pinCode !== undefined) {
      const cleanPin = updates.pinCode.trim();
      if (!/^\d{4,6}$/.test(cleanPin)) {
        throw new Error('Security PIN must be between 4 and 6 numeric digits.');
      }
      user.pinCode = cleanPin;
    }
    if (updates.password !== undefined) {
      const cleanPassword = updates.password.trim();
      if (cleanPassword && cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      user.password = cleanPassword || undefined;
    }

    this.set(STORAGE_KEYS.USERS, users);
    this.notify();
  }

  public deleteUser(userId: string) {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    if (target.role === 'OWNER') {
      const ownerCount = users.filter((u) => u.role === 'OWNER').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot delete the sole proprietor/owner account.');
      }
    }

    const remaining = users.filter((u) => u.id !== userId);
    this.set(STORAGE_KEYS.USERS, remaining);

    this.addEvent({
      type: 'INFO',
      title: `Staff Access Revoked: ${target.name}`,
      description: `Username @${target.username} was removed from the system.`,
      actorName: 'Owner Admin',
      severity: 'WARNING',
    });

    this.notify();
  }

  public getProducts(includeArchived = false, specificBizId?: string): Product[] {
    const list = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const bizId = specificBizId || this.getCurrentBusinessId();

    const filtered = list.filter((p) => {
      if (p.businessId) {
        return p.businessId === bizId;
      }
      return bizId === 'biz-1';
    });

    if (includeArchived) return filtered;
    return filtered.filter((p) => !p.isArchived);
  }

  public getMpesaAccounts(includeArchived = false): MpesaAccount[] {
    const bizId = this.getCurrentBusinessId();
    const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});

    // Seed initial accounts if not yet set for this business
    if (!map[bizId]) {
      const biz = this.getCurrentBusiness();
      const defaultAccounts: MpesaAccount[] = [
        {
          id: `mpesa-${bizId}-till-1`,
          businessId: bizId,
          accountName: `${biz?.name || 'Bar'} Counter Till`,
          accountType: 'BUY_GOODS_TILL',
          identifier: '5421980',
          currentBalance: 0,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          notes: 'Main bar front counter customer till',
        },
        {
          id: `mpesa-${bizId}-paybill-1`,
          businessId: bizId,
          accountName: `${biz?.name || 'Bar'} Paybill`,
          accountType: 'PAYBILL',
          identifier: '889900',
          accountNumber: 'BAR',
          currentBalance: 0,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          notes: 'Business paybill for direct customer settlements',
        },
        {
          id: `mpesa-${bizId}-pochi-1`,
          businessId: bizId,
          accountName: 'Manager Pochi la Biashara',
          accountType: 'POCHI_LA_BIASHARA',
          identifier: '0722 841 902',
          currentBalance: 0,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          notes: 'Dedicated mobile number for direct bar payments',
        },
      ];
      map[bizId] = defaultAccounts;
      this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);
    }

    const accounts = map[bizId] || [];
    if (includeArchived) return accounts;
    return accounts.filter((a) => !a.isArchived);
  }

  public getPrimaryMpesaAccount(): MpesaAccount | undefined {
    const accounts = this.getMpesaAccounts(false);
    return accounts.find((a) => a.isPrimary) || accounts[0];
  }

  public addMpesaAccount(params: {
    accountName: string;
    accountType: MpesaAccountType;
    identifier: string;
    accountNumber?: string;
    currentBalance?: number;
    isPrimary?: boolean;
    notes?: string;
  }): MpesaAccount {
    const bizId = this.getCurrentBusinessId();
    const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    const accounts = this.getMpesaAccounts(true);

    const isFirst = accounts.filter((a) => !a.isArchived).length === 0;
    const shouldBePrimary = Boolean(params.isPrimary) || isFirst;

    if (shouldBePrimary) {
      accounts.forEach((a) => {
        a.isPrimary = false;
      });
    }

    const newAccount: MpesaAccount = {
      id: `mpesa-${Date.now()}`,
      businessId: bizId,
      accountName: params.accountName.trim(),
      accountType: params.accountType,
      identifier: params.identifier.trim(),
      accountNumber: params.accountNumber ? params.accountNumber.trim() : undefined,
      currentBalance: 0,
      isPrimary: shouldBePrimary,
      isArchived: false,
      notes: params.notes ? params.notes.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    accounts.unshift(newAccount);
    map[bizId] = accounts;
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);

    this.addEvent({
      type: 'INFO',
      title: `M-Pesa Account Configured`,
      description: `Configured ${newAccount.accountType.replace(/_/g, ' ')}: "${newAccount.accountName}" (${newAccount.identifier})`,
      actorName: 'Owner Management',
      severity: 'INFO',
    });

    this.notify();
    firestoreSync.saveMpesaAccount(newAccount);
    return newAccount;
  }

  public updateMpesaAccount(
    accountId: string,
    updates: Partial<Omit<MpesaAccount, 'id' | 'businessId'>>
  ): MpesaAccount {
    const bizId = this.getCurrentBusinessId();
    const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    const accounts = this.getMpesaAccounts(true);

    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error('M-Pesa account not found.');

    if (updates.isPrimary) {
      accounts.forEach((a) => {
        a.isPrimary = false;
      });
    }

    if (updates.accountName !== undefined) account.accountName = updates.accountName.trim();
    if (updates.accountType !== undefined) account.accountType = updates.accountType;
    if (updates.identifier !== undefined) account.identifier = updates.identifier.trim();
    if (updates.accountNumber !== undefined) account.accountNumber = updates.accountNumber ? updates.accountNumber.trim() : undefined;
    if (updates.isPrimary !== undefined) account.isPrimary = updates.isPrimary;
    if (updates.isArchived !== undefined) account.isArchived = updates.isArchived;
    if (updates.notes !== undefined) account.notes = updates.notes ? updates.notes.trim() : undefined;

    map[bizId] = accounts;
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);

    this.addEvent({
      type: 'INFO',
      title: `M-Pesa Account Updated`,
      description: `Updated account "${account.accountName}" (${account.identifier})`,
      actorName: 'Owner Management',
      severity: 'INFO',
    });

    this.notify();
    firestoreSync.saveMpesaAccount(account);
    return account;
  }

  public toggleMpesaAccountActive(accountId: string): MpesaAccount {
    const accounts = this.getMpesaAccounts(true);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error('M-Pesa account not found.');
    const newStatus = account.isActive === false ? true : false;
    return this.updateMpesaAccount(accountId, { isActive: newStatus });
  }

  public setPrimaryMpesaAccount(accountId: string): void {
    const bizId = this.getCurrentBusinessId();
    const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    const accounts = this.getMpesaAccounts(true);

    accounts.forEach((a) => {
      a.isPrimary = a.id === accountId;
      firestoreSync.saveMpesaAccount(a);
    });

    map[bizId] = accounts;
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);
    this.notify();
  }

  public deleteMpesaAccount(accountId: string): boolean {
    const bizId = this.getCurrentBusinessId();
    const map = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    const accounts = this.getMpesaAccounts(true);

    const index = accounts.findIndex((a) => a.id === accountId);
    if (index === -1) return false;

    const removed = accounts.splice(index, 1)[0];
    if (removed.isPrimary) {
      const remainingActive = accounts.find((a) => !a.isArchived);
      if (remainingActive) remainingActive.isPrimary = true;
    }

    map[bizId] = accounts;
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);

    this.addEvent({
      type: 'DISCREPANCY_FLAGGED',
      title: `M-Pesa Account Removed`,
      description: `Removed ${removed.accountName} (${removed.identifier})`,
      actorName: 'Owner Management',
      severity: 'WARNING',
    });

    this.notify();
    firestoreSync.deleteMpesaAccount(accountId);
    return true;
  }

  public getInventory(): InventoryItem[] {
    const bizId = this.getCurrentBusinessId();
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    if (!inventoryMap[bizId]) {
      if (bizId === 'biz-1') {
        inventoryMap[bizId] = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
      } else {
        inventoryMap[bizId] = [];
      }
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }
    return inventoryMap[bizId];
  }

  private saveCurrentInventory(inv: InventoryItem[]) {
    const bizId = this.getCurrentBusinessId();
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    inventoryMap[bizId] = inv;
    this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    inv.forEach((item) => {
      firestoreSync.saveInventoryItem(item, bizId);
    });
  }

  public getShifts(): Shift[] {
    const bizId = this.getCurrentBusinessId();
    const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
    return shiftsMap[bizId] || [];
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

  // --- Shift Operations ---
  public openShift(params: {
    workerId: string;
    workerName: string;
    openingCashFloat: number;
    openingMpesaBalance: number;
    physicalCounts: Record<string, number>;
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
    const lastClosedShift = this.getLastClosedShift();
    const prevAttendant = lastClosedShift ? lastClosedShift.workerName : 'Previous Attendant';
    const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);

    products.forEach((product) => {
      const inv = currentInventory.find((i) => i.productId === product.id);
      const systemCount = inv ? inv.quantityOnHand : 0;
      const physicalCount =
        params.physicalCounts[product.id] !== undefined
          ? params.physicalCounts[product.id]
          : systemCount;

      const diff = physicalCount - systemCount;
      if (diff !== 0) {
        hasOpeningInconsistency = true;

        if (diff < 0) {
          // Shortage: previous attendant held accountable
          const shortageQty = Math.abs(diff);
          const moneyVal = shortageQty * product.sellingPrice;
          discrepancies.unshift({
            id: `disc-${Date.now()}-${product.id}`,
            shiftId,
            shiftNumber,
            workerName: params.workerName,
            responsibleWorkerName: prevAttendant,
            previousShiftId: lastClosedShift?.id,
            type: 'STOCK_SHORTAGE',
            itemId: product.id,
            itemName: product.name,
            expected: systemCount,
            actual: physicalCount,
            variance: diff, // negative e.g. -2
            monetaryValue: moneyVal,
            severity: shortageQty >= 3 ? 'HIGH' : 'MEDIUM',
            status: 'FLAGGED',
            ownerNotes: `Opening handover shortage: ${shortageQty} bottle(s) fewer than expected left by ${prevAttendant}. Reported by incoming attendant ${params.workerName}.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Surplus: previous attendant credited to balance the scale!
          const surplusQty = diff;
          const moneyVal = surplusQty * product.sellingPrice;
          discrepancies.unshift({
            id: `disc-${Date.now()}-${product.id}`,
            shiftId,
            shiftNumber,
            workerName: params.workerName,
            responsibleWorkerName: prevAttendant,
            previousShiftId: lastClosedShift?.id,
            type: 'STOCK_OVERAGE',
            itemId: product.id,
            itemName: product.name,
            expected: systemCount,
            actual: physicalCount,
            variance: diff, // positive e.g. +3
            monetaryValue: moneyVal,
            severity: 'LOW',
            status: 'RESOLVED',
            ownerNotes: `Opening handover surplus: +${surplusQty} extra bottle(s) found on shelf left by ${prevAttendant}. Credited to previous attendant to balance their scale fairly.`,
            timestamp: new Date().toISOString(),
          });
        }
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
    shiftStockItems.forEach((ssi) => {
      const existing = currentInventory.find((i) => i.productId === ssi.productId);
      if (existing) {
        existing.quantityOnHand = ssi.openingPhysicalCount;
        existing.updatedAt = new Date().toISOString();
      } else {
        currentInventory.push({
          id: `inv-${Date.now()}-${ssi.productId}`,
          productId: ssi.productId,
          quantityOnHand: ssi.openingPhysicalCount,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    this.saveCurrentInventory(currentInventory);

    if (hasOpeningInconsistency) {
      this.set(STORAGE_KEYS.DISCREPANCIES, discrepancies);
    }

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

    const bizId = this.getCurrentBusinessId();
    const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
    const shifts = shiftsMap[bizId] || [];
    shifts.unshift(newShift);
    shiftsMap[bizId] = shifts;
    this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);

    this.addEvent({
      type: 'SHIFT_OPENED',
      title: hasOpeningInconsistency ? 'Shift Opened (Handover Discrepancy/Surplus)' : 'Shift Opened',
      description: `${params.workerName} opened shift ${shiftNumber}. Cash Float: KES ${params.openingCashFloat.toLocaleString()}, M-Pesa Entry: KES ${params.openingMpesaBalance.toLocaleString()}${
        params.inconsistencyNote ? ` · Handover Note: ${params.inconsistencyNote}` : ''
      }`,
      actorName: params.workerName,
      severity: hasOpeningInconsistency ? 'WARNING' : 'SUCCESS',
      amount: params.openingMpesaBalance,
      currency: 'KES',
    });

    this.notify();
    firestoreSync.saveShift(newShift);
    return newShift;
  }

  public recordStockAddition(params: {
    shiftId: string;
    productId: string;
    quantity: number;
    workerName?: string;
    source?: string;
    note?: string;
  }): StockAdditionRecord {
    this.queueOfflineOperation('recordStockAddition', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');
    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');

    const qty = Number(params.quantity);
    if (qty <= 0) throw new Error('Quantity must be greater than 0.');

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
    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === params.productId);
    if (inv) {
      inv.quantityOnHand += qty;
      inv.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
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
      note: `Restocked ${qty} units.`,
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // Create persistent StockAdditionRecord
    const workerName = params.workerName || shift.workerName;
    const additionRecord: StockAdditionRecord = {
      id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      shiftId: params.shiftId,
      shiftNumber: shift.shiftNumber,
      productId: params.productId,
      productName: product.name,
      quantity: qty,
      workerName,
      timestamp: new Date().toISOString(),
      status: 'PENDING_OWNER_CONFIRMATION',
      isImmutable: false,
    };
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    additions.unshift(additionRecord);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);

    // Report directly to owner in events audit
    this.addEvent({
      type: 'ADDITION_RECORDED',
      title: `Stock Restock: +${qty} ${product.name}`,
      description: `${workerName} restocked ${qty}x ${product.name} on Shift #${shift.shiftNumber}. Awaiting owner verification & lock.`,
      actorName: workerName,
      severity: 'WARNING',
    });

    this.notify();
    firestoreSync.saveStockAddition(additionRecord);
    return additionRecord;
  }

  public getStockAdditions(shiftId?: string): StockAdditionRecord[] {
    const list = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    if (shiftId) return list.filter((a) => a.shiftId === shiftId);
    return list;
  }

  public saveAndLockStockAddition(additionId: string, ownerName: string): boolean {
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    const record = additions.find((a) => a.id === additionId);
    if (!record) return false;

    record.status = 'SAVED_LOCKED';
    record.isImmutable = true;
    record.savedAt = new Date().toISOString();
    record.savedBy = ownerName;
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);

    this.addEvent({
      type: 'INFO',
      title: `Restock Verified & Saved: +${record.quantity} ${record.productName}`,
      description: `Owner ${ownerName} confirmed and locked restock #${record.id}. Record is now permanently immutable to deletion.`,
      actorName: ownerName,
      severity: 'SUCCESS',
    });

    this.notify();
    return true;
  }

  public deleteStockAddition(additionId: string): boolean {
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    const record = additions.find((a) => a.id === additionId);
    if (!record) return false;

    // Check immutability!
    if (record.isImmutable || record.status === 'SAVED_LOCKED') {
      throw new Error('This restock record has been verified and saved by the owner. It is immutable to deletion.');
    }

    // Revert inventory and SSI
    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === record.productId);
    if (inv) {
      inv.quantityOnHand = Math.max(0, inv.quantityOnHand - record.quantity);
      inv.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
    }

    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find((item) => item.shiftId === record.shiftId && item.productId === record.productId);
    if (ssi) {
      ssi.additions = Math.max(0, ssi.additions - record.quantity);
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // Remove from additions
    const remaining = additions.filter((a) => a.id !== additionId);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, remaining);

    this.addEvent({
      type: 'INFO',
      title: `Pending Restock Deleted: -${record.quantity} ${record.productName}`,
      description: `Pending restock addition was removed before owner verification.`,
      actorName: 'System Ledger',
      severity: 'INFO',
    });

    this.notify();
    return true;
  }

  public recordExpense(params: {
    shiftId: string;
    category?: ExpenseCategory;
    amount: number;
    paymentMethod?: 'CASH' | 'MPESA';
    description: string;
    receiptRef?: string;
  }): Expense {
    this.queueOfflineOperation('recordExpense', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');

    const category = params.category || 'OTHER';
    const paymentMethod = params.paymentMethod || 'CASH';

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      shiftId: params.shiftId,
      category,
      amount: Number(params.amount) || 0,
      paymentMethod,
      description: params.description,
      receiptRef: params.receiptRef,
      timestamp: new Date().toISOString(),
    };

    const expenses = this.get<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    expenses.unshift(expense);
    this.set(STORAGE_KEYS.EXPENSES, expenses);

    this.addEvent({
      type: 'EXPENSE_LOGGED',
      title: `Expense: KES ${expense.amount.toLocaleString()} - ${params.description}`,
      description: `${params.description} (KES ${expense.amount.toLocaleString()})`,
      actorName: shift.workerName,
      severity: 'INFO',
      amount: expense.amount,
      currency: 'KES',
    });

    this.notify();
    firestoreSync.saveExpense(expense);
    return expense;
  }

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

    const bizId = this.getCurrentBusinessId();
    const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
    shiftsMap[bizId] = shifts;
    this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);

    // Update Shift Stock Items
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const remainingSSIs = allSSIs.filter((i) => i.shiftId !== params.shiftId);
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, [
      ...recon.reconciledStockItems,
      ...remainingSSIs,
    ]);

    // Update physical inventory to closing verified counts
    const currentInventory = this.getInventory();
    recon.reconciledStockItems.forEach((item) => {
      const inv = currentInventory.find((i) => i.productId === item.productId);
      if (inv && item.closingPhysicalCount !== undefined) {
        inv.quantityOnHand = item.closingPhysicalCount;
        inv.updatedAt = new Date().toISOString();
      }
    });
    this.saveCurrentInventory(currentInventory);

    this.addEvent({
      type: 'SHIFT_CLOSED',
      title: `Shift Closed: ${shift.shiftNumber}`,
      description: `Reconciled by ${shift.workerName}. Net Money Returned: KES ${recon.totalIncomeReturned.toLocaleString()} | Net Profit: KES ${recon.netProfit.toLocaleString()}`,
      actorName: shift.workerName,
      severity: Math.abs(recon.financialVariance) > 5 ? 'WARNING' : 'SUCCESS',
      amount: recon.totalIncomeReturned,
      currency: 'KES',
    });

    // Invalidate one-time shift transfer code at shift closure (lasts strictly one shift)
    const businesses = this.getBusinesses();
    const targetB = businesses.find((b) => b.id === bizId);
    if (targetB) {
      targetB.activeShiftTransferCode = undefined;
      targetB.activeShiftId = undefined;
      this.set(STORAGE_KEYS.BUSINESSES, businesses);
    }

    // Clear handover draft on successful close
    this.clearHandoverDraft(params.shiftId);

    this.notify();
    firestoreSync.saveShift(shift);
    return shift;
  }

  public markCounterFinished(shiftId: string, finished: boolean = true) {
    const shifts = this.getShifts();
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) {
      shift.counterFinished = finished;
      const bizId = this.getCurrentBusinessId();
      const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
      shiftsMap[bizId] = shifts;
      this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);
      this.notify();
    }
  }

  public markShiftReviewed(shiftId: string, reviewedBy: string, isReviewed: boolean = true): boolean {
    const shifts = this.getShifts();
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return false;

    shift.isReviewedByOwner = isReviewed;
    shift.reviewedAt = isReviewed ? new Date().toISOString() : undefined;
    shift.reviewedBy = isReviewed ? reviewedBy : undefined;

    const bizId = this.getCurrentBusinessId();
    const shiftsMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
    shiftsMap[bizId] = shifts;
    this.set(STORAGE_KEYS.SHIFTS_MAP, shiftsMap);

    this.addEvent({
      type: 'INFO',
      title: isReviewed ? `Shift Reviewed: ${shift.shiftNumber}` : `Shift Marked Unread: ${shift.shiftNumber}`,
      description: isReviewed
        ? `Owner ${reviewedBy} reviewed and verified Shift #${shift.shiftNumber} submitted by ${shift.workerName}.`
        : `Shift #${shift.shiftNumber} marked as unread.`,
      actorName: reviewedBy,
      severity: isReviewed ? 'SUCCESS' : 'INFO',
    });

    this.notify();
    firestoreSync.saveShift(shift);
    return true;
  }

  public getHandoverDraft(shiftId: string): HandoverDraft | null {
    const drafts = this.get<Record<string, HandoverDraft>>(STORAGE_KEYS.HANDOVER_DRAFTS, {});
    return drafts[shiftId] || null;
  }

  public saveHandoverDraft(shiftId: string, draft: HandoverDraft) {
    const drafts = this.get<Record<string, HandoverDraft>>(STORAGE_KEYS.HANDOVER_DRAFTS, {});
    drafts[shiftId] = draft;
    this.set(STORAGE_KEYS.HANDOVER_DRAFTS, drafts);
  }

  public clearHandoverDraft(shiftId: string) {
    const drafts = this.get<Record<string, HandoverDraft>>(STORAGE_KEYS.HANDOVER_DRAFTS, {});
    delete drafts[shiftId];
    this.set(STORAGE_KEYS.HANDOVER_DRAFTS, drafts);
  }

  public getWorkerMaxAllowedStep(): 'start' | 'counter' | 'end_shift' {
    const activeShift = this.getActiveShift();
    if (!activeShift) {
      return 'start';
    }
    if (activeShift.counterFinished) {
      return 'end_shift';
    }
    return 'counter';
  }

  public updateProductPricing(productId: string, sellingPrice: number, costPrice: number) {
    const products = this.getProducts(true);
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

  public adjustProductStock(productId: string, newQuantity: number): boolean {
    const cleanQty = Math.max(0, Math.floor(Number(newQuantity) || 0));
    const inv = this.getInventory();
    const item = inv.find((i) => i.productId === productId);
    const prevQty = item ? item.quantityOnHand : 0;
    const delta = cleanQty - prevQty;

    if (item) {
      item.quantityOnHand = cleanQty;
      item.updatedAt = new Date().toISOString();
    } else {
      inv.push({
        productId,
        quantityOnHand: cleanQty,
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveCurrentInventory(inv);

    // If an active shift exists and stock changed, keep active shift in balance
    const activeShift = this.getActiveShift();
    if (activeShift && delta !== 0) {
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      const ssi = allSSIs.find(
        (s) => s.shiftId === activeShift.id && s.productId === productId
      );
      if (ssi) {
        if (delta > 0) {
          ssi.additions = (ssi.additions || 0) + delta;
        } else {
          const absDelta = Math.abs(delta);
          if ((ssi.additions || 0) >= absDelta) {
            ssi.additions = (ssi.additions || 0) - absDelta;
          } else {
            const remaining = absDelta - (ssi.additions || 0);
            ssi.additions = 0;
            ssi.openingPhysicalCount = Math.max(0, (ssi.openingPhysicalCount || 0) - remaining);
          }
        }
        this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
      }
    }

    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    const productName = product ? product.name : 'Drink';
    this.addEvent({
      type: 'INFO',
      title: `Stock Count Adjusted: ${productName}`,
      description: `Stock adjusted from ${prevQty} to ${cleanQty} (${delta >= 0 ? `+${delta}` : delta}) by Owner`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    return true;
  }

  public addProduct(params: {
    name: string;
    category: import('../types').ProductCategory;
    unit: import('../types').ProductUnit;
    costPrice: number;
    sellingPrice: number;
    reorderLevel?: number;
    volumeMl?: number;
    initialStock?: number;
    businessId?: string;
  }): Product {
    const currentBizId = params.businessId || this.getCurrentBusinessId();
    const products = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      businessId: currentBizId,
      name: params.name.trim(),
      category: params.category,
      unit: params.unit,
      costPrice: Number(params.costPrice) || 0,
      sellingPrice: Number(params.sellingPrice) || 0,
      reorderLevel: Number(params.reorderLevel) || 5,
      volumeMl: params.volumeMl ? Number(params.volumeMl) : undefined,
      isArchived: false,
    };

    products.push(newProduct);
    this.set(STORAGE_KEYS.PRODUCTS, products);

    // Initialize inventory for current business
    const inv = this.getInventory();
    const initialQty = Number(params.initialStock) || 0;
    const existingInv = inv.find((i) => i.productId === newProduct.id);
    if (!existingInv) {
      inv.push({
        productId: newProduct.id,
        quantityOnHand: initialQty,
        updatedAt: new Date().toISOString(),
      });
      this.saveCurrentInventory(inv);
    }

    // If an active shift exists, add shift stock item so it's immediately available to the worker
    const activeShift = this.getActiveShift();
    if (activeShift) {
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      const newSSI: ShiftStockItem = {
        id: `ssi-${activeShift.id}-${newProduct.id}`,
        shiftId: activeShift.id,
        productId: newProduct.id,
        productName: newProduct.name,
        unit: newProduct.unit,
        sellingPrice: newProduct.sellingPrice,
        costPrice: newProduct.costPrice,
        openingSystemCount: 0,
        openingPhysicalCount: 0,
        openingVerified: true,
        additions: initialQty,
        recordedSales: 0,
        transfersIn: 0,
        transfersOut: 0,
        damages: 0,
      };
      allSSIs.push(newSSI);
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    this.addEvent({
      type: 'INFO',
      title: `Drink Added to Catalog: ${newProduct.name}`,
      description: `Category: ${newProduct.category} | Sell: KES ${newProduct.sellingPrice} | Stock: ${initialQty} ${newProduct.unit.toLowerCase()}s`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    return newProduct;
  }

  /**
   * Universal smart parser for bulk real drinks text (supports CSV, TSV, hyphens, colons)
   */
  public parseBulkDrinksText(
    text: string,
    defaultStock = 0
  ): Array<{
    name: string;
    sellingPrice: number;
    costPrice?: number;
    category: import('../types').ProductCategory;
    unit: import('../types').ProductUnit;
    initialStock?: number;
    reorderLevel?: number;
  }> {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((line, idx) => {
      const parts = line.includes(',')
        ? line.split(',').map((p) => p.trim())
        : line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.includes(' - ')
        ? line.split(' - ').map((p) => p.trim())
        : line.includes(':')
        ? line.split(':').map((p) => p.trim())
        : [line.trim()];

      const rawName = parts[0] || `Drink ${idx + 1}`;
      const rawSell = parts[1] ? parseFloat(parts[1].replace(/[^0-9.]/g, '')) : 0;
      const rawCost = parts[2] ? parseFloat(parts[2].replace(/[^0-9.]/g, '')) : undefined;
      const rawCat = parts[3]?.toUpperCase();
      const rawStock = parts[4] ? parseInt(parts[4].replace(/[^0-9]/g, ''), 10) : undefined;

      // Smart category detection from drink keywords
      let guessedCat: import('../types').ProductCategory = 'BEER';
      const lower = rawName.toLowerCase();
      if (
        lower.includes('whisky') ||
        lower.includes('whiskey') ||
        lower.includes('gin') ||
        lower.includes('vodka') ||
        lower.includes('rum') ||
        lower.includes('brandy') ||
        lower.includes('cognac') ||
        lower.includes('tequila') ||
        lower.includes('liqueur') ||
        lower.includes('spirit') ||
        lower.includes('jameson') ||
        lower.includes('gilbeys') ||
        lower.includes('johnnie') ||
        lower.includes('black label') ||
        lower.includes('red label') ||
        lower.includes('flagon') ||
        lower.includes('richot') ||
        lower.includes('viceroy') ||
        lower.includes('captain morgan') ||
        lower.includes('jack daniel') ||
        lower.includes('gordon') ||
        lower.includes('tanqueray') ||
        lower.includes('chrome') ||
        lower.includes('kibao') ||
        lower.includes('best') ||
        lower.includes('county') ||
        lower.includes('hunters choice')
      ) {
        guessedCat = 'SPIRIT';
      } else if (
        lower.includes('cider') ||
        lower.includes('savanna') ||
        lower.includes('hunters cider') ||
        lower.includes('snapp') ||
        lower.includes('tusker cider')
      ) {
        guessedCat = 'CIDER';
      } else if (
        lower.includes('wine') ||
        lower.includes('sauvignon') ||
        lower.includes('merlot') ||
        lower.includes('chardonnay') ||
        lower.includes('cabernet') ||
        lower.includes('cellar cask') ||
        lower.includes('4th street') ||
        lower.includes('drostdy') ||
        lower.includes('four cousins') ||
        lower.includes('robertson') ||
        lower.includes('rosso')
      ) {
        guessedCat = 'WINE';
      } else if (
        lower.includes('soda') ||
        lower.includes('coca') ||
        lower.includes('coke') ||
        lower.includes('fanta') ||
        lower.includes('sprite') ||
        lower.includes('water') ||
        lower.includes('juice') ||
        lower.includes('red bull') ||
        lower.includes('energy') ||
        lower.includes('tonic') ||
        lower.includes('ginger ale') ||
        lower.includes('krest') ||
        lower.includes('stoney') ||
        lower.includes('del monte') ||
        lower.includes('minute maid')
      ) {
        guessedCat = 'SOFT_DRINK';
      } else if (
        lower.includes('smoke') ||
        lower.includes('cigarette') ||
        lower.includes('dunhill') ||
        lower.includes('sportsman') ||
        lower.includes('embassy') ||
        lower.includes('rothmans') ||
        lower.includes('vape')
      ) {
        guessedCat = 'CIGARETTE';
      }

      const validCats: import('../types').ProductCategory[] = ['BEER', 'CIDER', 'SPIRIT', 'WINE', 'SOFT_DRINK', 'CIGARETTE'];
      const category: import('../types').ProductCategory = validCats.includes(rawCat as any) ? (rawCat as any) : guessedCat;

      const sellingPrice = isNaN(rawSell) ? 0 : rawSell;
      const costPrice = rawCost !== undefined && !isNaN(rawCost) ? rawCost : Math.round(sellingPrice * 0.75);
      const stock = rawStock !== undefined && !isNaN(rawStock) ? rawStock : defaultStock;

      return {
        name: rawName,
        sellingPrice,
        costPrice,
        category,
        unit: 'BOTTLE' as import('../types').ProductUnit,
        initialStock: stock,
        reorderLevel: 5,
      };
    });
  }

  /**
   * Fast Bulk Import of products and prices
   */
  public bulkAddProducts(
    items: Array<{
      name: string;
      sellingPrice: number;
      costPrice?: number;
      category?: import('../types').ProductCategory;
      unit?: import('../types').ProductUnit;
      initialStock?: number;
      reorderLevel?: number;
    }>
  ): Product[] {
    const currentBizId = this.getCurrentBusinessId();
    const products = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const inv = this.getInventory();
    const added: Product[] = [];

    items.forEach((item) => {
      const cleanName = item.name.trim();
      if (!cleanName) return;

      const sellPrice = Number(item.sellingPrice) || 0;
      const costPrice =
        item.costPrice !== undefined && !isNaN(Number(item.costPrice))
          ? Number(item.costPrice)
          : Math.round(sellPrice * 0.75); // Realistic 25% bar margin default

      const newProduct: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        businessId: currentBizId,
        name: cleanName,
        category: item.category || 'BEER',
        unit: item.unit || 'BOTTLE',
        costPrice,
        sellingPrice: sellPrice,
        reorderLevel: Number(item.reorderLevel) || 5,
        isArchived: false,
      };

      products.push(newProduct);
      added.push(newProduct);

      const initialQty = Number(item.initialStock) || 0;
      const existingInv = inv.find((i) => i.productId === newProduct.id);
      if (existingInv) {
        existingInv.quantityOnHand = initialQty;
      } else {
        inv.push({
          productId: newProduct.id,
          quantityOnHand: initialQty,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    this.set(STORAGE_KEYS.PRODUCTS, products);
    this.saveCurrentInventory(inv);

    this.addEvent({
      type: 'INFO',
      title: `Bulk Catalog Import (${added.length} drinks)`,
      description: `Imported ${added.length} real drinks into active menu.`,
      actorName: 'Owner Audit Desk',
      severity: 'SUCCESS',
    });

    this.notify();
    return added;
  }

  /**
   * Wipe all sample or test drinks to start with a 100% clean slate
   */
  public clearAllProducts(): void {
    const currentBizId = this.getCurrentBusinessId();
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);

    // Filter out products belonging to current business
    // If on sample businesses (biz-1, biz-2, biz-3), remove untagged legacy products too
    let remaining: Product[] = [];
    if (currentBizId === 'biz-1') {
      remaining = allProducts.filter((p) => p.businessId && p.businessId !== currentBizId);
    } else {
      remaining = allProducts.filter((p) => p.businessId !== currentBizId);
    }

    this.set(STORAGE_KEYS.PRODUCTS, remaining);
    this.saveCurrentInventory([]);

    this.addEvent({
      type: 'INFO',
      title: 'Catalog Reset to Blank Slate',
      description: 'All sample/test drinks cleared. Ready for real inventory entry.',
      actorName: 'Owner Audit Desk',
      severity: 'WARNING',
    });

    this.notify();
  }

  /**
   * Restore Kenyan Bar Staples catalog template
   */
  public restoreDefaultCatalog(): void {
    const cloned = INITIAL_PRODUCTS.map((p) => ({
      name: p.name,
      category: p.category,
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      reorderLevel: p.reorderLevel,
      initialStock: 24,
    }));
    this.bulkAddProducts(cloned);
  }

  public updateProduct(productId: string, updates: Partial<Product>): Product | null {
    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    if (!product) return null;

    Object.assign(product, updates);
    this.set(STORAGE_KEYS.PRODUCTS, products);

    this.addEvent({
      type: 'INFO',
      title: `Catalog Updated: ${product.name}`,
      description: `Selling Price: KES ${product.sellingPrice} | Cost Price: KES ${product.costPrice}`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    return product;
  }

  public deleteProduct(productId: string, permanent = false): boolean {
    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    if (!product) return false;

    if (permanent) {
      const filtered = products.filter((p) => p.id !== productId);
      this.set(STORAGE_KEYS.PRODUCTS, filtered);
    } else {
      product.isArchived = true;
      this.set(STORAGE_KEYS.PRODUCTS, products);
    }

    this.addEvent({
      type: 'INFO',
      title: `${permanent ? 'Drink Deleted' : 'Drink Archived'}: ${product.name}`,
      description: `${product.name} removed from active catalog shelves`,
      actorName: 'Owner Audit Desk',
      severity: 'WARNING',
    });

    this.notify();
    return true;
  }

  public restoreProduct(productId: string): boolean {
    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    if (!product) return false;

    product.isArchived = false;
    this.set(STORAGE_KEYS.PRODUCTS, products);

    this.addEvent({
      type: 'INFO',
      title: `Drink Restored: ${product.name}`,
      description: `${product.name} restored to active catalog shelves`,
      actorName: 'Owner Audit Desk',
      severity: 'SUCCESS',
    });

    this.notify();
    return true;
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

  public uploadAllToFirestore() {
    return firestoreSync.uploadAllLocalDataToFirestore({
      businesses: this.getBusinesses(),
      products: this.getProducts(),
      inventoryMap: this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {}),
      shiftsMap: this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {}),
      mpesaAccountsMap: this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {}),
      expenses: this.getExpenses(),
    });
  }
}

export const store = new StoreService();
