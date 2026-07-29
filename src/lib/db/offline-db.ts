import Dexie, { Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  collection: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data: any;
  localId?: string;
  timestamp: string;
  status: 'pending' | 'failed' | 'processing';
  error?: string;
}

export class DukanKhataDB extends Dexie {
  products!: Table<any, string>;
  parties!: Table<any, string>;
  orders!: Table<any, string>;
  party_transactions!: Table<any, string>;
  party_ledger_entries!: Table<any, string>;
  party_balance_state!: Table<any, string>;
  purchase_bills!: Table<any, string>;
  expenses!: Table<any, string>;
  quotations!: Table<any, string>;
  categories!: Table<any, string>;
  payment_methods!: Table<any, string>;
  vendor_transactions!: Table<any, string>;
  sale_return_transactions!: Table<any, string>;
  transactions!: Table<any, string>;
  subscriptions!: Table<any, string>;
  configurations!: Table<any, string>;
  users!: Table<any, string>;
  modules!: Table<any, string>;
  permissions!: Table<any, string>;
  roles!: Table<any, string>;
  role_permissions!: Table<any, string>;
  user_roles!: Table<any, string>;
  branches!: Table<any, string>;
  syncQueue!: Table<SyncOperation, number>;

  constructor(dbName: string = 'DukanKhataOfflineDB') {
    super(dbName);
    this.version(1).stores({
      products: 'id, name, sku, category',
      parties: 'id, name, phone, company_name, type, is_delete',
      orders: 'id, party_id, created_at, status',
      party_transactions: 'id, party_id, date, type',
      party_ledger_entries: 'id, party_id, created_at, effective_at',
      party_balance_state: 'id, party_id',
      purchase_bills: 'id, party_id, created_at',
      expenses: 'id, date, category',
      quotations: 'id, party_id, created_at, status',
      categories: 'id, name',
      payment_methods: 'id, name',
      syncQueue: '++id, status, timestamp, collection'
    });
    // v2: added payment_method, vendor_transactions, sale_return_transactions, transactions, branches, subscriptions
    // v3: added configurations
    // These were previously added in-place to the version(1) schema, which meant Dexie
    // never created the object stores for users whose local DB already existed at version 1.
    this.version(2).stores({
      products: 'id, name, sku, category',
      parties: 'id, name, phone, company_name, type, is_delete',
      orders: 'id, party_id, created_at, status',
      order_items: 'id, order_id, product_id',
      party_transactions: 'id, party_id, date, type',
      party_ledger_entries: 'id, party_id, created_at, effective_at',
      party_balance_state: 'id, party_id',
      purchase_bills: 'id, party_id, created_at',
      expenses: 'id, date, category',
      quotations: 'id, party_id, created_at, status',
      categories: 'id, name',
      payment_methods: 'id, name',
      payment_method: 'id',
      vendor_transactions: 'id, party_id, date, type',
      sale_return_transactions: 'id, party_id, date',
      transactions: 'id, order_id, type',
      subscriptions: 'id, status, expiry_date',
      configurations: 'id, user_id',
      users: 'id, email',
      modules: 'id, name',
      permissions: 'id, module_id',
      roles: 'id, owner_id',
      role_permissions: 'id, role_id',
      user_roles: 'id, user_id',
      syncQueue: '++id, status, timestamp, collection'
    });
    // v2: added branches, which was previously dropped when the RBAC tables were merged in.
    // A new version is required (rather than editing version(1) in place) so that Dexie
    // actually creates the store for browsers whose local DB already exists at version 1.
    this.version(2).stores({
      products: 'id, name, sku, category',
      parties: 'id, name, phone, company_name, type, is_delete',
      orders: 'id, party_id, created_at, status',
      party_transactions: 'id, party_id, date, type',
      party_ledger_entries: 'id, party_id, created_at, effective_at',
      party_balance_state: 'id, party_id',
      purchase_bills: 'id, party_id, created_at',
      expenses: 'id, date, category',
      quotations: 'id, party_id, created_at, status',
      categories: 'id, name',
      payment_methods: 'id, name',
      vendor_transactions: 'id, party_id, date, type',
      sale_return_transactions: 'id, party_id, date',
      transactions: 'id, order_id, type',
      subscriptions: 'id, status, expiry_date',
      configurations: 'id, user_id',
      users: 'id, email',
      modules: 'id, name',
      permissions: 'id, module_id',
      roles: 'id, owner_id',
      role_permissions: 'id, role_id',
      user_roles: 'id, user_id',
      branches: 'id, name',
      syncQueue: '++id, status, timestamp, collection'
    });
  }
}

const getDynamicDbName = () => {
  if (typeof window !== 'undefined') {
    try {
      const infoStr = localStorage.getItem('tenant_info');
      if (infoStr) {
        const info = JSON.parse(infoStr);
        if (info.userId) {
          return `dukaankhata_${info.userId}`;
        }
      }
    } catch(e) {}
  }
  return 'DukanKhataOfflineDB';
}

export const db = new DukanKhataDB(getDynamicDbName());

export async function clearUserDatabase(): Promise<void> {
  await db.delete();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('last_sync_timestamp');
  }
}
