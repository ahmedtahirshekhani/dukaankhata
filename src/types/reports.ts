// src/types/reports.ts

// --- Excel Shared Interfaces ---
export interface ExcelTransaction {
  id?: number | string;
  productId?: number | string;
  productName?: string;
  productDescription?: string;
  type: "income" | "expense" | string;
  created_at: string;
  amount: number;
  customerName?: string;
  customerNumber?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  [key: string]: any;
}

export interface ExcelProduct {
  id?: number | string;
  type?: string;
  name: string;
  description?: string;
  sell_price?: number;
  cost_price?: number;
  quantity?: number;
  in_stock?: number;
  category?: string;
  unit_of_measurement?: string;
  branch?: string;
  [key: string]: any;
}

export interface ExcelCustomer {
  id?: number | string;
  name: string;
  email?: string;
  phone?: string;
  status?: "active" | "inactive" | string;
  company_name?: string;
  balance?: number;
  [key: string]: any;
}

// --- Stock Report Interfaces ---
export interface StockProduct {
  _id?: string;
  id?: string | number;
  name: string;
  sku?: string;
  category?: string;
  branch?: string;
  quantity?: number;
  cost_price?: number;
  sell_price?: number;
  damaged_quantity?: number;
  status?: string;
  total_cost?: number;
  total_retail?: number;
  potential_profit?: number;
  [key: string]: any;
}

export interface StockSummary {
  totalItems: number;
  totalQuantity: number;
  totalCostValue: number;
  totalRetailValue: number;
  totalPotentialProfit: number;
  lowStockItemsCount?: number;
  outOfStockItemsCount?: number;
  damagedItemsCount?: number;
  [key: string]: any;
}

// --- Profitability Report Interfaces ---
export interface ProfitabilitySummary {
  totalRevenue: number;
  totalCOGS?: number;
  grossProfit?: number;
  totalExpenses: number;
  operatingProfit?: number;
  netProfit?: number;
  profitMargin: number;
  totalOrders: number;
  totalExpenseItems: number;
  avgOrderValue?: number;
  avgExpenseValue?: number;
  [key: string]: any;
}

export interface ProfitabilityBreakdown {
  category: string;
  revenue: number;
  orders: number;
  [key: string]: any;
}

export interface ProfitabilityExpense {
  _id?: string;
  id?: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  [key: string]: any;
}

export interface ProfitabilityReportData {
  summary: ProfitabilitySummary;
  breakdown: ProfitabilityBreakdown[];
  expenses: ProfitabilityExpense[];
  expensesByCategory?: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
}

// --- Receivable Summary Interfaces ---
export interface ReceivableDebtorItem {
  id?: string | number;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  balance: number;
  status: string;
  [key: string]: any;
}

export interface ReceivableSummaryStats {
  totalReceivable: number;
  totalDebtors: number;
  maxReceivable: number;
  avgReceivable: number;
  [key: string]: any;
}

// --- Account Statement (Party Statement) Interfaces ---
export interface StatementTransactionItem {
  id?: string | number;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  [key: string]: any;
}

export interface StatementTransaction {
  id: string | number;
  dateTime: string;
  type: string;
  orderId?: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  items?: StatementTransactionItem[];
  [key: string]: any;
}

export interface StatementSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  totalTransactions: number;
  [key: string]: any;
}

export interface StatementReportMeta {
  customerName: string;
  customerId: string;
  phone: string;
  email: string;
  companyName: string;
  fromDate: string;
  toDate: string;
  reportDate: string;
  [key: string]: any;
}
