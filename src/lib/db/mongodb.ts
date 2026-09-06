import { MongoClient, Db, Collection, ObjectId, Document, UpdateFilter, Filter } from "mongodb";
import { getCurrentUser } from "@/lib/auth/utils";  // Add this import at top

if (!process.env.MONGODB_URL) {
  throw new Error("Please add your Mongo URI to .env.local");
}

const uri = process.env.MONGODB_URL;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable to preserve the client across hot reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, create a new client
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise
export default clientPromise;

// Database name
const DB_NAME = process.env.MONGODB_DB_NAME || "dukaankhata";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexesCreated: boolean | undefined;
}

export async function ensureIndexes() {
  if (global._mongoIndexesCreated) return;
  global._mongoIndexesCreated = true;
  createIndexes().catch(err => {
    console.error("Failed to create DB indexes:", err);
  });
}

// Helper function to get database
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  if (!global._mongoIndexesCreated) {
    ensureIndexes();
  }
  return client.db(DB_NAME);
}

// Helper function to get a collection
export async function getCollection<T extends Document = Document>(
  collectionName: string
): Promise<Collection<T>> {
  const db = await getDatabase();
  return db.collection<T>(collectionName);
}

// Collection names constants
export const COLLECTIONS = {
  INVITATIONS: "invitations",
  USERS: "users",
  PRODUCTS: "products",
  PARTIES: "parties",
  CUSTOMERS: "parties", // Alias for backward compatibility
  ORDERS: "orders",
  PAYMENT_METHODS: "payment_methods",
  SHOPS: "shops",
  MODULES: "modules",
  PERMISSIONS: "permissions",
  ROLES: "roles",
  ROLE_PERMISSIONS: "role_permissions",
  USER_ROLES: "user_roles",
  PARTY_TRANSACTIONS: "party_transaction",
  CUSTOMER_TRANSACTIONS: "party_transaction", // Alias for backward compatibility
  VENDOR_TRANSACTIONS: "vendor_transaction",
  SALE_RETURN_TRANSACTIONS: "sale_return_transaction",
  PURCHASE_BILLS: "purchase_bills",
  PARTY_LEDGER_ENTRIES: "party_ledger_entries",
  CUSTOMER_LEDGER_ENTRIES: "party_ledger_entries", // Alias for backward compatibility
  PARTY_BALANCE_STATE: "party_balance_state",
  CUSTOMER_BALANCE_STATE: "party_balance_state", // Alias for backward compatibility
  EXPENSES: "expenses",
  TRANSACTIONS: "transactions",
  PASSWORD_RESETS: "password_resets",
  EMAIL_VERIFICATION_CODES: "email_verification_codes",
  CATEGORIES: "categories",
  BRANCHES: "branches",
  QUOTATIONS: "quotations",
  SUBSCRIPTIONS: "subscriptions",
  WHATSAPP_VERIFICATION_CODES: "whatsapp_verification_codes",
  CONFIGURATIONS: "configurations",
  ORDER_ITEMS: "order_items",
  WAITLIST: "waitlist",
  WHATSAPP_SESSIONS: "whatsapp_sessions",
  WHATSAPP_REMINDER_LOGS: "whatsapp_reminder_logs",
  WHATSAPP_AUTH_KEYS: "whatsapp_auth_keys",
} as const;

// Helper to convert MongoDB ObjectId to string
export function toObjectId(id: string | ObjectId | undefined | null): ObjectId {
  if (!id) {
    throw new Error("Invalid ObjectId: id is required");
  }
  if (typeof id === "string") {
    // Check if it's a valid MongoDB ObjectId format
    if (!ObjectId.isValid(id)) {
      throw new Error(
        `Invalid ObjectId string: "${id}" is not a valid 24-character hex string or valid ObjectId`
      );
    }
    try {
      return new ObjectId(id);
    } catch (e) {
      throw new Error(`Failed to create ObjectId from string "${id}": ${e}`);
    }
  }
  return id;
}

// Helper to check if a string is a valid ObjectId
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * Generic function to set updated_at field for a document AND update user's last activity
 * @param collection - MongoDB collection
 * @param filter - Filter to find the document
 * @param additionalUpdate - Optional extra $set fields
 */
