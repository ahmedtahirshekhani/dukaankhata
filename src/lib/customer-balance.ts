import { appendCustomerLedgerEntry } from "@/lib/ledger/customer-ledger";

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

  await appendCustomerLedgerEntry({
    userId,
    customerId,
    eventKey: `legacy_adjust:${customerId}:${Date.now()}:${Math.abs(delta)}`,
    eventType: "manual_adjustment",
    eventSource: "system",
    eventSourceId: customerId,
    amountDelta: delta,
    effectiveAt: new Date(),
    metadata: { source: "legacy_adjustCustomerBalance" },
  });
}

/**
 * Deducts a payment amount from customer balance (payment in = customer pays).
 */
export async function deductPaymentFromBalance(
  customerId: string,
  userId: string,
  amount: number
): Promise<void> {
  if (amount === 0) return;
  await appendCustomerLedgerEntry({
    userId,
    customerId,
    eventKey: `legacy_payment_deduct:${customerId}:${Date.now()}:${Math.abs(amount)}`,
    eventType: "payment_in_credit",
    eventSource: "system",
    eventSourceId: customerId,
    amountDelta: -amount,
    effectiveAt: new Date(),
    metadata: { source: "legacy_deductPaymentFromBalance" },
  });
}

/**
 * Adds a payment amount back to customer balance (revert payment).
 */
export async function addPaymentToBalance(
  customerId: string,
  userId: string,
  amount: number
): Promise<void> {
  if (amount === 0) return;
  await appendCustomerLedgerEntry({
    userId,
    customerId,
    eventKey: `legacy_payment_add:${customerId}:${Date.now()}:${Math.abs(amount)}`,
    eventType: "manual_adjustment",
    eventSource: "system",
    eventSourceId: customerId,
    amountDelta: amount,
    effectiveAt: new Date(),
    metadata: { source: "legacy_addPaymentToBalance" },
  });
}
