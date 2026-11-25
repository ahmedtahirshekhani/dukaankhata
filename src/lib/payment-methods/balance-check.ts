import { getCollection, COLLECTIONS, toObjectId, isValidObjectId } from "@/lib/db/mongodb";

export interface GetPaymentMethodBalanceOptions {
  userId: string;
  paymentMethodId: string;
  excludeTransaction?: {
    amount: number;
    paymentMethodId?: string | null;
  };
}

/**
 * Calculates real-time available balance for a payment method on the server.
 * Sources:
 * - Opening balance of the payment method (or default Cash in Hand)
 * - (+) Payment In (customer_transactions)
 * - (-) Payment Out (customer_transactions)
 * - (+) Paid Sales (orders)
 * - (-) Paid Purchases (purchase_bills)
 * - (-) Paid Sale Returns (sale_return_transactions)
 * - (-) Expenses (expenses)
 */
export async function getServerPaymentMethodBalance(
  options: GetPaymentMethodBalanceOptions
): Promise<number> {
  const { userId, paymentMethodId, excludeTransaction } = options;
  if (!userId || !paymentMethodId) return 0;

  const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
  let isCash =
    paymentMethodId === "cash" ||
    paymentMethodId === "Cash" ||
    paymentMethodId.toLowerCase().includes("cash");
  let isCheque =
    paymentMethodId === "cheque" ||
    paymentMethodId === "Cheque" ||
    paymentMethodId.toLowerCase().includes("cheque");

  const pmValuesSet = new Set<any>();
  pmValuesSet.add(paymentMethodId);
  if (isValidObjectId(paymentMethodId)) {
    pmValuesSet.add(toObjectId(paymentMethodId));
  }

  let openingBal = 0;
  if (isValidObjectId(paymentMethodId)) {
    const pmDoc = await paymentMethodCollection.findOne({
      _id: toObjectId(paymentMethodId),
      user_id: toObjectId(userId),
    });
    if (pmDoc) {
      openingBal = Number(pmDoc.opening_balance) || 0;
      if (pmDoc.is_default || /cash/i.test(pmDoc.bank_name || pmDoc.name || "")) {
        isCash = true;
      }
      if (/cheque/i.test(pmDoc.bank_name || pmDoc.name || "")) {
        isCheque = true;
      }
    }
  }

  if (isCash) {
    const defaultCashDoc = await paymentMethodCollection.findOne({
      user_id: toObjectId(userId),
      $or: [{ is_default: true }, { bank_name: { $regex: /cash/i } }, { name: { $regex: /cash/i } }],
    });
    if (defaultCashDoc) {
      if (openingBal === 0) {
        openingBal = Number(defaultCashDoc.opening_balance) || 0;
      }
      pmValuesSet.add(defaultCashDoc._id);
      pmValuesSet.add(defaultCashDoc._id.toString());
    }
    pmValuesSet.add("cash");
    pmValuesSet.add("Cash");
    pmValuesSet.add("CASH");
    pmValuesSet.add(null);
    pmValuesSet.add("");
  }

  if (isCheque) {
    pmValuesSet.add("cheque");
    pmValuesSet.add("Cheque");
    pmValuesSet.add("CHEQUE");
  }

  const pmValues = Array.from(pmValuesSet);
  const pmFilter = { $in: pmValues };
  const userIdObj = toObjectId(userId);
  const ctCollection = await getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS);

  const [ctItems, orderItems, pbItems, srItems, expItems] = await Promise.all([
    ctCollection.find({ user_id: userIdObj, payment_method_id: pmFilter }).toArray(),
    getCollection(COLLECTIONS.ORDERS).then((c) =>
      c
        .find({
          user_id: userIdObj,
          $or: [{ "payment.method": pmFilter }, { payment_method_id: pmFilter }],
        })
        .toArray()
    ),
    getCollection(COLLECTIONS.PURCHASE_BILLS).then((c) =>
      c.find({ user_id: userIdObj, payment_method_id: pmFilter }).toArray()
    ),
    getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then((c) =>
      c.find({ user_id: userIdObj, payment_method_id: pmFilter }).toArray()
    ),
    getCollection(COLLECTIONS.EXPENSES).then((c) =>
      c.find({ user_id: userIdObj, payment_method_id: pmFilter }).toArray()
    ),
  ]);

  let serverBalance = openingBal;
  ctItems.forEach((t) => {
    const amt = Number(t.payment_amount || t.amount) || 0;
    if (t.type === "payment-in") serverBalance += amt;
    if (t.type === "payment-out") serverBalance -= amt;
  });
  orderItems.forEach((o) => {
    const amt = Number(o.payment?.paid_amount || o.paid_amount) || 0;
    serverBalance += amt;
  });
  pbItems.forEach((p) => {
    const amt = Number(p.payment?.paid_amount || p.paid_amount) || 0;
    serverBalance -= amt;
  });
  srItems.forEach((s) => {
    const amt = Number(s.paid_amount) || 0;
    serverBalance -= amt;
  });
  expItems.forEach((e) => {
    const amt = Number(e.amount) || 0;
    serverBalance -= amt;
  });

  // If editing an existing transaction where money was previously paid from this method, add it back
  if (excludeTransaction && excludeTransaction.amount > 0) {
    const oldMethod = excludeTransaction.paymentMethodId?.toString() || "";
    const isOldCash =
      oldMethod === "cash" ||
      oldMethod === "Cash" ||
      oldMethod.toLowerCase().includes("cash") ||
      !oldMethod;

    const matchesMethod =
      oldMethod === paymentMethodId ||
      (isCash && isOldCash) ||
      (pmValues.some((v) => v && v.toString() === oldMethod));

    if (matchesMethod) {
      serverBalance += excludeTransaction.amount;
    }
  }

  return Math.round(serverBalance * 100) / 100;
}
