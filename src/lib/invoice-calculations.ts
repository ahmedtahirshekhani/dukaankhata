export type InvoiceLineInput = {
  sell_price: number
  quantity: number
  discount?: number
  discountType?: "value" | "percentage"
}

export function calculateDiscountValue(item: InvoiceLineInput): number {
  const quantity = item.quantity || 1
  const gross = quantity * item.sell_price
  const discount = item.discount || 0
  if (item.discountType === "percentage") {
    return Math.floor((gross * discount) / 100)
  }
  return discount
}

export function calculateLineTotal(item: InvoiceLineInput): number {
  const quantity = item.quantity || 1
  const gross = quantity * item.sell_price
  const discountValue = calculateDiscountValue(item)
  return Math.max(0, gross - discountValue)
}

export function calculateSubtotal(items: InvoiceLineInput[]): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0)
}
