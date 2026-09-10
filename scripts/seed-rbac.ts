import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getCollection, COLLECTIONS } from '../src/lib/db/mongodb';

const BASE_MODULES = [
  { code: 'customers', name: 'Customers & Parties' },
  { code: 'products', name: 'Products & Inventory' },
  { code: 'sales', name: 'Sales & Invoices' },
  { code: 'purchase', name: 'Purchases & Bills' },
  { code: 'expenses', name: 'Expenses' },
  { code: 'reports', name: 'Reports' },
  { code: 'ai_chat', name: 'AI Chat' },
  { code: 'staff', name: 'Staff Management' },
  { code: 'payment_methods', name: 'Payment Methods' },
  { code: 'configuration', name: 'Configuration' },
  { code: 'whatsapp', name: 'WhatsApp Integration' }
];

const MODULE_SPECIFIC_ACTIONS: Record<string, string[]> = {
  customers: ['view', 'create', 'edit', 'delete'],
  products: ['view', 'create', 'edit', 'delete'],
  sales: [
    'view_quotations',
    'create_quotations',
    'edit_quotations',
    'delete_quotations',
    'view_invoice',
    'create_invoice',
    'edit_invoice',
    'delete_invoice',
    'view_payment_in',
    'create_payment_in',
    'edit_payment_in',
    'delete_payment_in',
    'view_sale_return',
    'create_sale_return',
    'edit_sale_return',
    'delete_sale_return',
    'view_counter_sale',
    'create_counter_sale',
    'edit_counter_sale',
    'delete_counter_sale'
  ],
  purchase: [
    'view_purchase_bill',
    'create_purchase_bill',
    'edit_purchase_bill',
    'delete_purchase_bill',
    'view_payment_out',
    'create_payment_out',
    'edit_payment_out',
    'delete_payment_out'
  ],
  expenses: ['view', 'create', 'edit', 'delete'],
  reports: [
    'view_account_statement',
    'export_account_statement',
    'view_stock',
    'export_stock',
    'view_receivable_summary',
    'export_receivable_summary',
    'view_profitability',
    'export_profitability',
    'view_item_wise_sales',
    'export_item_wise_sales'
  ],
  staff: ['view', 'create', 'edit', 'delete'],
  payment_methods: ['view', 'create', 'edit', 'delete'],
  configuration: ['view', 'create', 'edit', 'delete'],
  whatsapp: ['view', 'create', 'edit', 'delete'],
  ai_chat: ['view']
};

async function seedRBAC() {
  try {
    console.log('Starting RBAC seeding...');

    const modulesCollection = await getCollection(COLLECTIONS.MODULES);
    const permissionsCollection = await getCollection(COLLECTIONS.PERMISSIONS);

    // 1. Seed Modules
    console.log('Seeding Modules...');
    for (const mod of BASE_MODULES) {
      const isActive = mod.code !== 'ai_chat';
      await modulesCollection.updateOne(
        { code: mod.code },
        { $setOnInsert: { ...mod, isActive } },
        { upsert: true }
      );
    }

    // 2. Seed Permissions
    console.log('Seeding Permissions...');
    for (const mod of BASE_MODULES) {
      const actions = MODULE_SPECIFIC_ACTIONS[mod.code] || ['view'];
      const isActive = mod.code !== 'ai_chat';
      
      for (const action of actions) {
        await permissionsCollection.updateOne(
          { module_code: mod.code, action: action },
          { $setOnInsert: { module_code: mod.code, action: action, isActive } },
          { upsert: true }
        );
      }
    }

    console.log('RBAC seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during RBAC seeding:', error);
    process.exit(1);
  }
}

seedRBAC();
