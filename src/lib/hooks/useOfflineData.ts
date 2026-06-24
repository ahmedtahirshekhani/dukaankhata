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

export function useOfflineCustomerTransactions(type: string = 'payment-in', searchQuery: string = '', filterPaymentMethodId: string = 'all', filterPartyId: string = 'all') {
  return useLiveQuery(async () => {
    // Join parties and payment methods locally
    const allParties = await db.parties.toArray();
    const partyMap = new Map(allParties.map(p => [(p.id || p._id)?.toString(), p.name]));
    
    const allMethods = await db.payment_methods.toArray();
    const methodMap = new Map(allMethods.map(m => [(m.id || m._id)?.toString(), m.name || m.bankName || m.bank_name]));

    const transactions = await db.party_transactions.toArray();
    
    return transactions.map(t => {
      // Normalize snake_case (server) to camelCase (local/UI)
      const customerId = (t.customerId || t.customer_id)?.toString();
      const paymentMethodId = (t.paymentMethodId || t.payment_method_id)?.toString();
      const paymentAmount = t.paymentAmount ?? t.payment_amount ?? 0;
      let formattedDate = t.date;
      if (formattedDate && typeof formattedDate === 'string' && formattedDate.includes('T')) {
        formattedDate = formattedDate.split('T')[0];
      }

      return {
        ...t,
        id: t.id,
        customerId,
        paymentMethodId,
        paymentAmount,
        date: formattedDate,
        customerName: t.customerName || partyMap.get(customerId) || '-',
        paymentMethodName: t.paymentMethodName || methodMap.get(paymentMethodId) || (paymentMethodId === 'cash' ? 'Cash' : paymentMethodId === 'cheque' ? 'Cheque' : '-'),
      };
    }).filter(t => {
      let matches = t.type === type;
      
      if (filterPaymentMethodId && filterPaymentMethodId !== 'all') {
        matches = matches && t.paymentMethodId === filterPaymentMethodId;
      }
      
      if (filterPartyId && filterPartyId !== 'all') {
        matches = matches && t.customerId === filterPartyId;
      }
      
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        matches = matches && (
          (t.customerName && t.customerName.toLowerCase().includes(lowerSearch)) ||
          (t.paymentMethodName && t.paymentMethodName.toLowerCase().includes(lowerSearch)) ||
          (t.paymentAmount && t.paymentAmount.toString().includes(searchQuery)) ||
          (t.date && t.date.includes(searchQuery))
        );
      }
      
      return matches;
    }).sort((a, b) => {
      // Sort by date descending
      const dateA = a.date ? new Date(a.date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const dateB = b.date ? new Date(b.date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return dateB - dateA;
    });
  }, [type, searchQuery, filterPaymentMethodId, filterPartyId]);
}

export function useOfflinePaymentMethods() {
  return useLiveQuery(() => db.payment_methods.toArray());
}
