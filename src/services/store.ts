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
import { authService } from './auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';

const FIRESTORE_COLLECTIONS = {
  BUSINESSES: 'businesses',
  USERS: 'users',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  SHIFTS: 'shifts',
  SHIFT_STOCK_ITEMS: 'shiftStockItems',
  STOCK_ADDITIONS: 'stockAdditions',
  EXPENSES: 'expenses',
  DISCREPANCIES: 'discrepancies',
  EVENTS: 'events',
  MPESA_ACCOUNTS: 'mpesaAccounts',
  INTER_TRANSFERS: 'interTransfers',
};

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
  DELETED_PRODUCT_IDS: 'bar_track_deleted_product_ids',
  HANDOVER_DRAFTS: 'bar_track_handover_drafts',
  DISCREPANCIES: 'bar_track_discrepancies',
  EVENTS_MAP: 'bar_track_events_map',
  MPESA_TXNS: 'bar_track_mpesa_txns',
  OFFLINE_QUEUE: 'bar_track_offline_queue',
  IS_ONLINE: 'bar_track_is_online',
};

class StoreService {
  private memoryStore = new Map<string, unknown>();
  private subscribers: (() => void)[] = [];
  private liveChannel: BroadcastChannel | null = null;

  private onlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncTimestamp: string | null = null;
  private isCurrentlySyncing: boolean = false;

  private isRemoteMutating: boolean = false;
  private firestoreListenersInitialized: boolean = false;

  constructor() {
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

      window.addEventListener('online', () => {
        this.onlineStatus = true;
        this.set(STORAGE_KEYS.IS_ONLINE, true, false);
        this.syncWithCloud();
        this.notify();
      });

      window.addEventListener('offline', () => {
        this.onlineStatus = false;
        this.set(STORAGE_KEYS.IS_ONLINE, false, false);
        this.notify();
      });
    }

