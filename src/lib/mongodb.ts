import { MongoClient, Db, Collection, ObjectId, Document } from 'mongodb';

if (!process.env.MONGODB_URL) {
  throw new Error('Please add your Mongo URI to .env.local');
}

const uri = process.env.MONGODB_URL;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
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
const DB_NAME = process.env.MONGODB_DB_NAME || 'dukaankhata';

// Helper function to get database
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

// Helper function to get a collection
export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  const db = await getDatabase();
  return db.collection<T>(collectionName);
}

// Collection names constants
export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  PAYMENT_METHODS: 'payment_methods',
  TRANSACTIONS: 'transactions',
  PASSWORD_RESETS: 'password_resets',
} as const;

// Helper to convert MongoDB ObjectId to string
export function toObjectId(id: string | ObjectId | undefined | null): ObjectId {
  if (!id) {
    throw new Error('Invalid ObjectId: id is required');
  }
  if (typeof id === 'string') {
    // Check if it's a valid MongoDB ObjectId format
    if (!ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId string: "${id}" is not a valid 24-character hex string or valid ObjectId`);
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

// Helper function to create indexes for collections
export async function createIndexes() {
  const db = await getDatabase();

  try {
    // Users collection indexes
    await db.collection(COLLECTIONS.USERS).createIndex({ email: 1 }, { unique: true });
    
    // Products collection indexes
    await db.collection(COLLECTIONS.PRODUCTS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.PRODUCTS).createIndex({ category: 1 });
    
    // Customers collection indexes
    await db.collection(COLLECTIONS.CUSTOMERS).createIndex({ email: 1, user_id: 1 }, { unique: true });
    await db.collection(COLLECTIONS.CUSTOMERS).createIndex({ user_id: 1 });
    
    // Orders collection indexes
    await db.collection(COLLECTIONS.ORDERS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.ORDERS).createIndex({ customer_id: 1 });
    await db.collection(COLLECTIONS.ORDERS).createIndex({ created_at: -1 });
    
    // Order items collection indexes
    await db.collection(COLLECTIONS.ORDER_ITEMS).createIndex({ order_id: 1 });
    await db.collection(COLLECTIONS.ORDER_ITEMS).createIndex({ product_id: 1 });
    
    // Payment methods collection indexes
    await db.collection(COLLECTIONS.PAYMENT_METHODS).createIndex({ name: 1 }, { unique: true });
    
    // Transactions collection indexes
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ user_id: 1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ order_id: 1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ created_at: -1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ type: 1 });
    
    // Password resets collection indexes
    await db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ token: 1 }, { unique: true });
    await db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ email: 1 });
    await db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

    console.log('MongoDB indexes created successfully');
  } catch (error) {
    console.error('Error creating MongoDB indexes:', error);
  }
}
