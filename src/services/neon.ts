/**
 * Neon Service Stub
 * Pure in-memory mode: all database persistence and cloud synchronization completely deleted.
 */

import {
  BusinessProfile,
  User,
  Product,
  InventoryItem,
  Shift,
  Expense,
  MpesaAccount,
  OperationalEvent,
  Discrepancy,
  StockAdditionRecord,
  InterBusinessTransfer,
  BusinessPartner,
  ShiftStockItem,
} from '../types';

export type NeonStatus = 'DISCONNECTED';

export interface NeonState {
  status: NeonStatus;
  databaseUrl: string | null;
  databaseName?: string;
  latencyMs?: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export interface SyncPayload {
  business: BusinessProfile;
  users: User[];
  products: Product[];
  inventory: InventoryItem[];
  shifts: Shift[];
  expenses: Expense[];
  mpesaAccounts: MpesaAccount[];
  events?: OperationalEvent[];
  stockAdditions?: StockAdditionRecord[];
  deletedStockAdditionIds?: string[];
  deletedProductIds?: string[];
  discrepancies?: Discrepancy[];
  interTransfers?: InterBusinessTransfer[];
  partners?: BusinessPartner[];
  shiftStockItems?: ShiftStockItem[];
}

export interface PullResult {
  business?: BusinessProfile;
  users?: User[];
  products?: Product[];
  inventory?: InventoryItem[];
  shifts?: Shift[];
  expenses?: Expense[];
  mpesaAccounts?: MpesaAccount[];
  events?: OperationalEvent[];
  stockAdditions?: StockAdditionRecord[];
  discrepancies?: Discrepancy[];
  interTransfers?: InterBusinessTransfer[];
  partners?: BusinessPartner[];
  shiftStockItems?: ShiftStockItem[];
}

class NeonService {
  private state: NeonState = {
    status: 'DISCONNECTED',
    databaseUrl: null,
  };

  public getStatus(): NeonState {
    return this.state;
  }

  public subscribeStatus(listener: (state: NeonState) => void): () => void {
    listener(this.state);
    return () => {};
  }

  public getSavedDatabaseUrl(): string | null {
    return null;
  }

  public setDatabaseUrl(_url: string | null) {
    // Disabled: pure in-memory mode
  }

  public async checkConnectionNow(): Promise<boolean> {
    return false;
  }

  public async syncPayloadToNeon(_payload: SyncPayload): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'In-memory operational mode (persistence disabled).' };
  }

  public async pullAllBusinessesAndUsers(): Promise<{ success: boolean; businesses?: BusinessProfile[]; users?: User[] }> {
    return { success: false, businesses: [], users: [] };
  }

  public async pullBusinessFromNeon(_businessId: string): Promise<{ success: boolean; data?: PullResult }> {
    return { success: false };
  }

  public async adjustProductStock(_bizId: string, _productId: string, _newQty: number): Promise<boolean> {
    return true;
  }

  public async deleteProduct(_bizId: string, _productId: string): Promise<boolean> {
    return true;
  }

  public async updateProduct(_product: Product): Promise<boolean> {
    return true;
  }

  public async deleteStockAddition(_additionId: string): Promise<boolean> {
    return true;
  }
}

export const neonService = new NeonService();
