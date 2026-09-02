import * as XLSX from "xlsx";

interface Transaction {
  id: number;
  productId?: number | string;
  productName?: string;
  productDescription?: string;
  type: "income" | "expense";
  created_at: string;
  amount: number;
  customerName?: string;
  customerNumber?: string;
}

interface ProfitabilitySummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  totalExpenseItems: number;
  avgOrderValue?: number;
  avgExpenseValue?: number;
}

interface ProfitabilityBreakdown {
  category: string;
  revenue: number;
  orders: number;
}

interface ProfitabilityExpense {
  _id?: string;
  id?: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod?: string;
}

interface ProfitabilityReportData {
  summary: ProfitabilitySummary;
  breakdown: ProfitabilityBreakdown[];
  expenses: ProfitabilityExpense[];
}

/**
 * Exports transactions to an Excel file
 * @param transactions Array of transactions to export
 * @param filename Name of the file to download
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  filename: string = "counter-sale-transactions.xlsx"
): void {
  // Prepare data for Excel
  const excelData = transactions.map((transaction) => ({
    "Item Name": transaction.productName || "-",
    Description: transaction.productDescription || "-",
    Type: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
    Date: new Date(transaction.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    "Amount (Rs.)": Math.floor(transaction.amount),
    UOM: (transaction as any).uom || "Piece",
    Quantity: (transaction as any).quantity || 1,
    "Unit Price": (transaction as any).unitPrice || Math.floor(transaction.amount),
    "Customer Name": transaction.customerName || "-",
    "Customer Number": transaction.customerNumber || "-",
  }));

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Item Name
    { wch: 30 }, // Description
    { wch: 12 }, // Type
    { wch: 15 }, // Date
    { wch: 15 }, // Amount
    { wch: 12 }, // UOM
    { wch: 12 }, // Quantity
    { wch: 15 }, // Unit Price
    { wch: 20 }, // Customer Name
    { wch: 18 }, // Customer Number
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports an Excel template with column headers only (no data)
 * @param filename Name of the file to download
 */