export async function setLastUpdated<T extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
  additionalUpdate?: Record<string, any>
) {
  // 1. Update target document's updated_at field
  const update: UpdateFilter<T> = {
    $set: {
      updated_at: new Date(),
      ...additionalUpdate,
    } as any,
  };
  const result = await collection.updateOne(filter, update);

  // 2. Call the user activity update function (instead of duplicating logic)
  await updateUserLastActivity();

  return result;
}

/**
 * Update user's last activity timestamp without touching any other collection
 * Use this for INSERT and DELETE operations where you want to track user activity
 * Also used internally by setLastUpdated
 */
export async function updateUserLastActivity(userId?: string) {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const user = await getCurrentUser();
      targetUserId = user?.id;
    }
    if (targetUserId) {
      const usersCollection = await getCollection(COLLECTIONS.USERS);
      await usersCollection.updateOne(
        { _id: toObjectId(targetUserId) },
        { $set: { user_last_updated_at: new Date() } }
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to update user last activity:", err);
    return false;
  }
}

// Helper function to create indexes for collections
export async function createIndexes() {
  const db = await getDatabase();

  const safeIndex = async (collectionName: string, keys: Record<string, 1 | -1>, options?: any) => {
    try {
      await db.collection(collectionName).createIndex(keys, options);
    } catch (e: any) {
      console.warn(`Warning creating index on ${collectionName}:`, e?.message || e);
    }
  };

  try {
    // Users collection indexes
    await safeIndex(COLLECTIONS.USERS, { email: 1 }, { unique: true });

    // Products collection indexes
    await safeIndex(COLLECTIONS.PRODUCTS, { user_id: 1 });
    await safeIndex(COLLECTIONS.PRODUCTS, { category: 1 });

    // Parties collection indexes
    await safeIndex(COLLECTIONS.PARTIES, { user_id: 1 });
    await safeIndex(COLLECTIONS.PARTIES, { user_id: 1, name: 1 });

    // Orders collection indexes
    await safeIndex(COLLECTIONS.ORDERS, { user_id: 1 });
    await safeIndex(COLLECTIONS.ORDERS, { party_id: 1 });
    await safeIndex(COLLECTIONS.ORDERS, { created_at: -1 });
    await safeIndex(COLLECTIONS.ORDERS, { user_id: 1, invoice_no: 1 });

    // Order items collection indexes
    await safeIndex(COLLECTIONS.ORDER_ITEMS, { order_id: 1 });
    await safeIndex(COLLECTIONS.ORDER_ITEMS, { product_id: 1 });

    // Payment methods collection indexes (sparse index to avoid null name unique crashes)
    await safeIndex(COLLECTIONS.PAYMENT_METHODS, { user_id: 1, bank_name: 1 }, { sparse: true });

    // Party transactions (payment in) collection indexes
    await safeIndex(COLLECTIONS.PARTY_TRANSACTIONS, { user_id: 1 });
    await safeIndex(COLLECTIONS.PARTY_TRANSACTIONS, { party_id: 1 });
    await safeIndex(COLLECTIONS.PARTY_TRANSACTIONS, { date: -1 });

    // Sale return transactions collection indexes
    await safeIndex(COLLECTIONS.SALE_RETURN_TRANSACTIONS, { user_id: 1 });
    await safeIndex(COLLECTIONS.SALE_RETURN_TRANSACTIONS, { party_id: 1 });
    await safeIndex(COLLECTIONS.SALE_RETURN_TRANSACTIONS, { date: -1 });
    await safeIndex(COLLECTIONS.SALE_RETURN_TRANSACTIONS, { user_id: 1, return_number: 1 });

    // Party ledger collections indexes
    await safeIndex(COLLECTIONS.PARTY_LEDGER_ENTRIES, { user_id: 1, party_id: 1, effective_at: -1 });
    await safeIndex(COLLECTIONS.PARTY_LEDGER_ENTRIES, { user_id: 1, party_id: 1, created_at: -1 });
    await safeIndex(COLLECTIONS.PARTY_LEDGER_ENTRIES, { user_id: 1, party_id: 1, event_key: 1 }, { unique: true, sparse: true });
    await safeIndex(COLLECTIONS.PARTY_LEDGER_ENTRIES, { user_id: 1, event_source_id: 1 });
    await safeIndex(COLLECTIONS.PARTY_BALANCE_STATE, { user_id: 1, party_id: 1 }, { unique: true, sparse: true });

    // Purchase bills collection indexes
    await safeIndex(COLLECTIONS.PURCHASE_BILLS, { user_id: 1 });
    await safeIndex(COLLECTIONS.PURCHASE_BILLS, { user_id: 1, party_id: 1 });
    await safeIndex(COLLECTIONS.PURCHASE_BILLS, { created_at: -1 });
    await safeIndex(COLLECTIONS.PURCHASE_BILLS, { user_id: 1, created_at: -1 });

    // Expenses collection indexes
    await safeIndex(COLLECTIONS.EXPENSES, { user_id: 1 });
    await safeIndex(COLLECTIONS.EXPENSES, { date: -1 });
    await safeIndex(COLLECTIONS.EXPENSES, { expense_number: 1 });
    await safeIndex(COLLECTIONS.EXPENSES, { category: 1 });
    await safeIndex(COLLECTIONS.EXPENSES, { item_name: 1 });

    // Transactions collection indexes
    await safeIndex(COLLECTIONS.TRANSACTIONS, { user_id: 1 });
    await safeIndex(COLLECTIONS.TRANSACTIONS, { order_id: 1 });
    await safeIndex(COLLECTIONS.TRANSACTIONS, { created_at: -1 });
    await safeIndex(COLLECTIONS.TRANSACTIONS, { type: 1 });

    // Password resets collection indexes
    await safeIndex(COLLECTIONS.PASSWORD_RESETS, { token: 1 }, { unique: true });
    await safeIndex(COLLECTIONS.PASSWORD_RESETS, { email: 1 });
    await safeIndex(COLLECTIONS.PASSWORD_RESETS, { expires_at: 1 }, { expireAfterSeconds: 0 });

    // Email verification codes collection indexes
    await safeIndex(COLLECTIONS.EMAIL_VERIFICATION_CODES, { email: 1 });
    await safeIndex(COLLECTIONS.EMAIL_VERIFICATION_CODES, { expires_at: 1 }, { expireAfterSeconds: 0 });

    // Quotations collection indexes
    await safeIndex(COLLECTIONS.QUOTATIONS, { user_id: 1 });
    await safeIndex(COLLECTIONS.QUOTATIONS, { party_id: 1 });
    await safeIndex(COLLECTIONS.QUOTATIONS, { created_at: -1 });
    await safeIndex(COLLECTIONS.QUOTATIONS, { user_id: 1, party_id: 1 });
    await safeIndex(COLLECTIONS.QUOTATIONS, { status: 1 });
    await safeIndex(COLLECTIONS.QUOTATIONS, { validity_date: 1 });

    // Waitlist collection indexes
    await safeIndex(COLLECTIONS.WAITLIST, { whatsapp_number: 1 });
    await safeIndex(COLLECTIONS.WAITLIST, { created_at: -1 });

    // Subscriptions collection indexes
    await safeIndex(COLLECTIONS.SUBSCRIPTIONS, { user_id: 1 });
    await safeIndex(COLLECTIONS.SUBSCRIPTIONS, { email: 1 });
    await safeIndex(COLLECTIONS.SUBSCRIPTIONS, { status: 1 });
    await safeIndex(COLLECTIONS.SUBSCRIPTIONS, { expiry_date: 1 });
    await safeIndex(COLLECTIONS.SUBSCRIPTIONS, { created_at: -1 });

    // WhatsApp verification codes collection indexes
    await safeIndex(COLLECTIONS.WHATSAPP_VERIFICATION_CODES, { user_id: 1, whatsapp_number: 1 });
    await safeIndex(COLLECTIONS.WHATSAPP_VERIFICATION_CODES, { expires_at: 1 }, { expireAfterSeconds: 0 });

    console.log("MongoDB indexes processed successfully");
  } catch (error) {
    console.error("Error creating MongoDB indexes:", error);
  }
}
