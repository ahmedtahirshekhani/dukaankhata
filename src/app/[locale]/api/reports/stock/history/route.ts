// src/app/[locale]/api/reports/stock/history/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser() as { id: string } | null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission("reports.view_stock");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json({ error: "Valid productId is required" }, { status: 400 });
    }

    const userId = toObjectId(user.id);
    const prodObjId = toObjectId(productId);

    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const product = await productsCollection.findOne({
      _id: prodObjId,
      user_id: userId,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { getValuationMethod } = await import('@/lib/inventory/valuation-engine');
    const valuationMethod = await getValuationMethod(user.id);

    // 1. Fetch batches
    const batchesCollection = await getCollection(COLLECTIONS.INVENTORY_BATCHES);
    const batches = await batchesCollection
      .find({
        user_id: userId,
        product_id: prodObjId,
      })
      .sort({ batch_date: -1, created_at: -1 })
      .toArray();

    // 2. Fetch Purchase Bills containing this product
    const purchaseBillsCollection = await getCollection(COLLECTIONS.PURCHASE_BILLS);
    const purchaseBills = await purchaseBillsCollection
      .find({
        user_id: userId,
        "items.product_id": { $in: [prodObjId, productId] },
      })
      .toArray();

    // 3. Fetch Sales Invoices (Orders) containing this product
    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const orders = await ordersCollection
      .find({
        user_id: userId,
        status: { $ne: "cancelled" },
        "items.product_id": { $in: [prodObjId, productId] },
      })
      .toArray();

    // 4. Fetch Sale Returns containing this product
    const saleReturnsCollection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const saleReturns = await saleReturnsCollection
      .find({
        user_id: userId,
        $or: [
          { "items.productId": productId },
          { "items.product_id": productId },
          { "items.productId": prodObjId },
          { "items.product_id": prodObjId },
        ],
      })
      .toArray();

    // 5. Fetch Stock Adjustments
    const stockAdjustmentsCollection = await getCollection(
      (COLLECTIONS as any).STOCK_ADJUSTMENTS || "stock_adjustments"
    );
    const stockAdjustments = await stockAdjustmentsCollection
      .find({
        user_id: userId,
        product_id: { $in: [prodObjId, productId] },
      })
      .toArray();

    // Fetch parties and customers map for names
    const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

    const [allParties, allCustomers] = await Promise.all([
      partiesCollection.find({ user_id: userId }, { projection: { _id: 1, name: 1, company_name: 1 } }).toArray(),
      customersCollection.find({ user_id: userId }, { projection: { _id: 1, name: 1, company_name: 1 } }).toArray(),
    ]);

    const partyMap = new Map<string, string>();
    for (const p of allParties) {
      partyMap.set(p._id.toString(), p.company_name || p.name || "Supplier");
    }
    for (const c of allCustomers) {
      partyMap.set(c._id.toString(), c.name || c.company_name || "Customer");
    }

    // 6. Build raw chronological movement events
    interface RawMovement {
      id: string;
      date: Date;
      type: "purchase" | "sale" | "sale_return" | "adjustment_add" | "adjustment_reduce";
      refNo: string;
      partyName: string;
      inwardQty: number;
      outwardQty: number;
      unitRate: number;
      costPrice: number;
      totalAmount: number;
      batchSplits?: any[];
      batchNumber?: string;
    }

    const rawMovements: RawMovement[] = [];

    // Map Purchase Bills
    for (const bill of purchaseBills) {
      const billDate = bill.bill_date || bill.date || bill.created_at;
      const d = new Date(billDate);
      const supplierName = bill.party_name || partyMap.get(bill.party_id?.toString()) || "Supplier";
      
      const matchedItems = (bill.items || []).filter((it: any) => 
        it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.cost_price ?? it.unit_price) || 0;
        rawMovements.push({
          id: `pb-${bill._id}-${it.product_id}`,
          date: isNaN(d.getTime()) ? new Date(bill.created_at || Date.now()) : d,
          type: "purchase",
          refNo: bill.bill_number || `BILL-${bill._id.toString().slice(-6)}`,
          partyName: supplierName,
          inwardQty: qty,
          outwardQty: 0,
          unitRate: rate,
          costPrice: rate,
          totalAmount: Math.round(qty * rate * 100) / 100,
          batchNumber: bill.bill_number,
        });
      }
    }

    // Map Sales Orders
    for (const order of orders) {
      const saleDate = order.sale_date || order.date || order.created_at;
      const d = new Date(saleDate);
      const customerName = order.customer_name || partyMap.get(order.customer_id?.toString()) || "Customer";

      const matchedItems = (order.items || []).filter((it: any) => 
        it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.price) || 0;
        const costPrice = Number(it.cost_price) || 0;
        const splits = Array.isArray(it.batch_splits) && it.batch_splits.length > 0 ? it.batch_splits : null;

        if (splits && splits.length > 0) {
          const fulfilledQty = splits.reduce((acc: number, s: any) => acc + (Number(s.quantity) || 0), 0);
          const unfulfilledQty = Math.max(0, Math.round((qty - fulfilledQty) * 100000) / 100000);

          splits.forEach((split: any, sIdx: number) => {
            const splitQty = Number(split.quantity) || 0;
            const splitCost = Number(split.cost_price) || 0;
            rawMovements.push({
              id: `so-${order._id}-${it.product_id}-split-${sIdx}`,
              date: isNaN(d.getTime()) ? new Date(order.created_at || Date.now()) : d,
              type: "sale",
              refNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
              partyName: customerName,
              inwardQty: 0,
              outwardQty: splitQty,
              unitRate: price,
              costPrice: splitCost,
              totalAmount: Math.round(splitQty * price * 100) / 100,
              batchNumber: split.batch_number || undefined,
              batchSplits: [split],
            });
          });

          if (unfulfilledQty > 0) {
            rawMovements.push({
              id: `so-${order._id}-${it.product_id}-deficit`,
              date: isNaN(d.getTime()) ? new Date(order.created_at || Date.now()) : d,
              type: "sale",
              refNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
              partyName: customerName,
              inwardQty: 0,
              outwardQty: unfulfilledQty,
              unitRate: price,
              costPrice: costPrice,
              totalAmount: Math.round(unfulfilledQty * price * 100) / 100,
              batchNumber: "DEFICIT",
              batchSplits: [],
            });
          }
        } else {
          rawMovements.push({
            id: `so-${order._id}-${it.product_id}`,
            date: isNaN(d.getTime()) ? new Date(order.created_at || Date.now()) : d,
            type: "sale",
            refNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
            partyName: customerName,
            inwardQty: 0,
            outwardQty: qty,
            unitRate: price,
            costPrice: costPrice,
            totalAmount: Math.round(qty * price * 100) / 100,
            batchSplits: it.batch_splits || [],
          });
        }
      }
    }

    // Map Sale Returns
    for (const ret of saleReturns) {
      const retDate = ret.date || ret.return_date || ret.created_at;
      const d = new Date(retDate);
      const customerName = ret.customerName || partyMap.get(ret.customerId?.toString() || ret.customer_id?.toString()) || "Customer";

      const matchedItems = (ret.items || []).filter((it: any) => 
        (it.productId || it.product_id)?.toString() === productId || (it.productId || it.product_id)?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        rawMovements.push({
          id: `sr-${ret._id}-${it.productId || it.product_id}`,
          date: isNaN(d.getTime()) ? new Date(ret.created_at || Date.now()) : d,
          type: "sale_return",
          refNo: ret.returnNumber || ret.return_number || `RET-${ret._id.toString().slice(-6)}`,
          partyName: customerName,
          inwardQty: qty,
          outwardQty: 0,
          unitRate: rate,
          costPrice: Number(it.costPrice || product.cost_price || rate) || 0,
          totalAmount: Math.round(qty * rate * 100) / 100,
        });
      }
    }

    // Map Stock Adjustments
    for (const adj of stockAdjustments) {
      const d = new Date(adj.date || adj.created_at || Date.now());
      const isAdd = adj.action_type === "add";
      const qty = Number(adj.quantity) || 0;
      const rate = Number(adj.cost_price || product.cost_price) || 0;
      const reasonKey = adj.reason || "Adjustment";

      rawMovements.push({
        id: `adj-${adj._id}`,
        date: isNaN(d.getTime()) ? new Date(adj.created_at || Date.now()) : d,
        type: isAdd ? "adjustment_add" : "adjustment_reduce",
        refNo: adj.ref_no || `ADJ-${adj._id.toString().slice(-6)}`,
        partyName: `Adjustment (${reasonKey})`,
        inwardQty: isAdd ? qty : 0,
        outwardQty: !isAdd ? qty : 0,
        unitRate: rate,
        costPrice: rate,
        totalAmount: Math.round(qty * rate * 100) / 100,
      });
    }

    // Sort chronologically ascending from the very beginning to calculate accurate running balance
    rawMovements.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate Running Balance
    let runningBalance = 0;
    const allCalculatedMovements = rawMovements.map(m => {
      if (m.type === "purchase" || m.type === "sale_return" || m.type === "adjustment_add") {
        runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
      } else if (m.type === "sale" || m.type === "adjustment_reduce") {
        runningBalance = Math.round((runningBalance - m.outwardQty) * 1000) / 1000;
      }
      return {
        ...m,
        date: m.date.toISOString(),
        balance: runningBalance,
      };
    });

    // Date range filtering (if requested)
    let filteredMovements = allCalculatedMovements;
    let openingBalanceBeforeFilter = 0;

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : null;
      if (from) from.setHours(0, 0, 0, 0);

      const to = toDate ? new Date(toDate) : null;
      if (to) to.setHours(23, 59, 59, 999);

      if (from) {
        // Calculate opening stock balance prior to fromDate
        const priorMovements = allCalculatedMovements.filter(m => new Date(m.date) < from);
        if (priorMovements.length > 0) {
          openingBalanceBeforeFilter = priorMovements[priorMovements.length - 1].balance;
        }
      }

      filteredMovements = allCalculatedMovements.filter(m => {
        const d = new Date(m.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    // Compute period totals
    let periodInward = 0;
    let periodOutward = 0;
    for (const m of filteredMovements) {
      periodInward += m.inwardQty;
      periodOutward += m.outwardQty;
    }

    // Format batches for client
    const formattedBatches = batches.map(b => ({
      id: b._id.toString(),
      batch_number: b.batch_number || "BATCH",
      source_type: b.source_type || "purchase_bill",
      initial_quantity: Number(b.initial_quantity) || 0,
      remaining_quantity: Number(b.remaining_quantity) || 0,
      cost_price: Number(b.cost_price) || 0,
      status: b.status || "active",
      batch_date: b.batch_date ? new Date(b.batch_date).toISOString() : new Date(b.created_at).toISOString(),
    }));

    await updateUserLastActivity();

    return NextResponse.json({
      product: {
        id: product._id.toString(),
        name: product.name,
        sku: product.sku || "-",
        category: product.category || "General",
        branch: product.branch || "Main",
        uom: product.unit_of_measurement || "pcs",
        currentStock: Number(product.quantity) || 0,
        costPrice: Number(product.cost_price ?? product.purchase_price) || 0,
        sellPrice: Number(product.sell_price) || 0,
        valuationMethod,
      },
      summary: {
        openingStock: openingBalanceBeforeFilter,
        totalInward: Math.round(periodInward * 1000) / 1000,
        totalOutward: Math.round(periodOutward * 1000) / 1000,
        closingStock: filteredMovements.length > 0 
          ? filteredMovements[filteredMovements.length - 1].balance 
          : openingBalanceBeforeFilter,
        valuationMethod,
        activeBatchesCount: formattedBatches.filter(b => b.status === "active" && b.remaining_quantity > 0).length,
      },
      batches: formattedBatches,
      // Reverse to descending order for display (latest first)
      movements: filteredMovements.slice().reverse(),
    });

  } catch (err: any) {
    console.error("Error fetching product stock movement history:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
