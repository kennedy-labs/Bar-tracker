/**
 * Neon Serverless PostgreSQL Database Service
 * Connects directly to Neon PostgreSQL using @neondatabase/serverless
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
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
} from '../types';

export type NeonStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'SYNCING' | 'ERROR';

export interface NeonState {
  status: NeonStatus;
  databaseUrl: string | null;
  databaseName?: string;
  latencyMs?: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

const STORAGE_KEY_NEON_URL = 'bar_track_neon_url';
const STORAGE_KEY_LAST_SYNC = 'bar_track_neon_last_sync';

class NeonService {
  private client: NeonQueryFunction<false, false> | null = null;
  private state: NeonState = {
    status: 'DISCONNECTED',
    databaseUrl: null,
  };
  private subscribers: ((state: NeonState) => void)[] = [];

  constructor() {
    const savedUrl = this.getSavedDatabaseUrl();
    if (savedUrl) {
      this.state.databaseUrl = savedUrl;
      this.initializeClient(savedUrl);
    }
  }

  public getSavedDatabaseUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const fromEnv = import.meta.env.VITE_NEON_DATABASE_URL;
    if (fromEnv && fromEnv.startsWith('postgres')) return fromEnv;
    const fromStorage = localStorage.getItem(STORAGE_KEY_NEON_URL);
    if (fromStorage && fromStorage.startsWith('postgres')) return fromStorage;
    return null;
  }

  public setDatabaseUrl(url: string | null) {
    if (url && url.trim().length > 0) {
      const cleanUrl = url.trim();
      localStorage.setItem(STORAGE_KEY_NEON_URL, cleanUrl);
      this.state.databaseUrl = cleanUrl;
      this.initializeClient(cleanUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_NEON_URL);
      this.state.databaseUrl = null;
      this.client = null;
      this.updateState({ status: 'DISCONNECTED', errorMessage: undefined });
    }
  }

  private initializeClient(url: string) {
    try {
      this.updateState({ status: 'CONNECTING', errorMessage: undefined });
      this.client = neon(url);
      this.testConnection(url).then((res) => {
        if (res.success) {
          this.updateState({
            status: 'CONNECTED',
            databaseName: res.database,
            latencyMs: res.latencyMs,
          });
        } else {
          this.updateState({
            status: 'ERROR',
            errorMessage: res.error,
          });
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
    }
  }

  public subscribeStatus(callback: (state: NeonState) => void) {
    this.subscribers.push(callback);
    callback(this.state);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  public getStatus(): NeonState {
    return { ...this.state };
  }

  private updateState(partial: Partial<NeonState>) {
    this.state = { ...this.state, ...partial };
    this.subscribers.forEach((cb) => {
      try {
        cb(this.state);
      } catch (e) {
        console.error('Neon subscriber error:', e);
      }
    });
  }

  /**
   * Health check & connection validation
   */
  public async testConnection(overrideUrl?: string): Promise<{
    success: boolean;
    database?: string;
    latencyMs?: number;
    error?: string;
  }> {
    const url = overrideUrl || this.state.databaseUrl;
    if (!url) {
      return { success: false, error: 'No Neon Database URL configured.' };
    }

    const start = performance.now();
    try {
      const sql = neon(url);
      const rows = await sql`SELECT current_database() as db, NOW() as server_time;`;
      const latencyMs = Math.round(performance.now() - start);
      const dbName = rows[0]?.db || 'neondb';
      return { success: true, database: dbName, latencyMs };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Initializes PostgreSQL schema DDL on Neon
   */
  public async initSchema(overrideUrl?: string): Promise<{ success: boolean; message: string }> {
    const url = overrideUrl || this.state.databaseUrl;
    if (!url) {
      return { success: false, message: 'No Neon Database URL configured.' };
    }

    try {
      this.updateState({ status: 'SYNCING' });
      const sql = neon(url);

      // 1. Businesses table
      await sql`
        CREATE TABLE IF NOT EXISTS businesses (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          owner_name TEXT,
          connect_code TEXT,
          active_shift_code TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 2. Users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          password_hash TEXT,
          password_salt TEXT,
          pin_code_hash TEXT,
          pin_salt TEXT,
          is_archived BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(business_id, username)
        );
      `;

      // 3. Products catalog
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          unit TEXT NOT NULL,
          cost_price NUMERIC(12,2) DEFAULT 0,
          selling_price NUMERIC(12,2) DEFAULT 0,
          reorder_level INT DEFAULT 5,
          is_archived BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 4. Inventory table
      await sql`
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          quantity_on_hand INT DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(business_id, product_id)
        );
      `;

      // 5. Shifts table
      await sql`
        CREATE TABLE IF NOT EXISTS shifts (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          shift_number TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          worker_name TEXT NOT NULL,
          status TEXT NOT NULL,
          opened_at TIMESTAMPTZ NOT NULL,
          closed_at TIMESTAMPTZ,
          opening_cash_float NUMERIC(12,2) DEFAULT 0,
          opening_mpesa_balance NUMERIC(12,2) DEFAULT 0,
          closing_cash_actual NUMERIC(12,2),
          closing_mpesa_balance NUMERIC(12,2),
          recorded_sales_count INT DEFAULT 0,
          calculated_mpesa_income NUMERIC(12,2),
          calculated_cash_income NUMERIC(12,2),
          expected_sales_revenue NUMERIC(12,2),
          total_expenses NUMERIC(12,2),
          gross_profit NUMERIC(12,2),
          net_profit NUMERIC(12,2),
          financial_variance NUMERIC(12,2),
          notes TEXT,
          shift_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 6. Expenses table
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          shift_id TEXT NOT NULL,
          category TEXT NOT NULL,
          amount NUMERIC(12,2) NOT NULL,
          payment_method TEXT NOT NULL,
          description TEXT NOT NULL,
          receipt_ref TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 7. Mpesa Accounts table
      await sql`
        CREATE TABLE IF NOT EXISTS mpesa_accounts (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          account_name TEXT NOT NULL,
          account_type TEXT NOT NULL,
          identifier TEXT NOT NULL,
          account_number TEXT,
          current_balance NUMERIC(12,2) DEFAULT 0,
          is_primary BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 8. Operational events
      await sql`
        CREATE TABLE IF NOT EXISTS operational_events (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          amount NUMERIC(12,2),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      this.updateState({ status: 'CONNECTED', errorMessage: undefined });
      return { success: true, message: 'Neon PostgreSQL schema verified & initialized successfully.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, message: `Schema initialization failed: ${msg}` };
    }
  }

  /**
   * Pushes full business payload to Neon
   */
  public async syncPayloadToNeon(payload: {
    business: BusinessProfile;
    users: User[];
    products: Product[];
    inventory: InventoryItem[];
    shifts: Shift[];
    expenses: Expense[];
    mpesaAccounts: MpesaAccount[];
    events: OperationalEvent[];
  }): Promise<{ success: boolean; message: string }> {
    const url = this.state.databaseUrl || this.getSavedDatabaseUrl();
    if (!url) {
      return { success: false, message: 'Neon Database URL not configured.' };
    }

    try {
      this.updateState({ status: 'SYNCING' });
      const sql = this.client || neon(url);
      const { business, users, products, inventory, shifts, expenses, mpesaAccounts, events } = payload;

      // Ensure business exists
      await sql`
        INSERT INTO businesses (id, name, phone, address, owner_name, connect_code)
        VALUES (${business.id}, ${business.name}, ${business.phone || ''}, ${business.address || ''}, ${business.ownerName || ''}, ${business.connectCode || ''})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          owner_name = EXCLUDED.owner_name,
          connect_code = EXCLUDED.connect_code,
          updated_at = NOW();
      `;

      // Upsert users
      for (const u of users) {
        await sql`
          INSERT INTO users (id, business_id, username, name, role, password_hash, password_salt, pin_code_hash, pin_salt, is_archived)
          VALUES (${u.id}, ${business.id}, ${u.username}, ${u.name}, ${u.role}, ${u.password || ''}, ${u.passwordSalt || ''}, ${u.pinCode || ''}, ${u.pinSalt || ''}, ${u.isArchived || false})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            password_hash = EXCLUDED.password_hash,
            password_salt = EXCLUDED.password_salt,
            pin_code_hash = EXCLUDED.pin_code_hash,
            pin_salt = EXCLUDED.pin_salt,
            is_archived = EXCLUDED.is_archived;
        `;
      }

      // Upsert products
      for (const p of products) {
        await sql`
          INSERT INTO products (id, business_id, name, category, unit, cost_price, selling_price, reorder_level, is_archived)
          VALUES (${p.id}, ${business.id}, ${p.name}, ${p.category}, ${p.unit}, ${p.costPrice}, ${p.sellingPrice}, ${p.reorderLevel || 5}, ${p.isArchived || false})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            cost_price = EXCLUDED.cost_price,
            selling_price = EXCLUDED.selling_price,
            reorder_level = EXCLUDED.reorder_level,
            is_archived = EXCLUDED.is_archived;
        `;
      }

      // Upsert inventory
      for (const inv of inventory) {
        await sql`
          INSERT INTO inventory (id, business_id, product_id, quantity_on_hand)
          VALUES (${inv.id || `${business.id}-${inv.productId}`}, ${business.id}, ${inv.productId}, ${inv.quantityOnHand})
          ON CONFLICT (id) DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            updated_at = NOW();
        `;
      }

      // Upsert shifts
      for (const s of shifts) {
        await sql`
          INSERT INTO shifts (
            id, business_id, shift_number, worker_id, worker_name, status,
            opened_at, closed_at, opening_cash_float, opening_mpesa_balance,
            closing_cash_actual, closing_mpesa_balance, recorded_sales_count,
            expected_sales_revenue, gross_profit, net_profit, financial_variance,
            notes, shift_data
          )
          VALUES (
            ${s.id}, ${business.id}, ${s.shiftNumber}, ${s.workerId}, ${s.workerName}, ${s.status},
            ${s.openedAt}, ${s.closedAt || null}, ${s.openingCashFloat}, ${s.openingMpesaBalance},
            ${s.closingCashActual || null}, ${s.closingMpesaBalance || null}, ${s.recordedSalesCount || 0},
            ${s.expectedSalesRevenue || 0}, ${s.grossProfit || 0}, ${s.netProfit || 0}, ${s.financialVariance || 0},
            ${s.closingNotes || ''}, ${JSON.stringify(s)}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            closed_at = EXCLUDED.closed_at,
            closing_cash_actual = EXCLUDED.closing_cash_actual,
            closing_mpesa_balance = EXCLUDED.closing_mpesa_balance,
            recorded_sales_count = EXCLUDED.recorded_sales_count,
            expected_sales_revenue = EXCLUDED.expected_sales_revenue,
            gross_profit = EXCLUDED.gross_profit,
            net_profit = EXCLUDED.net_profit,
            financial_variance = EXCLUDED.financial_variance,
            notes = EXCLUDED.notes,
            shift_data = EXCLUDED.shift_data;
        `;
      }

      // Upsert expenses
      for (const exp of expenses) {
        await sql`
          INSERT INTO expenses (id, business_id, shift_id, category, amount, payment_method, description, receipt_ref)
          VALUES (${exp.id}, ${business.id}, ${exp.shiftId}, ${exp.category}, ${exp.amount}, ${exp.paymentMethod}, ${exp.description}, ${exp.receiptRef || null})
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      // Upsert mpesa accounts
      for (const acc of mpesaAccounts) {
        await sql`
          INSERT INTO mpesa_accounts (id, business_id, account_name, account_type, identifier, account_number, current_balance, is_primary)
          VALUES (${acc.id}, ${business.id}, ${acc.accountName}, ${acc.accountType}, ${acc.identifier}, ${acc.accountNumber || null}, ${acc.currentBalance || 0}, ${acc.isPrimary || false})
          ON CONFLICT (id) DO UPDATE SET
            account_name = EXCLUDED.account_name,
            current_balance = EXCLUDED.current_balance,
            is_primary = EXCLUDED.is_primary;
        `;
      }

      const syncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncTime);
      this.updateState({ status: 'CONNECTED', lastSyncedAt: syncTime, errorMessage: undefined });

      return { success: true, message: `Successfully synchronized ${business.name} to Neon PostgreSQL.` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, message: `Neon sync failed: ${msg}` };
    }
  }

  /**
   * Pulls clean data from Neon PostgreSQL for a business
   */
  public async pullBusinessFromNeon(businessId: string): Promise<{
    success: boolean;
    data?: {
      business?: BusinessProfile;
      users?: User[];
      products?: Product[];
      inventory?: InventoryItem[];
      shifts?: Shift[];
      expenses?: Expense[];
      mpesaAccounts?: MpesaAccount[];
    };
    error?: string;
  }> {
    const url = this.state.databaseUrl || this.getSavedDatabaseUrl();
    if (!url) {
      return { success: false, error: 'Neon Database URL not configured.' };
    }

    try {
      this.updateState({ status: 'SYNCING' });
      const sql = this.client || neon(url);

      const bizRows = await sql`SELECT * FROM businesses WHERE id = ${businessId} LIMIT 1;`;
      if (bizRows.length === 0) {
        this.updateState({ status: 'CONNECTED' });
        return { success: false, error: 'Business not found on Neon database.' };
      }

      const b = bizRows[0];
      const business: BusinessProfile = {
        id: b.id,
        name: b.name,
        phone: b.phone,
        address: b.address,
        ownerName: b.owner_name,
        connectCode: b.connect_code,
        activeShiftTransferCode: b.active_shift_code,
      };

      const userRows = await sql`SELECT * FROM users WHERE business_id = ${businessId};`;
      const users: User[] = userRows.map((u) => ({
        id: u.id,
        businessId: u.business_id,
        username: u.username,
        name: u.name,
        role: u.role,
        password: u.password_hash,
        passwordSalt: u.password_salt,
        pinCode: u.pin_code_hash,
        pinSalt: u.pin_salt,
        isArchived: u.is_archived,
        createdAt: u.created_at,
      }));

      const prodRows = await sql`SELECT * FROM products WHERE business_id = ${businessId};`;
      const products: Product[] = prodRows.map((p) => ({
        id: p.id,
        businessId: p.business_id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        costPrice: Number(p.cost_price),
        sellingPrice: Number(p.selling_price),
        reorderLevel: Number(p.reorder_level),
        isArchived: p.is_archived,
      }));

      const invRows = await sql`SELECT * FROM inventory WHERE business_id = ${businessId};`;
      const inventory: InventoryItem[] = invRows.map((i) => ({
        id: i.id,
        productId: i.product_id,
        quantityOnHand: Number(i.quantity_on_hand),
        updatedAt: i.updated_at,
      }));

      const shiftRows = await sql`SELECT * FROM shifts WHERE business_id = ${businessId} ORDER BY opened_at DESC;`;
      const shifts: Shift[] = shiftRows.map((s) => {
        if (s.shift_data) {
          return typeof s.shift_data === 'string' ? JSON.parse(s.shift_data) : s.shift_data;
        }
        return {
          id: s.id,
          shiftNumber: s.shift_number,
          workerId: s.worker_id,
          workerName: s.worker_name,
          status: s.status,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          openingCashFloat: Number(s.opening_cash_float),
          openingMpesaBalance: Number(s.opening_mpesa_balance),
          closingCashActual: s.closing_cash_actual ? Number(s.closing_cash_actual) : undefined,
          closingMpesaBalance: s.closing_mpesa_balance ? Number(s.closing_mpesa_balance) : undefined,
          recordedSalesCount: Number(s.recorded_sales_count || 0),
          expectedSalesRevenue: Number(s.expected_sales_revenue || 0),
          grossProfit: Number(s.gross_profit || 0),
          netProfit: Number(s.net_profit || 0),
          financialVariance: Number(s.financial_variance || 0),
          closingNotes: s.notes,
        };
      });

      const expRows = await sql`SELECT * FROM expenses WHERE business_id = ${businessId};`;
      const expenses: Expense[] = expRows.map((e) => ({
        id: e.id,
        shiftId: e.shift_id,
        category: e.category,
        amount: Number(e.amount),
        paymentMethod: e.payment_method,
        description: e.description,
        receiptRef: e.receipt_ref,
        timestamp: e.created_at,
      }));

      const mpesaRows = await sql`SELECT * FROM mpesa_accounts WHERE business_id = ${businessId};`;
      const mpesaAccounts: MpesaAccount[] = mpesaRows.map((m) => ({
        id: m.id,
        businessId: m.business_id,
        accountName: m.account_name,
        accountType: m.account_type,
        identifier: m.identifier,
        accountNumber: m.account_number,
        currentBalance: Number(m.current_balance || 0),
        isPrimary: m.is_primary,
      }));

      this.updateState({ status: 'CONNECTED', errorMessage: undefined });
      return {
        success: true,
        data: { business, users, products, inventory, shifts, expenses, mpesaAccounts },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, error: msg };
    }
  }
}

export const neonService = new NeonService();
