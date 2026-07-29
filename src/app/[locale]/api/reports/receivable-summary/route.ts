// src/app/[locale]/api/reports/receivable-summary/route.ts

import { getCollection, COLLECTIONS, toObjectId, updateUserLastActivity } from '@/lib/db/mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { requirePermission } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authCheck = await requirePermission("reports.view_receivable_summary");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    const limit = limitParam === "-1" ? 0 : parseInt(limitParam || "10");
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "all";
    const minBalanceParam = searchParams.get("minBalance");
    const maxBalanceParam = searchParams.get("maxBalance");
    
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    
    // Query condition: only non-deleted customers with outstanding positive balances (> 0)
    const baseQuery: any = {
      user_id: toObjectId(user.id),
      is_delete: { $ne: 1 },
      balance: { $gt: 0 }
    };

    // Filtered query for list display (supports search & filters)
    const listQuery: any = { ...baseQuery };
    if (search) {
      listQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { company_name: { $regex: search, $options: "i" } },
      ];
    }

    if (statusParam && statusParam !== "all") {
      listQuery.status = statusParam;
    }

    if (minBalanceParam || maxBalanceParam) {
      const balanceCond: any = { $gt: 0 };
      if (minBalanceParam && !isNaN(parseFloat(minBalanceParam))) {
        balanceCond.$gte = parseFloat(minBalanceParam);
      }
      if (maxBalanceParam && !isNaN(parseFloat(maxBalanceParam))) {
        balanceCond.$lte = parseFloat(maxBalanceParam);
      }
      listQuery.balance = balanceCond;
    }

    // 1. Calculate summary statistics for the same filtered result set used by the list/pagination
    const statsPipeline = [
      { $match: listQuery },
      {
        $group: {
          _id: null,
          totalReceivable: { $sum: "$balance" },
          totalDebtors: { $sum: 1 },
          maxReceivable: { $max: "$balance" },
          avgReceivable: { $avg: "$balance" }
        }
      }
    ];

    const [statsResult, totalCount] = await Promise.all([
      customersCollection.aggregate(statsPipeline).toArray(),
      customersCollection.countDocuments(listQuery)
    ]);

    const summary = statsResult[0] || {
      totalReceivable: 0,
      totalDebtors: 0,
      maxReceivable: 0,
      avgReceivable: 0
    };

    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    // 2. Fetch the paginated debtors list
    const debtorsCursor = customersCollection
      .find(listQuery)
      .sort({ balance: -1 }); // Sort by outstanding balance desc (highest first)

    if (limit > 0) {
      debtorsCursor.skip(skip).limit(limit);
    }

    const data = await debtorsCursor.toArray();

    // Convert _id to id for consistency
    const debtors = data.map(debtor => ({
      id: debtor._id.toString(),
      name: debtor.name,
      email: debtor.email || "",
      phone: debtor.phone || "",
      company_name: debtor.company_name || "",
      company_address: debtor.company_address || "",
      balance: debtor.balance || 0,
      status: debtor.status || "active"
    }));

    await updateUserLastActivity();

    return NextResponse.json({
      debtors,
      summary: {
        totalReceivable: summary.totalReceivable || 0,
        totalDebtors: summary.totalDebtors || 0,
        maxReceivable: summary.maxReceivable || 0,
        avgReceivable: Math.round(summary.avgReceivable || 0)
      },
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit > 0 ? limit : totalCount
      }
    });

  } catch (err: any) {
    console.error("Error in receivable summary API:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
