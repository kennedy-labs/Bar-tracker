import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Shift,
  InventoryItem,
  Product,
  MpesaAccount,
  Expense,
  StockAdditionRecord,
  OperationalEvent,
  BusinessProfile,
} from '../types';

export interface FirestoreSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

class FirestoreSyncService {
  private statusListeners: ((status: FirestoreSyncStatus) => void)[] = [];
  private activeUnsubscribes: Unsubscribe[] = [];
  private currentBizId: string = 'biz-1';
  private status: FirestoreSyncStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateStatus({ isOnline: true }));
      window.addEventListener('offline', () => this.updateStatus({ isOnline: false }));
    }
  }

  public getStatus(): FirestoreSyncStatus {
    return { ...this.status };
  }

  public subscribeStatus(cb: (status: FirestoreSyncStatus) => void) {
    this.statusListeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  private updateStatus(partial: Partial<FirestoreSyncStatus>) {
    this.status = { ...this.status, ...partial };
    this.statusListeners.forEach((cb) => cb(this.getStatus()));
  }

  // Set active business and start listening to remote changes
  public initListeners(
    bizId: string,
    callbacks: {
      onShiftsUpdated: (shifts: Shift[]) => void;
      onInventoryUpdated: (items: InventoryItem[]) => void;
      onMpesaAccountsUpdated: (accounts: MpesaAccount[]) => void;
      onExpensesUpdated: (expenses: Expense[]) => void;
      onStockAdditionsUpdated: (additions: StockAdditionRecord[]) => void;
      onEventsUpdated: (events: OperationalEvent[]) => void;
    }
  ) {
    this.currentBizId = bizId;
    this.clearListeners();

    try {
      // 1. Listen to Shifts
      const shiftsQuery = query(collection(db, 'shifts'), where('businessId', '==', bizId));
      const unsubShifts = onSnapshot(
        shiftsQuery,
        (snapshot) => {
          const remoteShifts: Shift[] = [];
          snapshot.forEach((docSnap) => {
            remoteShifts.push(docSnap.data() as Shift);
          });
          // Sort newest first
          remoteShifts.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
          callbacks.onShiftsUpdated(remoteShifts);
          this.updateStatus({ lastSyncedAt: new Date().toISOString(), error: null });
        },
        (err) => {
          if (err.code === 'unavailable' || err.message?.includes('backend') || err.message?.includes('offline')) {
            this.updateStatus({ isOnline: false, isSyncing: false, error: null });
          } else {
            console.warn('[FirestoreSync] Shifts listener notice:', err.message);
            this.updateStatus({ error: `Sync notice: ${err.message}` });
          }
        }
      );
      this.activeUnsubscribes.push(unsubShifts);

      // 2. Listen to Inventory for this business
      const invQuery = query(collection(db, 'inventory'), where('businessId', '==', bizId));
      const unsubInv = onSnapshot(
        invQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteInventory: InventoryItem[] = [];
            snapshot.forEach((docSnap) => {
              remoteInventory.push(docSnap.data() as InventoryItem);
            });
            callbacks.onInventoryUpdated(remoteInventory);
          }
        },
        (err) => {
          console.error('[FirestoreSync] Inventory listener error:', err);
        }
      );
      this.activeUnsubscribes.push(unsubInv);

      // 3. Listen to Mpesa Accounts
      const mpesaQuery = query(collection(db, 'mpesa_accounts'), where('businessId', '==', bizId));
      const unsubMpesa = onSnapshot(
        mpesaQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteAccounts: MpesaAccount[] = [];
            snapshot.forEach((docSnap) => {
              remoteAccounts.push(docSnap.data() as MpesaAccount);
            });
            callbacks.onMpesaAccountsUpdated(remoteAccounts);
          }
        },
        (err) => {
          console.error('[FirestoreSync] M-Pesa accounts listener error:', err);
        }
      );
      this.activeUnsubscribes.push(unsubMpesa);

      // 4. Listen to Expenses
      const expQuery = query(collection(db, 'expenses'), where('businessId', '==', bizId));
      const unsubExp = onSnapshot(
        expQuery,
        (snapshot) => {
          const remoteExpenses: Expense[] = [];
          snapshot.forEach((docSnap) => {
            remoteExpenses.push(docSnap.data() as Expense);
          });
          remoteExpenses.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          callbacks.onExpensesUpdated(remoteExpenses);
        },
        (err) => {
          console.error('[FirestoreSync] Expenses listener error:', err);
        }
      );
      this.activeUnsubscribes.push(unsubExp);

      // 5. Listen to Stock Additions
      const addQuery = query(collection(db, 'stock_additions'), where('businessId', '==', bizId));
      const unsubAdd = onSnapshot(
        addQuery,
        (snapshot) => {
          const remoteAdditions: StockAdditionRecord[] = [];
          snapshot.forEach((docSnap) => {
            remoteAdditions.push(docSnap.data() as StockAdditionRecord);
          });
          callbacks.onStockAdditionsUpdated(remoteAdditions);
        },
        (err) => {
          console.error('[FirestoreSync] Stock additions listener error:', err);
        }
      );
      this.activeUnsubscribes.push(unsubAdd);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[FirestoreSync] Init notice (operating in offline-first mode):', message);
      this.updateStatus({ isOnline: false, error: null });
    }
  }

  public clearListeners() {
    this.activeUnsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.error('Error unsubscribing listener:', e);
      }
    });
    this.activeUnsubscribes = [];
  }

  // --- Push single items to Firestore in background ---

  public async saveShift(shift: Shift): Promise<void> {
    try {
      this.updateStatus({ isSyncing: true });
      const ref = doc(db, 'shifts', shift.id);
      await setDoc(ref, shift, { merge: true });
      this.updateStatus({ isSyncing: false, lastSyncedAt: new Date().toISOString(), error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[FirestoreSync] Saved locally (offline):', message);
      this.updateStatus({ isSyncing: false, isOnline: false, error: null });
    }
  }

  public async saveInventoryItem(item: InventoryItem, bizId: string): Promise<void> {
    try {
      const docId = `${bizId}_${item.id}`;
      const ref = doc(db, 'inventory', docId);
      await setDoc(ref, { ...item, businessId: bizId }, { merge: true });
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to save inventory item:', err);
    }
  }

  public async saveMpesaAccount(account: MpesaAccount): Promise<void> {
    try {
      const ref = doc(db, 'mpesa_accounts', account.id);
      await setDoc(ref, account, { merge: true });
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to save M-Pesa account:', err);
    }
  }

  public async deleteMpesaAccount(accountId: string): Promise<void> {
    try {
      const ref = doc(db, 'mpesa_accounts', accountId);
      await deleteDoc(ref);
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to delete M-Pesa account:', err);
    }
  }

  public async saveExpense(expense: Expense): Promise<void> {
    try {
      const ref = doc(db, 'expenses', expense.id);
      await setDoc(ref, expense, { merge: true });
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to save expense:', err);
    }
  }

  public async saveStockAddition(addition: StockAdditionRecord): Promise<void> {
    try {
      const ref = doc(db, 'stock_additions', addition.id);
      await setDoc(ref, addition, { merge: true });
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to save stock addition:', err);
    }
  }

  public async saveOperationalEvent(event: OperationalEvent, bizId: string): Promise<void> {
    try {
      const ref = doc(db, 'operational_events', event.id);
      await setDoc(ref, { ...event, businessId: bizId }, { merge: true });
    } catch (err: unknown) {
      console.error('[FirestoreSync] Failed to save operational event:', err);
    }
  }

  // --- Seed / Full Initial Migration ---
  // Copies local inventory, products, and tills into Firestore if Firestore is empty
  public async uploadAllLocalDataToFirestore(params: {
    businesses: BusinessProfile[];
    products: Product[];
    inventoryMap: Record<string, InventoryItem[]>;
    shiftsMap: Record<string, Shift[]>;
    mpesaAccountsMap: Record<string, MpesaAccount[]>;
    expenses: Expense[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      this.updateStatus({ isSyncing: true });
      const batch = writeBatch(db);
      let opCount = 0;

      // 1. Upload Businesses
      for (const biz of params.businesses) {
        const ref = doc(db, 'businesses', biz.id);
        batch.set(ref, biz, { merge: true });
        opCount++;
      }

      // 2. Upload Products Catalog
      for (const prod of params.products) {
        const ref = doc(db, 'products', prod.id);
        batch.set(ref, prod, { merge: true });
        opCount++;
      }

      // 3. Upload Inventory per business
      for (const [bizId, items] of Object.entries(params.inventoryMap)) {
        for (const item of items) {
          const docId = `${bizId}_${item.id}`;
          const ref = doc(db, 'inventory', docId);
          batch.set(ref, { ...item, businessId: bizId }, { merge: true });
          opCount++;
        }
      }

      // 4. Upload M-Pesa Accounts
      for (const [bizId, accounts] of Object.entries(params.mpesaAccountsMap)) {
        for (const acc of accounts) {
          const ref = doc(db, 'mpesa_accounts', acc.id);
          batch.set(ref, { ...acc, businessId: bizId }, { merge: true });
          opCount++;
        }
      }

      // 5. Upload Shifts
      for (const [bizId, shifts] of Object.entries(params.shiftsMap)) {
        for (const s of shifts) {
          const ref = doc(db, 'shifts', s.id);
          batch.set(ref, { ...s, businessId: bizId }, { merge: true });
          opCount++;
        }
      }

      // 6. Upload Expenses
      for (const exp of params.expenses) {
        const ref = doc(db, 'expenses', exp.id);
        batch.set(ref, exp, { merge: true });
        opCount++;
      }

      await batch.commit();

      this.updateStatus({
        isSyncing: false,
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });

      return {
        success: true,
        message: `Successfully synchronized ${opCount} records to your Firestore cloud database.`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[FirestoreSync] Batch upload failed:', message);
      this.updateStatus({ isSyncing: false, error: message });
      return { success: false, message };
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
