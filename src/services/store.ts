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
import { neonService, PullResult } from './neon';
import { authService } from './auth';

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
  DELETED_STOCK_ADDITIONS: 'bar_track_deleted_stock_additions',
  HANDOVER_DRAFTS: 'bar_track_handover_drafts',
  DISCREPANCIES: 'bar_track_discrepancies',
  EVENTS_MAP: 'bar_track_events_map',
  MPESA_TXNS: 'bar_track_mpesa_txns',
  OFFLINE_QUEUE: 'bar_track_offline_queue',
  IS_ONLINE: 'bar_track_is_online',
};

class StoreService {
  private subscribers: (() => void)[] = [];
  private pendingAutoSync = false;
  private isAutoSyncing = false;
  private autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAutoSyncTime: string | null = null;
  private hasInitialCloudSynced = false;
  private liveChannel: BroadcastChannel | null = null;

  constructor() {
    this.ensureInitialized();
    if (typeof window !== 'undefined') {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          this.liveChannel = new BroadcastChannel('bartrack_realtime_sync');
          this.liveChannel.onmessage = (event) => {
            if (event.data?.type === 'LOCAL_STORE_MUTATED') {
              this.notifySubscribersOnly();
            }
          };
        }
      } catch (e) {
        // BroadcastChannel unavailable
      }
      this.setupAutoSyncEngine();
    }
  }

  private setupAutoSyncEngine() {
    // Listen to Neon status changes: when connected, flush pending sync
    neonService.subscribeStatus((st) => {
      if (st.status === 'CONNECTED') {
        if (this.pendingAutoSync || !this.hasInitialCloudSynced) {
          this.scheduleAutoSync(200);
        }
      }
    });

    // Browser network events
    window.addEventListener('online', () => {
      this.set(STORAGE_KEYS.IS_ONLINE, true);
      this.scheduleAutoSync(200);
    });

    window.addEventListener('offline', () => {
      this.set(STORAGE_KEYS.IS_ONLINE, false);
      this.pendingAutoSync = true;
    });

    // Continuous live synchronization loop:
    // Polls cloud every 3.5 seconds while online to sync cross-browser edits seamlessly
    setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncWithCloud(true);
      }
    }, 3500);

    // Immediate sync on window focus and tab visibility change
    window.addEventListener('focus', () => {
      this.syncWithCloud(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.syncWithCloud(true);
      }
    });
  }

  public scheduleAutoSync(delayMs = 600) {
    if (typeof window === 'undefined') return;
    this.pendingAutoSync = true;
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }
    this.autoSyncTimer = setTimeout(() => {
      this.syncWithCloud();
    }, delayMs);
  }

  public async syncWithCloud(silent = false): Promise<{ success: boolean; message: string }> {
    if (typeof window === 'undefined') return { success: false, message: 'Server context' };
    if (this.isAutoSyncing) {
      this.pendingAutoSync = true;
      return { success: true, message: 'Sync already in progress' };
    }

    const neonStatus = neonService.getStatus();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline || (neonStatus.status !== 'CONNECTED' && neonStatus.status !== 'SYNCING')) {
      this.pendingAutoSync = true;
      return { success: false, message: 'Offline. Queued for auto-sync.' };
    }

    this.isAutoSyncing = true;
    try {
      const currentBiz = this.getCurrentBusiness();

      // If we have pending local mutations or offline changes, push them to Neon first
      if (currentBiz && currentBiz.id && (this.pendingAutoSync || this.getOfflineQueueCount() > 0)) {
        try {
          await this.uploadAllToNeon(currentBiz.id);
        } catch (uploadErr) {
          console.warn('Pending mutations upload to Neon notice:', uploadErr);
        }
      }

      // Always pull latest businesses and users from Neon for cross-device synchronization
      const pullRes = await neonService.pullAllBusinessesAndUsers();
      if (pullRes.success && pullRes.businesses && pullRes.businesses.length > 0) {
        this.mergeCloudBusinessesAndUsers(pullRes.businesses, pullRes.users || []);
      }

      // Pull authoritative establishment data for the current active business
      const bizToPull = this.getCurrentBusiness();
      if (bizToPull && bizToPull.id) {
        const fullBizRes = await neonService.pullBusinessFromNeon(bizToPull.id);
        if (fullBizRes.success && fullBizRes.data) {
          this.mergeCloudBusinessData(fullBizRes.data);
        }
      }

      this.pendingAutoSync = false;
      this.hasInitialCloudSynced = true;
      this.lastAutoSyncTime = new Date().toLocaleTimeString();

      if (!silent) {
        this.notifySubscribersOnly();
      }

      return { success: true, message: 'Cloud database synchronized automatically.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.pendingAutoSync = true;
      return { success: false, message: msg };
    } finally {
      this.isAutoSyncing = false;
    }
  }

  public getLastAutoSyncTime(): string | null {
    return this.lastAutoSyncTime;
  }

  public hasPendingCloudSync(): boolean {
    return this.pendingAutoSync;
  }

  public isCloudSyncing(): boolean {
    return this.isAutoSyncing;
  }

  public triggerNeonSync() {
    this.scheduleAutoSync(0);
  }

  public subscribe(callback: () => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notifySubscribersOnly() {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Subscriber callback error:', e);
      }
    });
  }

  private notify() {
    this.notifySubscribersOnly();
    try {
      this.liveChannel?.postMessage({ type: 'LOCAL_STORE_MUTATED', timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
    // Automatically debounce cloud sync whenever any local state changes
    this.scheduleAutoSync(600);
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

  private purgeLegacyDemoData() {
    try {
      const storedBusinesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
      const isDemo = storedBusinesses.some(
        (b) =>
          b.id === 'biz-1' ||
          b.id === 'biz-2' ||
          b.id === 'biz-3' ||
          b.name === 'Bar Tracker Lounge' ||
          b.name === 'The Copper Kettle Lounge' ||
          b.name === 'The Alchemist Bar' ||
          b.name === 'Brew Bistro & Taproom'
      );
      const storedUsers = this.get<User[]>(STORAGE_KEYS.USERS, []);
      const hasDemoUsers = storedUsers.some(
        (u) =>
          u.id === 'user-owner' ||
          u.id === 'user-owner-mary' ||
          u.id === 'user-1' ||
          u.id === 'user-2' ||
          u.username === 'ann_njeri' ||
          u.username === 'mary' ||
          u.username === 'wanjiku' ||
          u.username === 'kevin'
      );

      if (isDemo || hasDemoUsers) {
        Object.values(STORAGE_KEYS).forEach((key) => {
          localStorage.removeItem(key);
        });
        localStorage.removeItem('bartracker_session_user');
        localStorage.removeItem('bartracker_auth_session');
        localStorage.removeItem('bartracker_saved_username');
      }
    } catch (e) {
      console.error('Error purging legacy demo data:', e);
    }
  }

  private ensureInitialized() {
    this.purgeLegacyDemoData();

    // Ensure baseline structures exist without seeding any mock data
    if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
      this.set(STORAGE_KEYS.BUSINESSES, []);
      this.set(STORAGE_KEYS.USERS, []);
      this.set(STORAGE_KEYS.PRODUCTS, []);
      this.set(STORAGE_KEYS.INVENTORY_MAP, {});
      this.set(STORAGE_KEYS.SHIFTS_MAP, {});
      this.set(STORAGE_KEYS.EXPENSES, []);
      this.set(STORAGE_KEYS.PARTNERS, []);
      this.set(STORAGE_KEYS.INTER_TRANSFERS, []);
      this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
      this.set(STORAGE_KEYS.EVENTS_MAP, {});
      this.set(STORAGE_KEYS.DISCREPANCIES, []);
      this.set(STORAGE_KEYS.STOCK_ADDITIONS, []);
      this.set(STORAGE_KEYS.CURRENT_BIZ_ID, '');
    }
  }

  public purgeAllData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('bartracker_session_user');
    localStorage.removeItem('bartracker_auth_session');
    localStorage.removeItem('bartracker_saved_username');
    this.ensureInitialized();
    this.notify();
  }

  public hasAnyBusiness(): boolean {
    const list = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    return list.length > 0;
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
    return this.get<string>(STORAGE_KEYS.CURRENT_BIZ_ID, '');
  }

  public getCurrentBusiness(): BusinessProfile {
    const id = this.getCurrentBusinessId();
    const businesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const found = businesses.find((b) => b.id === id);
    if (found) return found;

    if (businesses.length > 0) return businesses[0];

    const user = this.getSessionUser();
    return {
      id: id || '',
      name: user?.role === 'OWNER' && user.name ? `${user.name.replace(/\s*\(Proprietor\)/i, '')}'s Establishment` : 'My Bar Establishment',
      connectCode: '000000',
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
    this.triggerNeonSync();
    this.notify();
  }

  public getBusinesses(): BusinessProfile[] {
    const all = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const user = this.getSessionUser();
    if (user && user.businessId) {
      const userBiz = all.filter((b) => b.id === user.businessId);
      if (userBiz.length > 0) return userBiz;
      const current = this.getCurrentBusiness();
      if (current.id) return [current];
    }
    return all;
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
    this.triggerNeonSync();
    this.notify();
  }

  /**
   * Register a brand new business establishment and its executive proprietor (Owner).
   * Attendants can subsequently be registered inside the Admin Desk.
   */
  public async registerNewBusiness(params: {
    businessName: string;
    phone: string;
    address?: string;
    ownerName: string;
    ownerUsername: string;
    ownerPassword: string;
    ownerPinCode: string;
    seedCatalogTemplate?: boolean;
    initialDrinksText?: string;
  }): Promise<{ business: BusinessProfile; user: User }> {
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

    const businesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    businesses.push(newBusiness);
    this.set(STORAGE_KEYS.BUSINESSES, businesses);

    // Hash credentials securely using Web Crypto with unique per-user salts
    const passwordSalt = authService.generateSalt();
    const passwordHash = await authService.hashCredential(cleanPassword, passwordSalt);
    const pinSalt = authService.generateSalt();
    const pinHash = await authService.hashCredential(cleanPin, pinSalt);

    // Create Owner user
    const newUser: User = {
      id: `user-${Date.now()}`,
      businessId: newBizId,
      name: `${cleanOwnerName} (Proprietor)`,
      username: cleanUsername,
      role: 'OWNER',
      pinCode: pinHash,
      pinSalt: pinSalt,
      password: passwordHash,
      passwordSalt: passwordSalt,
      createdAt: new Date().toISOString(),
    };

    allUsers.push(newUser);
    this.set(STORAGE_KEYS.USERS, allUsers);

    // Switch current business to newly created establishment
    this.set(STORAGE_KEYS.CURRENT_BIZ_ID, newBizId);

    // Issue authentic cryptographic session
    authService.createSession(newUser);

    // Handle catalog setup (Clean slate without any mock data)
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});

    if (params.initialDrinksText && params.initialDrinksText.trim()) {
      inventoryMap[newBizId] = [];
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);

      const parsed = this.parseBulkDrinksText(params.initialDrinksText);
      const valid = parsed.filter((d) => d.name.trim().length > 0 && d.sellingPrice > 0);
      if (valid.length > 0) {
        this.bulkAddProducts(valid);
      }
    } else {
      inventoryMap[newBizId] = [];
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }

    // Default clean primary M-Pesa account container
    const mpesaMap = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
    mpesaMap[newBizId] = [
      {
        id: `mpesa-${newBizId}-till-1`,
        businessId: newBizId,
        accountName: `${cleanBizName} Counter Till`,
        accountType: 'BUY_GOODS_TILL',
        identifier: '100001',
        currentBalance: 0,
        isPrimary: true,
        isActive: true,
      },
    ];
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, mpesaMap);

    this.addEvent({
      type: 'INFO',
      title: 'Business Established',
      description: `${cleanBizName} created with proprietor account for ${cleanOwnerName}.`,
      actorName: 'System Setup',
      severity: 'SUCCESS',
    });

    // Immediate authoritative cloud persistence to Neon PostgreSQL
    // Ensures owner account and business are immediately live across all devices and browsers!
    try {
      await neonService.syncPayloadToNeon({
        business: newBusiness,
        users: [newUser],
        products: this.getProducts(true, newBizId),
        inventory: inventoryMap[newBizId] || [],
        shifts: [],
        expenses: [],
        mpesaAccounts: mpesaMap[newBizId] || [],
        events: this.getEvents(40, newBizId),
        stockAdditions: [],
        deletedStockAdditionIds: [],
        discrepancies: [],
        interTransfers: [],
        partners: [],
        shiftStockItems: [],
      });
      this.hasInitialCloudSynced = true;
    } catch (neonErr) {
      console.warn('Initial cloud sync for new business notice:', neonErr);
      this.triggerNeonSync();
    }

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
      netTransferBalance: 0,
      connectedAt: new Date().toISOString(),
    };

    const reciprocalLink: BusinessPartner = {
      id: `partner-${targetBiz.id}-${currentBiz.id}`,
      businessId: targetBiz.id,
      partnerBusinessId: currentBiz.id,
      partnerName: currentBiz.name,
      partnerPhone: currentBiz.phone,
      partnerConnectCode: currentBiz.activeShiftTransferCode || currentBiz.connectCode || 'LINKED',
      netTransferBalance: 0,
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
      unitPrice: product.sellingPrice,
      timestamp: new Date().toISOString(),
      note: `Dispatched ${qty} to partner bar ${targetBiz.name}. ${params.notes || ''}`,
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // 4. Create InterBusinessTransfer record
    const totalTransferValue = qty * product.sellingPrice;
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
      unitPrice: product.sellingPrice,
      totalTransferValue,
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
      description: `Dispatched to ${targetBiz.name}. Stock Value: KES ${totalTransferValue.toLocaleString()}. Waiting for their acceptance.`,
      actorName: activeShift.workerName,
      severity: 'WARNING',
      amount: totalTransferValue,
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

    // 4. Update Partner Stock Ledger (Stock value removed from giver and added to receiver)
    const allPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);

    // For receiver: we owe the sender this stock value (netTransferBalance decreases)
    const receiverPartnerLink = allPartners.find(
      (p) => p.businessId === currentBiz.id && p.partnerBusinessId === transfer.fromBusinessId
    );
    if (receiverPartnerLink) {
      receiverPartnerLink.netTransferBalance -= transfer.totalTransferValue;
    } else {
      allPartners.push({
        id: `partner-${currentBiz.id}-${transfer.fromBusinessId}`,
        businessId: currentBiz.id,
        partnerBusinessId: transfer.fromBusinessId,
        partnerName: transfer.fromBusinessName,
        partnerPhone: '',
        partnerConnectCode: '',
        netTransferBalance: -transfer.totalTransferValue,
        connectedAt: new Date().toISOString(),
      });
    }

    // For sender: sender is owed this stock value (netTransferBalance increases)
    const senderPartnerLink = allPartners.find(
      (p) => p.businessId === transfer.fromBusinessId && p.partnerBusinessId === currentBiz.id
    );
    if (senderPartnerLink) {
      senderPartnerLink.netTransferBalance += transfer.totalTransferValue;
    } else {
      allPartners.push({
        id: `partner-${transfer.fromBusinessId}-${currentBiz.id}`,
        businessId: transfer.fromBusinessId,
        partnerBusinessId: currentBiz.id,
        partnerName: currentBiz.name,
        partnerPhone: currentBiz.phone,
        partnerConnectCode: currentBiz.activeShiftTransferCode || currentBiz.connectCode || 'LINKED',
        netTransferBalance: transfer.totalTransferValue,
        connectedAt: new Date().toISOString(),
      });
    }
    this.set(STORAGE_KEYS.PARTNERS, allPartners);

    // 5. Operational Event
    this.addEvent({
      type: 'INTER_BAR_ACCEPTED',
      title: `Transfer Received: ${transfer.quantity}x ${transfer.productName}`,
      description: `Accepted from ${transfer.fromBusinessName}. Stock of KES ${transfer.totalTransferValue.toLocaleString()} added to bar inventory.`,
      actorName: attendant,
      severity: 'SUCCESS',
      amount: transfer.totalTransferValue,
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

    partnerLink.netTransferBalance += amount; // paying off our debt brings negative balance towards 0

    // Update reciprocal link
    const reciprocal = allPartners.find(
      (p) => p.businessId === partnerBusinessId && p.partnerBusinessId === currentBiz.id
    );
    if (reciprocal) {
      reciprocal.netTransferBalance -= amount;
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
  public getEvents(limit = 40, specificBizId?: string): OperationalEvent[] {
    const bizId = specificBizId || this.getCurrentBusinessId();
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

  public async authenticateUser(usernameInput: string, credentialInput: string): Promise<User | null> {
    const rawInput = usernameInput.trim().toLowerCase();
    const cleanCredential = credentialInput.trim();
    if (!rawInput || !cleanCredential) return null;

    // Check rate-limiting brute force protection
    const lockout = authService.getLockoutStatus(rawInput);
    if (lockout.isLocked) {
      throw new Error(`Account temporarily locked due to repeated failed attempts. Please wait ${lockout.secondsRemaining} seconds.`);
    }

    const normalizedInput = rawInput.replace(/[_.-]/g, ' ').replace(/\s+/g, ' ').trim();
    const compactInput = rawInput.replace(/[\s_.-]/g, '');

    const findCandidates = (userPool: User[]): User[] => {
      return userPool.filter((u) => {
        if (u.isArchived) return false;

        const userUName = (u.username || '').toLowerCase();
        const userName = (u.name || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();

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
    };

    const verifyCandidate = async (activeUser: User): Promise<boolean> => {
      // 1. Verify Password
      if (activeUser.password && activeUser.passwordSalt) {
        const match = await authService.verifyCredential(cleanCredential, activeUser.password, activeUser.passwordSalt);
        if (match) return true;
      } else if (activeUser.password && activeUser.password === cleanCredential) {
        // Auto-migrate plaintext to salt+hash
        const salt = authService.generateSalt();
        activeUser.passwordSalt = salt;
        activeUser.password = await authService.hashCredential(cleanCredential, salt);
        const allUsers = this.getUsers();
        const idx = allUsers.findIndex((u) => u.id === activeUser.id);
        if (idx >= 0) allUsers[idx] = activeUser;
        this.set(STORAGE_KEYS.USERS, allUsers);
        return true;
      }

      // 2. Verify PIN
      if (activeUser.pinCode && activeUser.pinSalt) {
        const match = await authService.verifyCredential(cleanCredential, activeUser.pinCode, activeUser.pinSalt);
        if (match) return true;
      } else if (activeUser.pinCode && activeUser.pinCode === cleanCredential) {
        // Auto-migrate plaintext to salt+hash
        const salt = authService.generateSalt();
        activeUser.pinSalt = salt;
        activeUser.pinCode = await authService.hashCredential(cleanCredential, salt);
        const allUsers = this.getUsers();
        const idx = allUsers.findIndex((u) => u.id === activeUser.id);
        if (idx >= 0) allUsers[idx] = activeUser;
        this.set(STORAGE_KEYS.USERS, allUsers);
        return true;
      }

      return false;
    };

    // First attempt: Check local storage candidates
    const localCandidates = findCandidates(this.getUsers());
    for (const cand of localCandidates) {
      if (await verifyCandidate(cand)) {
        authService.clearFailedAttempts(rawInput);
        authService.createSession(cand);
        if (cand.businessId) {
          this.setCurrentBusiness(cand.businessId);
        }
        return cand;
      }
    }

    // Second attempt: If local check didn't match or local candidates pool was empty,
    // query Neon PostgreSQL live to fetch updated credentials or newly registered businesses
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const pullRes = await neonService.pullAllBusinessesAndUsers();
        if (pullRes.success && pullRes.users && pullRes.users.length > 0) {
          this.mergeCloudBusinessesAndUsers(pullRes.businesses || [], pullRes.users);
          const freshCandidates = findCandidates(this.getUsers());
          for (const cand of freshCandidates) {
            if (await verifyCandidate(cand)) {
              authService.clearFailedAttempts(rawInput);
              authService.createSession(cand);
              if (cand.businessId) {
                this.setCurrentBusiness(cand.businessId);
                // Also pull business-specific data immediately
                neonService.pullBusinessFromNeon(cand.businessId).then((res) => {
                  if (res.success && res.data) {
                    this.mergeCloudBusinessData(res.data);
                    this.notify();
                  }
                }).catch(() => {});
              }
              return cand;
            }
          }
        }
      } catch (e) {
        // network error fallback
      }
    }

    authService.recordFailedAttempt(rawInput);
    return null;
  }

  public async addUser(params: {
    name: string;
    username: string;
    role: Role;
    pinCode: string;
    password?: string;
    businessId?: string;
  }): Promise<User> {
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

    const pinSalt = authService.generateSalt();
    const pinHash = await authService.hashCredential(cleanPin, pinSalt);

    let passwordSalt: string | undefined;
    let passwordHash: string | undefined;
    if (cleanPassword) {
      passwordSalt = authService.generateSalt();
      passwordHash = await authService.hashCredential(cleanPassword, passwordSalt);
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      businessId: bizId,
      name: params.name.trim(),
      username: cleanUsername,
      role: params.role,
      pinCode: pinHash,
      pinSalt: pinSalt,
      password: passwordHash,
      passwordSalt: passwordSalt,
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

    // Immediate authoritative cloud persistence to Neon
    try {
      await this.uploadAllToNeon(bizId);
    } catch (neonErr) {
      console.warn('Neon push on addUser notice:', neonErr);
      this.triggerNeonSync();
    }

    this.notify();
    return newUser;
  }

  public async verifyUserCredential(userId: string, credentialInput: string): Promise<boolean> {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return false;
    const cleanCredential = credentialInput.trim();
    if (!cleanCredential) return false;

    // Check Password
    if (user.password && user.passwordSalt) {
      const match = await authService.verifyCredential(cleanCredential, user.password, user.passwordSalt);
      if (match) return true;
    } else if (user.password && user.password === cleanCredential) {
      return true;
    }

    // Check PIN
    if (user.pinCode && user.pinSalt) {
      const match = await authService.verifyCredential(cleanCredential, user.pinCode, user.pinSalt);
      if (match) return true;
    } else if (user.pinCode && user.pinCode === cleanCredential) {
      return true;
    }

    return false;
  }

  public async updateUser(userId: string, updates: Partial<User>): Promise<User> {
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
      const pinSalt = authService.generateSalt();
      user.pinSalt = pinSalt;
      user.pinCode = await authService.hashCredential(cleanPin, pinSalt);
    }
    if (updates.password !== undefined) {
      const cleanPassword = updates.password.trim();
      if (cleanPassword) {
        if (cleanPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const passwordSalt = authService.generateSalt();
        user.passwordSalt = passwordSalt;
        user.password = await authService.hashCredential(cleanPassword, passwordSalt);
      } else {
        user.password = undefined;
        user.passwordSalt = undefined;
      }
    }

    this.set(STORAGE_KEYS.USERS, users);

    // Immediate authoritative cloud persistence to Neon
    try {
      await this.uploadAllToNeon(user.businessId);
    } catch (neonErr) {
      console.warn('Neon push on updateUser notice:', neonErr);
      this.triggerNeonSync();
    }

    this.notify();
    return user;
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
    this.triggerNeonSync();
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
    this.triggerNeonSync();
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
    });

    map[bizId] = accounts;
    this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, map);
    this.triggerNeonSync();
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
    this.triggerNeonSync();
    return true;
  }

  public getInventory(): InventoryItem[] {
    const bizId = this.getCurrentBusinessId();
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    if (!inventoryMap[bizId]) {
      inventoryMap[bizId] = [];
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }
    return inventoryMap[bizId];
  }

  private saveCurrentInventory(inv: InventoryItem[]) {
    const bizId = this.getCurrentBusinessId();
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    inventoryMap[bizId] = inv;
    this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    this.triggerNeonSync();
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

  public getAllShiftStockItems(): ShiftStockItem[] {
    return this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
  }

  /**
   * Single canonical constructor for a ShiftStockItem row.
   * Every code path that needs to materialise a missing counter row must go
   * through here, otherwise the auto-heal path and the explicit-edit paths
   * drift apart on opening counts (the root cause of owner/worker desync).
   */
  private buildShiftStockItem(
    shiftId: string,
    product: Product,
    quantity: number,
    options?: { additions?: number; closingPhysicalCount?: number }
  ): ShiftStockItem {
    const qty = Number(quantity) || 0;
    return {
      id: `ssi-${shiftId}-${product.id}`,
      shiftId,
      productId: product.id,
      productName: product.name,
      unit: product.unit || 'BOTTLE',
      sellingPrice: product.sellingPrice || 0,
      openingSystemCount: qty,
      openingPhysicalCount: qty,
      openingVerified: true,
      additions: options?.additions !== undefined ? options.additions : 0,
      recordedSales: 0,
      transfersIn: 0,
      transfersOut: 0,
      damages: 0,
      closingPhysicalCount: options?.closingPhysicalCount,
      isMeasured: product.isMeasured,
      measurementType: product.measurementType,
      measureUnitLabel: product.measureUnitLabel,
      totalMeasuredValueKes: product.totalMeasuredValueKes,
    };
  }

  public getShiftStockItems(shiftId: string): ShiftStockItem[] {
    const items = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    let shiftItems = items.filter((i) => i.shiftId === shiftId);

    // Auto-heal active shift items from inventory and product catalog:
    // If an active shift is in progress and some products do not have SSIs yet
    // (e.g. freshly loaded on a new browser), populate them seamlessly from current inventory
    const active = this.getActiveShift();
    if (active && active.id === shiftId) {
      const products = this.getProducts();
      const inventory = this.getInventory();
      let modified = false;

      products.forEach((p) => {
        if (!shiftItems.some((si) => si.productId === p.id)) {
          const invItem = inventory.find((inv) => inv.productId === p.id);
          const initialQty = invItem ? Number(invItem.quantityOnHand || 0) : 0;
          const healedItem = this.buildShiftStockItem(shiftId, p, initialQty);
          shiftItems.push(healedItem);
          items.push(healedItem);
          modified = true;
        }
      });

      // Synchronize additions directly from persistent StockAddition records
      // Guarantees that any restock requested by attendant stays on the counter across refreshes
      const recordedAdditions = this.getStockAdditions(shiftId);
      shiftItems.forEach((si) => {
        const totalAdded = recordedAdditions
          .filter((a) => a.productId === si.productId)
          .reduce((sum, a) => sum + Number(a.quantity || 0), 0);
        if ((si.additions || 0) !== totalAdded) {
          si.additions = totalAdded;
          modified = true;
        }
      });

      if (modified) {
        this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, items);
      }
    }

    return shiftItems;
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

  // --- Shift Stock Item Row Editing (Single Unified Counter Sheet) ---
  public updateShiftStockItemRow(params: {
    shiftId: string;
    productId: string;
    openingPhysicalCount?: number;
    additions?: number;
    closingPhysicalCount?: number;
  }) {
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    let ssi = allSSIs.find(
      (item) => item.shiftId === params.shiftId && item.productId === params.productId
    );

    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) return;

    if (!ssi) {
      const inv = this.getInventory().find((i) => i.productId === params.productId);
      const openCount = params.openingPhysicalCount !== undefined
        ? params.openingPhysicalCount
        : (inv ? Number(inv.quantityOnHand || 0) : 0);
      ssi = this.buildShiftStockItem(params.shiftId, product, openCount, {
        additions: params.additions !== undefined ? params.additions : 0,
        closingPhysicalCount: params.closingPhysicalCount,
      });
      // Honour an explicitly supplied opening count even when the caller also
      // omitted/derived it from inventory.
      ssi.openingSystemCount = openCount;
      ssi.openingPhysicalCount =
        params.openingPhysicalCount !== undefined ? params.openingPhysicalCount : openCount;
      allSSIs.push(ssi);
    } else {
      if (params.openingPhysicalCount !== undefined) {
        ssi.openingPhysicalCount = Math.max(0, params.openingPhysicalCount);
      }
      if (params.additions !== undefined) {
        ssi.additions = Math.max(0, params.additions);
      }
      if (params.closingPhysicalCount !== undefined) {
        ssi.closingPhysicalCount = Math.max(0, params.closingPhysicalCount);
      }
    }

    const available = Number(ssi.openingPhysicalCount || 0) + Number(ssi.additions || 0) + Number(ssi.transfersIn || 0) - Number(ssi.transfersOut || 0) - Number(ssi.damages || 0);
    if (ssi.closingPhysicalCount !== undefined) {
      ssi.recordedSales = Math.round(Math.max(0, available - ssi.closingPhysicalCount) * 100) / 100;
    }

    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);

    // Keep inventory in sync
    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === params.productId);
    if (inv) {
      inv.quantityOnHand = ssi.closingPhysicalCount !== undefined ? ssi.closingPhysicalCount : available;
      inv.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
    }

    // Keep StockAdditionRecord in sync if additions were edited
    if (params.additions !== undefined) {
      const shift = this.getShiftById(params.shiftId);
      const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
      const recIdx = additions.findIndex((a) => a.shiftId === params.shiftId && a.productId === params.productId);
      if (params.additions > 0) {
        if (recIdx !== -1) {
          additions[recIdx].quantity = params.additions;
          additions[recIdx].timestamp = new Date().toISOString();
        } else {
          const newRecord: StockAdditionRecord = {
            id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            shiftId: params.shiftId,
            shiftNumber: shift ? shift.shiftNumber : 'ACTIVE',
            productId: params.productId,
            productName: product.name,
            quantity: params.additions,
            workerName: shift ? shift.workerName : 'Attendant',
            timestamp: new Date().toISOString(),
            status: 'PENDING_OWNER_CONFIRMATION',
            isImmutable: false,
          };
          additions.unshift(newRecord);
        }
      } else if (params.additions === 0 && recIdx !== -1) {
        additions.splice(recIdx, 1);
      }
      this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);
    }

    this.notify();
    this.triggerNeonSync();
  }

  public batchUpdateShiftStockItems(
    shiftId: string,
    updates: Record<string, { opening?: number; added?: number; closing?: number }>
  ) {
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const products = this.getProducts();
    const currentInventory = this.getInventory();
    const shift = this.getShiftById(shiftId);
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);

    Object.entries(updates).forEach(([productId, vals]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      let ssi = allSSIs.find((item) => item.shiftId === shiftId && item.productId === productId);
      const inv = currentInventory.find((i) => i.productId === productId);
      const defaultOpen = inv ? Number(inv.quantityOnHand || 0) : 0;

      if (!ssi) {
        const openVal = vals.opening !== undefined ? vals.opening : defaultOpen;
        ssi = this.buildShiftStockItem(shiftId, product, openVal, {
          additions: vals.added !== undefined ? vals.added : 0,
          closingPhysicalCount: vals.closing,
        });
        allSSIs.push(ssi);
      } else {
        if (vals.opening !== undefined) ssi.openingPhysicalCount = Math.max(0, vals.opening);
        if (vals.added !== undefined) ssi.additions = Math.max(0, vals.added);
        if (vals.closing !== undefined) ssi.closingPhysicalCount = Math.max(0, vals.closing);
      }

      const available = Number(ssi.openingPhysicalCount || 0) + Number(ssi.additions || 0) + Number(ssi.transfersIn || 0) - Number(ssi.transfersOut || 0) - Number(ssi.damages || 0);
      if (ssi.closingPhysicalCount !== undefined) {
        ssi.recordedSales = Math.round(Math.max(0, available - ssi.closingPhysicalCount) * 100) / 100;
      }

      if (inv) {
        inv.quantityOnHand = ssi.closingPhysicalCount !== undefined ? ssi.closingPhysicalCount : available;
        inv.updatedAt = new Date().toISOString();
      }

      if (vals.added !== undefined) {
        const recIdx = additions.findIndex((a) => a.shiftId === shiftId && a.productId === productId);
        if (vals.added > 0) {
          if (recIdx !== -1) {
            additions[recIdx].quantity = vals.added;
            additions[recIdx].timestamp = new Date().toISOString();
          } else {
            const rec: StockAdditionRecord = {
              id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              shiftId,
              shiftNumber: shift ? shift.shiftNumber : 'ACTIVE',
              productId,
              productName: product.name,
              quantity: vals.added,
              workerName: shift ? shift.workerName : 'Attendant',
              timestamp: new Date().toISOString(),
              status: 'PENDING_OWNER_CONFIRMATION',
              isImmutable: false,
            };
            additions.unshift(rec);
          }
        } else if (vals.added === 0 && recIdx !== -1) {
          additions.splice(recIdx, 1);
        }
      }
    });

    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    this.saveCurrentInventory(currentInventory);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);
    this.notify();
    this.triggerNeonSync();
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

        const isVal = product.isMeasured && (product.measurementType === 'VALUE' || product.unit === 'VALUE_KES');
        if (diff < 0) {
          // Shortage: previous attendant held accountable
          const shortageQty = Math.abs(diff);
          const moneyVal = isVal ? shortageQty : shortageQty * product.sellingPrice;
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
            severity: (isVal ? shortageQty >= 300 : shortageQty >= 3) ? 'HIGH' : 'MEDIUM',
            status: 'FLAGGED',
            ownerNotes: isVal
              ? `Opening handover shortage: KES ${shortageQty.toLocaleString()} value less than expected left by ${prevAttendant}. Reported by incoming attendant ${params.workerName}.`
              : `Opening handover shortage: ${shortageQty} bottle(s) fewer than expected left by ${prevAttendant}. Reported by incoming attendant ${params.workerName}.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Surplus: previous attendant credited to balance the scale!
          const surplusQty = diff;
          const moneyVal = isVal ? surplusQty : surplusQty * product.sellingPrice;
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
            ownerNotes: isVal
              ? `Opening handover surplus: +KES ${surplusQty.toLocaleString()} value found on shelf left by ${prevAttendant}. Credited to previous attendant to balance their scale fairly.`
              : `Opening handover surplus: +${surplusQty} extra bottle(s) found on shelf left by ${prevAttendant}. Credited to previous attendant to balance their scale fairly.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const item: ShiftStockItem = {
        id: `ssi-${shiftId}-${product.id}`,
        shiftId,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        sellingPrice: product.sellingPrice,
        openingSystemCount: systemCount,
        openingPhysicalCount: physicalCount,
        openingVerified: true,
        additions: 0,
        recordedSales: 0,
        transfersIn: 0,
        transfersOut: 0,
        damages: 0,
        isMeasured: product.isMeasured,
        measurementType: product.measurementType,
        measureUnitLabel: product.measureUnitLabel,
        totalMeasuredValueKes: product.totalMeasuredValueKes,
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
    this.triggerNeonSync();
    return newShift;
  }

  public recordStockAdjustment(params: {
    shiftId: string;
    productId: string;
    quantity: number;
    type?: 'ADD' | 'REDUCE';
    reason?: string;
    workerName?: string;
    source?: string;
    note?: string;
  }): StockAdditionRecord {
    this.queueOfflineOperation('recordStockAdjustment', params);

    const shift = this.getShiftById(params.shiftId);
    if (!shift) throw new Error('Shift not found.');
    const product = this.getProducts().find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found.');

    const isReduce = params.type === 'REDUCE' || Number(params.quantity) < 0;
    const rawQty = Math.abs(Number(params.quantity));
    if (rawQty <= 0) throw new Error('Quantity must be greater than 0.');
    const effectiveQty = isReduce ? -rawQty : rawQty;

    // Verify reduction does not make counter stock negative
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    let ssi = allSSIs.find(
      (item) => item.shiftId === params.shiftId && item.productId === params.productId
    );
    const currentInventory = this.getInventory();
    const invItem = currentInventory.find((i) => i.productId === params.productId);
    const openingCount = invItem ? Number(invItem.quantityOnHand || 0) : 0;

    if (!ssi) {
      ssi = this.buildShiftStockItem(params.shiftId, product, openingCount);
      allSSIs.push(ssi);
    }

    const currentCounterStock =
      Number(ssi.openingPhysicalCount || 0) +
      Number(ssi.additions || 0) +
      Number(ssi.transfersIn || 0) -
      Number(ssi.transfersOut || 0) -
      Number(ssi.damages || 0);

    if (isReduce && rawQty > currentCounterStock) {
      throw new Error(`Cannot reduce ${rawQty} ${product.unit.toLowerCase()}s. Current counter stock is only ${currentCounterStock}.`);
    }

    // Apply to SSI additions
    ssi.additions = (ssi.additions || 0) + effectiveQty;
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);

    // Apply to bar inventory
    if (invItem) {
      invItem.quantityOnHand = Math.max(0, invItem.quantityOnHand + effectiveQty);
      invItem.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
    }

    // Log movement
    const movements = this.get<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    movements.unshift({
      id: `mov-${Date.now()}`,
      shiftId: params.shiftId,
      productId: params.productId,
      productName: product.name,
      type: isReduce ? 'REDUCTION' : 'ADDITION',
      quantity: effectiveQty,
      unitPrice: product.sellingPrice,
      timestamp: new Date().toISOString(),
      note: isReduce
        ? `Reduced stock: -${rawQty} units (${params.reason || 'Returned / Recount'}).`
        : `Restocked stock: +${rawQty} units (${params.source || 'Central Storekeeper'}).`,
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
      quantity: effectiveQty,
      adjustmentType: isReduce ? 'REDUCE' : 'ADD',
      reason: params.reason || (isReduce ? 'Returned to Store / Recount' : 'Store Restock Delivery'),
      workerName,
      timestamp: new Date().toISOString(),
      status: 'PENDING_OWNER_CONFIRMATION',
      isImmutable: false,
    };
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    additions.unshift(additionRecord);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);

    // Ensure removed from deleted list if present
    const deletedIds = this.get<string[]>(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, []);
    if (deletedIds.includes(additionRecord.id)) {
      this.set(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, deletedIds.filter((id) => id !== additionRecord.id));
    }

    // Report directly to owner in events audit
    this.addEvent({
      type: 'ADDITION_RECORDED',
      title: isReduce ? `Stock Reduced: -${rawQty} ${product.name}` : `Stock Restock: +${rawQty} ${product.name}`,
      description: isReduce
        ? `${workerName} reduced -${rawQty}x ${product.name} on Shift #${shift.shiftNumber} (${params.reason || 'Returned to store'}). Awaiting owner verification & lock.`
        : `${workerName} restocked +${rawQty}x ${product.name} on Shift #${shift.shiftNumber}.${params.source ? ` Source: ${params.source}.` : ''} Awaiting owner verification & lock.`,
      actorName: workerName,
      severity: isReduce ? 'WARNING' : 'INFO',
    });

    this.notify();
    this.triggerNeonSync();
    return additionRecord;
  }

  public recordStockAddition(params: {
    shiftId: string;
    productId: string;
    quantity: number;
    workerName?: string;
    source?: string;
    note?: string;
  }): StockAdditionRecord {
    return this.recordStockAdjustment({
      ...params,
      type: 'ADD',
    });
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
      title: `Stock Adjustment Verified & Saved: ${record.quantity > 0 ? `+${record.quantity}` : record.quantity} ${record.productName}`,
      description: `Owner ${ownerName} confirmed and locked stock adjustment #${record.id}. Record is now permanently immutable.`,
      actorName: ownerName,
      severity: 'SUCCESS',
    });

    this.notify();
    this.triggerNeonSync();
    return true;
  }

  public deleteStockAddition(additionId: string): boolean {
    const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
    const record = additions.find((a) => a.id === additionId);
    if (!record) return false;

    // Check immutability!
    if (record.isImmutable || record.status === 'SAVED_LOCKED') {
      throw new Error('This stock adjustment has been verified and saved by the owner. It is immutable to deletion.');
    }

    // Revert bar inventory
    const currentInventory = this.getInventory();
    const inv = currentInventory.find((i) => i.productId === record.productId);
    if (inv) {
      inv.quantityOnHand = Math.max(0, inv.quantityOnHand - record.quantity);
      inv.updatedAt = new Date().toISOString();
      this.saveCurrentInventory(currentInventory);
    }

    // Revert SSI additions
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const ssi = allSSIs.find((item) => item.shiftId === record.shiftId && item.productId === record.productId);
    if (ssi) {
      ssi.additions = (ssi.additions || 0) - record.quantity;
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    // Remove from additions
    const remaining = additions.filter((a) => a.id !== additionId);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, remaining);

    // Track in deleted list so cloud sync never resurrects it
    const deletedIds = this.get<string[]>(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, []);
    if (!deletedIds.includes(additionId)) {
      deletedIds.push(additionId);
      this.set(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, deletedIds);
    }

    // Delete in Neon PostgreSQL database immediately
    neonService.deleteStockAddition(additionId).catch((err) => {
      console.warn('Neon deletion error:', err);
    });
    this.queueOfflineOperation('deleteStockAddition', { additionId });

    const isReduction = record.quantity < 0 || record.adjustmentType === 'REDUCE';
    this.addEvent({
      type: 'INFO',
      title: isReduction
        ? `Stock Reduction Undone: Restored +${Math.abs(record.quantity)} ${record.productName}`
        : `Stock Restock Undone: Reverted -${record.quantity} ${record.productName}`,
      description: `Pending ${isReduction ? 'reduction' : 'restock'} was undone before owner verification. Counter stock reverted.`,
      actorName: 'Counter Attendant',
      severity: 'INFO',
    });

    this.notify();
    this.triggerNeonSync();
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
    this.triggerNeonSync();
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

    const reconciledStockItems = shiftStockItems.map((item) => {
      const isValue =
        (item.isMeasured && item.measurementType === 'VALUE') ||
        item.unit === 'VALUE_KES';

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

      const calculatedSold = Math.round(Math.max(0, availableStock - physicalClosing) * 100) / 100;
      const overageCount = physicalClosing > availableStock ? Math.round((physicalClosing - availableStock) * 100) / 100 : 0;
      const discrepancyValue = isValue ? overageCount : overageCount * item.sellingPrice;

      if (isValue) {
        // Continuous/local drink measured by monetary value (e.g. Muratina left on counter)
        // calculatedSold is already the KES money value
        expectedSalesRevenue += calculatedSold;
      } else {
        // Discrete bottle count
        expectedSalesRevenue += calculatedSold * item.sellingPrice;
      }

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
      totalExpenses,
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
      description: `Reconciled by ${shift.workerName}. Net Money Returned: KES ${recon.totalIncomeReturned.toLocaleString()} | Expected Sales: KES ${recon.expectedSalesRevenue.toLocaleString()}`,
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
    this.triggerNeonSync();
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
      this.triggerNeonSync();
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
    this.triggerNeonSync();
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

  public updateProductPricing(productId: string, sellingPrice: number) {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    if (!product.businessId) {
      product.businessId = this.getCurrentBusinessId();
    }

    product.sellingPrice = sellingPrice;
    if (product.isMeasured) {
      product.totalMeasuredValueKes = sellingPrice;
    }
    this.set(STORAGE_KEYS.PRODUCTS, allProducts);

    this.addEvent({
      type: 'INFO',
      title: `Price Updated: ${product.name}`,
      description: `Selling Price: KES ${sellingPrice.toLocaleString()}`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    this.triggerNeonSync();
    this.uploadAllToNeon().catch((e) => console.warn('Instant neon sync notice:', e));
  }

  public adjustProductStock(productId: string, newQuantity: number): boolean {
    const cleanQty = Math.max(0, Number(newQuantity) || 0);
    const inv = this.getInventory();
    const item = inv.find((i) => i.productId === productId);
    const prevQty = item ? item.quantityOnHand : 0;
    const delta = cleanQty - prevQty;
    const bizId = this.getCurrentBusinessId();

    if (item) {
      item.quantityOnHand = cleanQty;
      item.updatedAt = new Date().toISOString();
      if (!item.id) item.id = `${bizId}-${productId}`;
    } else {
      inv.push({
        id: `${bizId}-${productId}`,
        productId,
        quantityOnHand: cleanQty,
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveCurrentInventory(inv);

    // If an active shift exists and stock changed, keep the shift ledger in balance.
    // The SSI row is materialised on demand (mirroring getShiftStockItems' heal
    // logic) so an owner adjustment can never be dropped just because the counter
    // row had not been created yet on this device/browser.
    const activeShift = this.getActiveShift();
    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    const productName = product ? product.name : 'Drink';

    if (activeShift && product && delta !== 0) {
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      let ssi = allSSIs.find(
        (s) => s.shiftId === activeShift.id && s.productId === productId
      );

      if (!ssi) {
        // Heal: create the counter row from current inventory, then apply delta below.
        ssi = this.buildShiftStockItem(activeShift.id, product, prevQty, {
          additions: delta > 0 ? delta : 0,
        });
        if (delta < 0) {
          ssi.openingPhysicalCount = Math.max(0, prevQty + delta);
        }
        allSSIs.push(ssi);
      } else if (delta > 0) {
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

    this.addEvent({
      type: 'INFO',
      title: `Stock Count Adjusted: ${productName}`,
      description: `Stock adjusted from ${prevQty} to ${cleanQty} (${delta >= 0 ? `+${delta}` : delta}) by Owner`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    // Mark a mutation as pending and push synchronously *before* the periodic
    // syncWithCloud pull can run, otherwise the 3.5s poll could immediately
    // re-merge a stale cloud inventory row over the value we just wrote.
    this.pendingAutoSync = true;
    this.uploadAllToNeon()
      .catch((e) => console.warn('Instant neon sync notice:', e))
      .finally(() => {
        this.pendingAutoSync = false;
      });

    this.notify();
    return true;
  }

  public addProduct(params: {
    name: string;
    category: import('../types').ProductCategory;
    unit: import('../types').ProductUnit;
    sellingPrice: number;
    reorderLevel?: number;
    volumeMl?: number;
    initialStock?: number;
    businessId?: string;
    isMeasured?: boolean;
    measurementType?: import('../types').MeasurementType;
    measureUnitLabel?: string;
    totalMeasuredValueKes?: number;
  }): Product {
    const currentBizId = params.businessId || this.getCurrentBusinessId();
    const products = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      businessId: currentBizId,
      name: params.name.trim(),
      category: params.category,
      unit: params.unit,
      sellingPrice: Number(params.sellingPrice) || 0,
      reorderLevel: Number(params.reorderLevel) || 5,
      volumeMl: params.volumeMl ? Number(params.volumeMl) : undefined,
      isArchived: false,
      isMeasured: Boolean(params.isMeasured),
      measurementType: params.measurementType || (params.isMeasured ? 'VALUE' : 'COUNT'),
      measureUnitLabel: params.measureUnitLabel,
      totalMeasuredValueKes: params.totalMeasuredValueKes ? Number(params.totalMeasuredValueKes) : undefined,
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
        openingSystemCount: 0,
        openingPhysicalCount: 0,
        openingVerified: true,
        additions: initialQty,
        recordedSales: 0,
        transfersIn: 0,
        transfersOut: 0,
        damages: 0,
        isMeasured: newProduct.isMeasured,
        measurementType: newProduct.measurementType,
        measureUnitLabel: newProduct.measureUnitLabel,
        totalMeasuredValueKes: newProduct.totalMeasuredValueKes,
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
      const rawStock = parts[4] ? parseFloat(parts[4].replace(/[^0-9.]/g, '')) : undefined;

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
      const stock = rawStock !== undefined && !isNaN(rawStock) ? rawStock : defaultStock;

      return {
        name: rawName,
        sellingPrice,
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

      const newProduct: Product = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        businessId: currentBizId,
        name: cleanName,
        category: item.category || 'BEER',
        unit: item.unit || 'BOTTLE',
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
    // No mock data loaded. Empty catalog by default.
    this.notify();
  }

  public updateProduct(productId: string, updates: Partial<Product>): Product | null {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return null;

    if (!product.businessId) {
      product.businessId = this.getCurrentBusinessId();
    }

    Object.assign(product, updates);
    if (product.isMeasured && updates.sellingPrice !== undefined && updates.totalMeasuredValueKes === undefined) {
      product.totalMeasuredValueKes = updates.sellingPrice;
    }
    this.set(STORAGE_KEYS.PRODUCTS, allProducts);

    this.addEvent({
      type: 'INFO',
      title: `Catalog Updated: ${product.name}`,
      description: `Selling Price: KES ${product.sellingPrice}`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    this.triggerNeonSync();
    this.uploadAllToNeon().catch((e) => console.warn('Instant neon sync notice:', e));
    return product;
  }

  public deleteProduct(productId: string, permanent = false): boolean {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return false;

    if (permanent) {
      const filtered = allProducts.filter((p) => p.id !== productId);
      this.set(STORAGE_KEYS.PRODUCTS, filtered);
    } else {
      product.isArchived = true;
      this.set(STORAGE_KEYS.PRODUCTS, allProducts);
    }

    this.addEvent({
      type: 'INFO',
      title: `${permanent ? 'Drink Deleted' : 'Drink Archived'}: ${product.name}`,
      description: `${product.name} removed from active catalog shelves`,
      actorName: 'Owner Audit Desk',
      severity: 'WARNING',
    });

    this.notify();
    this.triggerNeonSync();
    return true;
  }

  public restoreProduct(productId: string): boolean {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return false;

    product.isArchived = false;
    this.set(STORAGE_KEYS.PRODUCTS, allProducts);

    this.addEvent({
      type: 'INFO',
      title: `Drink Restored: ${product.name}`,
      description: `${product.name} restored to active catalog shelves`,
      actorName: 'Owner Audit Desk',
      severity: 'SUCCESS',
    });

    this.notify();
    this.triggerNeonSync();
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

  public async uploadAllToNeon(targetBizId?: string) {
    const bizId = targetBizId || this.getCurrentBusinessId();
    const businesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const business = businesses.find((b) => b.id === bizId) || this.getCurrentBusiness();
    if (!business || !business.id) {
      return { success: false, message: 'No active business selected to sync.' };
    }
    const targetId = business.id;
    return neonService.syncPayloadToNeon({
      business,
      users: this.getUsers().filter((u) => !u.businessId || u.businessId === targetId),
      products: this.getProducts(true, targetId),
      inventory: this.getInventory(),
      shifts: this.getShifts(),
      expenses: this.getExpenses(),
      mpesaAccounts: this.getMpesaAccounts(true),
      events: this.getEvents(40, targetId),
      stockAdditions: this.getStockAdditions(),
      deletedStockAdditionIds: this.get<string[]>(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, []),
      discrepancies: this.getDiscrepancies(),
      interTransfers: this.getInterBusinessTransfers(),
      partners: this.getPartners(),
      shiftStockItems: this.getAllShiftStockItems(),
    });
  }

  private mergeCloudBusinessesAndUsers(cloudBizs: BusinessProfile[], cloudUsers: User[]) {
    const localBizs = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const bizMap = new Map<string, BusinessProfile>();
    localBizs.forEach((b) => bizMap.set(b.id, b));
    cloudBizs.forEach((b) => {
      if (!bizMap.has(b.id)) {
        bizMap.set(b.id, b);
      } else {
        const existing = bizMap.get(b.id)!;
        bizMap.set(b.id, { ...existing, ...b });
      }
    });
    this.set(STORAGE_KEYS.BUSINESSES, Array.from(bizMap.values()));

    const localUsers = this.get<User[]>(STORAGE_KEYS.USERS, []);
    const userMap = new Map<string, User>();
    localUsers.forEach((u) => userMap.set(u.id, u));
    cloudUsers.forEach((u) => {
      if (!userMap.has(u.id)) {
        userMap.set(u.id, u);
      } else {
        const existing = userMap.get(u.id)!;
        userMap.set(u.id, { ...existing, ...u });
      }
    });
    this.set(STORAGE_KEYS.USERS, Array.from(userMap.values()));
  }

  private mergeCloudBusinessData(data: PullResult) {
    if (!data.business) return;
    const bizId = data.business.id;

    // 1. Authoritative Merge for Products
    // Only rows belonging to the business being merged are considered, so a
    // multi-establishment database cannot leak foreign catalog entries into
    // this business's product list (which then desyncs its inventory rows).
    if (data.products && data.products.length > 0) {
      // (ownership filter applied below)
      const bizProducts = data.products.filter(
        (cp) => !cp.businessId || cp.businessId === bizId
      );
      const cloudIds = new Set(bizProducts.map((cp) => cp.id));
      const localProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
      const mergedMap = new Map<string, Product>();
      bizProducts.forEach((cp) => mergedMap.set(cp.id, cp));
      localProducts.forEach((lp) => {
        const belongsHere = !lp.businessId || lp.businessId === bizId;
        if (belongsHere && !mergedMap.has(lp.id) && !cloudIds.has(lp.id)) {
          mergedMap.set(lp.id, lp);
        }
      });
      // Preserve products owned by other businesses untouched.
      localProducts.forEach((lp) => {
        if (lp.businessId && lp.businessId !== bizId) {
          mergedMap.set(lp.id, lp);
        }
      });
      this.set(STORAGE_KEYS.PRODUCTS, Array.from(mergedMap.values()));
    }

    // 2. Authoritative Merge for Shifts (Includes Active Attendant Shifts)
    if (data.shifts && data.shifts.length > 0) {
      const shiftMap = this.get<Record<string, Shift[]>>(STORAGE_KEYS.SHIFTS_MAP, {});
      shiftMap[bizId] = data.shifts;
      this.set(STORAGE_KEYS.SHIFTS_MAP, shiftMap);
    }

    // 3. Authoritative Merge for Inventory (Cloud is the source of truth)
    // The cloud row wins for quantityOnHand. A local row is only preserved when
    // there is no cloud counterpart at all, or when a local mutation is still
    // pending upload (otherwise a stale higher local count would silently
    // overwrite a remote owner adjustment).
    if (data.inventory && data.inventory.length > 0) {
      const invMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
      const localInv = invMap[bizId] || [];
      const localMap = new Map<string, InventoryItem>();
      localInv.forEach((i) => localMap.set(i.productId, i));
      const localMutationPending = this.pendingAutoSync || this.getOfflineQueueCount() > 0;

      // Restrict the merge to products that actually belong to this business,
      // so foreign inventory rows cannot be pulled in alongside foreign catalog rows.
      const businessProductIds = new Set(
        this.get<Product[]>(STORAGE_KEYS.PRODUCTS, [])
          .filter((p) => !p.businessId || p.businessId === bizId)
          .map((p) => p.id)
      );
      const cloudInventory = data.inventory.filter(
        (ci) => businessProductIds.has(ci.productId)
      );

      const mergedInv = cloudInventory.map((ci) => {
        const li = localMap.get(ci.productId);
        if (li && localMutationPending) {
          return li;
        }
        return ci;
      });
      localInv.forEach((li) => {
        if (!mergedInv.some((m) => m.productId === li.productId)) {
          mergedInv.push(li);
        }
      });
      invMap[bizId] = mergedInv;
      this.set(STORAGE_KEYS.INVENTORY_MAP, invMap);
    }

    // 4. Authoritative Merge for Shift Stock Items (Cloud wins unless a local
    // mutation is still pending upload). Records are matched by their
    // shiftId/productId identity so the cloud opening count is not frozen out.
    if (data.shiftStockItems && data.shiftStockItems.length > 0) {
      const localSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      const localMap = new Map<string, ShiftStockItem>();
      localSSIs.forEach((i) => localMap.set(`${i.shiftId}-${i.productId}`, i));
      const localMutationPending = this.pendingAutoSync || this.getOfflineQueueCount() > 0;

      const mergedSSIs = data.shiftStockItems.map((ci) => {
        const li = localMap.get(`${ci.shiftId}-${ci.productId}`);
        if (li && localMutationPending) {
          return li;
        }
        return ci;
      });
      localSSIs.forEach((li) => {
        if (!mergedSSIs.some((m) => m.shiftId === li.shiftId && m.productId === li.productId)) {
          mergedSSIs.push(li);
        }
      });
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, mergedSSIs);
    }

    // 5. Authoritative Merge for Shift Expenses
    if (data.expenses && data.expenses.length > 0) {
      const localExpenses = this.get<Expense[]>(STORAGE_KEYS.EXPENSES, []);
      const expMap = new Map<string, Expense>();
      localExpenses.forEach((e) => expMap.set(e.id, e));
      data.expenses.forEach((e) => expMap.set(e.id, e));
      this.set(STORAGE_KEYS.EXPENSES, Array.from(expMap.values()));
    }

    // 6. Authoritative Merge for Stock Restock Additions & Reductions
    if (data.stockAdditions && data.stockAdditions.length > 0) {
      const deletedIds = new Set(this.get<string[]>(STORAGE_KEYS.DELETED_STOCK_ADDITIONS, []));
      const localAdditions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
      const addMap = new Map<string, StockAdditionRecord>();
      localAdditions.forEach((a) => {
        if (!deletedIds.has(a.id)) addMap.set(a.id, a);
      });
      data.stockAdditions.forEach((a) => {
        if (!deletedIds.has(a.id)) addMap.set(a.id, a);
      });
      this.set(STORAGE_KEYS.STOCK_ADDITIONS, Array.from(addMap.values()));
    }

    // 7. Authoritative Merge for Discrepancies
    if (data.discrepancies && data.discrepancies.length > 0) {
      const localDiscs = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
      const discMap = new Map<string, Discrepancy>();
      localDiscs.forEach((d) => discMap.set(d.id, d));
      data.discrepancies.forEach((d) => discMap.set(d.id, d));
      this.set(STORAGE_KEYS.DISCREPANCIES, Array.from(discMap.values()));
    }

    // 8. Authoritative Merge for Inter-Business Transfers
    if (data.interTransfers && data.interTransfers.length > 0) {
      const localTrans = this.get<InterBusinessTransfer[]>(STORAGE_KEYS.INTER_TRANSFERS, []);
      const trMap = new Map<string, InterBusinessTransfer>();
      localTrans.forEach((t) => trMap.set(t.id, t));
      data.interTransfers.forEach((t) => trMap.set(t.id, t));
      this.set(STORAGE_KEYS.INTER_TRANSFERS, Array.from(trMap.values()));
    }

    // 9. Authoritative Merge for Business Partners
    if (data.partners && data.partners.length > 0) {
      const localPartners = this.get<BusinessPartner[]>(STORAGE_KEYS.PARTNERS, []);
      const pMap = new Map<string, BusinessPartner>();
      localPartners.forEach((p) => pMap.set(p.partnerBusinessId, p));
      data.partners.forEach((p) => pMap.set(p.partnerBusinessId, p));
      this.set(STORAGE_KEYS.PARTNERS, Array.from(pMap.values()));
    }

    // 10. Authoritative Merge for Operational Events
    if (data.events && data.events.length > 0) {
      const eventsMap = this.get<Record<string, OperationalEvent[]>>(STORAGE_KEYS.EVENTS_MAP, {});
      const existing = eventsMap[bizId] || [];
      const evMap = new Map<string, OperationalEvent>();
      existing.forEach((e) => evMap.set(e.id, e));
      data.events.forEach((e) => evMap.set(e.id, e));
      eventsMap[bizId] = Array.from(evMap.values()).slice(0, 100);
      this.set(STORAGE_KEYS.EVENTS_MAP, eventsMap);
    }

    // 11. Authoritative Merge for M-Pesa Accounts
    if (data.mpesaAccounts && data.mpesaAccounts.length > 0) {
      const mpesaMap = this.get<Record<string, MpesaAccount[]>>(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {});
      mpesaMap[bizId] = data.mpesaAccounts;
      this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, mpesaMap);
    }
  }
}

export const store = new StoreService();
