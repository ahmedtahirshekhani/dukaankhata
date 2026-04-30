
// src/app/[locale]/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { COLLECTIONS, getCollection, toObjectId, setLastUpdated, updateUserLastActivity } from "@/lib/db/mongodb";
import { setDateToCurrentTime } from "@/lib/utils";

type ExpenseItemInput = {
  category?: string;
  itemName?: string;
  qty?: number | string;
  rate?: number | string;
  amount?: number | string;
};

export async function GET() {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);
    const userId = toObjectId(user.id);

    const [categoriesRaw, itemNamesRaw, expenseRows] = await Promise.all([
      expensesCollection.distinct("category", { user_id: userId }),
      expensesCollection.distinct("item_name", { user_id: userId }),
      expensesCollection
        .find({
          user_id: userId,
        })
        .sort({ created_at: -1 })
        .limit(500)
        .toArray(),
    ]);

    const categories = categoriesRaw
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));

    const items = itemNamesRaw
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));

    const expenses = expenseRows.map((row) => ({
      id: row._id.toString(),
      expenseNumber: row.expense_number ?? "",
      date: row.date
        ? new Date(row.date).toISOString().split("T")[0]
        : row.created_at
          ? new Date(row.created_at).toISOString().split("T")[0]
          : "",
      category: row.category ?? "",
      itemName: row.item_name ?? row.description ?? "",
      qty: Number(row.qty ?? 0),
      rate: Number(row.rate ?? 0),
      amount: Number(row.amount ?? 0),
    }));

    await updateUserLastActivity();
    return NextResponse.json({ categories, items, expenses });
  } catch (err) {
    console.error("expenses GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const expenseNumber = String(body?.expenseNumber ?? "").trim();
    const dateInput = String(body?.date ?? "").trim();
    const lineItems = Array.isArray(body?.items) ? (body.items as ExpenseItemInput[]) : [];

    if (!expenseNumber) {
      return NextResponse.json(
        { error: "Expense number is required" },
        { status: 400 }
      );
    }

    if (!dateInput) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "At least one expense item is required" },
        { status: 400 }
      );
    }

    const expenseDate = setDateToCurrentTime(dateInput);
    const now = new Date();
    const userId = toObjectId(user.id);

    const documents = lineItems.map((item) => {
      const category = String(item.category ?? "").trim();
      const itemName = String(item.itemName ?? "").trim();
      const qty = Number(item.qty ?? 0);
      const rate = Number(item.rate ?? 0);
      const amountFromBody = Number(item.amount ?? 0);
      const amount = amountFromBody > 0 ? amountFromBody : qty * rate;

      if (!category || !itemName || qty <= 0 || rate < 0 || amount <= 0) {
        throw new Error("Each expense item must have category, item name, qty, rate, and amount");
      }

      return {
        user_id: userId,
        expense_number: expenseNumber,
        date: expenseDate,
        created_at: expenseDate,
        updated_at: now,
        category,
        item_name: itemName,
        description: itemName,
        qty,
        rate,
        amount,
      };
    });

    const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);
    const insertResult = await expensesCollection.insertMany(documents);

    // ✅ Update user's last activity
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    await setLastUpdated(usersCollection, { _id: toObjectId(user.id) });

    await updateUserLastActivity();
    return NextResponse.json({
      expenseNumber,
      insertedCount: insertResult.insertedCount,
      totalAmount: documents.reduce((sum, item) => sum + item.amount, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("must have") ? 400 : 500;
    console.error("expenses POST error", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";