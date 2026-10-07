/**
 * Neon Serverless PostgreSQL Database Service
 * Robust, resilient relational sync with self-healing schema migration
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
  BusinessPartner,
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
  discrepancies?: Discrepancy[];
  interTransfers?: InterBusinessTransfer[];
  partners?: BusinessPartner[];
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
}

export const DEFAULT_NEON_URL =
  'postgresql://neondb_owner:npg_3H9lLezpVIMy@ep-mute-firefly-b1blllpb-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const STORAGE_KEY_NEON_URL = 'bar_track_neon_url';
const STORAGE_KEY_LAST_SYNC = 'bar_track_neon_last_sync';

class NeonService {
  private client: NeonQueryFunction<false, false> | null = null;
  private schemaVerified = false;
  private state: NeonState = {
    status: 'DISCONNECTED',
    databaseUrl: null,
  };
  private subscribers: ((state: NeonState) => void)[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const savedUrl = this.getSavedDatabaseUrl();
    if (savedUrl) {
      this.state.databaseUrl = savedUrl;
      this.initializeClient(savedUrl);
    }
    if (typeof window !== 'undefined') {
      this.setupNetworkListeners();
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.checkConnectionNow();
    });

    window.addEventListener('offline', () => {
      this.updateState({
        status: 'DISCONNECTED',
        errorMessage: 'Device offline. Changes will save locally and auto-sync when reconnected.',
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.checkConnectionNow();
      }
    });

    // Start 30-second heartbeat check
    this.heartbeatTimer = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.checkConnectionNow();
      }
    }, 30000);
  }

  public getSavedDatabaseUrl(): string | null {
    if (typeof window === 'undefined') return DEFAULT_NEON_URL;
    const fromStorage = localStorage.getItem(STORAGE_KEY_NEON_URL);
    if (fromStorage && fromStorage.startsWith('postgres')) return fromStorage;

    const fromEnv = import.meta.env.VITE_NEON_DATABASE_URL;
    if (fromEnv && fromEnv.startsWith('postgres') && !fromEnv.includes('user:password@')) {
      return fromEnv;
    }

    return DEFAULT_NEON_URL;
  }

  public setDatabaseUrl(url: string | null) {
    if (url && url.trim().length > 0) {
      const cleanUrl = url.trim();
      localStorage.setItem(STORAGE_KEY_NEON_URL, cleanUrl);
      this.state.databaseUrl = cleanUrl;
      this.schemaVerified = false;
      this.initializeClient(cleanUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_NEON_URL);
      this.state.databaseUrl = DEFAULT_NEON_URL;
      this.schemaVerified = false;
      this.initializeClient(DEFAULT_NEON_URL);
    }
  }

  public async checkConnectionNow(): Promise<boolean> {
    const url = this.state.databaseUrl || this.getSavedDatabaseUrl();
    if (!url) {
      this.updateState({ status: 'DISCONNECTED', errorMessage: 'No database URL configured.' });
      return false;
    }

    const res = await this.testConnection(url);
    if (res.success) {
      this.updateState({
        status: 'CONNECTED',
        databaseName: res.database,
        latencyMs: res.latencyMs,
        errorMessage: undefined,
      });
      if (!this.schemaVerified) {
        this.ensureSchema(url).catch(() => {});
      }
      return true;
    } else {
      this.updateState({
        status: 'ERROR',
        errorMessage: res.error,
      });
      return false;
    }
  }

  private initializeClient(url: string) {
    try {
      this.updateState({ status: 'CONNECTING', errorMessage: undefined });
      this.client = neon(url);
      this.testConnection(url).then(async (res) => {
        if (res.success) {
          this.updateState({
            status: 'CONNECTED',
            databaseName: res.database,
            latencyMs: res.latencyMs,
            errorMessage: undefined,
          });
          // Automatically run schema alignment in background to prevent column/relation mismatch errors
          this.ensureSchema(url).catch((err) => {
            console.warn('Neon background schema verification notice:', err);
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
   * Ensures schema is initialized once per session
   */
  private async ensureSchema(url?: string): Promise<void> {
    if (this.schemaVerified) return;
    await this.initSchema(url);
    this.schemaVerified = true;
  }

  /**
   * Comprehensive PostgreSQL DDL & Column Alignment Migration for Neon
   * Defensively creates and aligns all 12 tables and missing columns with CASCADE integrity.
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
          active_shift_transfer_code TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_name TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS connect_code TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active_shift_code TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active_shift_transfer_code TEXT;`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE businesses ALTER COLUMN phone DROP NOT NULL;`;
      await sql`ALTER TABLE businesses ALTER COLUMN owner_name DROP NOT NULL;`;
      await sql`ALTER TABLE businesses ALTER COLUMN address DROP NOT NULL;`;

      // 2. Users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          password TEXT,
          password_hash TEXT,
          password_salt TEXT,
          pin_code TEXT,
          pin_code_hash TEXT,
          pin_salt TEXT,
          is_archived BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_salt TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE users ALTER COLUMN pin_code DROP NOT NULL;`;
      await sql`ALTER TABLE users ALTER COLUMN password DROP NOT NULL;`;

      // 3. Products table
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
          volume_ml NUMERIC(12,2),
          is_archived BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS volume_ml NUMERIC(12,2);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 5;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_measured BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS measurement_type TEXT DEFAULT 'COUNT';`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS measure_unit_label TEXT;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS total_measured_value_kes NUMERIC(12,2);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

      // 4. Inventory table
      await sql`
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL,
          quantity_on_hand NUMERIC DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

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
          total_cost_of_goods_sold NUMERIC(12,2),
          gross_profit NUMERIC(12,2),
          net_profit NUMERIC(12,2),
          financial_variance NUMERIC(12,2),
          notes TEXT,
          shift_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_cash_float NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opening_mpesa_balance NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_actual NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_mpesa_balance NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recorded_sales_count INT DEFAULT 0;`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS calculated_mpesa_income NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS calculated_cash_income NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS expected_sales_revenue NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_expenses NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_cost_of_goods_sold NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS net_profit NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS financial_variance NUMERIC(12,2);`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes TEXT;`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_data JSONB;`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;

      // 6. Expenses table
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          shift_id TEXT,
          category TEXT NOT NULL,
          amount NUMERIC(12,2) NOT NULL,
          payment_method TEXT DEFAULT 'CASH',
          description TEXT,
          receipt_ref TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS shift_id TEXT;`;
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';`;
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_ref TEXT;`;
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE expenses ALTER COLUMN description DROP NOT NULL;`;

      // 7. Mpesa Accounts table
      await sql`
        CREATE TABLE IF NOT EXISTS mpesa_accounts (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          account_name TEXT NOT NULL,
          account_type TEXT,
          type TEXT,
          identifier TEXT,
          account_number TEXT,
          opening_balance NUMERIC(12,2) DEFAULT 0,
          current_balance NUMERIC(12,2) DEFAULT 0,
          is_primary BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS type TEXT;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS identifier TEXT;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS account_number TEXT;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2) DEFAULT 0;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE mpesa_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
      await sql`ALTER TABLE mpesa_accounts ALTER COLUMN account_number DROP NOT NULL;`;
      await sql`ALTER TABLE mpesa_accounts ALTER COLUMN type DROP NOT NULL;`;

      // 8. Operational Events
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
      await sql`ALTER TABLE operational_events ADD COLUMN IF NOT EXISTS actor_name TEXT;`;
      await sql`ALTER TABLE operational_events ADD COLUMN IF NOT EXISTS severity TEXT;`;
      await sql`ALTER TABLE operational_events ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);`;
      await sql`ALTER TABLE operational_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`;

      // 9. Stock Additions
      await sql`
        CREATE TABLE IF NOT EXISTS stock_additions (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          shift_id TEXT,
          shift_number TEXT,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity NUMERIC(12,2) NOT NULL,
          unit_cost NUMERIC(12,2) DEFAULT 0,
          worker_name TEXT,
          status TEXT DEFAULT 'SAVED_LOCKED',
          saved_at TIMESTAMPTZ,
          saved_by TEXT,
          is_immutable BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS shift_id TEXT;`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS shift_number TEXT;`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS worker_name TEXT;`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SAVED_LOCKED';`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS saved_by TEXT;`;
      await sql`ALTER TABLE stock_additions ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT FALSE;`;

      // 10. Discrepancies
      await sql`
        CREATE TABLE IF NOT EXISTS discrepancies (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          shift_id TEXT NOT NULL,
          shift_number TEXT NOT NULL,
          worker_name TEXT NOT NULL,
          responsible_worker_name TEXT,
          previous_shift_id TEXT,
          type TEXT NOT NULL,
          item_id TEXT,
          item_name TEXT NOT NULL,
          expected NUMERIC(12,2) DEFAULT 0,
          actual NUMERIC(12,2) DEFAULT 0,
          variance NUMERIC(12,2) DEFAULT 0,
          monetary_value NUMERIC(12,2) DEFAULT 0,
          severity TEXT NOT NULL,
          status TEXT NOT NULL,
          owner_notes TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // 11. Inter-business transfers
      await sql`
        CREATE TABLE IF NOT EXISTS inter_business_transfers (
          id TEXT PRIMARY KEY,
          from_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          from_business_name TEXT NOT NULL,
          from_shift_id TEXT NOT NULL,
          sender_worker_name TEXT NOT NULL,
          to_business_id TEXT NOT NULL,
          to_business_name TEXT NOT NULL,
          to_shift_id TEXT,
          receiver_worker_name TEXT,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity NUMERIC(12,2) NOT NULL,
          unit_cost NUMERIC(12,2) NOT NULL,
          total_cost_value NUMERIC(12,2) NOT NULL,
          status TEXT NOT NULL,
          dispatched_at TIMESTAMPTZ DEFAULT NOW(),
          accepted_at TIMESTAMPTZ,
          notes TEXT
        );
      `;

      // 12. Business partners
      await sql`
        CREATE TABLE IF NOT EXISTS business_partners (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          partner_business_id TEXT NOT NULL,
          partner_name TEXT NOT NULL,
          partner_phone TEXT,
          partner_connect_code TEXT,
          net_cost_balance NUMERIC(12,2) DEFAULT 0,
          connected_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // Safe Foreign Key Constraints with ON DELETE CASCADE
      const ensureFkSql = [
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_business') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_business') THEN
            ALTER TABLE products ADD CONSTRAINT fk_products_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_business') THEN
            ALTER TABLE inventory ADD CONSTRAINT fk_inventory_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_shifts_business') THEN
            ALTER TABLE shifts ADD CONSTRAINT fk_shifts_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_business') THEN
            ALTER TABLE expenses ADD CONSTRAINT fk_expenses_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mpesa_business') THEN
            ALTER TABLE mpesa_accounts ADD CONSTRAINT fk_mpesa_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_additions_business') THEN
            ALTER TABLE stock_additions ADD CONSTRAINT fk_stock_additions_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
          END IF;
        END $$;`,
      ];

      for (const statement of ensureFkSql) {
        await sql.query(statement);
      }

      // Safe Unique Indexes for upsert conflicts
      await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_biz_username ON users(business_id, username);`);
      await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_biz_prod ON inventory(business_id, product_id);`);

      this.schemaVerified = true;
      this.updateState({ status: 'CONNECTED', errorMessage: undefined });
      return { success: true, message: 'Neon PostgreSQL schema verified & all table relations aligned successfully.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, message: `Schema initialization failed: ${msg}` };
    }
  }

  /**
   * Pushes full business payload to Neon with automatic self-healing schema retry
   */
  public async syncPayloadToNeon(payload: SyncPayload, isRetry = false): Promise<{ success: boolean; message: string }> {
    const url = this.state.databaseUrl || this.getSavedDatabaseUrl();
    if (!url) {
      return { success: false, message: 'Neon Database URL not configured.' };
    }

    try {
      this.updateState({ status: 'SYNCING' });
      const sql = this.client || neon(url);
      const {
        business,
        users,
        products,
        inventory,
        shifts,
        expenses,
        mpesaAccounts,
        events = [],
        stockAdditions = [],
        discrepancies = [],
        interTransfers = [],
        partners = [],
      } = payload;

      // 1. Ensure business exists
      await sql`
        INSERT INTO businesses (
          id, name, phone, address, owner_name, connect_code,
          active_shift_code, active_shift_transfer_code, updated_at
        )
        VALUES (
          ${business.id},
          ${business.name},
          ${business.phone || ''},
          ${business.address || ''},
          ${business.ownerName || ''},
          ${business.connectCode || ''},
          ${business.activeShiftId || ''},
          ${business.activeShiftTransferCode || ''},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          owner_name = EXCLUDED.owner_name,
          connect_code = EXCLUDED.connect_code,
          active_shift_code = EXCLUDED.active_shift_code,
          active_shift_transfer_code = EXCLUDED.active_shift_transfer_code,
          updated_at = NOW();
      `;

      // 2. Upsert users
      for (const u of users) {
        await sql`
          INSERT INTO users (
            id, business_id, username, name, role,
            password, password_hash, password_salt,
            pin_code, pin_code_hash, pin_salt, is_archived,
            updated_at
          )
          VALUES (
            ${u.id},
            ${business.id},
            ${u.username},
            ${u.name},
            ${u.role},
            ${u.password || ''},
            ${u.password || ''},
            ${u.passwordSalt || ''},
            ${u.pinCode || ''},
            ${u.pinCode || ''},
            ${u.pinSalt || ''},
            ${u.isArchived || false},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            password = EXCLUDED.password,
            password_hash = EXCLUDED.password_hash,
            password_salt = EXCLUDED.password_salt,
            pin_code = EXCLUDED.pin_code,
            pin_code_hash = EXCLUDED.pin_code_hash,
            pin_salt = EXCLUDED.pin_salt,
            is_archived = EXCLUDED.is_archived,
            updated_at = NOW();
        `;
      }

      // 3. Upsert products
      for (const p of products) {
        await sql`
          INSERT INTO products (
            id, business_id, name, category, unit,
            cost_price, selling_price, reorder_level, volume_ml, is_archived,
            is_measured, measurement_type, measure_unit_label, total_measured_value_kes,
            updated_at
          )
          VALUES (
            ${p.id},
            ${business.id},
            ${p.name},
            ${p.category},
            ${p.unit},
            ${p.costPrice || 0},
            ${p.sellingPrice || 0},
            ${p.reorderLevel || 5},
            ${p.volumeMl || null},
            ${p.isArchived || false},
            ${p.isMeasured || false},
            ${p.measurementType || (p.isMeasured ? 'VALUE' : 'COUNT')},
            ${p.measureUnitLabel || (p.isMeasured ? 'KES Value' : null)},
            ${p.totalMeasuredValueKes !== undefined ? p.totalMeasuredValueKes : (p.isMeasured ? (p.sellingPrice || 0) : null)},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            cost_price = EXCLUDED.cost_price,
            selling_price = EXCLUDED.selling_price,
            reorder_level = EXCLUDED.reorder_level,
            volume_ml = EXCLUDED.volume_ml,
            is_archived = EXCLUDED.is_archived,
            is_measured = EXCLUDED.is_measured,
            measurement_type = EXCLUDED.measurement_type,
            measure_unit_label = EXCLUDED.measure_unit_label,
            total_measured_value_kes = EXCLUDED.total_measured_value_kes,
            updated_at = NOW();
        `;
      }

      // 4. Upsert inventory
      for (const inv of inventory) {
        await sql`
          INSERT INTO inventory (id, business_id, product_id, quantity_on_hand, updated_at)
          VALUES (
            ${inv.id || `${business.id}-${inv.productId}`},
            ${business.id},
            ${inv.productId},
            ${inv.quantityOnHand || 0},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            updated_at = NOW();
        `;
      }

      // 5. Upsert shifts
      for (const s of shifts) {
        await sql`
          INSERT INTO shifts (
            id, business_id, shift_number, worker_id, worker_name, status,
            opened_at, closed_at, opening_cash_float, opening_mpesa_balance,
            closing_cash_actual, closing_mpesa_balance, recorded_sales_count,
            calculated_mpesa_income, calculated_cash_income,
            expected_sales_revenue, total_expenses, total_cost_of_goods_sold,
            gross_profit, net_profit, financial_variance,
            notes, shift_data, updated_at
          )
          VALUES (
            ${s.id},
            ${business.id},
            ${s.shiftNumber},
            ${s.workerId},
            ${s.workerName},
            ${s.status},
            ${s.openedAt},
            ${s.closedAt || null},
            ${s.openingCashFloat || 0},
            ${s.openingMpesaBalance || 0},
            ${s.closingCashActual || null},
            ${s.closingMpesaBalance || null},
            ${s.recordedSalesCount || 0},
            ${s.calculatedMpesaIncome || null},
            ${s.calculatedCashIncome || null},
            ${s.expectedSalesRevenue || 0},
            ${s.totalExpenses || null},
            ${s.totalCostOfGoodsSold || null},
            ${s.grossProfit || 0},
            ${s.netProfit || 0},
            ${s.financialVariance || 0},
            ${s.closingNotes || ''},
            ${JSON.stringify(s)}::jsonb,
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            closed_at = EXCLUDED.closed_at,
            closing_cash_actual = EXCLUDED.closing_cash_actual,
            closing_mpesa_balance = EXCLUDED.closing_mpesa_balance,
            recorded_sales_count = EXCLUDED.recorded_sales_count,
            calculated_mpesa_income = EXCLUDED.calculated_mpesa_income,
            calculated_cash_income = EXCLUDED.calculated_cash_income,
            expected_sales_revenue = EXCLUDED.expected_sales_revenue,
            total_expenses = EXCLUDED.total_expenses,
            total_cost_of_goods_sold = EXCLUDED.total_cost_of_goods_sold,
            gross_profit = EXCLUDED.gross_profit,
            net_profit = EXCLUDED.net_profit,
            financial_variance = EXCLUDED.financial_variance,
            notes = EXCLUDED.notes,
            shift_data = EXCLUDED.shift_data,
            updated_at = NOW();
        `;
      }

      // 6. Upsert expenses
      for (const exp of expenses) {
        await sql`
          INSERT INTO expenses (
            id, business_id, shift_id, category, amount, payment_method,
            description, receipt_ref, timestamp
          )
          VALUES (
            ${exp.id},
            ${business.id},
            ${exp.shiftId},
            ${exp.category},
            ${exp.amount},
            ${exp.paymentMethod || 'CASH'},
            ${exp.description || ''},
            ${exp.receiptRef || null},
            ${exp.timestamp || new Date().toISOString()}
          )
          ON CONFLICT (id) DO UPDATE SET
            category = EXCLUDED.category,
            amount = EXCLUDED.amount,
            payment_method = EXCLUDED.payment_method,
            description = EXCLUDED.description,
            receipt_ref = EXCLUDED.receipt_ref,
            timestamp = EXCLUDED.timestamp;
        `;
      }

      // 7. Upsert mpesa accounts
      for (const acc of mpesaAccounts) {
        await sql`
          INSERT INTO mpesa_accounts (
            id, business_id, account_name, account_type, type,
            identifier, account_number, current_balance, is_primary, is_active,
            updated_at
          )
          VALUES (
            ${acc.id},
            ${business.id},
            ${acc.accountName},
            ${acc.accountType},
            ${acc.accountType},
            ${acc.identifier},
            ${acc.accountNumber || ''},
            ${acc.currentBalance || 0},
            ${acc.isPrimary || false},
            ${acc.isActive !== false},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            account_name = EXCLUDED.account_name,
            account_type = EXCLUDED.account_type,
            type = EXCLUDED.type,
            identifier = EXCLUDED.identifier,
            account_number = EXCLUDED.account_number,
            current_balance = EXCLUDED.current_balance,
            is_primary = EXCLUDED.is_primary,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
        `;
      }

      // 8. Upsert operational events
      for (const evt of events) {
        await sql`
          INSERT INTO operational_events (
            id, business_id, type, title, description,
            actor_name, severity, amount
          )
          VALUES (
            ${evt.id},
            ${business.id},
            ${evt.type},
            ${evt.title},
            ${evt.description},
            ${evt.actorName},
            ${evt.severity},
            ${evt.amount || null}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
      }

      // 9. Upsert stock additions
      for (const add of stockAdditions) {
        await sql`
          INSERT INTO stock_additions (
            id, business_id, shift_id, shift_number, product_id, product_name,
            quantity, unit_cost, worker_name, status, saved_at, saved_by,
            is_immutable, timestamp
          )
          VALUES (
            ${add.id},
            ${business.id},
            ${add.shiftId},
            ${add.shiftNumber || null},
            ${add.productId},
            ${add.productName},
            ${add.quantity},
            0,
            ${add.workerName},
            ${add.status},
            ${add.savedAt || null},
            ${add.savedBy || null},
            ${add.isImmutable || false},
            ${add.timestamp || new Date().toISOString()}
          )
          ON CONFLICT (id) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            status = EXCLUDED.status,
            saved_at = EXCLUDED.saved_at,
            saved_by = EXCLUDED.saved_by,
            is_immutable = EXCLUDED.is_immutable;
        `;
      }

      // 10. Upsert discrepancies
      for (const d of discrepancies) {
        await sql`
          INSERT INTO discrepancies (
            id, business_id, shift_id, shift_number, worker_name,
            responsible_worker_name, previous_shift_id, type, item_id, item_name,
            expected, actual, variance, monetary_value, severity, status,
            owner_notes, timestamp
          )
          VALUES (
            ${d.id},
            ${business.id},
            ${d.shiftId},
            ${d.shiftNumber},
            ${d.workerName},
            ${d.responsibleWorkerName || null},
            ${d.previousShiftId || null},
            ${d.type},
            ${d.itemId || null},
            ${d.itemName},
            ${d.expected},
            ${d.actual},
            ${d.variance},
            ${d.monetaryValue},
            ${d.severity},
            ${d.status},
            ${d.ownerNotes || null},
            ${d.timestamp}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            owner_notes = EXCLUDED.owner_notes,
            severity = EXCLUDED.severity;
        `;
      }

      // 11. Upsert inter-business transfers
      for (const t of interTransfers) {
        await sql`
          INSERT INTO inter_business_transfers (
            id, from_business_id, from_business_name, from_shift_id,
            sender_worker_name, to_business_id, to_business_name, to_shift_id,
            receiver_worker_name, product_id, product_name, quantity,
            unit_cost, total_cost_value, status, dispatched_at, accepted_at,
            notes
          )
          VALUES (
            ${t.id},
            ${t.fromBusinessId},
            ${t.fromBusinessName},
            ${t.fromShiftId},
            ${t.senderWorkerName},
            ${t.toBusinessId},
            ${t.toBusinessName},
            ${t.toShiftId || null},
            ${t.receiverWorkerName || null},
            ${t.productId},
            ${t.productName},
            ${t.quantity},
            ${t.unitCost},
            ${t.totalCostValue},
            ${t.status},
            ${t.dispatchedAt},
            ${t.acceptedAt || null},
            ${t.notes || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            accepted_at = EXCLUDED.accepted_at,
            to_shift_id = EXCLUDED.to_shift_id,
            receiver_worker_name = EXCLUDED.receiver_worker_name,
            notes = EXCLUDED.notes;
        `;
      }

      // 12. Upsert business partners
      for (const p of partners) {
        await sql`
          INSERT INTO business_partners (
            id, business_id, partner_business_id, partner_name,
            partner_phone, partner_connect_code, net_cost_balance, connected_at
          )
          VALUES (
            ${p.id},
            ${p.businessId},
            ${p.partnerBusinessId},
            ${p.partnerName},
            ${p.partnerPhone || ''},
            ${p.partnerConnectCode || ''},
            ${p.netCostBalance || 0},
            ${p.connectedAt}
          )
          ON CONFLICT (id) DO UPDATE SET
            partner_name = EXCLUDED.partner_name,
            partner_phone = EXCLUDED.partner_phone,
            net_cost_balance = EXCLUDED.net_cost_balance;
        `;
      }

      const syncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, syncTime);
      this.updateState({ status: 'CONNECTED', lastSyncedAt: syncTime, errorMessage: undefined });

      return { success: true, message: `Successfully synchronized ${business.name} to Neon PostgreSQL.` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Self-healing schema retry: If a missing column or table is encountered, run initSchema and retry once
      if (!isRetry && (msg.includes('does not exist') || msg.includes('undefined_column') || msg.includes('undefined_table'))) {
        console.warn('Neon relational mismatch detected. Automatically aligning schema and retrying sync...', msg);
        const schemaRes = await this.initSchema(url);
        if (schemaRes.success) {
          return this.syncPayloadToNeon(payload, true);
        }
      }

      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, message: `Neon sync failed: ${msg}` };
    }
  }

  /**
   * Pulls clean data from Neon PostgreSQL for a business
   */
  public async pullBusinessFromNeon(businessId: string): Promise<{
    success: boolean;
    data?: PullResult;
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
        phone: b.phone || '',
        address: b.address || '',
        ownerName: b.owner_name || '',
        connectCode: b.connect_code || '',
        activeShiftTransferCode: b.active_shift_transfer_code || b.active_shift_code || '',
        activeShiftId: b.active_shift_code || '',
      };

      const userRows = await sql`SELECT * FROM users WHERE business_id = ${businessId};`;
      const users: User[] = userRows.map((u) => ({
        id: u.id,
        businessId: u.business_id,
        username: u.username,
        name: u.name,
        role: u.role,
        password: u.password_hash || u.password,
        passwordSalt: u.password_salt,
        pinCode: u.pin_code_hash || u.pin_code,
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
        costPrice: Number(p.cost_price || 0),
        sellingPrice: Number(p.selling_price || 0),
        reorderLevel: Number(p.reorder_level || 5),
        volumeMl: p.volume_ml ? Number(p.volume_ml) : undefined,
        isArchived: p.is_archived,
        isMeasured: Boolean(p.is_measured),
        measurementType: p.measurement_type || (p.is_measured ? 'VALUE' : 'COUNT'),
        measureUnitLabel: p.measure_unit_label || (p.is_measured ? 'KES Value' : undefined),
        totalMeasuredValueKes: p.total_measured_value_kes != null ? Number(p.total_measured_value_kes) : (p.is_measured ? Number(p.selling_price || 0) : undefined),
      }));

      const invRows = await sql`SELECT * FROM inventory WHERE business_id = ${businessId};`;
      const inventory: InventoryItem[] = invRows.map((i) => ({
        id: i.id || `${businessId}-${i.product_id}`,
        productId: i.product_id,
        quantityOnHand: Number(i.quantity_on_hand || 0),
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
          openingCashFloat: Number(s.opening_cash_float || 0),
          openingMpesaBalance: Number(s.opening_mpesa_balance || 0),
          closingCashActual: s.closing_cash_actual ? Number(s.closing_cash_actual) : undefined,
          closingMpesaBalance: s.closing_mpesa_balance ? Number(s.closing_mpesa_balance) : undefined,
          recordedSalesCount: Number(s.recorded_sales_count || 0),
          calculatedMpesaIncome: s.calculated_mpesa_income ? Number(s.calculated_mpesa_income) : undefined,
          calculatedCashIncome: s.calculated_cash_income ? Number(s.calculated_cash_income) : undefined,
          expectedSalesRevenue: Number(s.expected_sales_revenue || 0),
          totalExpenses: s.total_expenses ? Number(s.total_expenses) : undefined,
          totalCostOfGoodsSold: s.total_cost_of_goods_sold ? Number(s.total_cost_of_goods_sold) : undefined,
          grossProfit: Number(s.gross_profit || 0),
          netProfit: Number(s.net_profit || 0),
          financialVariance: Number(s.financial_variance || 0),
          closingNotes: s.notes,
        };
      });

      const expRows = await sql`SELECT * FROM expenses WHERE business_id = ${businessId} ORDER BY timestamp DESC;`;
      const expenses: Expense[] = expRows.map((e) => ({
        id: e.id,
        shiftId: e.shift_id,
        category: e.category,
        amount: Number(e.amount),
        paymentMethod: e.payment_method || 'CASH',
        description: e.description || '',
        receiptRef: e.receipt_ref,
        timestamp: e.timestamp || e.created_at,
      }));

      const mpesaRows = await sql`SELECT * FROM mpesa_accounts WHERE business_id = ${businessId};`;
      const mpesaAccounts: MpesaAccount[] = mpesaRows.map((m) => ({
        id: m.id,
        businessId: m.business_id,
        accountName: m.account_name,
        accountType: m.account_type || m.type,
        identifier: m.identifier || m.account_number || '',
        accountNumber: m.account_number,
        currentBalance: Number(m.current_balance || 0),
        isPrimary: m.is_primary,
        isActive: m.is_active,
      }));

      const eventRows = await sql`SELECT * FROM operational_events WHERE business_id = ${businessId} ORDER BY created_at DESC LIMIT 50;`;
      const events: OperationalEvent[] = eventRows.map((ev) => ({
        id: ev.id,
        type: ev.type,
        title: ev.title,
        description: ev.description,
        actorName: ev.actor_name,
        severity: ev.severity,
        amount: ev.amount ? Number(ev.amount) : undefined,
        timestamp: ev.created_at,
      }));

      const additionRows = await sql`SELECT * FROM stock_additions WHERE business_id = ${businessId} ORDER BY timestamp DESC;`;
      const stockAdditions: StockAdditionRecord[] = additionRows.map((a) => ({
        id: a.id,
        shiftId: a.shift_id,
        shiftNumber: a.shift_number,
        productId: a.product_id,
        productName: a.product_name,
        quantity: Number(a.quantity),
        workerName: a.worker_name,
        timestamp: a.timestamp,
        status: a.status || 'SAVED_LOCKED',
        savedAt: a.saved_at,
        savedBy: a.saved_by,
        isImmutable: a.is_immutable,
      }));

      const discRows = await sql`SELECT * FROM discrepancies WHERE business_id = ${businessId} ORDER BY timestamp DESC;`;
      const discrepancies: Discrepancy[] = discRows.map((d) => ({
        id: d.id,
        shiftId: d.shift_id,
        shiftNumber: d.shift_number,
        workerName: d.worker_name,
        responsibleWorkerName: d.responsible_worker_name,
        previousShiftId: d.previous_shift_id,
        type: d.type,
        itemId: d.item_id,
        itemName: d.item_name,
        expected: Number(d.expected),
        actual: Number(d.actual),
        variance: Number(d.variance),
        monetaryValue: Number(d.monetary_value),
        severity: d.severity,
        status: d.status,
        ownerNotes: d.owner_notes,
        timestamp: d.timestamp,
      }));

      const transferRows = await sql`SELECT * FROM inter_business_transfers WHERE from_business_id = ${businessId} OR to_business_id = ${businessId} ORDER BY dispatched_at DESC;`;
      const interTransfers: InterBusinessTransfer[] = transferRows.map((t) => ({
        id: t.id,
        fromBusinessId: t.from_business_id,
        fromBusinessName: t.from_business_name,
        fromShiftId: t.from_shift_id,
        senderWorkerName: t.sender_worker_name,
        toBusinessId: t.to_business_id,
        toBusinessName: t.to_business_name,
        toShiftId: t.to_shift_id,
        receiverWorkerName: t.receiver_worker_name,
        productId: t.product_id,
        productName: t.product_name,
        quantity: Number(t.quantity),
        unitCost: Number(t.unit_cost),
        totalCostValue: Number(t.total_cost_value),
        status: t.status,
        dispatchedAt: t.dispatched_at,
        acceptedAt: t.accepted_at,
        notes: t.notes,
      }));

      const partnerRows = await sql`SELECT * FROM business_partners WHERE business_id = ${businessId};`;
      const partners: BusinessPartner[] = partnerRows.map((p) => ({
        id: p.id,
        businessId: p.business_id,
        partnerBusinessId: p.partner_business_id,
        partnerName: p.partner_name,
        partnerPhone: p.partner_phone,
        partnerConnectCode: p.partner_connect_code,
        netCostBalance: Number(p.net_cost_balance || 0),
        connectedAt: p.connected_at,
      }));

      this.updateState({ status: 'CONNECTED', errorMessage: undefined });
      return {
        success: true,
        data: {
          business,
          users,
          products,
          inventory,
          shifts,
          expenses,
          mpesaAccounts,
          events,
          stockAdditions,
          discrepancies,
          interTransfers,
          partners,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({ status: 'ERROR', errorMessage: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Pulls all business accounts and users from Neon PostgreSQL
   * Enables cross-browser, cross-device instant account detection
   */
  public async pullAllBusinessesAndUsers(): Promise<{
    success: boolean;
    businesses?: BusinessProfile[];
    users?: User[];
    error?: string;
  }> {
    const url = this.state.databaseUrl || this.getSavedDatabaseUrl();
    if (!url) return { success: false, error: 'No Neon Database URL configured.' };

    try {
      const sql = this.client || neon(url);
      const bizRows = await sql`SELECT * FROM businesses ORDER BY created_at ASC;`;
      const businesses: BusinessProfile[] = bizRows.map((b) => ({
        id: b.id,
        name: b.name,
        phone: b.phone || '',
        address: b.address || '',
        ownerName: b.owner_name || '',
        connectCode: b.connect_code || '',
        activeShiftTransferCode: b.active_shift_transfer_code || b.active_shift_code || '',
        activeShiftId: b.active_shift_code || '',
      }));

      const userRows = await sql`SELECT * FROM users;`;
      const users: User[] = userRows.map((u) => ({
        id: u.id,
        businessId: u.business_id,
        username: u.username,
        name: u.name,
        role: u.role,
        password: u.password_hash || u.password,
        passwordSalt: u.password_salt,
        pinCode: u.pin_code_hash || u.pin_code,
        pinSalt: u.pin_salt,
        isArchived: u.is_archived,
        createdAt: u.created_at,
      }));

      return { success: true, businesses, users };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export const neonService = new NeonService();
