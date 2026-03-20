import "dotenv/config";
import {
  getCollection,
  COLLECTIONS,
} from "../src/lib/db/mongodb";
import {
  appendCustomerLedgerEntry,
  seedCustomerOpeningBalance,
} from "../src/lib/ledger/customer-ledger";

type BackfillEvent = {
  key: string;
  eventType:
    | "order_debit"
    | "order_payment_credit"
    | "payment_in_credit";
  eventSource: "order" | "customer_transaction";
  eventSourceId: string;
  customerId: string;
  userId: string;
  amountDelta: number;
  effectiveAt: Date;
  metadata?: Record<string, unknown>;
};

async function runBackfill() {
  const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
  const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
  const customerTransactionsCollection = await getCollection(
    COLLECTIONS.CUSTOMER_TRANSACTIONS
  );

  const customers = await customersCollection
    .find({}, { projection: { _id: 1, user_id: 1, opening_balance: 1, created_at: 1 } })
    .toArray();

  console.log(`Backfill start: ${customers.length} customers`);

  for (const customer of customers) {
    const customerId = customer._id.toString();
    const userId = customer.user_id.toString();

    await seedCustomerOpeningBalance(
      userId,
      customerId,
      Number(customer.opening_balance ?? 0),
      customer.created_at ?? new Date()
    );

    const [orders, payments] = await Promise.all([
      ordersCollection
        .find({ user_id: customer.user_id, customer_id: customer._id })
        .toArray(),
      customerTransactionsCollection
        .find({ user_id: customer.user_id, customer_id: customer._id })
        .toArray(),
    ]);

    const events: BackfillEvent[] = [];

    for (const order of orders) {
      const orderId = order._id.toString();
      const saleDate = new Date(order.sale_date || order.created_at || new Date());
      const total = Number(order.total_amount ?? 0);
      const paid = Number(order.payment?.paid_amount ?? 0);

      if (total !== 0) {
        events.push({
          key: `backfill:order_debit:${orderId}`,
          eventType: "order_debit",
          eventSource: "order",
          eventSourceId: orderId,
          customerId,
          userId,
          amountDelta: total,
          effectiveAt: saleDate,
          metadata: {
            invoice_no: order.invoice_no ?? null,
            backfill: true,
          },
        });
      }

      if (paid > 0) {
        events.push({
          key: `backfill:order_payment_credit:${orderId}`,
          eventType: "order_payment_credit",
          eventSource: "order",
          eventSourceId: orderId,
          customerId,
          userId,
          amountDelta: -paid,
          effectiveAt: new Date(order.payment?.paid_date || saleDate),
          metadata: {
            invoice_no: order.invoice_no ?? null,
            backfill: true,
          },
        });
      }
    }

    for (const payment of payments) {
      const paymentId = payment._id.toString();
      const amount = Number(payment.payment_amount ?? 0);
      if (amount === 0) continue;

      events.push({
        key: `backfill:payment_in_credit:${paymentId}`,
        eventType: "payment_in_credit",
        eventSource: "customer_transaction",
        eventSourceId: paymentId,
        customerId,
        userId,
        amountDelta: -amount,
        effectiveAt: new Date(payment.date || payment.created_at || new Date()),
        metadata: {
          payment_method_id: payment.payment_method_id?.toString() ?? null,
          backfill: true,
        },
      });
    }

    events.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());

    for (const event of events) {
      await appendCustomerLedgerEntry({
        userId: event.userId,
        customerId: event.customerId,
        eventKey: event.key,
        eventType: event.eventType,
        eventSource: event.eventSource,
        eventSourceId: event.eventSourceId,
        amountDelta: event.amountDelta,
        effectiveAt: event.effectiveAt,
        metadata: event.metadata,
      });
    }

    console.log(
      `Backfilled customer ${customerId}: orders=${orders.length}, payments=${payments.length}, events=${events.length}`
    );
  }

  console.log("Backfill complete");
}

runBackfill()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
