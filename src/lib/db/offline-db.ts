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
  order_items!: Table<any, string>;
  party_transactions!: Table<any, string>;
  party_ledger_entries!: Table<any, string>;
  party_balance_state!: Table<any, string>;
  purchase_bills!: Table<any, string>;
  expenses!: Table<any, string>;
  quotations!: Table<any, string>;
  categories!: Table<any, string>;
  payment_methods!: Table<any, string>;
  syncQueue!: Table<SyncOperation, number>;

  constructor() {
    super('DukanKhataOfflineDB');
    this.version(1).stores({
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
      syncQueue: '++id, status, timestamp, collection'
    });
  }
}

export const db = new DukanKhataDB();
