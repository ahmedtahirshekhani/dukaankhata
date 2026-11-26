import { NextRequest, NextResponse } from "next/server";
import {
  getCollection,
  COLLECTIONS,
  toObjectId,
  isValidObjectId,
  updateUserLastActivity,
} from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";
import { requirePermission } from "@/lib/auth/rbac";
import { toSafeISOString } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("payment_methods.view");
    if (!authCheck.allowed) return authCheck.response!;

    const userId = toObjectId(user.id);
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("paymentMethodId");

    const query: any = {
      user_id: userId,
      is_deleted: { $ne: true },
      is_delete: { $nin: [1, true, "1"] },
    };

    if (paymentMethodId) {
      if (paymentMethodId.toLowerCase() === "cash") {
        query.$or = [
          { payment_method_id: "cash" },
          { payment_method_id: null },
          { payment_method_id: { $exists: false } },
        ];
      } else if (isValidObjectId(paymentMethodId)) {
        query.payment_method_id = {
          $in: [paymentMethodId, toObjectId(paymentMethodId)],
        };
      } else {
        query.payment_method_id = paymentMethodId;
      }
    }

    const collection = await getCollection(COLLECTIONS.CASH_ADJUSTMENTS);
    const docs = await collection
      .find(query)
      .sort({ date: -1, created_at: -1 })
      .toArray();

    const adjustments = docs.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
      _id: doc._id.toString(),
      payment_method_id: doc.payment_method_id?.toString() || "cash",
      user_id: doc.user_id?.toString(),
    }));

    return NextResponse.json({ adjustments });
  } catch (error: any) {
    console.error("Error in GET /api/cash-adjustments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch cash adjustments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("payment_methods.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await request.json();
    const {
      paymentMethodId = "cash",
      accountName,
      type = "add",
      amount,
      reason,
      notes = "",
      date,
      ref_no,
    } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a number greater than 0" },
        { status: 400 }
      );
    }

    const actionType = type === "reduce" ? "reduce" : "add";
    const userId = toObjectId(user.id);
    const dateIso = toSafeISOString(date);
    const refNo = ref_no || `CADJ-${Date.now().toString().slice(-6)}`;

    // Resolve Account Name if not passed
    let resolvedAccountName = accountName || "Cash in Hand";
    let resolvedPaymentMethodId = paymentMethodId || "cash";

    if (paymentMethodId && paymentMethodId !== "cash" && isValidObjectId(paymentMethodId)) {
      const pmCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
      const pmDoc = await pmCollection.findOne({
        _id: toObjectId(paymentMethodId),
        user_id: userId,
      });
      if (pmDoc) {
        resolvedAccountName = pmDoc.bank_name || pmDoc.name || resolvedAccountName;
        resolvedPaymentMethodId = pmDoc._id.toString();
      }
    }

    const newDoc = {
      user_id: userId,
      ref_no: refNo,
      payment_method_id: resolvedPaymentMethodId,
      account_name: resolvedAccountName,
      type: actionType,
      amount: Math.abs(numAmount),
      reason: reason || "Manual Cash Adjustment",
      notes: notes || "",
      date: dateIso,
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false,
    };

    const collection = await getCollection(COLLECTIONS.CASH_ADJUSTMENTS);
    const result = await collection.insertOne(newDoc as any);

    await updateUserLastActivity(user.id);

    return NextResponse.json(
      {
        message: "Cash adjustment created successfully",
        adjustment: {
          ...newDoc,
          id: result.insertedId.toString(),
          _id: result.insertedId.toString(),
          user_id: user.id,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/cash-adjustments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create cash adjustment" },
      { status: 500 }
    );
  }
}
