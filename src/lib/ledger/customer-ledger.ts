import { ObjectId } from "mongodb";
import clientPromise, {
  COLLECTIONS,
  getCollection,
  toObjectId,
} from "@/lib/db/mongodb";

export type CustomerLedgerEventType =
  | "opening_balance"
  | "order_debit"
  | "order_payment_credit"
  | "payment_in_credit"
  | "manual_adjustment";

export interface AppendCustomerLedgerEntryInput {
  userId: string;
  customerId: string;
  eventKey: string;
  eventType: CustomerLedgerEventType;
  eventSource: "customer" | "order" | "customer_transaction" | "system";
  eventSourceId?: string | null;
  amountDelta: number;
  effectiveAt: Date;
  metadata?: Record<string, unknown> | null;
}

interface CustomerLedgerEntryDoc {
  _id?: ObjectId;
  user_id: ObjectId;
  customer_id: ObjectId;
  event_key: string;
  event_type: CustomerLedgerEventType;
  event_source: string;
  event_source_id: ObjectId | string | null;
  amount_delta: number;
  effective_at: Date;
  running_balance: number;
  created_at: Date;
  metadata?: Record<string, unknown> | null;
}

interface CustomerBalanceStateDoc {
  _id: ObjectId;
  user_id: ObjectId;
  customer_id: ObjectId;
  current_balance: number;
  last_entry_id: ObjectId | null;
  last_effective_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AppendCustomerLedgerEntryResult {
  entryId: string;
  runningBalance: number;
  alreadyExists: boolean;
}

export async function appendCustomerLedgerEntry(
  input: AppendCustomerLedgerEntryInput
): Promise<AppendCustomerLedgerEntryResult> {
  if (!input.eventKey || input.eventKey.trim() === "") {
    throw new Error("eventKey is required");
  }
  if (!Number.isFinite(input.amountDelta)) {
    throw new Error("amountDelta must be a finite number");
  }

  const userObjId = toObjectId(input.userId);
  const customerObjId = toObjectId(input.customerId);
  const eventSourceId = input.eventSourceId
    ? toEventSourceId(input.eventSourceId)
    : null;

  const ledgerCollection = await getCollection<CustomerLedgerEntryDoc>(
    COLLECTIONS.CUSTOMER_LEDGER_ENTRIES
  );
  const balanceStateCollection = await getCollection<CustomerBalanceStateDoc>(
    COLLECTIONS.CUSTOMER_BALANCE_STATE
  );
  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

  const existing = await ledgerCollection.findOne({
    user_id: userObjId,
    customer_id: customerObjId,
    event_key: input.eventKey,
  });

  if (existing) {
    return {
      entryId: existing._id.toString(),
      runningBalance: existing.running_balance,
      alreadyExists: true,
    };
  }

  const client = await clientPromise;
  const session = client.startSession();

  try {
    let output: AppendCustomerLedgerEntryResult | null = null;

    await session.withTransaction(async () => {
      const now = new Date();

      const state = await balanceStateCollection.findOneAndUpdate(
        { user_id: userObjId, customer_id: customerObjId },
        {
          $setOnInsert: {
            user_id: userObjId,
            customer_id: customerObjId,
            last_entry_id: null,
            last_effective_at: null,
            created_at: now,
          },
          $inc: {
            current_balance: input.amountDelta,
            version: 1,
          },
          $set: { updated_at: now },
        },
        { upsert: true, returnDocument: "after", session }
      );

      if (!state) {
        throw new Error("Failed to update customer balance state");
      }

      const runningBalance = state.current_balance;

      const insertResult = await ledgerCollection.insertOne(
        {
          user_id: userObjId,
          customer_id: customerObjId,
          event_key: input.eventKey,
          event_type: input.eventType,
          event_source: input.eventSource,
          event_source_id: eventSourceId,
          amount_delta: input.amountDelta,
          effective_at: input.effectiveAt,
          running_balance: runningBalance,
          created_at: now,
          metadata: input.metadata ?? null,
        },
        { session }
      );

      await balanceStateCollection.updateOne(
        { user_id: userObjId, customer_id: customerObjId },
        {
          $set: {
            last_entry_id: insertResult.insertedId,
            last_effective_at: input.effectiveAt,
            updated_at: now,
          },
        },
        { session }
      );

      await customersCollection.updateOne(
        { _id: customerObjId, user_id: userObjId },
        { $set: { balance: runningBalance, updated_at: now } },
        { session }
      );

      output = {
        entryId: insertResult.insertedId.toString(),
        runningBalance,
        alreadyExists: false,
      };
    });

    if (!output) {
      throw new Error("Failed to append ledger entry");
    }

    return output;
  } catch (error: unknown) {
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      const dupe = await ledgerCollection.findOne({
        user_id: userObjId,
        customer_id: customerObjId,
        event_key: input.eventKey,
      });
      if (dupe) {
        return {
          entryId: dupe._id.toString(),
          runningBalance: dupe.running_balance,
          alreadyExists: true,
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function seedCustomerOpeningBalance(
  userId: string,
  customerId: string,
  openingBalance: number,
  effectiveAt: Date
): Promise<void> {
  if (!Number.isFinite(openingBalance) || openingBalance === 0) {
    return;
  }

  await appendCustomerLedgerEntry({
    userId,
    customerId,
    eventKey: `customer_opening:${customerId}`,
    eventType: "opening_balance",
    eventSource: "customer",
    eventSourceId: customerId,
    amountDelta: openingBalance,
    effectiveAt,
    metadata: { source: "customer_opening_balance" },
  });
}

export async function setCustomerBalanceTarget(
  userId: string,
  customerId: string,
  targetBalance: number,
  eventKey: string,
  effectiveAt: Date,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!Number.isFinite(targetBalance)) {
    throw new Error("targetBalance must be a finite number");
  }

  const current = await getCurrentCustomerBalance(userId, customerId);
  const delta = targetBalance - current;

  if (delta === 0) {
    return;
  }

  await appendCustomerLedgerEntry({
    userId,
    customerId,
    eventKey,
    eventType: "manual_adjustment",
    eventSource: "system",
    eventSourceId: customerId,
    amountDelta: delta,
    effectiveAt,
    metadata: {
      currentBalance: current,
      targetBalance,
      ...(metadata ?? {}),
    },
  });
}

export async function getCurrentCustomerBalance(
  userId: string,
  customerId: string
): Promise<number> {
  const balanceStateCollection = await getCollection<CustomerBalanceStateDoc>(
    COLLECTIONS.CUSTOMER_BALANCE_STATE
  );

  const state = await balanceStateCollection.findOne({
    user_id: toObjectId(userId),
    customer_id: toObjectId(customerId),
  });

  if (state) {
    return state.current_balance ?? 0;
  }

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const customer = await customersCollection.findOne(
    {
      _id: toObjectId(customerId),
      user_id: toObjectId(userId),
    },
    {
      projection: { balance: 1, opening_balance: 1 },
    }
  );

  return customer?.balance ?? customer?.opening_balance ?? 0;
}

function toEventSourceId(
  value: string
): ObjectId | string {
  return ObjectId.isValid(value) ? toObjectId(value) : value;
}
