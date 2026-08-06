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

    const mapData = (docs: any[]) => docs.map(d => {
      const mapped = { ...d, id: d._id.toString(), _id: undefined };
      if (mapped.role_id && typeof mapped.role_id === 'object') mapped.role_id = mapped.role_id.toString();
      if (mapped.permission_id && typeof mapped.permission_id === 'object') mapped.permission_id = mapped.permission_id.toString();
      if (mapped.user_id && typeof mapped.user_id === 'object') mapped.user_id = mapped.user_id.toString();
      if (mapped.owner_id && typeof mapped.owner_id === 'object') mapped.owner_id = mapped.owner_id.toString();
      if (mapped.party_id && typeof mapped.party_id === 'object') mapped.party_id = mapped.party_id.toString();
      return mapped;
    });

    const collectionsToFetch = [
      { name: 'products', key: COLLECTIONS.PRODUCTS },
      { name: 'parties', key: COLLECTIONS.PARTIES },
      { name: 'orders', key: COLLECTIONS.ORDERS },
      { name: 'party_transactions', key: COLLECTIONS.PARTY_TRANSACTIONS },
      { name: 'party_ledger_entries', key: COLLECTIONS.PARTY_LEDGER_ENTRIES },
      { name: 'party_balance_state', key: COLLECTIONS.PARTY_BALANCE_STATE },
      { name: 'purchase_bills', key: COLLECTIONS.PURCHASE_BILLS },
      { name: 'expenses', key: COLLECTIONS.EXPENSES },
      { name: 'quotations', key: COLLECTIONS.QUOTATIONS },
      { name: 'categories', key: COLLECTIONS.CATEGORIES },
      { name: 'payment_methods', key: COLLECTIONS.PAYMENT_METHOD },
      { name: 'vendor_transactions', key: COLLECTIONS.VENDOR_TRANSACTIONS },
      { name: 'sale_return_transactions', key: COLLECTIONS.SALE_RETURN_TRANSACTIONS },
      { name: 'transactions', key: COLLECTIONS.TRANSACTIONS },
      { name: 'subscriptions', key: COLLECTIONS.SUBSCRIPTIONS },
      { name: 'configurations', key: COLLECTIONS.CONFIGURATIONS },
      { name: 'users', key: COLLECTIONS.USERS, scope: 'users_and_staff' },
      { name: 'modules', key: COLLECTIONS.MODULES, scope: 'global_active' },
      { name: 'permissions', key: COLLECTIONS.PERMISSIONS, scope: 'global_active' },
      { name: 'roles', key: COLLECTIONS.ROLES, scope: 'owner_id' },
      { name: 'role_permissions', key: COLLECTIONS.ROLE_PERMISSIONS, scope: 'global' },
      { name: 'user_roles', key: COLLECTIONS.USER_ROLES, scope: 'shop_roles' },
    ];

    const result: Record<string, any[]> = {};
    
    // Fetch all collections concurrently for maximum performance
    await Promise.all(collectionsToFetch.map(async (col) => {
      const dbCol = await getCollection(col.key);
      
      let currentQuery: any = { ...query };
      if (col.scope === 'global') {
        currentQuery = {};
      } else if (col.scope === 'global_active') {
        currentQuery = { isActive: true };
      } else if (col.scope === 'owner_id') {
        currentQuery = { owner_id: toObjectId(user.id) };
      } else if (col.scope === 'none') {
        currentQuery = { _id: toObjectId(user.id) };
      } else if (col.scope === 'users_and_staff') {
        const rolesColl = await getCollection(COLLECTIONS.ROLES);
        const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
        const shopRoles = await rolesColl.find({ owner_id: toObjectId(user.id) }).toArray();
        const shopRoleIds = shopRoles.map((r: any) => r._id);
        const shopUserRoles = await userRolesColl.find({ role_id: { $in: shopRoleIds } }).toArray();
        const staffIds = shopUserRoles.map((ur: any) => ur.user_id);
        
        currentQuery = {
          $or: [
            { _id: toObjectId(user.id) },
            { _id: { $in: staffIds } },
            { owner_id: toObjectId(user.id), role: "staff" }
          ]
        };
      } else if (col.scope === 'shop_roles') {
        const rolesColl = await getCollection(COLLECTIONS.ROLES);
        const shopRoles = await rolesColl.find({ owner_id: toObjectId(user.id) }).toArray();
        const shopRoleIds = shopRoles.map((r: any) => r._id);
        currentQuery = { role_id: { $in: shopRoleIds } };
      }
      
      if (query.updated_at && col.scope !== 'global' && col.key !== COLLECTIONS.USER_ROLES && col.key !== COLLECTIONS.ROLE_PERMISSIONS) {
        currentQuery.updated_at = query.updated_at;
      }

      const docs = await dbCol.find(currentQuery).toArray();
      result[col.name] = mapData(docs);
    }));

    console.log('SYNC RESULT:', {
      payment_methods: result.payment_methods?.length,
      permissions: result.permissions?.length,
      modules: result.modules?.length,
    });

    return NextResponse.json({
      data: result,
      server_timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