export function exportTransactionsTemplate(
  filename: string = "counter-sale-template.xlsx"
): void {
  // Create headers only
  const headers = [
    "Item Name",
    "Description",
    "Type",
    "Date",
    "Amount (Rs.)",
    "UOM",
    "Quantity",
    "Unit Price",
    "Customer Name",
    "Customer Number",
  ];

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet with headers only
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Item Name
    { wch: 30 }, // Description
    { wch: 12 }, // Type
    { wch: 15 }, // Date
    { wch: 15 }, // Amount
    { wch: 12 }, // UOM
    { wch: 12 }, // Quantity
    { wch: 15 }, // Unit Price
    { wch: 20 }, // Customer Name
    { wch: 18 }, // Customer Number
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

interface Product {
  id: number;
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
}

/**
 * Exports products to an Excel file
 * @param products Array of products to export
 * @param filename Name of the file to download
 */
export function exportProductsToExcel(
  products: Product[],
  filename: string = "products.xlsx"
): void {
  // Prepare data for Excel
  const excelData = products.map((product) => ({
    Name: product.name || "-",
    Description: product.description || "-",
    Type: product.type ? product.type.charAt(0).toUpperCase() + product.type.slice(1) : "Goods",
    "Sell Price (Rs.)": product.sell_price !== undefined && product.sell_price !== null ? Math.floor(product.sell_price) : "-",
    "Cost Price (Rs.)": product.cost_price !== undefined && product.cost_price !== null ? Math.floor(product.cost_price) : "-",
    Quantity: product.quantity !== undefined ? product.quantity : (product.in_stock !== undefined ? product.in_stock : "-"),
    "Unit of Measurement": product.unit_of_measurement || "-",
    Category: product.category || "-",
    Branch: product.branch || "-",
  }));

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Name
    { wch: 30 }, // Description
    { wch: 12 }, // Type
    { wch: 15 }, // Sell Price
    { wch: 15 }, // Cost Price
    { wch: 12 }, // Quantity
    { wch: 20 }, // Unit of Measurement
    { wch: 20 }, // Category
    { wch: 18 }, // Branch
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports a products Excel template with column headers only (no data)
 * @param filename Name of the file to download
 */
export function exportProductsTemplate(
  filename: string = "products-template.xlsx"
): void {
  // Create headers only
  const headers = [
    "Name",
    "Description",
    "Type",
    "Sell Price (Rs.)",
    "Cost Price (Rs.)",
    "Quantity",
    "Unit of Measurement",
    "Category",
    "Branch",
  ];

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet with headers only
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Name
    { wch: 30 }, // Description
    { wch: 12 }, // Type
    { wch: 15 }, // Sell Price
    { wch: 15 }, // Cost Price
    { wch: 12 }, // Quantity
    { wch: 20 }, // Unit of Measurement
    { wch: 20 }, // Category
    { wch: 18 }, // Branch
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  status?: "active" | "inactive";
  company_name?: string;
  balance?: number;
}

/**
 * Exports customers to an Excel file
 * @param customers Array of customers to export
 * @param filename Name of the file to download
 */
export function exportCustomersToExcel(
  customers: Customer[],
  filename: string = "customers.xlsx"
): void {
  // Prepare data for Excel
  const excelData = customers.map((customer) => ({
    "Name": customer.name || "-",
    "Phone": customer.phone || "-",
    "Company Name": customer.company_name || "-",
    "Balance (Rs.)": customer.balance ? Math.round(customer.balance) : 0,
  }));

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Name
    { wch: 20 }, // Phone
    { wch: 25 }, // Company Name
    { wch: 20 }, // Balance
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports a customers Excel template with column headers only (no data)
 * @param filename Name of the file to download
 */
export function exportCustomersTemplate(
  filename: string = "customers-template.xlsx"
): void {
  // Create headers only
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Status",
  ];

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet with headers only
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // Name
    { wch: 30 }, // Email
    { wch: 20 }, // Phone
    { wch: 12 }, // Status
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  // Write the file
  XLSX.writeFile(workbook, filename);
}

interface StockReportItem {
  sku?: string;
  name: string;
  category?: string;
  branch?: string;
  quantity?: number;
  cost_price?: number;
  sell_price?: number;
  damaged_quantity?: number;
}

/**
 * Exports Stock Report items to an Excel file with detailed valuations
 */
export function exportStockReportToExcel(
  items: StockReportItem[],
  filename: string = "stock-report.xlsx"
): void {
  const excelData = items.map((item) => {
    const qty = item.quantity || 0;
    const cost = item.cost_price || 0;
    const sell = item.sell_price || 0;
    const damagedQty = item.damaged_quantity || 0;
    const totalCostVal = qty * cost;
    const totalRetailVal = qty * sell;
    const profitPotential = totalRetailVal - totalCostVal;

    return {
      "Product Name": item.name || "-",
      Category: item.category || "-",
      Branch: item.branch || "-",
      Quantity: qty,
      "Cost Price (Rs.)": Math.floor(cost),
      "Sell Price (Rs.)": Math.floor(sell),
      "Total Cost Valuation (Rs.)": Math.floor(totalCostVal),
      "Total Retail Valuation (Rs.)": Math.floor(totalRetailVal),
      "Profit Potential (Rs.)": Math.floor(profitPotential),
      "Damaged Quantity": damagedQty,
      "Damaged Valuation (Rs.)": Math.floor(damagedQty * cost),
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const columnWidths = [
    { wch: 25 }, // Product Name
    { wch: 18 }, // Category
    { wch: 18 }, // Branch
    { wch: 12 }, // Quantity
    { wch: 18 }, // Cost Price
    { wch: 18 }, // Sell Price
    { wch: 25 }, // Total Cost Valuation
    { wch: 25 }, // Total Retail Valuation
    { wch: 22 }, // Profit Potential
    { wch: 18 }, // Damaged Quantity
    { wch: 22 }, // Damaged Valuation
  ];
  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Report");
  XLSX.writeFile(workbook, filename);
}

interface ReceivableDebtorItem {
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  balance: number;
  status: string;
}

/**
 * Exports Receivable Summary debtors to an Excel file
 */
export function exportReceivableSummaryToExcel(
  items: ReceivableDebtorItem[],
  filename: string = "receivable-summary.xlsx"
): void {
  const excelData = items.map((item) => ({
    "Party Name": item.name || "-",
    "Company Name": item.company_name || "-",
    Email: item.email || "-",
    Phone: item.phone || "-",
    "Outstanding Balance (Rs.)": Math.floor(item.balance),
    Status: (item.status || "active").charAt(0).toUpperCase() + (item.status || "active").slice(1),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const columnWidths = [
    { wch: 25 }, // Party Name
    { wch: 22 }, // Company Name
    { wch: 30 }, // Email
    { wch: 20 }, // Phone
    { wch: 25 }, // Outstanding Balance (Rs.)
    { wch: 12 }, // Status
  ];
  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Receivable Summary");
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports Profitability Report to an Excel file
 */
export function exportProfitabilityToExcel(
  data: ProfitabilityReportData,
  filename: string = "profitability-report.xlsx"
): void {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ["Profitability Summary"],
    [],
    ["Metric", "Value"],
    ["Total Revenue", Math.floor(data.summary.totalRevenue || 0)],
    ["Total Expenses", Math.floor(data.summary.totalExpenses || 0)],
    ["Net Profit", Math.floor(data.summary.netProfit || 0)],
    ["Profit Margin (%)", (data.summary.profitMargin || 0).toFixed(2)],
    ["Total Orders", data.summary.totalOrders || 0],
    ["Total Expense Items", data.summary.totalExpenseItems || 0],
    ["Avg Order Value", Math.floor(data.summary.avgOrderValue || 0)],
    ["Avg Expense Value", Math.floor(data.summary.avgExpenseValue || 0)],
  ];

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

  // Breakdown Sheet
  const breakdownExcelData = data.breakdown.map((item) => ({
    Category: item.category || "-",
    Revenue: Math.floor(item.revenue || 0),
    Orders: item.orders || 0,
    "Avg Value": Math.floor((item.revenue || 0) / (item.orders || 1)),
  }));

  if (breakdownExcelData.length > 0) {
    const breakdownWorksheet = XLSX.utils.json_to_sheet(breakdownExcelData);
    breakdownWorksheet["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, breakdownWorksheet, "Revenue Breakdown");
  }

  // Expenses Sheet
  const expensesExcelData = data.expenses.map((item) => ({
    Category: item.category || "-",
    Description: item.description || "-",
    Amount: Math.floor(item.amount || 0),
    Date: new Date(item.date).toLocaleDateString(),
    "Payment Method": item.paymentMethod || "-",
  }));

  if (expensesExcelData.length > 0) {
    const expensesWorksheet = XLSX.utils.json_to_sheet(expensesExcelData);
    expensesWorksheet["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, expensesWorksheet, "Expenses");
  }

  XLSX.writeFile(workbook, filename);
}



