import { ObjectId } from "mongodb";
import clientPromise, {
  COLLECTIONS,
  getCollection,
  toObjectId,
} from "@/lib/db/mongodb";

export type PartyLedgerEventType =
  | "opening_balance"
  | "order_debit"
  | "order_payment_credit"
  | "payment_in_credit"
  | "payment_out_debit"
  | "purchase_bill_debit"
  | "purchase_bill_credit"
  | "purchase_return_debit"
  | "purchase_return_credit      
  | "sale_return_debit"
  | "sale_return_credit"
  | "manual_adjustment";

// Backward compatibility aliases
export type CustomerLedgerEventType = PartyLedgerEventType;

export interface AppendPartyLedgerEntryInput {
  userId: string;
  partyId: string;
  eventKey: string;
  eventType: PartyLedgerEventType;
  eventSource: "party" | "order" | "party_transaction" | "system";
  eventSourceId?: string | null;
  amountDelta: number;
  effectiveAt: Date;
  metadata?: Record<string, unknown> | null;
}

// Backward compatibility alias
export type AppendCustomerLedgerEntryInput = Omit<
  AppendPartyLedgerEntryInput,
  "partyId"
> & {
  customerId: string;
};

interface PartyLedgerEntryDoc {
  _id?: ObjectId;
  user_id: ObjectId;
  party_id: ObjectId;
  event_key: string;
  event_type: PartyLedgerEventType;
  event_source: string;
  event_source_id: ObjectId | string | null;
  amount_delta: number;
  effective_at: Date;
  running_balance: number;
  created_at: Date;
  metadata?: Record<string, unknown> | null;
}

