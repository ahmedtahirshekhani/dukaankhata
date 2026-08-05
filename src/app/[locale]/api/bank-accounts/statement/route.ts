import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

function parseDateRange(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (from.getTime() > to.getTime()) {
    throw new Error("fromDate cannot be greater than toDate");
  }

  return { from, to };
}

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("payment_methods.view");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get("bankAccountId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    if (!bankAccountId || !isValidObjectId(bankAccountId)) {
      return NextResponse.json({ error: "Valid bank account ID is required" }, { status: 400 });
    }
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "fromDate and toDate are required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const methodObjId = toObjectId(bankAccountId);
    const { from, to } = parseDateRange(fromDate, toDate);

    const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHOD);
    const bankAccount = await paymentMethodCollection.findOne({
      _id: methodObjId,
      user_id: userId,
    });

    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const openingBalance = bankAccount.opening_balance || 0;

    const pmStringQuery = { $in: [methodObjId, bankAccountId, methodObjId.toString()] };

    const [
      customerTransactions,
      orders,
      purchaseBills,
      saleReturns,
      expenses
    ] = await Promise.all([
      getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS).then(c => c.find({ user_id: userId, payment_method_id: pmStringQuery }).toArray()),
      getCollection(COLLECTIONS.ORDERS).then(c => c.find({ user_id: userId, $or: [{ 'payment.method': pmStringQuery }, { payment_method_id: pmStringQuery }] }).toArray()),
      getCollection(COLLECTIONS.PURCHASE_BILLS).then(c => c.find({ user_id: userId, payment_method_id: pmStringQuery }).toArray()),
      getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then(c => c.find({ user_id: userId, payment_method_id: pmStringQuery }).toArray()),
      getCollection(COLLECTIONS.EXPENSES).then(c => c.find({ user_id: userId, payment_method_id: pmStringQuery }).toArray())
    ]);

    let transactions: any[] = [];

    // Payment In (type: payment-in) -> IN
    // Payment Out (type: payment-out) -> OUT
    customerTransactions.forEach(t => {
      transactions.push({
        id: t._id.toString(),
        type: t.type === 'payment-out' ? 'Payment Out' : (t.type === 'payment-in' ? 'Payment In' : 'Payment'),
        description: t.description || (t.type === 'payment-out' ? 'Payment sent to vendor' : 'Payment received from customer'),
        amount: t.payment_amount || t.amount || 0,
        direction: t.type === 'payment-out' ? 'OUT' : 'IN',
        dateTime: t.date ? new Date(t.date).toISOString() : (t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString())
      });
    });

    // Cash Invoices -> IN (if paid via this method)
    orders.forEach(o => {
      const paidAmount = o.payment?.paid_amount || o.paid_amount || 0;
      if (paidAmount > 0) {
        transactions.push({
          id: o._id.toString(),
          type: 'Sale Invoice',
          description: `Sale Invoice ${o.invoice_no ? '#' + o.invoice_no : ''}`.trim(),
          amount: paidAmount,
          direction: 'IN',
          dateTime: (o.payment?.paid_date || o.created_at) ? new Date(o.payment?.paid_date || o.created_at).toISOString() : new Date().toISOString()
        });
      }
    });

    // Purchase Bills -> OUT
    purchaseBills.forEach(p => {
      const paidAmount = p.payment?.paid_amount || p.paid_amount || 0;
      if (paidAmount > 0) {
        transactions.push({
          id: p._id.toString(),
          type: 'Purchase Invoice',
          description: `Purchase Invoice ${p.bill_no ? '#' + p.bill_no : ''}`.trim(),
          amount: paidAmount,
          direction: 'OUT',
          dateTime: (p.payment?.paid_date || p.created_at) ? new Date(p.payment?.paid_date || p.created_at).toISOString() : new Date().toISOString()
        });
      }
    });

    // Sale Returns -> OUT
    saleReturns.forEach(s => {
      if (s.paid_amount > 0) {
        transactions.push({
          id: s._id.toString(),
          type: 'Sale Return',
          description: `Sale return refund`,
          amount: s.paid_amount || 0,
          direction: 'OUT',
          dateTime: s.date ? new Date(s.date).toISOString() : new Date().toISOString()
        });
      }
    });

    // Expenses -> OUT
    expenses.forEach(e => {
      transactions.push({
        id: e._id.toString(),
        type: 'Expense',
        description: e.category || 'Expense',
        amount: e.amount || 0,
        direction: 'OUT',
        dateTime: e.date ? new Date(e.date).toISOString() : new Date().toISOString()
      });
    });

    // Sort all transactions by date ascending
    transactions.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    // Calculate balances and filter by date range
    let currentBalance = openingBalance;
    let filteredTransactions: any[] = [];
    let periodOpeningBalance = openingBalance;
    
    let totalIn = 0;
    let totalOut = 0;

    for (const t of transactions) {
      const tDate = new Date(t.dateTime);
      
      const isBeforeFrom = tDate < from;
      const isInRange = tDate >= from && tDate <= to;

      if (t.direction === 'IN') {
        currentBalance += t.amount;
        if (isBeforeFrom) {
          periodOpeningBalance += t.amount;
        } else if (isInRange) {
          totalIn += t.amount;
        }
      } else {
        currentBalance -= t.amount;
        if (isBeforeFrom) {
          periodOpeningBalance -= t.amount;
        } else if (isInRange) {
          totalOut += t.amount;
        }
      }

      if (isInRange) {
        filteredTransactions.push({
          ...t,
          balance: currentBalance,
          debit: t.direction === 'IN' ? t.amount : 0,
          credit: t.direction === 'OUT' ? t.amount : 0
        });
      }
    }

    filteredTransactions.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    const summary = {
      openingBalance: periodOpeningBalance,
      totalIn,
      totalOut,
      currentBalance: currentBalance
    };

    await updateUserLastActivity();
    return NextResponse.json({
      transactions: filteredTransactions,
      summary,
    });
  } catch (err: unknown) {
    console.error("bank-accounts statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
