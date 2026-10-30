// src/app/[locale]/api/reports/stock/history/route.ts
import { getCollection, COLLECTIONS, toObjectId, isValidObjectId, updateUserLastActivity } from '@/lib/db/mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { requirePermission } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    let user: { id: string } | null = null;
    try {
      user = (await getCurrentUser()) as { id: string };
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await requirePermission("reports.view_stock");
    if (!authCheck.allowed) return authCheck.response!;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const mode = searchParams.get("mode") || "valuation";

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
        product_id: { $in: [prodObjId, productId] },
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
    let initialOpeningCost = openingBatch
      ? Number(openingBatch.cost_price) || 0
      : Number((product as any).initial_cost || (product as any).opening_cost || 0);

    // If opening cost is not directly available, check earliest sales invoice before purchases (which preserved the initial cost)
    if (initialOpeningCost <= 0) {
      const sortedOrders = [...orders].sort((a, b) => new Date(a.date || a.sale_date || a.created_at).getTime() - new Date(b.date || b.sale_date || b.created_at).getTime());
      for (const ord of sortedOrders) {
        const item = (ord.items || []).find((it: any) => it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString());
        if (item && Number(item.cost_price) > 0) {
          initialOpeningCost = Number(item.cost_price);
          break;
        }
      }
    }

    // Last resort fallback
    if (initialOpeningCost <= 0) {
      initialOpeningCost = Number((product as any).purchase_price || product.cost_price || 0);
    }
    // Find the earliest transaction or product created_at date (never default to 1970)
    const allTxDates: number[] = [];
    if (product.created_at) allTxDates.push(new Date(product.created_at).getTime());
    if (openingBatch?.batch_date) allTxDates.push(new Date(openingBatch.batch_date).getTime());
    if (openingBatch?.created_at) allTxDates.push(new Date(openingBatch.created_at).getTime());
    for (const b of purchaseBills) allTxDates.push(new Date(b.bill_date || b.created_at).getTime());
    for (const o of orders) allTxDates.push(new Date(o.sale_date || o.created_at).getTime());
    for (const a of stockAdjustments) allTxDates.push(new Date(a.date || a.created_at).getTime());
    const validTxDates = allTxDates.filter(t => !isNaN(t) && t > 0);
    const earliestTx = validTxDates.length > 0 ? Math.min(...validTxDates) : Date.now();

    const openingDate = fromDate ? new Date(fromDate) : new Date(earliestTx);

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

    rawMovements.push({
      id: `opening-${product._id}`,
      date: openingDate,
      type: "opening_stock",
      refNo: "OPENING",
      partyName: "Opening Stock",
      inwardQty: initialOpeningQty > 0 ? initialOpeningQty : 0,
      outwardQty: 0,
      unitRate: initialOpeningCost,
      costPrice: initialOpeningCost,
      totalAmount: Math.round(initialOpeningQty * initialOpeningCost * 100) / 100,
      batchNumber: "OPENING",
    });

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
      const splits = Array.isArray(adj.batch_splits) && adj.batch_splits.length > 0 ? adj.batch_splits : null;

      if (!isAdd && valuationMethod === "fifo" && splits && splits.length > 0) {
        splits.forEach((split: any, sIdx: number) => {
          const splitQty = Number(split.quantity) || 0;
          const splitCost = Number(split.cost_price) || 0;
          rawMovements.push({
            id: `adj-${adj._id}-split-${sIdx}`,
            date: d,
            type: "adjustment_reduce",
            refNo: adj.ref_no || `ADJ-${adj._id.toString().slice(-6)}`,
            partyName: `Adjustment (${reasonKey})`,
            inwardQty: 0,
            outwardQty: splitQty,
            unitRate: splitCost,
            costPrice: splitCost,
            totalAmount: Math.round(splitQty * splitCost * 100) / 100,
            batchNumber: split.batch_number || undefined,
            batchSplits: [split],
          });
        });
      } else {
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
          batchSplits: splits || [],
        });
      }
    }

    let reorderedMovements: RawMovement[] = [];

    if (mode === "valuation" && valuationMethod !== "fifo") {
      // WAC Valuation Sequence (Interleaved):
      // 1. Opening stock is ALWAYS row 1 at the very top.
      // 2. Inwards that occurred naturally prior to a sale are emitted first.
      // 3. For any sale where current stock is not enough (deficit), pull subsequent inwards
      //    until the sale's stock is covered.
      // 4. Then emit the sale immediately so it reflects the available stock & calculated WAC!
      // 5. Subsequent sales only run after their deficit has been covered by subsequent inwards.
      const buildInterleavedValuationSequence = (items: RawMovement[]): RawMovement[] => {
        const opening = items.find(m => m.type === "opening_stock");
        const otherMoves = items.filter(m => m.type !== "opening_stock");

        const inwardQueue = otherMoves
          .filter(m => (m.inwardQty || 0) > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const outwardQueue = otherMoves
          .filter(m => (m.outwardQty || 0) > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const result: RawMovement[] = [];
        let runningStock = 0;

        if (opening) {
          result.push(opening);
          runningStock += (opening.inwardQty || 0);
        }

        while (outwardQueue.length > 0) {
          const nextSale = outwardQueue[0];

          // 1. Emit inwards that occurred at or before this sale's timestamp
          while (inwardQueue.length > 0 && new Date(inwardQueue[0].date).getTime() <= new Date(nextSale.date).getTime()) {
            const naturalInward = inwardQueue.shift()!;
            result.push(naturalInward);
            runningStock += (naturalInward.inwardQty || 0);
          }

          // 2. If running stock is not enough for this sale, pull subsequent inwards until fulfilled
          while (runningStock < nextSale.outwardQty && inwardQueue.length > 0) {
            const deficitInward = inwardQueue.shift()!;
            result.push(deficitInward);
            runningStock += (deficitInward.inwardQty || 0);
          }

          // 3. Now emit the sale
          outwardQueue.shift();
          result.push(nextSale);
          runningStock -= nextSale.outwardQty;
        }

        // 4. Any remaining inwards at the end of the period
        while (inwardQueue.length > 0) {
          const remainingInward = inwardQueue.shift()!;
          result.push(remainingInward);
          runningStock += (remainingInward.inwardQty || 0);
        }

        return result;
      };

      reorderedMovements = buildInterleavedValuationSequence(rawMovements);
    } else {
      // Natural Chronological Sequence for Stock Movement Report (shows true physical minus balance when oversold):
      const opening = rawMovements.find(m => m.type === "opening_stock");
      const otherMoves = rawMovements.filter(m => m.type !== "opening_stock");

      const TYPE_PRIORITY: Record<string, number> = {
        purchase: 1,
        adjustment_add: 2,
        sale_return: 3,
        sale: 4,
        adjustment_reduce: 5,
      };

      otherMoves.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99);
      });

      reorderedMovements = opening ? [opening, ...otherMoves] : otherMoves;
    }

    // Calculate Running Balance, Rates, and Running Valuation
    const { calculateMovingAverage, calculateMovingAverageWithPrior, roundToPrecision } = await import("@/lib/inventory/valuation-calc");

    let allCalculatedMovements: any[] = [];

    if (valuationMethod === "fifo") {
      let runningBalance = 0;
      let runningValuation = 0;
      let lastKnownCost = initialOpeningCost > 0 ? initialOpeningCost : (Number(product.cost_price ?? product.purchase_price) || 0);

      allCalculatedMovements = reorderedMovements.map(m => {
        let effectiveRate = lastKnownCost;
        let cogs = 0;
        let impactFormula = "";

        if (m.type === "opening_stock") {
          runningBalance = roundToPrecision(runningBalance + m.inwardQty, 3);
          effectiveRate = m.unitRate > 0 ? m.unitRate : lastKnownCost;
          lastKnownCost = effectiveRate;
          runningValuation = roundToPrecision(runningBalance * effectiveRate, 2);
          impactFormula = m.inwardQty > 0 
            ? `Opening Batch: ${m.inwardQty} units @ ${effectiveRate}` 
            : `Opening balance @ 0`;
        } else if (m.type === "purchase") {
          runningBalance = roundToPrecision(runningBalance + m.inwardQty, 3);
          effectiveRate = m.unitRate > 0 ? m.unitRate : lastKnownCost;
          lastKnownCost = effectiveRate;
          runningValuation = roundToPrecision(runningValuation + (m.inwardQty * effectiveRate), 2);
          impactFormula = `FIFO Inward: ${m.inwardQty} units @ ${effectiveRate} (Batch: ${m.batchNumber || m.refNo})`;
        } else if (m.type === "adjustment_add") {
          runningBalance = roundToPrecision(runningBalance + m.inwardQty, 3);
          effectiveRate = m.costPrice > 0 ? m.costPrice : lastKnownCost;
          lastKnownCost = effectiveRate;
          runningValuation = roundToPrecision(runningValuation + (m.inwardQty * effectiveRate), 2);
          impactFormula = `Adj (+): Added ${m.inwardQty} units @ ${effectiveRate}`;
        } else if (m.type === "sale_return") {
          runningBalance = roundToPrecision(runningBalance + m.inwardQty, 3);
          effectiveRate = m.costPrice > 0 ? m.costPrice : lastKnownCost;
          runningValuation = roundToPrecision(runningValuation + (m.inwardQty * effectiveRate), 2);
          impactFormula = `Sale Return (${m.inwardQty} units) returned to inventory @ ${effectiveRate}`;
        } else if (m.type === "sale") {
          runningBalance = roundToPrecision(runningBalance - m.outwardQty, 3);
          effectiveRate = m.costPrice > 0 ? m.costPrice : lastKnownCost;
          cogs = roundToPrecision(m.outwardQty * effectiveRate, 2);
          runningValuation = runningBalance > 0
            ? Math.max(0, roundToPrecision(runningValuation - cogs, 2))
            : roundToPrecision(runningBalance * effectiveRate, 2);
          impactFormula = m.batchNumber
            ? `FIFO Depleted from Batch ${m.batchNumber}: ${m.outwardQty} units @ ${effectiveRate} (COGS: ${cogs})`
            : `Sale Outward: ${m.outwardQty} units @ FIFO COGS ${effectiveRate} (Total: ${cogs})`;
        } else if (m.type === "adjustment_reduce") {
          runningBalance = roundToPrecision(runningBalance - m.outwardQty, 3);
          effectiveRate = m.costPrice > 0 ? m.costPrice : lastKnownCost;
          cogs = roundToPrecision(m.outwardQty * effectiveRate, 2);
          runningValuation = runningBalance > 0
            ? Math.max(0, roundToPrecision(runningValuation - cogs, 2))
            : roundToPrecision(runningBalance * effectiveRate, 2);
          impactFormula = `Adj (-): Reduced ${m.outwardQty} units @ ${effectiveRate} (COGS: ${cogs})`;
        }

        return {
          ...m,
          date: m.date.toISOString(),
          costPrice: effectiveRate,
          cogs,
          balance: runningBalance,
          effectiveWac: effectiveRate,
          runningValuation,
          wacFormula: impactFormula,
        };
      });
    } else {
      let runningBalance = 0;
      let runningWac = initialOpeningCost > 0 ? initialOpeningCost : (Number(product.cost_price ?? product.purchase_price) || 0);
      let priorFulfilledBudget = 0;

      allCalculatedMovements = reorderedMovements.map(m => {
        const prevBal = runningBalance;
        const prevWac = runningWac;
        let effectiveWac = runningWac;
        let wacFormula = "";

        if (m.type === "opening_stock") {
          runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
          effectiveWac = m.unitRate > 0 ? m.unitRate : runningWac;
          runningWac = effectiveWac;
          wacFormula = m.inwardQty > 0 ? `Opening stock (${m.inwardQty}) @ ${effectiveWac}` : `Opening balance @ 0`;
        } else if (m.type === "purchase") {
          const inQty = m.inwardQty;
          const inRate = m.unitRate;
          if (prevBal < 0 && prevWac > 0) {
            effectiveWac = calculateMovingAverageWithPrior(prevBal, prevWac, inQty, inRate, priorFulfilledBudget);
            wacFormula = `Reconciled Deficit (${prevBal}) + Inward (${inQty} @ ${inRate}) -> WAC: ${effectiveWac}`;
          } else {
            effectiveWac = calculateMovingAverage(prevBal, prevWac, inQty, inRate);
            wacFormula = prevBal > 0 
              ? `(${prevBal} @ ${prevWac} + ${inQty} @ ${inRate}) / ${roundToPrecision(prevBal + inQty, 3)} = ${effectiveWac}`
              : `New inward @ ${inRate}`;
          }
          runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
          runningWac = effectiveWac;
        } else if (m.type === "adjustment_add") {
          const inQty = m.inwardQty;
          const inRate = m.costPrice > 0 ? m.costPrice : prevWac;
          if (inRate > 0 && inRate !== prevWac) {
            effectiveWac = prevBal < 0
              ? calculateMovingAverageWithPrior(prevBal, prevWac, inQty, inRate, priorFulfilledBudget)
              : calculateMovingAverage(prevBal, prevWac, inQty, inRate);
            wacFormula = `Adj (+): (${prevBal} @ ${prevWac} + ${inQty} @ ${inRate}) -> WAC: ${effectiveWac}`;
            runningWac = effectiveWac;
          } else {
            effectiveWac = runningWac;
            wacFormula = `Adj (+): ${inQty} units (WAC maintained @ ${runningWac})`;
          }
          runningBalance = Math.round((runningBalance + inQty) * 1000) / 1000;
        } else if (m.type === "sale_return") {
          runningBalance = Math.round((runningBalance + m.inwardQty) * 1000) / 1000;
          effectiveWac = runningWac;
          wacFormula = `Sale Return (${m.inwardQty}) returned to inventory (WAC: ${runningWac})`;
        } else if (m.type === "sale") {
          const outQty = m.outwardQty;
          effectiveWac = runningWac;
          if (prevBal > 0) {
            priorFulfilledBudget += Math.min(prevBal, outQty);
          }
          runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
          wacFormula = `Sale Outward: ${outQty} units @ COGS ${runningWac} (WAC maintained)`;
        } else if (m.type === "adjustment_reduce") {
          const outQty = m.outwardQty;
          effectiveWac = runningWac;
          runningBalance = Math.round((runningBalance - outQty) * 1000) / 1000;
          wacFormula = `Adj (-): ${outQty} units reduced (WAC maintained @ ${runningWac})`;
        }

        // Zoho Books rule: Asset value = runningBalance * effectiveWac (negative when stock is negative)
        const runningValuation = roundToPrecision(runningBalance * effectiveWac, 2);

        // Cost price & outward COGS
        const finalCostPrice = (m.type === "sale" || m.type === "adjustment_reduce")
          ? effectiveWac
          : (m.costPrice || m.unitRate || effectiveWac);

        const outwardCogs = (m.type === "sale" || m.type === "adjustment_reduce")
          ? roundToPrecision(m.outwardQty * effectiveWac, 2)
          : 0;

        return {
          ...m,
          date: m.date.toISOString(),
          costPrice: finalCostPrice,
          cogs: outwardCogs,
          balance: runningBalance,
          effectiveWac,
          runningValuation,
          wacFormula,
        };
      });
    }

    // Date range filtering (if requested)
    let filteredMovements = allCalculatedMovements;
    let openingBalanceBeforeFilter = initialOpeningQty;

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : null;
      if (from) from.setHours(0, 0, 0, 0);

      const to = toDate ? new Date(toDate) : null;
      if (to) to.setHours(23, 59, 59, 999);

      let openingCostForPeriod = initialOpeningCost;

      if (from) {
        // Calculate opening stock balance and effective rate prior to fromDate
        const priorMovements = allCalculatedMovements.filter(m => m.type !== "opening_stock" && new Date(m.date) < from);
        if (priorMovements.length > 0) {
          const lastPrior = priorMovements[priorMovements.length - 1];
          openingBalanceBeforeFilter = lastPrior.balance;
          openingCostForPeriod = Number(lastPrior.effectiveWac ?? initialOpeningCost) || initialOpeningCost;
        } else {
          openingBalanceBeforeFilter = initialOpeningQty;
          openingCostForPeriod = initialOpeningCost;
        }
      }

      filteredMovements = allCalculatedMovements.filter(m => {
        if (m.type === "opening_stock") return false; // Handled explicitly below
        const d = new Date(m.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });

      // ALWAYS ensure an Opening Stock row is at the start of the period movements with the start date!
      const startPeriodDate = from ? from.toISOString() : (openingDate ? openingDate.toISOString() : new Date().toISOString());
      const openingValuationForPeriod = roundToPrecision(openingBalanceBeforeFilter * openingCostForPeriod, 2);

      filteredMovements.unshift({
        id: `opening-period-${startPeriodDate}`,
        date: startPeriodDate,
        type: "opening_stock",
        refNo: "OPENING",
        partyName: "Opening Stock",
        inwardQty: openingBalanceBeforeFilter > 0 ? openingBalanceBeforeFilter : 0,
        outwardQty: openingBalanceBeforeFilter < 0 ? Math.abs(openingBalanceBeforeFilter) : 0,
        unitRate: openingCostForPeriod,
        costPrice: openingCostForPeriod,
        cogs: 0,
        totalAmount: Math.abs(openingValuationForPeriod),
        balance: openingBalanceBeforeFilter,
        effectiveWac: openingCostForPeriod,
        runningValuation: openingValuationForPeriod,
        wacFormula: openingBalanceBeforeFilter !== 0 ? `Opening balance B/F @ ${openingCostForPeriod}` : `Opening balance @ 0`,
      });
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

    // Sort batches: Opening Stock is ALWAYS first, then subsequent batches ordered by start date (ascending / oldest first)
    formattedBatches.sort((a, b) => {
      const isOpeningA = a.source_type === "opening_stock" || a.batch_number === "OPENING";
      const isOpeningB = b.source_type === "opening_stock" || b.batch_number === "OPENING";
      if (isOpeningA && !isOpeningB) return -1;
      if (!isOpeningA && isOpeningB) return 1;
      const da = new Date(a.batch_date || 0).getTime();
      const db = new Date(b.batch_date || 0).getTime();
      return da - db;
    });

    await updateUserLastActivity();

    const curCost = Number(product.cost_price ?? product.purchase_price) || 0;
    const curStock = Number(product.quantity) || 0;

    const trueClosingWac = allCalculatedMovements.length > 0
      ? allCalculatedMovements[allCalculatedMovements.length - 1].effectiveWac
      : curCost;

    if (valuationMethod !== "fifo" && trueClosingWac > 0 && Math.abs(curCost - trueClosingWac) > 0.001) {
      productsCollection.updateOne(
        { _id: prodObjId, user_id: userId },
        {
          $set: {
            cost_price: trueClosingWac,
            cost_price_str: trueClosingWac.toString(),
            purchase_price: trueClosingWac,
            updated_at: new Date(),
          }
        }
      ).catch(e => console.error("Failed to sync closing WAC to products collection:", e));
    }

    const effectiveCost = trueClosingWac > 0 ? trueClosingWac : curCost;
    const totalInventoryValuation = allCalculatedMovements.length > 0
      ? allCalculatedMovements[allCalculatedMovements.length - 1].runningValuation
      : (curStock > 0 ? Math.round(curStock * effectiveCost * 100) / 100 : 0);

    return NextResponse.json({
      product: {
        id: product._id.toString(),
        name: product.name,
        sku: product.sku || "-",
        category: product.category || "General",
        branch: product.branch || "Main",
        uom: product.unit_of_measurement || "pcs",
        currentStock: curStock,
        costPrice: effectiveCost,
        totalValuation: totalInventoryValuation,
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
        closingWac: filteredMovements.length > 0
          ? filteredMovements[filteredMovements.length - 1].effectiveWac
          : curCost,
        closingValuation: filteredMovements.length > 0
          ? filteredMovements[filteredMovements.length - 1].runningValuation
          : totalInventoryValuation,
        valuationMethod,
        activeBatchesCount: formattedBatches.filter(b => b.status === "active" && b.remaining_quantity > 0).length,
      },
      batches: formattedBatches,
      // Chronological order (Start date / Opening Stock at the top)
      movements: filteredMovements,
    });

  } catch (err: any) {
    console.error("Error fetching product stock movement history:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
