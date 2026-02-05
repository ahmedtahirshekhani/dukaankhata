"use client"

import React, { forwardRef } from "react"
import { Card } from "@/components/ui/card"
import { calculateDiscountValue, calculateLineTotal } from "@/lib/invoice/calculations"
import { formatCurrencyString } from "@/lib/utils"

export interface InvoiceProduct {
  id: number | string
  name: string
  description?: string
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
  customer: {
    name: string
    email?: string
    phone?: string
  }
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
  requestCustomerSignature?: boolean
  companyName?: string
  customerNotes?: string
  printFormat?: "a4" | "thermal" | "letter"
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

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  })
}

const formatUom = (uom?: string) => (uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-")
const truncateDescription = (desc?: string, limit = 100) => {
  if (!desc) return ""
  return desc.length > limit ? `${desc.slice(0, limit)}...` : desc
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  (
    {
      invoiceNo,
      customer,
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
      requestCustomerSignature = false,
      companyName,
      customerNotes = "",
      printFormat = "a4",
    },
    ref
  ) => {
    const remainingBalance = Math.max(0, total - paidAmount)

    // Format-specific styling
    const isThermal = printFormat === "thermal"
    const cardPadding = isThermal ? "p-3" : "p-6"
    const headerTextSize = isThermal ? "text-lg" : "text-2xl"
    const textSize = isThermal ? "text-xs" : "text-sm"
    const fontBoldSize = isThermal ? "text-sm" : "text-lg"
    const logoHeight = isThermal ? "h-10" : "h-16"
    const signatureHeight = isThermal ? "h-12" : "h-20"
    const gridCols = isThermal ? "grid-cols-1" : "grid-cols-2"

    return (
      <div ref={ref}>
        <Card className={cardPadding}>
          <div className="mb-6 border-b pb-4">
            {companyLogo && (
              <div className="mb-4 flex justify-center">
                <img src={companyLogo} alt="Company Logo" className={`${logoHeight} w-auto`} />
              </div>
            )}
            <h2 className={`${headerTextSize} font-bold mb-2`}>INVOICE</h2>
            <div className={`grid ${gridCols} gap-4 ${textSize}`}>
              <div>
                <p className="text-gray-600">Invoice No.</p>
                <p className="font-semibold">{invoiceNo}</p>
              </div>
              <div>
                <p className="text-gray-600">Invoice Date</p>
                <p className="font-semibold">{formatDateShort(saleDate)}</p>
              </div>
              <div className={isThermal ? "" : "col-span-2"}>
                <p className="text-gray-600 mb-1">Customer Details</p>
                <div className="space-y-1">
                  <p className="font-semibold">{customer.name}</p>
                  {customer.email && (
                    <p className={`${textSize} text-gray-700`}>{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className={`${textSize} text-gray-700`}>{customer.phone}</p>
                  )}
                </div>
              </div>
              {dueDate && (
                <div className={isThermal ? "" : "col-span-2"}>
                  <p className="text-gray-600">Due Date</p>
                  <p className="font-semibold">{formatDateLong(dueDate)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <table className={`w-full ${textSize}`}>
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Item</th>
                  {!isThermal && <th className="text-right py-2">Sell Price</th>}
                  <th className="text-right py-2">Qty</th>
                  {!isThermal && <th className="text-right py-2">UOM</th>}
                  {!isThermal && <th className="text-right py-2">Discount</th>}
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const discountValue = calculateDiscountValue(product)
                  const lineTotal = calculateLineTotal(product)
                  return (
                    <tr key={product.id} className="border-b">
                      <td className="py-2">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{truncateDescription(product.description)}</div>
                          )}
                        </div>
                      </td>
                      {!isThermal && <td className="text-right">{formatCurrencyString(product.sell_price)}</td>}
                      <td className="text-right">{product.quantity}</td>
                      {!isThermal && <td className="text-right">{formatUom(product.unit_of_measurement)}</td>}
                      {!isThermal && (
                        <td className="text-right">
                          {discountValue > 0 ? formatCurrencyString(discountValue) : "-"}
                        </td>
                      )}
                      <td className="text-right">{formatCurrencyString(lineTotal)}</td>
                    </tr>
                  )
                })}
                
              </tbody>
            </table>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className={`flex justify-between ${textSize}`}>
              <span>Sub Total:</span>
              <span>{formatCurrencyString(subtotal)}</span>
            </div>

            {overallDiscount > 0 && (
              <div className={`flex justify-between ${textSize}`}>
                <span>Overall Discount:</span>
                <span>- {formatCurrencyString(Math.min(overallDiscount, subtotal))}</span>
              </div>
            )}

            {shippingCharges > 0 && (
              <div className={`flex justify-between ${textSize}`}>
                <span>Shipping charges:</span>
                <span>{formatCurrencyString(shippingCharges)}</span>
              </div>
            )}

            {charges.length > 0 && (
              <div className="space-y-1">
                {charges.map((charge, idx) => (
                  <div key={idx} className={`flex justify-between ${textSize}`}>
                    <span>{charge.item}:</span>
                    <span>{formatCurrencyString(charge.value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`flex justify-between font-bold ${fontBoldSize} border-t pt-2`}>
              <span>Total:</span>
              <span>{formatCurrencyString(total)}</span>
            </div>

            <div className={`mt-4 text-right ${textSize} space-y-1`}>
              {!noPaymentAtAll && paidAmount > 0 && (
                <div>
                  <span className="font-medium">Paid On:</span> {paidDate ? formatDateLong(paidDate) : "—"} — {formatCurrencyString(paidAmount)}
                </div>
              )}
              <div>
                <span className="font-medium">Remaining Balance:</span> {formatCurrencyString(remainingBalance)}
              </div>
            </div>

            {(signatureImage && includeSignature) || requestCustomerSignature ? (
              <div className={`mt-6 flex ${isThermal ? "flex-col gap-4" : "justify-between items-end gap-6"}`}>
                {signatureImage && includeSignature && (
                  <div className="flex flex-col items-start gap-2">
                    <img src={signatureImage} alt="Company Signature" className={`${signatureHeight} w-auto`} />
                    <div className="w-40 border-t border-gray-300" />
                    <span className="text-xs text-muted-foreground">{companyName}</span>
                  </div>
                )}
                {requestCustomerSignature && (
                  <div className="flex flex-col items-end gap-2 flex-1">
                    <div className={`${signatureHeight} ${isThermal ? "w-full" : "w-48"} border-2 border-dashed border-gray-300 flex items-center justify-center`}>
                      <span className="text-xs text-muted-foreground">Customer Signature</span>
                    </div>
                    <div className="w-40 border-t border-gray-300" />
                    <span className="text-xs text-muted-foreground">{customer.name}</span>
                  </div>
                )}
              </div>
            ) : null}

            {customerNotes && (
              <div className={`mt-4 ${textSize} text-muted-foreground`}>
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
