const XLSX = require("xlsx");
const fs = require("fs");

// 1. Parties (20 rows)
const parties = Array.from({ length: 20 }).map((_, i) => ({
  ClientName: `Customer ${i + 1}`,
  Phone: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
  Address: `Shop ${i + 1}, Main Market`,
  OutStanding: Math.floor(Math.random() * 10000) - 2000, // Mix of payable/receivable
}));

// 2. Products (20 rows)
const products = Array.from({ length: 20 }).map((_, i) => ({
  ItemName: `Item ${i + 1}`,
  SalePrice: Math.floor(Math.random() * 500) + 100,
  PurchasePrice: Math.floor(Math.random() * 400) + 50,
  StockQty: Math.floor(Math.random() * 100),
  Barcode: `SKU-${1000 + i}`,
}));

// 3. Transactions / Invoices (30 rows)
const transactions = Array.from({ length: 30 }).map((_, i) => ({
  BillNo: `INV-${1000 + i}`,
  Customer: `Customer ${Math.floor(Math.random() * 20) + 1}`,
  TxDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
  Item: `Item ${Math.floor(Math.random() * 20) + 1}`,
  Qty: Math.floor(Math.random() * 5) + 1,
  Rate: Math.floor(Math.random() * 500) + 100,
  Discount: Math.floor(Math.random() * 50),
  NetTotal: 0, // Will calculate below
}));
transactions.forEach(t => t.NetTotal = (t.Qty * t.Rate) - t.Discount);

// 4. Payments (15 rows)
const payments = Array.from({ length: 15 }).map((_, i) => ({
  Party: `Customer ${Math.floor(Math.random() * 20) + 1}`,
  Amount: Math.floor(Math.random() * 5000) + 500,
  Method: i % 2 === 0 ? 'Cash' : 'Bank Transfer',
  PayDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
  Direction: i % 3 === 0 ? 'payment-out' : 'payment-in',
}));

// 5. Expenses (15 rows)
const expenses = Array.from({ length: 15 }).map((_, i) => ({
  ExpNo: `EXP-${500 + i}`,
  Date: new Date().toISOString().split('T')[0],
  Category: 'Office Supplies',
  Detail: `Bought items ${i}`,
  Amount: Math.floor(Math.random() * 2000) + 100,
}));

// Create Excel Workbook
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parties), "Clients");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Inventory");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactions), "Sales");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments), "Cashbook");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "Kharche");

// Write to Excel File (Best for multiple modules)
XLSX.writeFile(wb, "dummy_khata_full.xlsx");

// Also create a large CSV just for Transactions (100 rows) as requested
const largeCsvData = Array.from({ length: 100 }).map((_, i) => ({
  InvoiceID: `INV-${2000 + i}`,
  Client: `Customer ${Math.floor(Math.random() * 50) + 1}`,
  Date: new Date().toISOString().split('T')[0],
  ProductName: `Product ${Math.floor(Math.random() * 50) + 1}`,
  Quantity: Math.floor(Math.random() * 10) + 1,
  UnitPrice: Math.floor(Math.random() * 1000) + 100,
  TotalValue: 0
}));
largeCsvData.forEach(t => t.TotalValue = t.Quantity * t.UnitPrice);

const csvSheet = XLSX.utils.json_to_sheet(largeCsvData);
const csvStr = XLSX.utils.sheet_to_csv(csvSheet);
fs.writeFileSync("dummy_large_transactions.csv", csvStr);

console.log("Files generated: dummy_khata_full.xlsx and dummy_large_transactions.csv");
