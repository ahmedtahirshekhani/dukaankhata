// src/app/[locale]/api/reports/item-wise-sales/details/route.ts
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

    const authCheck = await requirePermission("reports.view_item_wise_sales");
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

    // 1. Fetch Product Master details
    const productsCollection = await getCollection(COLLECTIONS.PRODUCTS);
    const product = await productsCollection.findOne({
      _id: prodObjId,
      user_id: userId,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const ordersCollection = await getCollection(COLLECTIONS.ORDERS);
    const saleReturnsCollection = await getCollection(COLLECTIONS.SALE_RETURN_TRANSACTIONS);
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);

    // 2. Build Date Filters
    const orderMatch: any = {
      user_id: userId,
      status: { $ne: "cancelled" },
      "items.product_id": { $in: [prodObjId, productId] },
    };

    const returnMatch: any = {
      user_id: userId,
      $or: [
        { "items.productId": productId },
        { "items.product_id": productId },
        { "items.productId": prodObjId },
        { "items.product_id": prodObjId },
      ],
    };

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : null;
      if (from) from.setHours(0, 0, 0, 0);

      const to = toDate ? new Date(toDate) : null;
      if (to) to.setHours(23, 59, 59, 999);

      const dateConditions: any[] = [];
      if (from && to) {
        dateConditions.push(
          { sale_date: { $gte: from.toISOString(), $lte: to.toISOString() } },
          { created_at: { $gte: from, $lte: to } }
        );
      } else if (from) {
        dateConditions.push(
          { sale_date: { $gte: from.toISOString() } },
          { created_at: { $gte: from } }
        );
      } else if (to) {
        dateConditions.push(
          { sale_date: { $lte: to.toISOString() } },
          { created_at: { $lte: to } }
        );
      }

      if (dateConditions.length > 0) {
        orderMatch.$or = dateConditions;
      }

      const returnDateConditions: any[] = [];
      if (from && to) {
        returnDateConditions.push(
          { date: { $gte: from, $lte: to } },
          { date: { $gte: from.toISOString(), $lte: to.toISOString() } },
          { created_at: { $gte: from, $lte: to } }
        );
      } else if (from) {
        returnDateConditions.push(
          { date: { $gte: from } },
          { created_at: { $gte: from } }
        );
      } else if (to) {
        returnDateConditions.push(
          { date: { $lte: to } },
          { created_at: { $lte: to } }
        );
      }

      if (returnDateConditions.length > 0) {
        returnMatch.$and = [{ $or: returnDateConditions }];
      }
    }

    // 3. Fetch orders & customer details
    const [matchingOrders, matchingReturns, allCustomers] = await Promise.all([
      ordersCollection.find(orderMatch).sort({ sale_date: -1, created_at: -1 }).toArray(),
      saleReturnsCollection.find(returnMatch).sort({ date: -1, created_at: -1 }).toArray(),
      customersCollection.find({ user_id: userId }, { projection: { _id: 1, name: 1, phone: 1, company_name: 1 } }).toArray(),
    ]);

    const customerMap = new Map<string, { name: string; phone: string }>();
    for (const c of allCustomers) {
      customerMap.set(c._id.toString(), {
        name: c.name || c.company_name || "Customer",
        phone: c.phone || "",
      });
    }

    // 4. Map individual item sales lines
    const salesList: Array<{
      orderId: string;
      invoiceNo: string;
      date: string;
      customerId: string;
      customerName: string;
      customerPhone: string;
      quantity: number;
      price: number;
      discount: number;
      discountType: string;
      lineGross: number;
      lineDiscount: number;
      lineRevenue: number;
      unitCost: number;
      totalCogs: number;
      profit: number;
      profitMargin: number;
      batchSplits: any[];
      batchNumber?: string;
      isBatchSplit?: boolean;
      batchIndex?: number;
      totalBatches?: number;
    }> = [];

    let totalGrossRevenue = 0;
    let totalDiscountAmount = 0;
    let totalNetRevenue = 0;
    let totalCogsSum = 0;
    let totalQuantitySold = 0;

    for (const order of matchingOrders) {
      const orderDate = order.sale_date || order.date || order.created_at;
      const cInfo = customerMap.get(order.customer_id?.toString()) || {
        name: order.customer_name || "Customer",
        phone: "",
      };

      const matchedItems = (order.items || []).filter((it: any) => 
        it.product_id?.toString() === productId || it.product_id?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.price) || 0;
        const discount = Number(it.discount) || 0;
        const discountType = it.discountType || "value";

        const lineGross = Math.round(qty * price * 100) / 100;
        let lineDiscount = 0;
        if (discountType === "percentage") {
          lineDiscount = Math.round(((lineGross * discount) / 100) * 100) / 100;
        } else {
          lineDiscount = discount;
        }
        const lineRevenue = Math.max(0, Math.round((lineGross - lineDiscount) * 100) / 100);

        const unitCost = Number(it.cost_price ?? it.purchase_price ?? product.cost_price) || 0;
        const lineCogs = typeof it.total_cogs === "number" 
          ? it.total_cogs 
          : Math.round(qty * unitCost * 100) / 100;

        totalQuantitySold += qty;
        totalGrossRevenue += lineGross;
        totalDiscountAmount += lineDiscount;
        totalNetRevenue += lineRevenue;
        totalCogsSum += lineCogs;

        const splits = Array.isArray(it.batch_splits) && it.batch_splits.length > 0 ? it.batch_splits : null;

        if (splits && splits.length > 0) {
          const fulfilledQty = splits.reduce((acc: number, s: any) => acc + (Number(s.quantity) || 0), 0);
          const unfulfilledQty = Math.max(0, Math.round((qty - fulfilledQty) * 100000) / 100000);
          const totalRowsCount = splits.length + (unfulfilledQty > 0 ? 1 : 0);

          // Vyapar FIFO style: separate entry for each batch consumed
          splits.forEach((split: any, sIdx: number) => {
            const splitQty = Number(split.quantity) || 0;
            const splitCost = Number(split.cost_price) || 0;
            const splitCogs = typeof split.total_cost === "number"
              ? split.total_cost
              : Math.round(splitQty * splitCost * 100) / 100;

            const ratio = qty > 0 ? (splitQty / qty) : (1 / totalRowsCount);
            const splitGross = Math.round(splitQty * price * 100) / 100;
            const splitDiscount = Math.round(lineDiscount * ratio * 100) / 100;
            const splitRevenue = Math.max(0, Math.round((splitGross - splitDiscount) * 100) / 100);
            const splitProfit = Math.round((splitRevenue - splitCogs) * 100) / 100;
            const splitMargin = splitRevenue > 0 ? Math.round(((splitProfit / splitRevenue) * 100) * 10) / 10 : 0;

            salesList.push({
              orderId: order._id.toString(),
              invoiceNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
              date: new Date(orderDate).toISOString(),
              customerId: order.customer_id?.toString() || "",
              customerName: cInfo.name,
              customerPhone: cInfo.phone,
              quantity: splitQty,
              price,
              discount: splitDiscount,
              discountType,
              lineGross: splitGross,
              lineDiscount: splitDiscount,
              lineRevenue: splitRevenue,
              unitCost: Math.round(splitCost * 100) / 100,
              totalCogs: splitCogs,
              profit: splitProfit,
              profitMargin: splitMargin,
              batchNumber: split.batch_number || "BATCH",
              batchSplits: [split],
              isBatchSplit: totalRowsCount > 1,
              batchIndex: sIdx + 1,
              totalBatches: totalRowsCount,
            });
          });

          if (unfulfilledQty > 0) {
            const fallbackUnitCost = Number(it.cost_price ?? product.cost_price) || 0;
            const unfulfilledCogs = Math.round(unfulfilledQty * fallbackUnitCost * 100) / 100;
            const ratio = qty > 0 ? (unfulfilledQty / qty) : 0;
            const splitGross = Math.round(unfulfilledQty * price * 100) / 100;
            const splitDiscount = Math.round(lineDiscount * ratio * 100) / 100;
            const splitRevenue = Math.max(0, Math.round((splitGross - splitDiscount) * 100) / 100);
            const splitProfit = Math.round((splitRevenue - unfulfilledCogs) * 100) / 100;
            const splitMargin = splitRevenue > 0 ? Math.round(((splitProfit / splitRevenue) * 100) * 10) / 10 : 0;

            salesList.push({
              orderId: order._id.toString(),
              invoiceNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
              date: new Date(orderDate).toISOString(),
              customerId: order.customer_id?.toString() || "",
              customerName: cInfo.name,
              customerPhone: cInfo.phone,
              quantity: unfulfilledQty,
              price,
              discount: splitDiscount,
              discountType,
              lineGross: splitGross,
              lineDiscount: splitDiscount,
              lineRevenue: splitRevenue,
              unitCost: Math.round(fallbackUnitCost * 100) / 100,
              totalCogs: unfulfilledCogs,
              profit: splitProfit,
              profitMargin: splitMargin,
              batchNumber: "DEFICIT",
              batchSplits: [],
              isBatchSplit: totalRowsCount > 1,
              batchIndex: totalRowsCount,
              totalBatches: totalRowsCount,
            });
          }
        } else {
          const profit = Math.round((lineRevenue - lineCogs) * 100) / 100;
          const margin = lineRevenue > 0 ? Math.round(((profit / lineRevenue) * 100) * 10) / 10 : 0;

          salesList.push({
            orderId: order._id.toString(),
            invoiceNo: order.invoice_no || `INV-${order._id.toString().slice(-6)}`,
            date: new Date(orderDate).toISOString(),
            customerId: order.customer_id?.toString() || "",
            customerName: cInfo.name,
            customerPhone: cInfo.phone,
            quantity: qty,
            price,
            discount,
            discountType,
            lineGross,
            lineDiscount,
            lineRevenue,
            unitCost: Math.round(unitCost * 100) / 100,
            totalCogs: lineCogs,
            profit,
            profitMargin: margin,
            batchSplits: [],
            isBatchSplit: false,
          });
        }
      }
    }

    // 5. Map returns
    const returnsList: Array<{
      returnId: string;
      returnNumber: string;
      date: string;
      customerName: string;
      quantity: number;
      rate: number;
      amount: number;
    }> = [];

    let totalReturnedQty = 0;
    let totalReturnedAmount = 0;

    for (const ret of matchingReturns) {
      const retDate = ret.date || ret.return_date || ret.created_at;
      const cInfo = customerMap.get(ret.customerId?.toString() || ret.customer_id?.toString()) || {
        name: ret.customerName || "Customer",
        phone: "",
      };

      const matchedItems = (ret.items || []).filter((it: any) => 
        (it.productId || it.product_id)?.toString() === productId || (it.productId || it.product_id)?.toString() === prodObjId.toString()
      );

      for (const it of matchedItems) {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        const amt = Number(it.amount) || Math.round(qty * rate * 100) / 100;

        totalReturnedQty += qty;
        totalReturnedAmount += amt;

        returnsList.push({
          returnId: ret._id.toString(),
          returnNumber: ret.returnNumber || ret.return_number || `RET-${ret._id.toString().slice(-6)}`,
          date: new Date(retDate).toISOString(),
          customerName: cInfo.name,
          quantity: qty,
          rate,
          amount: amt,
        });
      }
    }

    const netQuantitySold = Math.max(0, totalQuantitySold - totalReturnedQty);
    const finalNetRevenue = Math.max(0, totalNetRevenue - totalReturnedAmount);
    const avgUnitCost = totalQuantitySold > 0 ? (totalCogsSum / totalQuantitySold) : 0;
    const finalNetCogs = Math.round(netQuantitySold * avgUnitCost * 100) / 100;
    const finalNetProfit = Math.round((finalNetRevenue - finalNetCogs) * 100) / 100;
    const finalProfitMargin = finalNetRevenue > 0 ? Math.round(((finalNetProfit / finalNetRevenue) * 100) * 10) / 10 : 0;

    await updateUserLastActivity();

    return NextResponse.json({
      product: {
        id: product._id.toString(),
        name: product.name,
        sku: product.sku || "-",
        category: product.category || "General",
        uom: product.unit_of_measurement || "pcs",
        currentStock: Number(product.quantity) || 0,
        costPrice: Number(product.cost_price ?? product.purchase_price) || 0,
        sellPrice: Number(product.sell_price) || 0,
      },
      summary: {
        totalInvoices: salesList.length,
        totalQuantitySold: Math.round(totalQuantitySold * 1000) / 1000,
        totalReturnedQuantity: Math.round(totalReturnedQty * 1000) / 1000,
        netQuantitySold: Math.round(netQuantitySold * 1000) / 1000,
        totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
        totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
        totalNetRevenue: Math.round(finalNetRevenue * 100) / 100,
        totalCogs: finalNetCogs,
        totalProfit: finalNetProfit,
        profitMargin: finalProfitMargin,
        avgSellingPrice: netQuantitySold > 0 ? Math.round((finalNetRevenue / netQuantitySold) * 100) / 100 : 0,
        avgCostPrice: Math.round(avgUnitCost * 100) / 100,
      },
      sales: salesList,
      returns: returnsList,
    });

  } catch (err: any) {
    console.error("Error fetching item sales details:", err);
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
