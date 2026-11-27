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
import { parsePKTDateBoundary } from "@/lib/date-utils";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDateRange(fromDate: string, toDate: string) {
  const from = parsePKTDateBoundary(fromDate, false);
  const to = parsePKTDateBoundary(toDate, true);

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
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

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
    }
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "fromDate and toDate are required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const { from, to } = parseDateRange(fromDate, toDate);

    const paymentMethodCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

    let bankAccount: any = null;
    if (isValidObjectId(bankAccountId)) {
      bankAccount = await paymentMethodCollection.findOne({
        _id: toObjectId(bankAccountId),
        user_id: userId,
      });
    }

    if (!bankAccount) {
      bankAccount = await paymentMethodCollection.findOne({
        user_id: userId,
        $or: [
          { id: bankAccountId },
          ...(isValidObjectId(bankAccountId) ? [{ _id: toObjectId(bankAccountId) }] : []),
          { local_id: bankAccountId },
          { bank_name: { $regex: new RegExp(`^${escapeRegex(bankAccountId)}$`, "i") } },
          ...(bankAccountId.toLowerCase() === "cash" ? [{ is_default: true }] : [])
        ]
      } as any);
    }

    if (!bankAccount && (bankAccountId.toLowerCase() === "cash" || bankAccountId.toLowerCase().includes("cash"))) {
      bankAccount = await paymentMethodCollection.findOne({
        user_id: userId,
        $or: [{ is_default: true }, { bank_name: { $regex: /cash/i } }]
      });
    }

    if (!bankAccount) {
      // Fallback synthetic representation if bank account is not found in DB
      bankAccount = {
        _id: isValidObjectId(bankAccountId) ? toObjectId(bankAccountId) : bankAccountId,
        bank_name: bankAccountId.toLowerCase() === "cash" ? "Cash in Hand" : bankAccountId,
        opening_balance: 0,
        is_default: bankAccountId.toLowerCase() === "cash"
      };
    }

    const openingBalance = bankAccount.opening_balance || 0;

    const isCashAccount = Boolean(
      bankAccount.is_default ||
      bankAccount.bank_name?.toLowerCase().includes("cash") ||
      bankAccountId.toLowerCase() === "cash"
    );
    const isChequeAccount = Boolean(bankAccount.bank_name?.toLowerCase().includes("cheque"));

    const pmValues: any[] = [];
    if (bankAccount._id) {
      pmValues.push(bankAccount._id);
      pmValues.push(bankAccount._id.toString());
    }
    if (bankAccount.id) pmValues.push(bankAccount.id);
    if (bankAccount.local_id) pmValues.push(bankAccount.local_id);
    if (bankAccountId) {
      pmValues.push(bankAccountId);
      if (isValidObjectId(bankAccountId)) {
        pmValues.push(toObjectId(bankAccountId));
      }
    }
    if (bankAccount.bank_name) {
      pmValues.push(bankAccount.bank_name);
    }
    if (bankAccount.name) {
      pmValues.push(bankAccount.name);
    }
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

    const vtQuery: any = {
      user_id: userId,
      $or: [
        { payment_method_id: pmStringQuery },
        { paymentMethodId: pmStringQuery },
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } }
        ] : [])
      ]
    };

    const caQuery: any = {
      user_id: userId,
      is_deleted: { $ne: true },
      is_delete: { $nin: [1, true, "1"] },
      $or: [
        { payment_method_id: pmStringQuery },
        ...(bankAccount.bank_name ? [{ account_name: { $regex: new RegExp(`^${escapeRegex(bankAccount.bank_name)}$`, 'i') } }] : []),
        ...(isCashAccount ? [
          { payment_method_id: { $in: ['cash', 'Cash', 'CASH', null, ''] } },
          { payment_method_id: { $exists: false } },
          { account_name: { $regex: /cash/i } }
        ] : [])
      ]
    };

    const [
      customerTransactions,
      vendorTransactions,
      orders,
      purchaseBills,
      saleReturns,
      expenses,
      cashAdjustments
    ] = await Promise.all([
      getCollection(COLLECTIONS.CUSTOMER_TRANSACTIONS).then(c => c.find(ctQuery).toArray()),
      getCollection(COLLECTIONS.VENDOR_TRANSACTIONS).then(c => c.find(vtQuery).toArray()).catch(() => []),
      getCollection(COLLECTIONS.ORDERS).then(c => c.find(orderQuery).toArray()),
      getCollection(COLLECTIONS.PURCHASE_BILLS).then(c => c.find(pbQuery).toArray()),
      getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS).then(c => c.find(srQuery).toArray()),
      getCollection(COLLECTIONS.EXPENSES).then(c => c.find(expQuery).toArray()),
      getCollection(COLLECTIONS.CASH_ADJUSTMENTS).then(c => c.find(caQuery).toArray())
    ]);

    let transactions: any[] = [];

    // Vendor Transactions -> OUT (for payment-out) / IN (for refund/payment-in)
    (vendorTransactions || []).forEach(t => {
      const amount = Number(t.payment_amount || t.amount || 0);
      if (amount > 0) {
        const isPaymentOut = t.type === 'payment-out' || !t.type;
        const voucherNo = t.payment_number || t.paymentNumber || t.voucher_no || t.reference_no || null;
        const txnDate = t.date || t.payment_date || t.created_at;
        transactions.push({
          id: t._id.toString(),
          type: isPaymentOut ? 'Payment Out' : 'Payment In',
          rawType: isPaymentOut ? 'payment_out' : 'payment_in',
          voucherNo: voucherNo,
          description: t.description || (isPaymentOut ? 'Payment to vendor' : 'Payment from vendor'),
          amount: amount,
          direction: isPaymentOut ? 'OUT' : 'IN',
          dateTime: parseToISO(txnDate, t.created_at)
        });
      }
    });

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

    // Cash Adjustments -> IN (for Add) / OUT (for Reduce)
    cashAdjustments.forEach(ca => {
      const amount = Number(ca.amount || 0);
      if (amount > 0) {
        const isReduce = ca.type === 'reduce';
        const voucherNo = ca.ref_no || null;
        const caDate = ca.date || ca.created_at;
        const desc = ca.reason ? `Cash Adjustment: ${ca.reason}` : (isReduce ? 'Cash Adjustment (Reduce)' : 'Cash Adjustment (Add)');
        transactions.push({
          id: ca._id.toString(),
          type: isReduce ? 'Cash Adjustment (-)' : 'Cash Adjustment (+)',
          rawType: 'cash_adjustment',
          voucherNo: voucherNo,
          description: desc,
          amount: amount,
          direction: isReduce ? 'OUT' : 'IN',
          dateTime: parseToISO(caDate, ca.created_at)
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
    const openingDate = from.getFullYear() <= 1970 && bankAccount.created_at
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
