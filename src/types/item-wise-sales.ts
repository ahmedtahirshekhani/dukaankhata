// src/types/item-wise-sales.ts

export interface ItemSaleRecord {
  _id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  uom: string;
  currentStock: number;
  totalQuantitySold: number; // Net Quantity Sold
  totalGrossQuantity?: number; // Gross Quantity Sold before returns
  totalReturnedQuantity?: number; // Quantity Returned
  totalReturnedAmount?: number; // Total Return Value
  totalGrossAmount: number;
  totalDiscount: number;
  totalRevenue: number; // Net Revenue
  totalCost: number; // Net Cost
  totalProfit: number; // Net Profit
  invoicesCount: number;
  minSellPrice: number;
  maxSellPrice: number;
  avgSellingPrice: number;
  profitMargin: number;
}

export interface ItemWiseSaleSummary {
  totalProductsCount: number;
  totalItemsSold: number; // Net Items Sold
  totalReturnedUnits?: number; // Total Returned Units
  totalReturnedAmount?: number; // Total Returned Amount
  totalGrossRevenue: number;
  totalDiscountGiven: number;
  totalNetRevenue: number;
  totalProfitEarned: number;
  overallProfitMargin: number;
  topSellingItem?: {
    name: string;
    quantity: number;
    revenue: number;
  } | null;
  topRevenueItem?: {
    name: string;
    quantity: number;
    revenue: number;
  } | null;
}

export interface ItemWiseSalePagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface ItemWiseSaleApiResponse {
  items: ItemSaleRecord[];
  summary: ItemWiseSaleSummary;
  pagination: ItemWiseSalePagination;
}

export interface ItemWiseSaleExportItem {
  productName: string;
  sku: string;
  category: string;
  totalQuantitySold: number;
  uom?: string;
  avgSellingPrice: number;
  totalGrossAmount: number;
  totalDiscount: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  currentStock: number;
}

