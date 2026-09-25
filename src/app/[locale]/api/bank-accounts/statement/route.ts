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
  let from: Date;
  let to: Date;

  if (fromDate.includes('-') && fromDate.length === 10) {
    const [y, m, d] = fromDate.split('-').map(Number);
    from = new Date(y, m - 1, d, 0, 0, 0, 0);
  } else {
    from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
  }

  if (toDate.includes('-') && toDate.length === 10) {
    const [y, m, d] = toDate.split('-').map(Number);
    to = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else {
    to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

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

    const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
    const bankAccount = await paymentMethodCollection.findOne({
      _id: methodObjId,
      user_id: userId,
    });

    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const openingBalance = bankAccount.opening_balance || 0;

    const isCashAccount = bankAccount.is_default || bankAccount.bank_name?.toLowerCase().includes("cash");
    const isChequeAccount = bankAccount.bank_name?.toLowerCase().includes("cheque");

    const pmValues: any[] = [methodObjId, bankAccountId, methodObjId.toString()];
    if (isCashAccount) {
      pmValues.push("cash", "Cash", "CASH", null, "");
    }
    if (isChequeAccount) {
      pmValues.push("cheque", "Cheque", "CHEQUE");
    }

    const pmStringQuery = { $in: pmValues };

    const parseToISO = (dateVal: any, fallback: any = new Date()) => {
      if (!dateVal) {
        return fallback instanceof Date ? fallback.toISOString() : (fallback ? new Date(fallback).toISOString() : new Date().toISOString());
      }
      const d = new Date(dateVal);
      if (Number.isNaN(d.getTime())) {
        return fallback instanceof Date ? fallback.toISOString() : (fallback ? new Date(fallback).toISOString() : new Date().toISOString());
      }
      return d.toISOString();
    };

    const orderQuery: any = {
      user_id: userId,
      $or: [
        { 'payment.method': pmStringQuery },
        { payment_method_id: pmStringQuery },
        ...(isCashAccount ? [
          { 'payment.method': { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { 'payment.method': { $exists: false } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const ctQuery: any = {
      user_id: userId,
      $or: [
        { payment_method_id: pmStringQuery },
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const pbQuery: any = {
      user_id: userId,
      $or: [
        { payment_method_id: pmStringQuery },
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const srQuery: any = {
      user_id: userId,
      $or: [
        { payment_method_id: pmStringQuery },
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const expQuery: any = {
      user_id: userId,
      $or: [
        { payment_method_id: pmStringQuery },
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const [
      customerTransactions,
      orders,
      purchaseBills,
      saleReturns,
      expenses
    ] = await Promise.all([
      getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS).then(c => c.find(ctQuery).toArray()),
      getCollection(COLLECTIONS.ORDERS).then(c => c.find(orderQuery).toArray()),
      getCollection(COLLECTIONS.PURCHASE_BILLS).then(c => c.find(pbQuery).toArray()),
      getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then(c => c.find(srQuery).toArray()),
      getCollection(COLLECTIONS.EXPENSES).then(c => c.find(expQuery).toArray())
    ]);

    let transactions: any[] = [];

    // Payment In (type: payment-in) -> IN
    // Payment Out (type: payment-out) -> OUT
    customerTransactions.forEach(t => {
      const amount = Number(t.payment_amount || t.amount || 0);
      if (amount > 0) {
        const isPaymentOut = t.type === 'payment-out';
        const voucherNo = t.payment_number || t.paymentNumber || t.voucher_no || t.reference_no || t.invoice_no || null;
        const txnDate = t.date || t.payment_date || t.created_at;
        let desc = t.description;
        if (!desc || desc === 'Payment sent to vendor' || desc === 'Payment received from customer') {
          desc = isPaymentOut ? 'Payment sent to party' : 'Payment received from party';
        }
        transactions.push({
          id: t._id.toString(),
          type: isPaymentOut ? 'Payment Out' : (t.type === 'payment-in' ? 'Payment In' : 'Payment'),
          rawType: isPaymentOut ? 'payment_out' : (t.type === 'payment-in' ? 'payment_in' : 'payment'),
          voucherNo: voucherNo,
          description: desc,
          amount: amount,
          direction: isPaymentOut ? 'OUT' : 'IN',
          dateTime: parseToISO(txnDate, t.created_at)
        });
      }
    });

    // Cash Invoices -> IN (if paid via this method)
    orders.forEach(o => {
      const paidAmount = Number(o.payment?.paid_amount || o.paid_amount || 0);
      if (paidAmount > 0) {
        const voucherNo = o.invoice_no || o.order_number || null;
        const orderDate = o.sale_date || o.order_date || o.date || o.payment?.paid_date || o.created_at;
        transactions.push({
          id: o._id.toString(),
          type: 'Sale Invoice',
          rawType: 'order',
          voucherNo: voucherNo,
          description: 'Sale Invoice',
          amount: paidAmount,
          direction: 'IN',
          dateTime: parseToISO(orderDate, o.created_at)
        });
      }
    });

    // Purchase Bills -> OUT
    purchaseBills.forEach(p => {
      const paidAmount = Number(p.payment?.paid_amount || p.paid_amount || 0);
      if (paidAmount > 0) {
        const voucherNo = p.bill_no || p.purchase_number || p.purchase_no || null;
        const pbDate = p.payment?.paid_date || p.purchase_date || p.bill_date || p.date || p.created_at;
        transactions.push({
          id: p._id.toString(),
          type: 'Purchase Bill',
          rawType: 'purchase_bill',
          voucherNo: voucherNo,
          description: 'Purchase Bill',
          amount: paidAmount,
          direction: 'OUT',
          dateTime: parseToISO(pbDate, p.created_at)
        });
      }
    });

    // Sale Returns -> OUT
    saleReturns.forEach(s => {
      const paidAmount = Number(s.paid_amount || 0);
      if (paidAmount > 0) {
        const voucherNo = s.return_number || null;
        const srDate = s.date || s.return_date || s.created_at;
        transactions.push({
          id: s._id.toString(),
          type: 'Sale Return',
          rawType: 'sale_return',
          voucherNo: voucherNo,
          description: 'Sale Return Refund',
          amount: paidAmount,
          direction: 'OUT',
          dateTime: parseToISO(srDate, s.created_at)
        });
      }
    });

    // Expenses -> OUT
    expenses.forEach(e => {
      const amount = Number(e.amount || 0);
      if (amount > 0) {
        const voucherNo = e.expense_number || e.expense_no || e.receipt_no || null;
        const expDate = e.date || e.expense_date || e.created_at;
        transactions.push({
          id: e._id.toString(),
          type: 'Expense',
          rawType: 'expense',
          voucherNo: voucherNo,
          description: e.category || e.description || 'Expense',
          amount: amount,
          direction: 'OUT',
          dateTime: parseToISO(expDate, e.created_at)
        });
      }
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

    // Sort filtered transactions by date ascending (oldest entries on top)
    filteredTransactions.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    // Virtual Opening Balance record
    const openingDate = from.getFullYear() === 1970 && bankAccount.created_at
      ? new Date(bankAccount.created_at).toISOString()
      : from.toISOString();

    const openingBalanceRecord = {
      id: "opening_balance",
      type: "Opening Balance",
      rawType: "opening_balance",
      voucherNo: "-",
      description: "Opening Balance",
      amount: Math.abs(periodOpeningBalance),
      direction: periodOpeningBalance >= 0 ? "IN" : "OUT",
      debit: periodOpeningBalance > 0 ? periodOpeningBalance : 0,
      credit: periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance) : 0,
      balance: periodOpeningBalance,
      dateTime: openingDate,
    };

    const summary = {
      openingBalance: periodOpeningBalance,
      totalIn,
      totalOut,
      currentBalance: currentBalance
    };

    await updateUserLastActivity();
    return NextResponse.json({
      transactions: [openingBalanceRecord, ...filteredTransactions],
      summary,
    });
  } catch (err: unknown) {
    console.error("bank-accounts statement GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
