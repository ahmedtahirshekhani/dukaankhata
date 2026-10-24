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

    // Helper to get exact timestamp combining date and time down to seconds
    const getExactTimestamp = (dateVal: any, createdAtVal: any): Date => {
      if (!dateVal && !createdAtVal) return new Date();
      const base = dateVal ? new Date(dateVal) : new Date(createdAtVal);
      if (isNaN(base.getTime())) return createdAtVal ? new Date(createdAtVal) : new Date();

      // If base date has no time (hours=0, min=0, sec=0) but createdAt has exact time, merge time
      if (base.getHours() === 0 && base.getMinutes() === 0 && base.getSeconds() === 0 && createdAtVal) {
        const created = new Date(createdAtVal);
        if (!isNaN(created.getTime())) {
          base.setHours(created.getHours(), created.getMinutes(), created.getSeconds(), created.getMilliseconds());
        }
      }
      return base;
    };

    // 6. Build raw chronological movement events
    interface RawMovement {
      id: string;
      date: Date;
      type: "opening_stock" | "purchase" | "sale" | "sale_return" | "adjustment_add" | "adjustment_reduce";
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

    // Map Opening Stock if exists
    const openingBatch = batches.find(
      (b: any) => b.source_type === "opening_stock" || b.batch_number === "OPENING"
    );
    let initialOpeningQty = openingBatch
      ? Number(openingBatch.initial_quantity) || 0
      : Number((product as any).opening_stock || (product as any).initial_quantity || 0);
    const initialOpeningCost = openingBatch
      ? Number(openingBatch.cost_price) || 0
      : Number(product.cost_price || product.purchase_price || 0);
    const openingDate = openingBatch?.batch_date || openingBatch?.created_at || product.created_at || new Date(0);

    // Fallback: If no opening batch was recorded, check if initial stock existed at creation
    if (initialOpeningQty <= 0) {
      const totalPurchased = purchaseBills.reduce((acc, b) => {
        const matched = (b.items || []).filter((it: any) => it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString());
        return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
      }, 0);
      const totalSold = orders.reduce((acc, o) => {
        const matched = (o.items || []).filter((it: any) => it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString());
        return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
      }, 0);
      const totalAdjustAdd = stockAdjustments.filter((a: any) => a.action_type === "add").reduce((acc: number, a: any) => acc + (Number(a.quantity) || 0), 0);
      const totalAdjustReduce = stockAdjustments.filter((a: any) => a.action_type !== "add").reduce((acc: number, a: any) => acc + (Number(a.quantity) || 0), 0);
      const totalReturned = saleReturns.reduce((acc, r) => {
        const matched = (r.items || []).filter((it: any) => (it.productId || it.product_id)?.toString() === productId || (it.productId || it.product_id)?.toString() === prodObjId.toString());
        return acc + matched.reduce((mAcc: number, it: any) => mAcc + (Number(it.quantity) || 0), 0);
      }, 0);
      const curStockNum = Number(product.quantity || product.in_stock || 0);
      const impliedOpening = Math.round((curStockNum - (totalPurchased + totalAdjustAdd + totalReturned - totalSold - totalAdjustReduce)) * 1000) / 1000;
      if (impliedOpening > 0) {
        initialOpeningQty = impliedOpening;
      }
    }

    if (initialOpeningQty > 0) {
      rawMovements.push({
        id: `opening-${product._id}`,
        date: new Date(openingDate),
        type: "opening_stock",
        refNo: "OPENING",
        partyName: "Opening Stock",
        inwardQty: initialOpeningQty,
        outwardQty: 0,
        unitRate: initialOpeningCost,
        costPrice: initialOpeningCost,
        totalAmount: Math.round(initialOpeningQty * initialOpeningCost * 100) / 100,
        batchNumber: "OPENING",
      });
    }

    // Map Purchase Bills
    for (const bill of purchaseBills) {
      const d = getExactTimestamp(bill.bill_date || bill.date, bill.created_at);
      const supplierName = bill.party_name || partyMap.get(bill.party_id?.toString()) || "Supplier";
      
      const matchedItems = (bill.items || []).filter((it: any) => 
        it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.cost_price ?? it.unit_price) || 0;
        rawMovements.push({
          id: `pb-${bill._id}-${it.product_id}`,
          date: d,
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
      const d = getExactTimestamp(order.sale_date || order.date, order.created_at);
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
              date: d,
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
              date: d,
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
            date: d,
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
      const d = getExactTimestamp(ret.return_date || ret.date, ret.created_at);
      const customerName = ret.customerName || partyMap.get(ret.customerId?.toString() || ret.customer_id?.toString()) || "Customer";

      const matchedItems = (ret.items || []).filter((it: any) => 
        (it.productId || it.product_id)?.toString() === productId || (it.productId || it.product_id)?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        rawMovements.push({
          id: `sr-${ret._id}-${it.productId || it.product_id}`,
          date: d,
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
      const d = getExactTimestamp(adj.date || adj.adjustment_date, adj.created_at);
      const isAdd = adj.action_type === "add";
      const qty = Number(adj.quantity) || 0;
      const rate = Number(adj.cost_price || product.cost_price) || 0;
      const reasonKey = adj.reason || "Adjustment";

      rawMovements.push({
        id: `adj-${adj._id}`,
        date: d,
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

    // Sort chronologically ascending by exact Date, Time, and Seconds (with priority for simultaneous events)
    rawMovements.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      const priority: Record<string, number> = {
        opening_stock: 1,
        purchase: 2,
        adjustment_add: 3,
        sale_return: 4,
        sale: 5,
        adjustment_reduce: 6,
      };
      return (priority[a.type] || 5) - (priority[b.type] || 5);
    });

    // Calculate Running Balance
    let runningBalance = 0;
    const allCalculatedMovements = rawMovements.map(m => {
      if (m.type === "opening_stock" || m.type === "purchase" || m.type === "sale_return" || m.type === "adjustment_add") {
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
    let openingBalanceBeforeFilter = initialOpeningQty;

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
        } else {
          openingBalanceBeforeFilter = initialOpeningQty;
        }
      }

      filteredMovements = allCalculatedMovements.filter(m => {
        const d = new Date(m.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });

      // If filtered by fromDate and openingBalanceBeforeFilter is non-zero,
      // ensure an Opening Balance B/F row is at the start of the period movements
      if (from && !filteredMovements.some(m => m.type === "opening_stock")) {
        filteredMovements.unshift({
          id: `opening-filter-${from.toISOString()}`,
          date: from.toISOString(),
          type: "opening_stock",
          refNo: "OPENING",
          partyName: "Opening Balance B/F",
          inwardQty: openingBalanceBeforeFilter > 0 ? openingBalanceBeforeFilter : 0,
          outwardQty: openingBalanceBeforeFilter < 0 ? Math.abs(openingBalanceBeforeFilter) : 0,
          unitRate: Number(product.cost_price ?? product.purchase_price) || 0,
          costPrice: Number(product.cost_price ?? product.purchase_price) || 0,
          totalAmount: Math.round(Math.abs(openingBalanceBeforeFilter) * (Number(product.cost_price ?? product.purchase_price) || 0) * 100) / 100,
          balance: openingBalanceBeforeFilter,
        });
      }
    }

    // Compute period totals
    let periodInward = 0;
    let periodOutward = 0;
    for (const m of filteredMovements) {
      if (m.type !== "opening_stock") {
        periodInward += m.inwardQty;
        periodOutward += m.outwardQty;
      }
    }

    // Format batches for client (includes Purchase Bills, Stock Adjustments, and Opening Stock)
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

    // Add Stock Adjustments (adds) into Tracked Batches if not already represented
    const existingBatchSources = new Set(batches.map(b => b.source_id?.toString() || b.batch_number));
    for (const adj of stockAdjustments) {
      if (adj.action_type === "add") {
        const adjIdStr = adj._id.toString();
        const adjRef = adj.ref_no || `ADJ-${adjIdStr.slice(-6)}`;
        if (!existingBatchSources.has(adjIdStr) && !existingBatchSources.has(adjRef)) {
          formattedBatches.push({
            id: `adj-batch-${adjIdStr}`,
            batch_number: adjRef,
            source_type: "stock_adjustment",
            initial_quantity: Number(adj.quantity) || 0,
            remaining_quantity: Number(adj.quantity) || 0,
            cost_price: Number(adj.cost_price || product.cost_price) || 0,
            status: "active",
            batch_date: adj.date ? new Date(adj.date).toISOString() : new Date(adj.created_at || Date.now()).toISOString(),
          });
        }
      }
    }

    // Add Opening Stock batch into Tracked Batches if not present
    if (initialOpeningQty > 0 && !formattedBatches.some(b => b.batch_number === "OPENING" || b.source_type === "opening_stock")) {
      formattedBatches.push({
        id: `opening-batch-${product._id}`,
        batch_number: "OPENING",
        source_type: "opening_stock",
        initial_quantity: initialOpeningQty,
        remaining_quantity: initialOpeningQty,
        cost_price: initialOpeningCost,
        status: "active",
        batch_date: new Date(openingDate).toISOString(),
      });
    }

    // Sort batches by batch_date descending (latest first)
    formattedBatches.sort((a, b) => new Date(b.batch_date).getTime() - new Date(a.batch_date).getTime());

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
