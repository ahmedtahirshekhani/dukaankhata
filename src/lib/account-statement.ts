/**
 * Account Statement utilities and helpers
 * Centralized logic for account statement calculations and transformations
 */

export interface OrderRecord {
  id: string;
  type: "order";
  orderValue: number;
  paidAmount: number | null;
  invoiceNo: string | null;
  dateTime: string;
  paidDate: string | null;
}

export interface PaymentRecord {
  id: string;
  type: "payment_in";
  orderValue: null;
  paidAmount: number;
  invoiceNo: null;
  dateTime: string;
  paidDate: string | null;
}

export interface OpeningBalanceRecord {
  id: "opening_balance";
  type: "opening_balance";
  orderValue: null;
  paidAmount: null;
  invoiceNo: null;
  dateTime: string;
  paidDate: null;
  balance: number;
}

export type StatementRecord = (OrderRecord | PaymentRecord) & { balance: number };

/**
 * Calculate running balance from transaction records
 * Starts with opening balance and applies order/payment changes
 */
export function calculateRunningBalance(
  records: Array<{
    type: "order" | "payment_in";
    orderValue?: number | null;
    paidAmount?: number | null;
  }>,
  openingBalance: number
): Array<{ balance: number }> {
  let runningBalance = openingBalance;
  return records.map((record) => {
    if (record.type === "order") {
      runningBalance += record.orderValue || 0;
      if (record.paidAmount) {
        runningBalance -= record.paidAmount;
      }
    } else if (record.type === "payment_in") {
      runningBalance -= record.paidAmount || 0;
    }
    return { balance: runningBalance };
  });
}

/**
 * Calculate summary statistics from transaction records
 */
export function calculateSummary(
  orderRecords: OrderRecord[],
  paymentRecords: PaymentRecord[],
  openingBalance: number,
  finalBalance: number
) {
  const totalOrders = orderRecords.reduce((sum, r) => sum + (r.orderValue || 0), 0);
  const totalPayments =
    paymentRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0) +
    orderRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

  return {
    openingBalance,
    totalOrders,
    totalPayments,
    currentBalance: finalBalance,
  };
}

/**
 * Safe date conversion to ISO string
 */
export function toISOString(date: any): string {
  if (!date) return "";
  if (typeof date.toISOString === "function") {
    return date.toISOString();
  }
  if (typeof date === "string") {
    return date;
  }
  return new Date(date).toISOString();
}

/**
 * Sorts records chronologically in ascending order
 * Uses generic type to preserve record structure through sorting
 */
export function sortRecordsChronologically<T extends { dateTime: string }>(
  records: T[]
): T[] {
  return records.sort((a, b) => {
    const dateA = new Date(a.dateTime).getTime();
    const dateB = new Date(b.dateTime).getTime();
    return dateA - dateB;
  });
}

/**
 * Validate and parse query parameters
 */
export function parseStatementParams(searchParams: URLSearchParams) {
  const customerId = searchParams.get("customerId");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const openingBalanceParam = searchParams.get("openingBalance");

  return {
    customerId,
    fromDate,
    toDate,
    openingBalance: openingBalanceParam ? parseFloat(openingBalanceParam) : 0,
    currentDate: searchParams.get("currentDate"),
  };
}
