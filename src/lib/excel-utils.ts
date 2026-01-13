import * as XLSX from "xlsx";

interface Transaction {
  id: number;
  productId?: number;
  productName?: string;
  productDescription?: string;
  type: "income" | "expense";
  created_at: string;
  amount: number;
  customerName?: string;
  customerNumber?: string;
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
    { wch: 20 }, // Customer Name
    { wch: 18 }, // Customer Number
  ];
  worksheet["!cols"] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  // Write the file
  XLSX.writeFile(workbook, filename);
}
