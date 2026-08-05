export function normalizeText(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function firstValue(row: Record<string, any> | null | undefined, keys: string[]) {
  if (!row) return '';
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

export function getBranchName(_brand: string | null | undefined) {
  return 'Main';
}

export function getProductDescription(productName: string | null | undefined, rawDescription: string | null | undefined) {
  const name = String(productName ?? '').trim();
  const description = String(rawDescription ?? '').trim();
  if (!description) return '';
  if (normalizeText(name) === normalizeText(description)) return '';
  return description;
}

export function getPriceFields(row: Record<string, any> | null | undefined) {
  const costValue = firstValue(row, [
    'CostPrice',
    'Cost',
    'PurchasePrice',
    'BuyingPrice',
    'BuyPrice',
    'AverageCost',
    'LastCost',
    'OpeningCost',
    'UnitCost',
    'PurchaseCost',
  ]);
  const sellValue = firstValue(row, [
    'SellPrice',
    'SellingPrice',
    'SalePrice',
    'Retail',
    'RetailPrice',
    'MRP',
    'SalesPrice',
    'Price',
    'UnitPrice',
  ]);

  const cost = Number(costValue);
  const sell = Number(sellValue);

  return {
    costPrice: Number.isFinite(cost) ? cost : 0,
    sellPrice: Number.isFinite(sell) ? sell : 0,
  };
}

export function getRowId(row: Record<string, any> | null | undefined, fallback = '') {
  const value = firstValue(row, ['Serial', 'Id', 'No', 'TxnId', 'TransactionId', 'BillNo', 'Bill', 'InvoiceNo', 'VoucherNo', 'ReceiptNo', 'PaymentNo']);
  return value != null && value !== '' ? String(value) : fallback;
}
