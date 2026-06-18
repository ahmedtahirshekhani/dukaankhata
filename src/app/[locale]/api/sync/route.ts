import { getCollection, COLLECTIONS, toObjectId } from '@/lib/db/mongodb';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const lastSyncStr = searchParams.get('last_sync');
    let query: any = { user_id: toObjectId(user.id) };

    if (lastSyncStr) {
      const lastSyncDate = new Date(lastSyncStr);
      if (!isNaN(lastSyncDate.getTime())) {
         query.updated_at = { $gte: lastSyncDate };
      }
    }

    const mapData = (docs: any[]) => docs.map(d => ({ ...d, id: d._id.toString(), _id: undefined }));

    const collectionsToFetch = [
      { name: 'products', key: COLLECTIONS.PRODUCTS },
      { name: 'parties', key: COLLECTIONS.PARTIES },
      { name: 'orders', key: COLLECTIONS.ORDERS },
      { name: 'order_items', key: COLLECTIONS.ORDER_ITEMS },
      { name: 'party_transactions', key: COLLECTIONS.PARTY_TRANSACTIONS },
      { name: 'party_ledger_entries', key: COLLECTIONS.PARTY_LEDGER_ENTRIES },
      { name: 'party_balance_state', key: COLLECTIONS.PARTY_BALANCE_STATE },
      { name: 'purchase_bills', key: COLLECTIONS.PURCHASE_BILLS },
      { name: 'expenses', key: COLLECTIONS.EXPENSES },
      { name: 'quotations', key: COLLECTIONS.QUOTATIONS },
      { name: 'categories', key: COLLECTIONS.CATEGORIES },
      { name: 'payment_methods', key: COLLECTIONS.PAYMENT_METHODS },
      { name: 'payment_method', key: COLLECTIONS.PAYMENT_METHOD },
      { name: 'vendor_transactions', key: COLLECTIONS.VENDOR_TRANSACTIONS },
      { name: 'sale_return_transactions', key: COLLECTIONS.SALE_RETURN_TRANSACTIONS },
      { name: 'transactions', key: COLLECTIONS.TRANSACTIONS },
      { name: 'branches', key: COLLECTIONS.BRANCHES },
      { name: 'subscriptions', key: COLLECTIONS.SUBSCRIPTIONS },
    ];

    const result: Record<string, any[]> = {};
    
    // Fetch all in parallel for performance
    await Promise.all(collectionsToFetch.map(async (col) => {
      const dbCol = await getCollection(col.key);
      const docs = await dbCol.find(query).toArray();
      result[col.name] = mapData(docs);
    }));

    return NextResponse.json({
      data: result,
      server_timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
