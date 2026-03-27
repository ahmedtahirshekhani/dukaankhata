import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { COLLECTIONS, getCollection, isValidObjectId, toObjectId } from "@/lib/db/mongodb";
import { setDateToCurrentTime } from "@/lib/utils";

type Params = {
  params: {
    id: string;
  };
};

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
    }

    const body = await req.json();
    const expenseNumber = String(body?.expenseNumber ?? "").trim();
    const dateInput = String(body?.date ?? "").trim();
    const category = String(body?.category ?? "").trim();
    const itemName = String(body?.itemName ?? "").trim();
    const qty = Number(body?.qty ?? 0);
    const rate = Number(body?.rate ?? 0);
    const amount = Number((qty * rate).toFixed(2));

    if (!expenseNumber || !dateInput || !category || !itemName || qty <= 0 || rate < 0 || amount <= 0) {
      return NextResponse.json(
        { error: "Expense number, date, category, item name, qty and rate are required" },
        { status: 400 }
      );
    }

    const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);
    const filter = {
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    };

    const updateResult = await expensesCollection.updateOne(filter, {
      $set: {
        expense_number: expenseNumber,
        date: setDateToCurrentTime(dateInput),
        category,
        item_name: itemName,
        description: itemName,
        qty,
        rate,
        amount,
        updated_at: new Date(),
      },
    });

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("expense PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
    }

    const expensesCollection = await getCollection(COLLECTIONS.EXPENSES);
    const deleteResult = await expensesCollection.deleteOne({
      _id: toObjectId(id),
      user_id: toObjectId(user.id),
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("expense DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
