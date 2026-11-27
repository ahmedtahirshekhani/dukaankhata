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

async function resolveAccountAndPaymentMethod(
  userId: any,
  rawPmId?: string,
  rawAccName?: string
): Promise<{ resolvedPaymentMethodId: string; resolvedAccountName: string }> {
  const pmId = String(rawPmId || "").trim();
  const accName = String(rawAccName || "").trim();

  // If nothing is given or explicit 'cash'
  if (!pmId && !accName) {
    return { resolvedPaymentMethodId: "cash", resolvedAccountName: "Cash in Hand" };
  }

  if (pmId.toLowerCase() === "cash") {
    return { resolvedPaymentMethodId: "cash", resolvedAccountName: accName || "Cash in Hand" };
  }

  // Look up in payment methods
  const pmCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
  let pmDoc: any = null;

  if (pmId && isValidObjectId(pmId)) {
    pmDoc = await pmCollection.findOne({
      _id: toObjectId(pmId),
      user_id: userId,
    });
  }

  if (!pmDoc) {
    const orConditions: any[] = [];
    if (pmId) {
      orConditions.push({ id: pmId });
      orConditions.push({ _id: pmId });
      orConditions.push({ local_id: pmId });
    }
    if (accName) {
      orConditions.push({ bank_name: accName });
      orConditions.push({ name: accName });
    }
    if (orConditions.length > 0) {
      pmDoc = await pmCollection.findOne({
        user_id: userId,
        $or: orConditions,
      } as any);
    }
  }

  if (pmDoc) {
    return {
      resolvedPaymentMethodId: (pmDoc._id || pmDoc.id || pmId).toString(),
      resolvedAccountName: pmDoc.bank_name || pmDoc.name || accName || "Bank Account",
    };
  }

  // If not found in DB (e.g. newly created offline account), retain user's intention
  return {
    resolvedPaymentMethodId: pmId || "cash",
    resolvedAccountName: accName || (pmId === "cash" ? "Cash in Hand" : "Bank Account"),
  };
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
      id,
      localId,
      type = "add",
      amount,
      reason,
      notes = "",
      date,
      ref_no,
      refNo,
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
    const finalRefNo = ref_no || refNo || `CADJ-${Date.now().toString().slice(-6)}`;

    const rawPmId = body.payment_method_id ?? body.paymentMethodId;
    const rawAccName = body.account_name ?? body.accountName;

    const { resolvedPaymentMethodId, resolvedAccountName } =
      await resolveAccountAndPaymentMethod(userId, rawPmId, rawAccName);

    const newDoc = {
      user_id: userId,
      local_id: id || localId || null,
      ref_no: finalRefNo,
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

    const insertedIdStr = result.insertedId.toString();

    return NextResponse.json(
      {
        message: "Cash adjustment created successfully",
        id: insertedIdStr,
        _id: insertedIdStr,
        ref_no: finalRefNo,
        adjustment: {
          ...newDoc,
          id: insertedIdStr,
          _id: insertedIdStr,
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

export async function PUT(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("payment_methods.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const body = await request.json();
    const { id, _id, ref_no, refNo, type, amount, reason, notes, date } = body;
    const targetId = id || _id;
    const targetRefNo = ref_no || refNo;

    if (!targetId && !targetRefNo) {
      return NextResponse.json({ error: "Adjustment ID or Ref No is required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const collection = await getCollection(COLLECTIONS.CASH_ADJUSTMENTS);

    const searchConditions: any[] = [];
    if (targetId && isValidObjectId(targetId)) {
      searchConditions.push({ _id: toObjectId(targetId) });
    }
    if (targetId) {
      searchConditions.push({ id: targetId });
      searchConditions.push({ _id: targetId });
      searchConditions.push({ local_id: targetId });
      searchConditions.push({ ref_no: targetId });
    }
    if (targetRefNo) {
      searchConditions.push({ ref_no: targetRefNo });
    }

    const query: any = {
      user_id: userId,
      $or: searchConditions,
    };

    const existing = await collection.findOne(query);
    if (!existing) {
      return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    }

    const updateFields: any = {
      updated_at: new Date(),
    };

    if (type !== undefined) updateFields.type = type === "reduce" ? "reduce" : "add";
    if (amount !== undefined) updateFields.amount = Math.abs(Number(amount) || 0);
    if (reason !== undefined) updateFields.reason = reason;
    if (notes !== undefined) updateFields.notes = notes;
    if (date !== undefined) updateFields.date = toSafeISOString(date);

    const rawPmId = body.payment_method_id !== undefined ? body.payment_method_id : body.paymentMethodId;
    const rawAccName = body.account_name !== undefined ? body.account_name : body.accountName;

    if (rawPmId !== undefined || rawAccName !== undefined) {
      const { resolvedPaymentMethodId, resolvedAccountName } =
        await resolveAccountAndPaymentMethod(
          userId,
          rawPmId !== undefined ? rawPmId : existing.payment_method_id,
          rawAccName !== undefined ? rawAccName : existing.account_name
        );
      updateFields.payment_method_id = resolvedPaymentMethodId;
      updateFields.account_name = resolvedAccountName;
    }

    await collection.updateOne({ _id: existing._id }, { $set: updateFields });
    await updateUserLastActivity(user.id);

    return NextResponse.json({
      message: "Cash adjustment updated successfully",
      adjustment: {
        ...existing,
        ...updateFields,
        id: existing._id.toString(),
        _id: existing._id.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error in PUT /api/cash-adjustments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update cash adjustment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = (await getCurrentUser()) as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authCheck = await requirePermission("payment_methods.edit");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const refNo = searchParams.get("ref_no");

    if (!id && !refNo) {
      return NextResponse.json({ error: "Adjustment ID or Ref No is required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const collection = await getCollection(COLLECTIONS.CASH_ADJUSTMENTS);

    const searchConditions: any[] = [];
    if (id && isValidObjectId(id)) {
      searchConditions.push({ _id: toObjectId(id) });
    }
    if (id) {
      searchConditions.push({ id });
      searchConditions.push({ _id: id });
      searchConditions.push({ local_id: id });
      searchConditions.push({ ref_no: id });
    }
    if (refNo) {
      searchConditions.push({ ref_no: refNo });
    }

    const query: any = {
      user_id: userId,
      $or: searchConditions,
    };

    const result = await collection.updateOne(query, {
      $set: {
        is_deleted: true,
        is_delete: 1,
        updated_at: new Date(),
      },
    });

    if (result.matchedCount === 0) {
      await collection.deleteOne(query);
    }

    await updateUserLastActivity(user.id);

    return NextResponse.json({
      message: "Cash adjustment deleted successfully",
      id,
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/cash-adjustments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete cash adjustment" },
      { status: 500 }
    );
  }
}
