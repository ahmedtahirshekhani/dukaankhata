import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/offline-db';

export function useOfflineCustomers(searchQuery: string = '') {
  return useLiveQuery(() => {
    return db.parties.filter(party => {
      // Filter out deleted parties
      if (party.is_delete === 1) return false;
      
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        return Boolean(party.name?.toLowerCase().includes(lowerSearch) || 
         party.phone?.includes(searchQuery) ||
         party.company_name?.toLowerCase().includes(lowerSearch));
      }
      return true;
    }).toArray().then(arr => arr.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    }));
  }, [searchQuery]);
}


export function useOfflineProducts(searchQuery: string = '', type: string = 'all') {
  return useLiveQuery(() => {
    let collection = db.products;
    
    return collection.filter(product => {
      let matchesSearch = true;
      let matchesType = true;
      
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        matchesSearch = (
          product.name?.toLowerCase().includes(lowerSearch) || 
          product.sku?.toLowerCase().includes(lowerSearch) ||
          product.category?.toLowerCase().includes(lowerSearch)
        );
      }
      
      if (type && type !== 'all') {
        matchesType = product.type === type;
      }
      
      return matchesSearch && matchesType && product.is_delete !== 1;
    }).toArray().then(arr => arr.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    }));
  }, [searchQuery, type]);
}

export function useOfflineOrders() {
  return useLiveQuery(() => db.orders.toArray());
}

export function useOfflineExpenses() {
  return useLiveQuery(() => db.expenses.toArray());
}

export function useOfflineLedger(partyId: string) {
  return useLiveQuery(() => db.party_ledger_entries.where('party_id').equals(partyId).toArray(), [partyId]);
}
