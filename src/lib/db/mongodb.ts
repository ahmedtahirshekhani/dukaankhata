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

// Helper function to get database
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
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
  PAYMENT_METHOD: "payment_method",
  WAITLIST: "waitlist",
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
export async function updateUserLastActivity() {
  try {
    const user = await getCurrentUser();
    // console.log("Current user in updateUserLastActivity:", user);
    if (user?.id) {
      const usersCollection = await getCollection(COLLECTIONS.USERS);
      await usersCollection.updateOne(
        { _id: toObjectId(user.id) },
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

  try {
    // Users collection indexes
    await db
      .collection(COLLECTIONS.USERS)
      .createIndex({ email: 1 }, { unique: true });

    // Products collection indexes
    await db.collection(COLLECTIONS.PRODUCTS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.PRODUCTS).createIndex({ category: 1 });

    // Parties collection indexes
    await db.collection(COLLECTIONS.PARTIES).createIndex({ user_id: 1 });
    await db
      .collection(COLLECTIONS.PARTIES)
      .createIndex({ user_id: 1, name: 1 });

    // Orders collection indexes
    await db.collection(COLLECTIONS.ORDERS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.ORDERS).createIndex({ party_id: 1 });
    await db.collection(COLLECTIONS.ORDERS).createIndex({ created_at: -1 });

    // Order items collection indexes
    await db.collection(COLLECTIONS.ORDER_ITEMS).createIndex({ order_id: 1 });
    await db.collection(COLLECTIONS.ORDER_ITEMS).createIndex({ product_id: 1 });

    // Payment methods collection indexes
    await db
      .collection(COLLECTIONS.PAYMENT_METHODS)
      .createIndex({ name: 1 }, { unique: true });

    // Payment method (configuration) collection indexes
    await db
      .collection(COLLECTIONS.PAYMENT_METHOD)
      .createIndex({ user_id: 1 });

    // Party transactions (payment in) collection indexes
    await db
      .collection(COLLECTIONS.PARTY_TRANSACTIONS)
      .createIndex({ user_id: 1 });
    await db
      .collection(COLLECTIONS.PARTY_TRANSACTIONS)
      .createIndex({ party_id: 1 });
    await db
      .collection(COLLECTIONS.PARTY_TRANSACTIONS)
      .createIndex({ date: -1 });

    // Sale return transactions collection indexes
    await db
      .collection(COLLECTIONS.SALE_RETURN_TRANSACTIONS)
      .createIndex({ user_id: 1 });
    await db
      .collection(COLLECTIONS.SALE_RETURN_TRANSACTIONS)
      .createIndex({ party_id: 1 });
    await db
      .collection(COLLECTIONS.SALE_RETURN_TRANSACTIONS)
      .createIndex({ date: -1 });
    await db
      .collection(COLLECTIONS.SALE_RETURN_TRANSACTIONS)
      .createIndex({ user_id: 1, return_number: 1 });

    // Party ledger collections indexes
    await db
      .collection(COLLECTIONS.PARTY_LEDGER_ENTRIES)
      .createIndex({ user_id: 1, party_id: 1, effective_at: -1 });
    await db
      .collection(COLLECTIONS.PARTY_LEDGER_ENTRIES)
      .createIndex({ user_id: 1, party_id: 1, created_at: -1 });
    await db
      .collection(COLLECTIONS.PARTY_LEDGER_ENTRIES)
      .createIndex({ user_id: 1, party_id: 1, event_key: 1 }, { unique: true });
    await db
      .collection(COLLECTIONS.PARTY_BALANCE_STATE)
      .createIndex({ user_id: 1, party_id: 1 }, { unique: true });

    // Purchase bills collection indexes
    await db.collection(COLLECTIONS.PURCHASE_BILLS).createIndex({ user_id: 1 });
    await db
      .collection(COLLECTIONS.PURCHASE_BILLS)
      .createIndex({ user_id: 1, party_id: 1 });
    await db
      .collection(COLLECTIONS.PURCHASE_BILLS)
      .createIndex({ created_at: -1 });
    await db
      .collection(COLLECTIONS.PURCHASE_BILLS)
      .createIndex({ user_id: 1, created_at: -1 });

    // Expenses collection indexes
    await db.collection(COLLECTIONS.EXPENSES).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.EXPENSES).createIndex({ date: -1 });
    await db.collection(COLLECTIONS.EXPENSES).createIndex({ expense_number: 1 });
    await db.collection(COLLECTIONS.EXPENSES).createIndex({ category: 1 });
    await db.collection(COLLECTIONS.EXPENSES).createIndex({ item_name: 1 });

    // Transactions collection indexes
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ order_id: 1 });
    await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .createIndex({ created_at: -1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ type: 1 });

    // Password resets collection indexes
    await db
      .collection(COLLECTIONS.PASSWORD_RESETS)
      .createIndex({ token: 1 }, { unique: true });
    await db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ email: 1 });
    await db
      .collection(COLLECTIONS.PASSWORD_RESETS)
      .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

    // Email verification codes collection indexes
    await db
      .collection(COLLECTIONS.EMAIL_VERIFICATION_CODES)
      .createIndex({ email: 1 });
    await db
      .collection(COLLECTIONS.EMAIL_VERIFICATION_CODES)
      .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });


    // Quotations collection indexes
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ party_id: 1 });
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ created_at: -1 });
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ user_id: 1, party_id: 1 });
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.QUOTATIONS).createIndex({ validity_date: 1 });

    // Waitlist collection indexes
    await db
      .collection(COLLECTIONS.WAITLIST)
      .createIndex({ whatsapp_number: 1 });
    await db.collection(COLLECTIONS.WAITLIST).createIndex({ created_at: -1 });

    // Subscriptions collection indexes
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.SUBSCRIPTIONS).createIndex({ email: 1 });
    await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .createIndex({ status: 1 });
    await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .createIndex({ expiry_date: 1 });
    await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .createIndex({ created_at: -1 });

    // WhatsApp verification codes collection indexes
    await db
      .collection(COLLECTIONS.WHATSAPP_VERIFICATION_CODES)
      .createIndex({ user_id: 1, whatsapp_number: 1 });
    await db
      .collection(COLLECTIONS.WHATSAPP_VERIFICATION_CODES)
      .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

    console.log("MongoDB indexes created successfully");
  } catch (error) {
    console.error("Error creating MongoDB indexes:", error);
  }
}
