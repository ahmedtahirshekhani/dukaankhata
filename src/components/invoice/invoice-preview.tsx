"use client"

import React, { forwardRef } from "react"
import { Card } from "@/components/ui/card"
import { calculateDiscountValue, calculateLineTotal } from "@/lib/invoice-calculations"
import { formatCurrencyString } from "@/lib/utils"

export interface InvoiceProduct {
  id: number | string
  name: string
  quantity: number
  sell_price: number
  unit_of_measurement?: string
  discount?: number
  discountType?: "value" | "percentage"
}

export interface InvoiceCharge {
  item: string
  value: number
}

export interface InvoicePreviewProps {
  invoiceNo: string
  customerName: string
  saleDate: string
  dueDate: string | null
  products: InvoiceProduct[]
  subtotal: number
  charges: InvoiceCharge[]
  overallDiscount?: number
  shippingCharges?: number
  total: number
  noPaymentAtAll: boolean
  paidAmount: number
  paidDate: string | null
  companyLogo?: string | null
  signatureImage?: string | null
  includeSignature?: boolean
  companyName?: string
  customerNotes?: string
}

const formatDateLong = (dateStr: string) => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  (
    {
      invoiceNo,
      customerName,
      saleDate,
      dueDate,
      products,
      subtotal,
      charges,
      overallDiscount = 0,
      shippingCharges = 0,
      total,
      noPaymentAtAll,
      paidAmount,
      paidDate,
      companyLogo,
      signatureImage,
      includeSignature = true,
      companyName,
      customerNotes = "",
    },
    ref
  ) => {
    const remainingBalance = Math.max(0, total - paidAmount)

    return (
      <div ref={ref}>
        <Card className="p-6">
          <div className="mb-6 border-b pb-4">
            {companyLogo && (
              <div className="mb-4 flex justify-center">
                <img src={companyLogo} alt="Company Logo" className="h-16 w-auto" />
              </div>
            )}
            <h2 className="text-2xl font-bold mb-2">INVOICE</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Invoice No.</p>
                <p className="font-semibold">{invoiceNo}</p>
              </div>
              <div>
                <p className="text-gray-600">Sale Date</p>
                <p className="font-semibold">{formatDateLong(saleDate)}</p>
              </div>
              <div>
                <p className="text-gray-600">Customer</p>
                <p className="font-semibold">{customerName}</p>
              </div>
              {dueDate && (
                <div>
                  <p className="text-gray-600">Due Date</p>
                  <p className="font-semibold">{formatDateLong(dueDate)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Sell Price</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">UOM</th>
                  <th className="text-right py-2">Discount</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const discountValue = calculateDiscountValue(product)
                  const lineTotal = calculateLineTotal(product)
                  return (
                    <tr key={product.id} className="border-b">
                      <td className="py-2">{product.name}</td>
                      <td className="text-right">{formatCurrencyString(product.sell_price)}</td>
                      <td className="text-right">{product.quantity}</td>
                      <td className="text-right">{product.unit_of_measurement || "-"}</td>
                      <td className="text-right">
                        {discountValue > 0 ? formatCurrencyString(discountValue) : "-"}
                      </td>
                      <td className="text-right">{formatCurrencyString(lineTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sub Total:</span>
              <span>{formatCurrencyString(subtotal)}</span>
            </div>

            {overallDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Overall Discount:</span>
                <span>- {formatCurrencyString(Math.min(overallDiscount, subtotal))}</span>
              </div>
            )}

            {shippingCharges > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping charges:</span>
                <span>{formatCurrencyString(shippingCharges)}</span>
              </div>
            )}

            {charges.length > 0 && (
              <div className="space-y-1">
                {charges.map((charge, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{charge.item}:</span>
                    <span>{formatCurrencyString(charge.value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrencyString(total)}</span>
            </div>

            <div className="mt-4 text-right text-sm space-y-1">
              {!noPaymentAtAll && paidAmount > 0 && (
                <div>
                  <span className="font-medium">Paid On:</span> {paidDate ? formatDateLong(paidDate) : "—"} — {formatCurrencyString(paidAmount)}
                </div>
              )}
              <div>
                <span className="font-medium">Remaining Balance:</span> {formatCurrencyString(remainingBalance)}
              </div>
            </div>

            {signatureImage && includeSignature && (
              <div className="mt-6 flex flex-col items-end gap-2">
                <img src={signatureImage} alt="Signature" className="h-20 w-auto" />
                <div className="w-40 border-t border-gray-300" />
                <span className="text-xs text-muted-foreground">{companyName}</span>
              </div>
            )}

            {customerNotes && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Customer Notes</p>
                <p>{customerNotes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }
)

InvoicePreview.displayName = "InvoicePreview"