    this.loadFromStorage();
    this.initFirestoreSync();
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
  }

  private get<T>(key: string, defaultValue: T): T {
    if (this.memoryStore.has(key)) {
      return (this.memoryStore.get(key) as T) ?? defaultValue;
    }
    if (typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) {
          const parsed = JSON.parse(item) as T;
          this.memoryStore.set(key, parsed);
          return parsed ?? defaultValue;
        }
      } catch {
        // fallback
      }
    }
    return defaultValue;
  }

  private set(key: string, value: unknown, syncToCloud: boolean = true) {
    this.memoryStore.set(key, value);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage quota fallback
      }
    }
    if (syncToCloud && !this.isRemoteMutating) {
      this.dispatchFirestoreSync(key, value);
    }
  }

  private loadFromStorage() {
    this.memoryStore.clear();
    // Preload all critical storage keys from persistent localStorage
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (typeof window !== 'undefined') {
        try {
          const val = localStorage.getItem(k);
          if (val !== null) {
            this.memoryStore.set(k, JSON.parse(val));
          }
        } catch {
          // ignore
        }
      }
    });

    // Ensure defaults exist for arrays and maps without overwriting cloud
    if (!this.memoryStore.has(STORAGE_KEYS.BUSINESSES)) this.set(STORAGE_KEYS.BUSINESSES, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.USERS)) this.set(STORAGE_KEYS.USERS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.PRODUCTS)) this.set(STORAGE_KEYS.PRODUCTS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.INVENTORY_MAP)) this.set(STORAGE_KEYS.INVENTORY_MAP, {}, false);
    if (!this.memoryStore.has(STORAGE_KEYS.SHIFTS_MAP)) this.set(STORAGE_KEYS.SHIFTS_MAP, {}, false);
    if (!this.memoryStore.has(STORAGE_KEYS.EXPENSES)) this.set(STORAGE_KEYS.EXPENSES, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.PARTNERS)) this.set(STORAGE_KEYS.PARTNERS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.INTER_TRANSFERS)) this.set(STORAGE_KEYS.INTER_TRANSFERS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.MPESA_ACCOUNTS_MAP)) this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, {}, false);
    if (!this.memoryStore.has(STORAGE_KEYS.EVENTS_MAP)) this.set(STORAGE_KEYS.EVENTS_MAP, {}, false);
    if (!this.memoryStore.has(STORAGE_KEYS.DISCREPANCIES)) this.set(STORAGE_KEYS.DISCREPANCIES, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.STOCK_ADDITIONS)) this.set(STORAGE_KEYS.STOCK_ADDITIONS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.CURRENT_BIZ_ID)) this.set(STORAGE_KEYS.CURRENT_BIZ_ID, '', false);
    if (!this.memoryStore.has(STORAGE_KEYS.SHIFT_STOCK_ITEMS)) this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.STOCK_MOVEMENTS)) this.set(STORAGE_KEYS.STOCK_MOVEMENTS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.HANDOVER_DRAFTS)) this.set(STORAGE_KEYS.HANDOVER_DRAFTS, [], false);
    if (!this.memoryStore.has(STORAGE_KEYS.OFFLINE_QUEUE)) this.set(STORAGE_KEYS.OFFLINE_QUEUE, [], false);
  }

  public purgeAllData(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // ignore
      }
    }
    this.loadFromStorage();
    authService.destroySession();
    this.notify();
  }

  public isOnline(): boolean {
    const forced = this.get<boolean | null>(STORAGE_KEYS.IS_ONLINE, null);
    if (forced !== null && forced !== undefined) return forced;
    return typeof navigator !== 'undefined' ? navigator.onLine : this.onlineStatus;
  }

  public toggleOnlineStatus(): boolean {
    const next = !this.isOnline();
    this.set(STORAGE_KEYS.IS_ONLINE, next);
    if (next) {
      this.syncWithCloud();
    }
    this.notify();
    return next;
  }

  public getPendingSyncCount(): number {
    const queue = this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
    return queue.length;
  }

  public getOfflineQueueCount(): number {
    return this.getPendingSyncCount();
  }

  public getLastAutoSyncTime(): string | null {
    return this.lastSyncTimestamp;
  }

  public hasPendingCloudSync(): boolean {
    return this.getPendingSyncCount() > 0;
  }

  public isCloudSyncing(): boolean {
    return this.isCurrentlySyncing;
  }

  public queueOfflineOperation(operationName: string, payload: unknown) {
    const queue = this.get<unknown[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
    queue.push({
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      operationName,
      payload,
      queuedAt: new Date().toISOString(),
    });
    this.set(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }

  public enqueueOfflineAction(actionType: string, payload: unknown): void {
    this.queueOfflineOperation(actionType, payload);
  }

  public async saveToFirestore(collectionName: string, docId: string, data: unknown): Promise<void> {
    if (!docId || !db) return;
    const cleanId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const cleanData = JSON.parse(JSON.stringify(data));
      await setDoc(doc(db, collectionName, cleanId), cleanData, { merge: true });
    } catch (error) {
      console.warn(`Firestore save error for ${collectionName}/${cleanId}:`, error);
      this.queueOfflineOperation(`SAVE_${collectionName}`, { docId: cleanId, data });
    }
  }

  public async deleteFromFirestore(collectionName: string, docId: string): Promise<void> {
    if (!docId || !db) return;
    const cleanId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await deleteDoc(doc(db, collectionName, cleanId));
    } catch (error) {
      console.warn(`Firestore delete error for ${collectionName}/${cleanId}:`, error);
      this.queueOfflineOperation(`DELETE_${collectionName}`, { docId: cleanId });
    }
  }

  private dispatchFirestoreSync(key: string, value: unknown) {
    if (this.isRemoteMutating || !db) return;

    try {
      if (key === STORAGE_KEYS.BUSINESSES && Array.isArray(value)) {
        (value as BusinessProfile[]).forEach((b) => {
          if (b && b.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.BUSINESSES, b.id, b);
        });
      } else if (key === STORAGE_KEYS.USERS && Array.isArray(value)) {
        (value as User[]).forEach((u) => {
          if (u && u.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.USERS, u.id, u);
        });
      } else if (key === STORAGE_KEYS.PRODUCTS && Array.isArray(value)) {
        (value as Product[]).forEach((p) => {
          if (p && p.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.PRODUCTS, p.id, p);
        });
      } else if (key === STORAGE_KEYS.INVENTORY_MAP && value && typeof value === 'object') {
        const invMap = value as Record<string, InventoryItem[]>;
        Object.entries(invMap).forEach(([bizId, items]) => {
          if (Array.isArray(items)) {
            items.forEach((item) => {
              const id = item.id || `inv-${bizId}-${item.productId}`;
              this.saveToFirestore(FIRESTORE_COLLECTIONS.INVENTORY, id, { ...item, id, businessId: bizId });
            });
          }
        });
      } else if (key === STORAGE_KEYS.SHIFTS_MAP && value && typeof value === 'object') {
        const sMap = value as Record<string, Shift[]>;
        Object.entries(sMap).forEach(([bizId, shifts]) => {
          if (Array.isArray(shifts)) {
            shifts.forEach((s) => {
              if (s && s.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.SHIFTS, s.id, { ...s, businessId: bizId });
            });
          }
        });
      } else if (key === STORAGE_KEYS.SHIFT_STOCK_ITEMS && Array.isArray(value)) {
        (value as ShiftStockItem[]).forEach((item) => {
          if (item && item.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.SHIFT_STOCK_ITEMS, item.id, item);
        });
      } else if (key === STORAGE_KEYS.STOCK_ADDITIONS && Array.isArray(value)) {
        (value as StockAdditionRecord[]).forEach((a) => {
          if (a && a.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.STOCK_ADDITIONS, a.id, a);
        });
      } else if (key === STORAGE_KEYS.EXPENSES && Array.isArray(value)) {
        (value as Expense[]).forEach((e) => {
          if (e && e.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.EXPENSES, e.id, e);
        });
      } else if (key === STORAGE_KEYS.DISCREPANCIES && Array.isArray(value)) {
        (value as Discrepancy[]).forEach((d) => {
          if (d && d.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.DISCREPANCIES, d.id, d);
        });
      } else if (key === STORAGE_KEYS.EVENTS_MAP && value && typeof value === 'object') {
        const eMap = value as Record<string, OperationalEvent[]>;
        Object.entries(eMap).forEach(([bizId, events]) => {
          if (Array.isArray(events)) {
            events.forEach((ev) => {
              if (ev && ev.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.EVENTS, ev.id, { ...ev, businessId: bizId });
            });
          }
        });
      } else if (key === STORAGE_KEYS.MPESA_ACCOUNTS_MAP && value && typeof value === 'object') {
        const mMap = value as Record<string, MpesaAccount[]>;
        Object.entries(mMap).forEach(([bizId, accs]) => {
          if (Array.isArray(accs)) {
            accs.forEach((acc) => {
              if (acc && acc.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.MPESA_ACCOUNTS, acc.id, { ...acc, businessId: bizId });
            });
          }
        });
      } else if (key === STORAGE_KEYS.INTER_TRANSFERS && Array.isArray(value)) {
        (value as InterBusinessTransfer[]).forEach((t) => {
          if (t && t.id) this.saveToFirestore(FIRESTORE_COLLECTIONS.INTER_TRANSFERS, t.id, t);
        });
      }
    } catch (e) {
      console.warn('Error dispatching Firestore sync for', key, e);
    }
  }

  public async fetchCoreFirestoreEntities(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const bizSnap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.BUSINESSES));
      if (!bizSnap.empty) {
        const bizs = bizSnap.docs.map((d) => d.data() as BusinessProfile);
        this.isRemoteMutating = true;
        this.set(STORAGE_KEYS.BUSINESSES, bizs, false);
        this.isRemoteMutating = false;
      } else {
        // If Firestore has no businesses yet, upload any local ones
        const localBiz = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
        if (localBiz.length > 0) {
          localBiz.forEach((b) => this.saveToFirestore(FIRESTORE_COLLECTIONS.BUSINESSES, b.id, b));
        }
      }

      const userSnap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.USERS));
      if (!userSnap.empty) {
        const users = userSnap.docs.map((d) => d.data() as User);
        this.isRemoteMutating = true;
        this.set(STORAGE_KEYS.USERS, users, false);
        this.isRemoteMutating = false;
      } else {
        const localUsers = this.get<User[]>(STORAGE_KEYS.USERS, []);
        if (localUsers.length > 0) {
          localUsers.forEach((u) => this.saveToFirestore(FIRESTORE_COLLECTIONS.USERS, u.id, u));
        }
      }

      this.notifySubscribersOnly();
    } catch (err) {
      console.debug('Core Firestore fetch note:', err);
    }
  }

  private migrateCollectionToFirestore(key: string, coll: string) {
    const local = this.get<unknown[]>(key, []);
    if (Array.isArray(local) && local.length > 0) {
      local.forEach((item: any) => {
        if (item && item.id) {
          this.saveToFirestore(coll, item.id, item);
        }
      });
    }
  }

  public initFirestoreSync(): void {
    if (this.firestoreListenersInitialized || typeof window === 'undefined') return;
    this.firestoreListenersInitialized = true;

    // 1. Initial eager fetch of businesses and users for instant availability
    this.fetchCoreFirestoreEntities();

    // 2. Setup real-time onSnapshot listeners on all collections with handleFirestoreError callbacks
    const arrayCollections = [
      { key: STORAGE_KEYS.BUSINESSES, coll: FIRESTORE_COLLECTIONS.BUSINESSES },
      { key: STORAGE_KEYS.USERS, coll: FIRESTORE_COLLECTIONS.USERS },
      { key: STORAGE_KEYS.PRODUCTS, coll: FIRESTORE_COLLECTIONS.PRODUCTS },
      { key: STORAGE_KEYS.SHIFT_STOCK_ITEMS, coll: FIRESTORE_COLLECTIONS.SHIFT_STOCK_ITEMS },
      { key: STORAGE_KEYS.STOCK_ADDITIONS, coll: FIRESTORE_COLLECTIONS.STOCK_ADDITIONS },
      { key: STORAGE_KEYS.EXPENSES, coll: FIRESTORE_COLLECTIONS.EXPENSES },
      { key: STORAGE_KEYS.DISCREPANCIES, coll: FIRESTORE_COLLECTIONS.DISCREPANCIES },
      { key: STORAGE_KEYS.INTER_TRANSFERS, coll: FIRESTORE_COLLECTIONS.INTER_TRANSFERS },
    ];

    arrayCollections.forEach(({ key, coll }) => {
      onSnapshot(
        collection(db, coll),
        (snapshot) => {
          if (snapshot.empty) {
            this.migrateCollectionToFirestore(key, coll);
            return;
          }
          const docs = snapshot.docs.map((d) => d.data());
          if (docs.length > 0) {
            this.isRemoteMutating = true;
            this.set(key, docs, false);
            this.isRemoteMutating = false;
            this.notifySubscribersOnly();
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, coll);
        }
      );
    });

    // Listen to Inventory Map
    onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.INVENTORY),
      (snapshot) => {
        if (snapshot.empty) return;
        const items = snapshot.docs.map((d) => d.data() as InventoryItem & { businessId?: string });
        if (items.length > 0) {
          const invMap: Record<string, InventoryItem[]> = {};
          items.forEach((item) => {
            const bId = item.businessId || 'default';
            if (!invMap[bId]) invMap[bId] = [];
            invMap[bId].push(item);
          });
          this.isRemoteMutating = true;
          this.set(STORAGE_KEYS.INVENTORY_MAP, invMap, false);
          this.isRemoteMutating = false;
          this.notifySubscribersOnly();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, FIRESTORE_COLLECTIONS.INVENTORY);
      }
    );

    // Listen to Shifts Map
    onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.SHIFTS),
      (snapshot) => {
        if (snapshot.empty) return;
        const shifts = snapshot.docs.map((d) => d.data() as Shift & { businessId?: string });
        if (shifts.length > 0) {
          const sMap: Record<string, Shift[]> = {};
          shifts.forEach((s) => {
            const bId = (s as any).businessId || 'default';
            if (!sMap[bId]) sMap[bId] = [];
            sMap[bId].push(s);
          });
          this.isRemoteMutating = true;
          this.set(STORAGE_KEYS.SHIFTS_MAP, sMap, false);
          this.isRemoteMutating = false;
          this.notifySubscribersOnly();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, FIRESTORE_COLLECTIONS.SHIFTS);
      }
    );

    // Listen to Events Map
    onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.EVENTS),
      (snapshot) => {
        if (snapshot.empty) return;
        const events = snapshot.docs.map((d) => d.data() as OperationalEvent & { businessId?: string });
        if (events.length > 0) {
          const eMap: Record<string, OperationalEvent[]> = {};
          events.forEach((ev) => {
            const bId = ev.businessId || 'default';
            if (!eMap[bId]) eMap[bId] = [];
            eMap[bId].push(ev);
          });
          this.isRemoteMutating = true;
          this.set(STORAGE_KEYS.EVENTS_MAP, eMap, false);
          this.isRemoteMutating = false;
          this.notifySubscribersOnly();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, FIRESTORE_COLLECTIONS.EVENTS);
      }
    );

    // Listen to Mpesa Accounts Map
    onSnapshot(
      collection(db, FIRESTORE_COLLECTIONS.MPESA_ACCOUNTS),
      (snapshot) => {
        if (snapshot.empty) return;
        const accs = snapshot.docs.map((d) => d.data() as MpesaAccount & { businessId?: string });
        if (accs.length > 0) {
          const mMap: Record<string, MpesaAccount[]> = {};
          accs.forEach((acc) => {
            const bId = acc.businessId || 'default';
            if (!mMap[bId]) mMap[bId] = [];
            mMap[bId].push(acc);
          });
          this.isRemoteMutating = true;
          this.set(STORAGE_KEYS.MPESA_ACCOUNTS_MAP, mMap, false);
          this.isRemoteMutating = false;
          this.notifySubscribersOnly();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, FIRESTORE_COLLECTIONS.MPESA_ACCOUNTS);
      }
    );
  }

  public async syncWithCloud(): Promise<{ success: boolean; message: string; syncedCount: number }> {
    if (!this.isOnline()) {
      return {
        success: false,
        message: 'Device is offline. Changes saved locally in transaction journal.',
        syncedCount: 0,
      };
    }

    this.isCurrentlySyncing = true;
    this.notify();

    try {
      const queue = this.get<Array<{ operationName: string; payload: any }>>(STORAGE_KEYS.OFFLINE_QUEUE, []);
      const count = queue.length;

      // Process any queued offline mutations
      for (const item of queue) {
        try {
          if (item.operationName.startsWith('SAVE_') && item.payload) {
            const coll = item.operationName.replace('SAVE_', '');
            await setDoc(doc(db, coll, item.payload.docId), JSON.parse(JSON.stringify(item.payload.data)), { merge: true });
          } else if (item.operationName.startsWith('DELETE_') && item.payload) {
            const coll = item.operationName.replace('DELETE_', '');
            await deleteDoc(doc(db, coll, item.payload.docId));
          }
        } catch (e) {
          console.warn('Queue item processing error:', e);
        }
      }

      await this.fetchCoreFirestoreEntities();

      this.set(STORAGE_KEYS.OFFLINE_QUEUE, [], false);
      this.lastSyncTimestamp = new Date().toISOString();
      this.isCurrentlySyncing = false;

      if (count > 0) {
        this.addEvent({
          type: 'SYNC_COMPLETED',
          title: 'Cloud Persistence Reconciled',
          description: `Successfully synchronized ${count} offline operational transactions with central Firestore cloud.`,
          actorName: 'Sync Engine',
          severity: 'SUCCESS',
        });
      }

      this.notify();
      return {
        success: true,
        message: `Synced ${count} pending updates. Central database up to date.`,
        syncedCount: count,
      };
    } catch {
      this.isCurrentlySyncing = false;
      this.notify();
      return {
        success: false,
        message: 'Cloud sync failed. Local data preserved in offline queue.',
        syncedCount: 0,
      };
    }
  }

  public triggerNeonSync() {
    this.syncWithCloud();
  }

  public clearActiveSessionCache() {
    // Session cache cleanup
  }

  /**
   * Reset Inventory for Live Launch
   * Preserves: Drink catalog (names, categories, prices, units, weights), staff members, business profile, M-Pesa accounts
   * Resets to 0: All bottle/unit stock counts on hand, shifts, shift stock items, historical test sales, and discrepancies
   */
  public resetInventoryForLiveLaunch(actorName: string = 'Owner'): { success: boolean; message: string } {
    const bizId = this.getCurrentBusinessId();
    const products = this.getProducts(true);

    // 1. Reset all inventory items to 0 for all products
    const zeroedInventoryMap: Record<string, InventoryItem[]> = {};
    const zeroedItems: InventoryItem[] = products.map((p) => ({
      id: `inv-${bizId}-${p.id}`,
      productId: p.id,
      quantityOnHand: 0,
      updatedAt: new Date().toISOString(),
    }));
    zeroedInventoryMap[bizId] = zeroedItems;
    this.set(STORAGE_KEYS.INVENTORY_MAP, zeroedInventoryMap);

    // 2. Clear all shifts, shift items, and test history
    this.set(STORAGE_KEYS.SHIFTS_MAP, { [bizId]: [] });
    this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    this.set(STORAGE_KEYS.STOCK_ADDITIONS, []);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    this.set(STORAGE_KEYS.EXPENSES, []);
    this.set(STORAGE_KEYS.HANDOVER_DRAFTS, []);
    this.set(STORAGE_KEYS.DISCREPANCIES, []);
    this.set(STORAGE_KEYS.OFFLINE_QUEUE, []);

    // 3. Log milestone audit event
    this.addEvent({
      type: 'INFO',
      title: 'Live Launch: Stock Reset to Zero',
      description: `Inventory bottle counts reset to 0 for live operations launch by ${actorName}. Drink catalog (${products.length} drinks), pricing, and staff team preserved. Ready for Day 1 physical stock intake.`,
      actorName,
      severity: 'SUCCESS',
    });

    this.notify();
    return {
      success: true,
      message: `System ready for live launch! All ${products.length} drink counts reset to 0. Menu prices and staff accounts are intact.`,
    };
  }

  public hasAnyBusiness(): boolean {
    const list = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    return list.length > 0;
  }

  // --- Session User Helper ---
  public getSessionUser(): User | null {
    const session = authService.getActiveSession();
    if (!session) return null;
    const users = this.get<User[]>(STORAGE_KEYS.USERS, []);
    return users.find((u) => u.id === session.userId) || null;
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

    // Sort candidates so that the most recently active business is tested first
    const businesses = this.get<BusinessProfile[]>(STORAGE_KEYS.BUSINESSES, []);
    const bizOrderMap = new Map<string, number>();
    businesses.forEach((b, index) => bizOrderMap.set(b.id, index));

    let userPool = this.getUsers();
    let candidates = findCandidates(userPool);

    if (candidates.length === 0) {
      await this.fetchCoreFirestoreEntities();
      userPool = this.getUsers();
      candidates = findCandidates(userPool);
    }

    candidates.sort((a, b) => {
      const idxA = a.businessId ? (bizOrderMap.get(a.businessId) ?? 999) : 999;
      const idxB = b.businessId ? (bizOrderMap.get(b.businessId) ?? 999) : 999;
      return idxA - idxB;
    });

    for (const cand of candidates) {
      if (await verifyCandidate(cand)) {
        authService.clearFailedAttempts(rawInput);
        authService.createSession(cand);
        if (cand.businessId) {
          this.setCurrentBusiness(cand.businessId);
        }
        return cand;
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
    const list = inventoryMap[bizId] || [];

    // Aggressive deduplication strictly by productId (newest updatedAt wins)
    const seen = new Map<string, InventoryItem>();
    let hasDups = false;
    list.forEach((item) => {
      if (!item.productId) return;
      const existing = seen.get(item.productId);
      if (!existing) {
        seen.set(item.productId, item);
      } else {
        hasDups = true;
        const tExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const tItem = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        if (tItem >= tExisting) {
          seen.set(item.productId, item);
        }
      }
    });

    const deduped = Array.from(seen.values());
    if (hasDups || !inventoryMap[bizId]) {
      inventoryMap[bizId] = deduped;
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);
    }
    return deduped;
  }

  private saveCurrentInventory(inv: InventoryItem[]) {
    const bizId = this.getCurrentBusinessId();
    const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
    
    // Strict deduplication by productId
    const seen = new Map<string, InventoryItem>();
    inv.forEach((item) => {
      if (!item.productId) return;
      seen.set(item.productId, {
        ...item,
        id: item.id && item.id.startsWith('inv-') ? item.id : `inv-${bizId}-${item.productId}`,
        updatedAt: item.updatedAt || new Date().toISOString(),
      });
    });

    inventoryMap[bizId] = Array.from(seen.values());
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
    const items = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    const seen = new Map<string, ShiftStockItem>();
    items.forEach((item) => {
      seen.set(`${item.shiftId}__${item.productId}`, item);
    });
    return Array.from(seen.values());
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
      fullWeightKg: product.fullWeightKg,
      emptyWeightKg: product.emptyWeightKg,
      pricePerKg: product.pricePerKg || (product.measurementType === 'WEIGHT' ? product.sellingPrice : undefined),
    };
  }

  public getShiftStockItems(shiftId: string): ShiftStockItem[] {
    const items = this.getAllShiftStockItems();
    const rawShiftItems = items.filter((i) => i.shiftId === shiftId);

    // Strict deduplication by productId
    const seen = new Map<string, ShiftStockItem>();
    rawShiftItems.forEach((si) => {
      seen.set(si.productId, si);
    });
    let shiftItems = Array.from(seen.values());

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
      if ('closingPhysicalCount' in params) {
        ssi.closingPhysicalCount =
          params.closingPhysicalCount !== undefined
            ? Math.max(0, params.closingPhysicalCount)
            : undefined;
      }
    }

    const available = Number(ssi.openingPhysicalCount || 0) + Number(ssi.additions || 0) + Number(ssi.transfersIn || 0) - Number(ssi.transfersOut || 0) - Number(ssi.damages || 0);
    if (ssi.closingPhysicalCount !== undefined) {
      ssi.recordedSales = Math.round(Math.max(0, available - ssi.closingPhysicalCount) * 100) / 100;
    } else {
      ssi.recordedSales = 0;
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

    this.enqueueOfflineAction('updateShiftStockItemRow', params);
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
        if (vals.opening !== undefined) {
          ssi.openingPhysicalCount = Math.max(0, vals.opening);
          ssi.openingSystemCount = ssi.openingPhysicalCount;
        }
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
    this.enqueueOfflineAction('batchUpdateShiftStockItems', { shiftId, updates });
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

        const isWeight =
          product.measurementType === 'WEIGHT' ||
          product.unit === 'KG' ||
          (product.isMeasured && (product.fullWeightKg || 0) > 0);
        const isVal = !isWeight && product.isMeasured && (product.measurementType === 'VALUE' || product.unit === 'VALUE_KES');
        const priceRate = isWeight ? (product.pricePerKg || product.sellingPrice || 150) : product.sellingPrice;

        if (diff < 0) {
          // Shortage: previous attendant held accountable
          const shortageQty = Math.abs(diff);
          const moneyVal = isVal ? shortageQty : Math.round(shortageQty * priceRate * 100) / 100;
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
            severity: (isVal ? shortageQty >= 300 : isWeight ? shortageQty >= 2 : shortageQty >= 3) ? 'HIGH' : 'MEDIUM',
            status: 'FLAGGED',
            ownerNotes: isVal
              ? `Opening handover shortage: KES ${shortageQty.toLocaleString()} value less than expected left by ${prevAttendant}. Reported by incoming attendant ${params.workerName}.`
              : isWeight
              ? `Opening handover shortage: ${shortageQty} kg (${shortageQty} kg × KES ${priceRate} = KES ${moneyVal.toLocaleString()}) less than expected left by ${prevAttendant}. Weighed on counter scale.`
              : `Opening handover shortage: ${shortageQty} bottle(s) fewer than expected left by ${prevAttendant}. Reported by incoming attendant ${params.workerName}.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Surplus: previous attendant credited to balance the scale!
          const surplusQty = diff;
          const moneyVal = isVal ? surplusQty : Math.round(surplusQty * priceRate * 100) / 100;
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
              : isWeight
              ? `Opening handover surplus: +${surplusQty} kg (+KES ${moneyVal.toLocaleString()}) extra found on scale left by ${prevAttendant}. Credited to previous attendant to balance their scale fairly.`
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
        fullWeightKg: product.fullWeightKg,
        emptyWeightKg: product.emptyWeightKg,
        pricePerKg: product.pricePerKg || (product.measurementType === 'WEIGHT' ? product.sellingPrice : undefined),
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

    // Save shift stock items (strictly deduplicated)
    const existingSSIs = this.getAllShiftStockItems().filter((s) => s.shiftId !== shiftId);
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
      const isWeight =
        item.measurementType === 'WEIGHT' ||
        item.unit === 'KG' ||
        (item.isMeasured === true && (item.fullWeightKg || 0) > 0);

      const isValue =
        !isWeight &&
        ((item.isMeasured && item.measurementType === 'VALUE') ||
        item.unit === 'VALUE_KES');

      const ratePerUnit = isWeight
        ? (item.pricePerKg || item.sellingPrice || 150)
        : item.sellingPrice;

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
      const discrepancyValue = isValue ? overageCount : Math.round(overageCount * ratePerUnit * 100) / 100;

      if (isValue) {
        // Continuous/local drink measured by monetary value (e.g. Muratina left on counter)
        // calculatedSold is already the KES money value
        expectedSalesRevenue += calculatedSold;
      } else if (isWeight) {
        // Measured by weight on scale (e.g. 29 kg sold * KES 150/kg = KES 4,350)
        expectedSalesRevenue += Math.round(calculatedSold * ratePerUnit * 100) / 100;
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

    // Update Shift Stock Items (strictly deduplicated)
    const allSSIs = this.getAllShiftStockItems();
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
  }

  public adjustProductStock(
    productId: string,
    newQuantity: number,
    options?: {
      mode?: 'CLERICAL_CORRECTION' | 'SHRINKAGE_VARIANCE';
      reason?: string;
      actorName?: string;
      actorRole?: string;
    }
  ): boolean {
    const cleanQty = Math.max(0, Number(newQuantity) || 0);
    const inv = this.getInventory();
    const item = inv.find((i) => i.productId === productId);
    const prevQty = item ? item.quantityOnHand : 0;
    const delta = cleanQty - prevQty;
    const bizId = this.getCurrentBusinessId();
    const mode = options?.mode || 'CLERICAL_CORRECTION';
    const reason = options?.reason?.trim() || (mode === 'CLERICAL_CORRECTION' ? 'Initial entry typo correction' : 'Physical count audit discrepancy');
    const actorName = options?.actorName || 'Owner Audit Desk';

    // Cleanly purge any duplicate rows and store a single canonical inventory record
    const otherInv = inv.filter((i) => i.productId !== productId);
    const updatedItem: InventoryItem = {
      id: `inv-${bizId}-${productId}`,
      productId,
      quantityOnHand: cleanQty,
      updatedAt: new Date().toISOString(),
    };
    this.saveCurrentInventory([...otherInv, updatedItem]);

    // Synchronize ALL active or unclosed shifts directly so opening counts across the system
    // immediately reflect the authoritative stock count:
    const activeShifts = this.getShifts().filter(
      (s) => s.status === 'ACTIVE' || s.status === 'OPENING_VERIFICATION'
    );
    const products = this.getProducts(true);
    const product = products.find((p) => p.id === productId);
    const productName = product ? product.name : 'Drink';

    if (product) {
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
      let ssiModified = false;

      activeShifts.forEach((shift) => {
        let ssi = allSSIs.find(
          (s) => s.shiftId === shift.id && s.productId === productId
        );

        if (!ssi) {
          ssi = this.buildShiftStockItem(shift.id, product, cleanQty);
          allSSIs.push(ssi);
          ssiModified = true;
        } else {
          // Force opening physical and opening system counts to match the authoritative adjustment
          ssi.openingPhysicalCount = cleanQty;
          ssi.openingSystemCount = cleanQty;

          // Zero out additions and damages/transfers so total available stock directly matches cleanQty
          ssi.additions = 0;
          ssi.transfersIn = 0;
          ssi.transfersOut = 0;
          ssi.damages = 0;

          if (ssi.closingPhysicalCount !== undefined) {
            if (ssi.closingPhysicalCount > cleanQty) {
              ssi.closingPhysicalCount = cleanQty;
            }
            ssi.recordedSales = Math.round(Math.max(0, cleanQty - ssi.closingPhysicalCount) * 100) / 100;
          } else {
            ssi.recordedSales = 0;
          }
          ssiModified = true;
        }
      });

      if (ssiModified) {
        this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
      }

      // Zero out / resolve any addition records for this product on active shifts
      const additions = this.get<StockAdditionRecord[]>(STORAGE_KEYS.STOCK_ADDITIONS, []);
      let additionsModified = false;
      additions.forEach((a) => {
        if (activeShifts.some((s) => s.id === a.shiftId) && a.productId === productId) {
          a.quantity = 0;
          a.status = 'SAVED_LOCKED';
          a.savedBy = `${actorName} Stock Adjustment`;
          a.savedAt = new Date().toISOString();
          a.isImmutable = true;
          additionsModified = true;
        }
      });
      if (additionsModified) {
        this.set(STORAGE_KEYS.STOCK_ADDITIONS, additions);
      }
    }

    if (mode === 'SHRINKAGE_VARIANCE' && delta < 0) {
      // Physical count is lower than expected and flagged as true shrinkage/theft/breakage
      const missingCount = Math.abs(delta);
      const unitVal = product?.sellingPrice || 0;
      const lossKes = Math.round(missingCount * unitVal);

      const disc: Discrepancy = {
        id: `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        shiftId: activeShifts[0]?.id || 'GENERAL',
        shiftNumber: activeShifts[0]?.shiftNumber || 'AUDIT',
        workerName: actorName,
        type: 'STOCK_SHORTAGE',
        itemId: productId,
        itemName: productName,
        expected: prevQty,
        actual: cleanQty,
        variance: delta,
        monetaryValue: lossKes,
        severity: missingCount > 5 ? 'HIGH' : 'MEDIUM',
        status: 'FLAGGED',
        ownerNotes: `Physical audit variance: ${reason}. Recorded by ${actorName}.`,
        timestamp: new Date().toISOString(),
      };

      const discrepancies = this.get<Discrepancy[]>(STORAGE_KEYS.DISCREPANCIES, []);
      this.set(STORAGE_KEYS.DISCREPANCIES, [disc, ...discrepancies]);

      this.addEvent({
        type: 'DISCREPANCY_FLAGGED',
        title: `Shrinkage Loss Flagged: ${productName}`,
        description: `Audit shortage of ${missingCount} bottles (-KES ${lossKes.toLocaleString()}). Reason: ${reason}`,
        actorName,
        severity: 'ALERT',
        amount: lossKes,
        currency: 'KES',
      });
    } else {
      // Clerical / Entry Error Correction - Zero shrinkage penalty, pure baseline correction with audit reason
      this.addEvent({
        type: 'INFO',
        title: `Clerical Correction: ${productName}`,
        description: `Stock count baseline corrected from ${prevQty} to ${cleanQty} (${delta >= 0 ? `+${delta}` : delta}). Reason: ${reason}. (Zero shrinkage penalty)`,
        actorName,
        severity: 'INFO',
      });
    }

    this.enqueueOfflineAction('ADJUST_PRODUCT_STOCK', {
      productId,
      newQuantity: cleanQty,
      mode,
      reason,
      actorName,
    });

    try {
      this.liveChannel?.postMessage({
        type: 'LOCAL_STORE_MUTATED',
        action: 'adjustProductStock',
        productId,
        quantity: cleanQty,
      });
    } catch {
      // ignore
    }

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
    fullWeightKg?: number;
    emptyWeightKg?: number;
    pricePerKg?: number;
  }): Product {
    const currentBizId = params.businessId || this.getCurrentBusinessId();
    const products = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const isWeight = params.measurementType === 'WEIGHT' || params.unit === 'KG';
    const cleanPricePerKg = params.pricePerKg ? Number(params.pricePerKg) : (isWeight ? Number(params.sellingPrice) : undefined);
    const cleanSellingPrice = isWeight && cleanPricePerKg ? cleanPricePerKg : (Number(params.sellingPrice) || 0);
    const initialQty = Number(params.initialStock) || 0;

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      businessId: currentBizId,
      name: params.name.trim(),
      category: params.category,
      unit: params.unit,
      sellingPrice: cleanSellingPrice,
      reorderLevel: Number(params.reorderLevel) || 5,
      volumeMl: params.volumeMl ? Number(params.volumeMl) : undefined,
      isArchived: false,
      isMeasured: Boolean(params.isMeasured || isWeight),
      measurementType: params.measurementType || (isWeight ? 'WEIGHT' : (params.isMeasured ? 'VALUE' : 'COUNT')),
      measureUnitLabel: params.measureUnitLabel || (isWeight ? 'kg' : undefined),
      totalMeasuredValueKes: isWeight
        ? (initialQty * cleanSellingPrice)
        : (params.totalMeasuredValueKes ? Number(params.totalMeasuredValueKes) : undefined),
      fullWeightKg: params.fullWeightKg ? Number(params.fullWeightKg) : (isWeight ? 60 : undefined),
      emptyWeightKg: params.emptyWeightKg !== undefined ? Number(params.emptyWeightKg) : (isWeight ? 0 : undefined),
      pricePerKg: cleanPricePerKg,
    };

    products.push(newProduct);
    this.set(STORAGE_KEYS.PRODUCTS, products);

    // Initialize inventory for current business
    const inv = this.getInventory();
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
        fullWeightKg: newProduct.fullWeightKg,
        emptyWeightKg: newProduct.emptyWeightKg,
        pricePerKg: newProduct.pricePerKg,
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

    const bizId = this.getCurrentBusinessId();
    if (!product.businessId) {
      product.businessId = bizId;
    }

    Object.assign(product, updates);
    if (product.measurementType === 'WEIGHT') {
      if (updates.pricePerKg !== undefined) {
        product.pricePerKg = updates.pricePerKg;
        product.sellingPrice = updates.pricePerKg;
      } else if (updates.sellingPrice !== undefined) {
        product.pricePerKg = updates.sellingPrice;
      }
    } else if (product.isMeasured && updates.sellingPrice !== undefined && updates.totalMeasuredValueKes === undefined) {
      product.totalMeasuredValueKes = updates.sellingPrice;
    }
    this.set(STORAGE_KEYS.PRODUCTS, allProducts);

    // Also update any active shift stock items so attendant UI immediately displays updated name and price
    const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []);
    let ssiChanged = false;
    allSSIs.forEach((ssi) => {
      if (ssi.productId === productId) {
        ssi.productName = product.name;
        ssi.unit = product.unit;
        ssi.sellingPrice = product.sellingPrice;
        ssi.isMeasured = product.isMeasured;
        ssi.measurementType = product.measurementType;
        ssi.measureUnitLabel = product.measureUnitLabel;
        ssi.totalMeasuredValueKes = product.totalMeasuredValueKes;
        ssi.fullWeightKg = product.fullWeightKg;
        ssi.emptyWeightKg = product.emptyWeightKg;
        ssi.pricePerKg = product.pricePerKg;
        ssiChanged = true;
      }
    });
    if (ssiChanged) {
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);
    }

    this.addEvent({
      type: 'INFO',
      title: `Catalog Updated: ${product.name}`,
      description: `Selling Price: KES ${product.sellingPrice}`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
    });

    this.notify();
    return product;
  }

  public deleteProduct(productId: string, permanent = false): boolean {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return false;

    const bizId = this.getCurrentBusinessId();

    if (permanent) {
      const filtered = allProducts.filter((p) => p.id !== productId);
      this.set(STORAGE_KEYS.PRODUCTS, filtered);

      // Clean from local inventory
      const inv = this.getInventory().filter((i) => i.productId !== productId);
      const inventoryMap = this.get<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY_MAP, {});
      inventoryMap[bizId] = inv;
      this.set(STORAGE_KEYS.INVENTORY_MAP, inventoryMap);

      // Clean from local shift stock items
      const allSSIs = this.get<ShiftStockItem[]>(STORAGE_KEYS.SHIFT_STOCK_ITEMS, []).filter(
        (i) => i.productId !== productId
      );
      this.set(STORAGE_KEYS.SHIFT_STOCK_ITEMS, allSSIs);

      const deleted = this.get<string[]>(STORAGE_KEYS.DELETED_PRODUCT_IDS, []);
      if (!deleted.includes(productId)) {
        deleted.push(productId);
        this.set(STORAGE_KEYS.DELETED_PRODUCT_IDS, deleted);
      }
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
    return true;
  }

  public restoreProduct(productId: string): boolean {
    const allProducts = this.get<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return false;

    // Remove from deleted list if present
    const deleted = this.get<string[]>(STORAGE_KEYS.DELETED_PRODUCT_IDS, []);
    if (deleted.includes(productId)) {
      this.set(
        STORAGE_KEYS.DELETED_PRODUCT_IDS,
        deleted.filter((id) => id !== productId)
      );
    }

    product.isArchived = false;
    this.set(STORAGE_KEYS.PRODUCTS, allProducts);

    this.addEvent({
      type: 'INFO',
      title: `Drink Restored: ${product.name}`,
      description: `${product.name} restored to catalog shelves`,
      actorName: 'Owner Audit Desk',
      severity: 'INFO',
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

}

export const store = new StoreService();
