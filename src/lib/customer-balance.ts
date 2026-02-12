import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

/**
 * Adjusts a customer's balance by a given amount.
 * Positive delta = increase balance (customer owes more).
 * Negative delta = decrease balance (customer paid).
 *
 * Uses balance ?? opening_balance ?? 0 as the current effective balance.
 */
export async function adjustCustomerBalance(
  customerId: string,
  userId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;

  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const customerObjId = toObjectId(customerId);
  const userObjId = toObjectId(userId);

  await customersCollection.updateOne(
    { _id: customerObjId, user_id: userObjId },
    [
      {
        $set: {
          balance: {
            $add: [
              { $ifNull: ["$balance", { $ifNull: ["$opening_balance", 0] }] },
              delta,
            ],
          },
        },
      },
    ]
  );
}

/**
 * Deducts a payment amount from customer balance (payment in = customer pays).
 */
export async function deductPaymentFromBalance(
  customerId: string,
  userId: string,
  amount: number
): Promise<void> {
  await adjustCustomerBalance(customerId, userId, -amount);
}

/**
 * Adds a payment amount back to customer balance (revert payment).
 */
export async function addPaymentToBalance(
  customerId: string,
  userId: string,
  amount: number
): Promise<void> {
  await adjustCustomerBalance(customerId, userId, amount);
}
