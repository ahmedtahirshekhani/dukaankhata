import { db, SyncOperation } from '../db/offline-db';

export class SyncEngine {
  
  static async pullInitialData() {
    try {
      const response = await fetch('/api/sync');
      if (!response.ok) throw new Error('Failed to fetch initial sync data');
      
      const { data, server_timestamp } = await response.json();
      
      // Save everything to IndexedDB
      await db.transaction('rw', 
        [db.products, db.parties, db.orders, db.order_items, 
        db.party_transactions, db.party_ledger_entries, db.party_balance_state,
        db.purchase_bills, db.expenses, db.quotations, db.categories, db.payment_methods],
        async () => {
          if (data.products?.length) await db.products.bulkPut(data.products);
          if (data.parties?.length) await db.parties.bulkPut(data.parties);
          if (data.orders?.length) await db.orders.bulkPut(data.orders);
          if (data.order_items?.length) await db.order_items.bulkPut(data.order_items);
          if (data.party_transactions?.length) await db.party_transactions.bulkPut(data.party_transactions);
          if (data.party_ledger_entries?.length) await db.party_ledger_entries.bulkPut(data.party_ledger_entries);
          if (data.party_balance_state?.length) await db.party_balance_state.bulkPut(data.party_balance_state);
          if (data.purchase_bills?.length) await db.purchase_bills.bulkPut(data.purchase_bills);
          if (data.expenses?.length) await db.expenses.bulkPut(data.expenses);
          if (data.quotations?.length) await db.quotations.bulkPut(data.quotations);
          if (data.categories?.length) await db.categories.bulkPut(data.categories);
          if (data.payment_methods?.length) await db.payment_methods.bulkPut(data.payment_methods);
        }
      );
      
      localStorage.setItem('last_sync_timestamp', server_timestamp);
      return true;
    } catch (error) {
      console.error('Initial sync failed:', error);
      return false;
    }
  }

  static async pushQueue() {
    if (!navigator.onLine) return false;
    
    const pendingOps = await db.syncQueue.where('status').equals('pending').toArray();
    if (pendingOps.length === 0) return true;

    let successCount = 0;
    
    for (const op of pendingOps) {
      try {
        await db.syncQueue.update(op.id!, { status: 'processing' });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(op.url, {
          method: op.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('online'));
          const result = await response.json().catch(() => ({})); // Parse JSON safely
          
          // If this was a POST and the server returned a new ID, update the local record
          if (op.method === 'POST' && result.id && op.localId && result.id !== op.localId) {
            const collectionName = op.collection as keyof typeof db;
            const table = db[collectionName] as any; // Cast to bypass strict typings for dynamic access
            
            const item = await table.get(op.localId);
            if (item) {
              item.id = result.id;
              await table.put(item);
              await table.delete(op.localId);
            }
          }
          
          await db.syncQueue.delete(op.id!);
          successCount++;
        } else {
          await db.syncQueue.update(op.id!, { status: 'failed', error: await response.text() });
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
           if (typeof window !== 'undefined') window.dispatchEvent(new Event('offline'));
        }
        // Change status back to pending if it's just a network error, so it automatically retries later
        // or keep as failed so user sees it. Let's keep it 'failed' and provide a way to retry, or change to pending so pushQueue retries.
        // Actually, if we mark it pending it will loop endlessly if called. So failed is fine.
        await db.syncQueue.update(op.id!, { status: 'failed', error: error.message });
      }
    }
    
    return successCount === pendingOps.length;
  }

  static async queueOperation(collection: string, method: 'POST'|'PUT'|'DELETE', url: string, data: any, localId?: string) {
    await db.syncQueue.add({
      collection,
      method,
      url,
      data,
      localId,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
    
    // Attempt immediate sync
    if (navigator.onLine) {
      this.pushQueue();
    }
  }
}