interface PartyBalanceStateDoc {
  _id: ObjectId;
  user_id: ObjectId;
  party_id: ObjectId;
  current_balance: number;
  last_entry_id: ObjectId | null;
  last_effective_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AppendPartyLedgerEntryResult {
  entryId: string;
  runningBalance: number;
  alreadyExists: boolean;
}

// Backward compatibility alias
export interface AppendCustomerLedgerEntryResult extends AppendPartyLedgerEntryResult { }

export async function appendPartyLedgerEntry(
  input: AppendPartyLedgerEntryInput
): Promise<AppendPartyLedgerEntryResult> {
  if (!input.eventKey || input.eventKey.trim() === "") {
    throw new Error("eventKey is required");
  }
  if (!Number.isFinite(input.amountDelta)) {
    throw new Error("amountDelta must be a finite number");
  }

  const userObjId = toObjectId(input.userId);
  const partyObjId = toObjectId(input.partyId);
  const eventSourceId = input.eventSourceId
    ? toEventSourceId(input.eventSourceId)
    : null;

  const ledgerCollection = await getCollection<PartyLedgerEntryDoc>(
    COLLECTIONS.PARTY_LEDGER_ENTRIES
  );
  const balanceStateCollection = await getCollection<PartyBalanceStateDoc>(
    COLLECTIONS.PARTY_BALANCE_STATE
  );
  const partiesCollection = await getCollection(COLLECTIONS.PARTIES);

  const existing = await ledgerCollection.findOne({
    user_id: userObjId,
    party_id: partyObjId,
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
    let output: AppendPartyLedgerEntryResult | null = null;

    await session.withTransaction(async () => {
      const now = new Date();

      const state = await balanceStateCollection.findOneAndUpdate(
        { user_id: userObjId, party_id: partyObjId },
        {
          $setOnInsert: {
            user_id: userObjId,
            party_id: partyObjId,
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
        throw new Error("Failed to update party balance state");
      }

      const runningBalance = state.current_balance;

      const insertResult = await ledgerCollection.insertOne(
        {
          user_id: userObjId,
          party_id: partyObjId,
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
        { user_id: userObjId, party_id: partyObjId },
        {
          $set: {
            last_entry_id: insertResult.insertedId,
            last_effective_at: input.effectiveAt,
            updated_at: now,
          },
        },
        { session }
      );

      await partiesCollection.updateOne(
        { _id: partyObjId, user_id: userObjId },
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
        party_id: partyObjId,
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

// Backward compatibility wrapper
export async function appendCustomerLedgerEntry(
  input: AppendCustomerLedgerEntryInput
): Promise<AppendCustomerLedgerEntryResult> {
  return appendPartyLedgerEntry({
    userId: input.userId,
    partyId: input.customerId,
    eventKey: input.eventKey,
    eventType: input.eventType as PartyLedgerEventType,
    eventSource: input.eventSource as "party" | "order" | "party_transaction" | "system",
    eventSourceId: input.eventSourceId,
    amountDelta: input.amountDelta,
    effectiveAt: input.effectiveAt,
    metadata: input.metadata,
  });
}

export async function seedPartyOpeningBalance(
  userId: string,
  partyId: string,
  openingBalance: number,
  effectiveAt: Date
): Promise<void> {
  if (!Number.isFinite(openingBalance) || openingBalance === 0) {
    return;
  }

  await appendPartyLedgerEntry({
    userId,
    partyId,
    eventKey: `party_opening:${partyId}`,
    eventType: "opening_balance",
    eventSource: "party",
    eventSourceId: partyId,
    amountDelta: openingBalance,
    effectiveAt,
    metadata: { source: "party_opening_balance" },
  });
}

// Backward compatibility wrapper
export async function seedCustomerOpeningBalance(
  userId: string,
  customerId: string,
  openingBalance: number,
  effectiveAt: Date
): Promise<void> {
  return seedPartyOpeningBalance(userId, customerId, openingBalance, effectiveAt);
}

export async function setPartyBalanceTarget(
  userId: string,
  partyId: string,
  targetBalance: number,
  eventKey: string,
  effectiveAt: Date,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!Number.isFinite(targetBalance)) {
    throw new Error("targetBalance must be a finite number");
  }

  const current = await getCurrentPartyBalance(userId, partyId);
  const delta = targetBalance - current;

  if (delta === 0) {
    return;
  }

  await appendPartyLedgerEntry({
    userId,
    partyId,
    eventKey,
    eventType: "manual_adjustment",
    eventSource: "system",
    eventSourceId: partyId,
    amountDelta: delta,
    effectiveAt,
    metadata: {
      currentBalance: current,
      targetBalance,
      ...(metadata ?? {}),
    },
  });
}

// Backward compatibility wrapper
export async function setCustomerBalanceTarget(
  userId: string,
  customerId: string,
  targetBalance: number,
  eventKey: string,
  effectiveAt: Date,
  metadata?: Record<string, unknown>
): Promise<void> {
  return setPartyBalanceTarget(userId, customerId, targetBalance, eventKey, effectiveAt, metadata);
}

export async function getCurrentPartyBalance(
  userId: string,
  partyId: string
): Promise<number> {
  const balanceStateCollection = await getCollection<PartyBalanceStateDoc>(
    COLLECTIONS.PARTY_BALANCE_STATE
  );

  const state = await balanceStateCollection.findOne({
    user_id: toObjectId(userId),
    party_id: toObjectId(partyId),
  });

  if (state) {
    return state.current_balance ?? 0;
  }

  const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
  const party = await partiesCollection.findOne(
    {
      _id: toObjectId(partyId),
      user_id: toObjectId(userId),
    },
    {
      projection: { balance: 1, opening_balance: 1 },
    }
  );

  return party?.balance ?? party?.opening_balance ?? 0;
}

// Backward compatibility wrapper
export async function getCurrentCustomerBalance(
  userId: string,
  customerId: string
): Promise<number> {
  return getCurrentPartyBalance(userId, customerId);
}

function toEventSourceId(
  value: string
): ObjectId | string {
  return ObjectId.isValid(value) ? toObjectId(value) : value;
}
