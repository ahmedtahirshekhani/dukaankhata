import { db, SyncOperation } from '../db/offline-db';

export class SyncEngine {
  
  static async pullInitialData() {
    try {
      let lastSyncTimestamp = localStorage.getItem('last_sync_timestamp');
      
      if (lastSyncTimestamp) {
        // If essential RBAC tables are empty, the cache is outdated (prior to RBAC feature).
        // Ignore the timestamp to force a full resync and populate these tables.
        const modulesCount = await db.modules.count();
        if (modulesCount === 0) {
          console.warn("RBAC modules missing in local DB. Forcing full resync to recover from old cache.");
          lastSyncTimestamp = null;
        }
      }

      const url = lastSyncTimestamp ? `/api/sync?last_sync=${encodeURIComponent(lastSyncTimestamp)}&_t=${Date.now()}` : `/api/sync?_t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch initial sync data');
      
      const { data, server_timestamp } = await response.json();
      
      // Save everything to IndexedDB
      await db.transaction('rw', 
        [db.products, db.parties, db.orders, 
        db.party_transactions, db.party_ledger_entries, db.party_balance_state,
        db.purchase_bills, db.expenses, db.quotations, db.categories, db.payment_methods,
        db.vendor_transactions, db.sale_return_transactions,
        db.transactions, db.subscriptions, db.configurations,
        db.users, db.modules, db.permissions, db.roles, db.role_permissions, db.user_roles],
        async () => {
          if (data.products?.length) await db.products.bulkPut(data.products);
          if (data.parties?.length) await db.parties.bulkPut(data.parties);
          if (data.orders?.length) await db.orders.bulkPut(data.orders);
          if (data.party_transactions?.length) await db.party_transactions.bulkPut(data.party_transactions);
          if (data.party_ledger_entries?.length) await db.party_ledger_entries.bulkPut(data.party_ledger_entries);
          if (data.party_balance_state?.length) await db.party_balance_state.bulkPut(data.party_balance_state);
          if (data.purchase_bills?.length) await db.purchase_bills.bulkPut(data.purchase_bills);
          if (data.expenses?.length) await db.expenses.bulkPut(data.expenses);
          if (data.quotations?.length) await db.quotations.bulkPut(data.quotations);
          if (data.categories?.length) await db.categories.bulkPut(data.categories);
          if (data.vendor_transactions?.length) await db.vendor_transactions.bulkPut(data.vendor_transactions);
          if (data.sale_return_transactions?.length) await db.sale_return_transactions.bulkPut(data.sale_return_transactions);
          if (data.transactions?.length) await db.transactions.bulkPut(data.transactions);
          if (data.subscriptions?.length) await db.subscriptions.bulkPut(data.subscriptions);
          if (data.users?.length) await db.users.bulkPut(data.users);
          if (data.modules?.length) await db.modules.bulkPut(data.modules);
          
          if (data.payment_methods?.length) {
            try {
              // console.log("Saving payment_methods to Dexie:", data.payment_methods);
              await db.payment_methods.bulkPut(data.payment_methods);
              // console.log("payment_methods saved successfully.");
            } catch (err) {
              console.error("Failed to save payment_methods:", err);
            }
          }
          
          if (data.permissions?.length) {
            try {
              // console.log("Saving permissions to Dexie:", data.permissions);
              await db.permissions.bulkPut(data.permissions);
              // console.log("permissions saved successfully.");
            } catch (err) {
              console.error("Failed to save permissions:", err);
            }
          }
          
          if (data.roles?.length) await db.roles.bulkPut(data.roles);
          if (data.role_permissions?.length) await db.role_permissions.bulkPut(data.role_permissions);
          if (data.user_roles?.length) await db.user_roles.bulkPut(data.user_roles);
          
          if (data.configurations?.length) {
            await db.configurations.bulkPut(data.configurations);
            // Also sync to localStorage for immediate UI availability
            const config = data.configurations[0];
            if (config) {
              localStorage.setItem("setting_counterSale", String(config.is_counterSale_enable || false));
              localStorage.setItem("setting_aiChat", String(config.is_AI_Chat_Enable || false));
              localStorage.setItem("setting_wa", String(config.is_Whatsapp_enable || false));
              if (typeof window !== "undefined") window.dispatchEvent(new Event("featureSettingsUpdated"));
            }
          }
        }
      );
      
      localStorage.setItem('last_sync_timestamp', server_timestamp);
      return true;
    } catch (error) {
      console.error('Initial sync failed:', error);
      return false;
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('initialSyncComplete'));
      }
    }
  }
  static async clearCacheAndResync() {
    try {
      await Promise.all(db.tables.map(table => table.clear()));
      localStorage.removeItem('last_sync_timestamp');
      return await this.pullInitialData();
    } catch (error) {
      console.error('Failed to clear cache and resync:', error);
      return false;
    }
  }

  private static isSyncing = false;

  static async pushQueue() {
    if (!navigator.onLine) return false;
    if (this.isSyncing) return false;
    
    this.isSyncing = true;
    try {
      let successCount = 0;
      
      while (true) {
        const pendingOps = await db.syncQueue.where('status').anyOf('pending', 'processing').toArray();
        if (pendingOps.length === 0) break;
        
        for (const originalOp of pendingOps) {
      try {
        // Re-fetch to ensure we have latest data (e.g. ID replacements from earlier ops in this sync loop)
        const op = await db.syncQueue.get(originalOp.id!);
        if (!op) continue;

        await db.syncQueue.update(op.id!, { status: 'processing' });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(op.url, {
          method: op.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok || (response.status === 404 && op.method === 'DELETE')) {
          // Dispatch a custom event instead of native 'online' to avoid unwanted reloads/refetches from external libs
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('syncComplete', { detail: { collection: op.collection } }));
          }
          
          let result: any = {};
          if (response.ok) {
            result = await response.json().catch(() => ({})); // Parse JSON safely
          }
          
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

            // Fix foreign keys in other pending operations
            const otherPendingOps = await db.syncQueue.where('status').equals('pending').toArray();
            for (const otherOp of otherPendingOps) {
              let modified = false;
              
              if (otherOp.data) {
                const dataStr = JSON.stringify(otherOp.data);
                if (dataStr.includes(op.localId)) {
                  otherOp.data = JSON.parse(dataStr.replaceAll(op.localId, result.id));
                  modified = true;
                }
              }
              
              if (otherOp.url && otherOp.url.includes(op.localId)) {
                otherOp.url = otherOp.url.replaceAll(op.localId, result.id);
                modified = true;
              }
              
              if (modified) {
                await db.syncQueue.put(otherOp);
              }
            }

            // Fix foreign keys in local Dexie tables specifically for users/user_roles
            if (op.collection === 'users' && op.localId) {
              const userRoles = await db.user_roles.where('user_id').equals(op.localId).toArray();
              for (const ur of userRoles) {
                ur.user_id = result.id;
                await db.user_roles.put(ur);
              }
            }
          }
          
          await db.syncQueue.delete(op.id!);
          successCount++;
          
          // Show success toast for data addition if we're in the browser
          if (typeof window !== 'undefined' && op.method === 'POST') {
            const { toast } = await import('sonner');
            toast.success('Data successfully synced to server');
          }
        } else {
          const errorText = await response.text();
          let errorMessage = response.statusText;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {}

          await db.syncQueue.update(op.id!, { status: 'failed', error: errorText });
          
          if (typeof window !== 'undefined') {
            const { toast } = await import('sonner');
            toast.error(`Failed to sync ${op.collection}: ${errorMessage}`);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
           if (typeof window !== 'undefined') window.dispatchEvent(new Event('offline'));
        } else {
           if (typeof window !== 'undefined') {
             const { toast } = await import('sonner');
             toast.error(`Sync error: ${error.message}`);
           }
        }
        // Change status back to pending if it's just a network error, so it automatically retries later
        // or keep as failed so user sees it. Let's keep it 'failed' and provide a way to retry, or change to pending so pushQueue retries.
        // Actually, if we mark it pending it will loop endlessly if called. So failed is fine.
        await db.syncQueue.update(originalOp.id!, { status: 'failed', error: error.message });
      }
    }
    
    // Check again to see if more items were added during the sync
    }
    
    return true;
    } finally {
      this.isSyncing = false;
    }
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
