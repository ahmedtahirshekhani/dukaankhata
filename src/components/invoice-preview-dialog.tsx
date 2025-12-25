"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InvoiceProduct {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface InvoiceCharge {
  item: string;
  value: number;
}

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNo: string;
  customerName: string;
  saleDate: string;
  dueDate: string | null;
  products: InvoiceProduct[];
  subtotal: number;
  charges: InvoiceCharge[];
  total: number;
  onMakePayment: () => void;
  onCreateOrder: () => void;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoiceNo,
  customerName,
  saleDate,
  dueDate,
  products,
  subtotal,
  charges,
  total,
  onMakePayment,
  onCreateOrder,
}: InvoicePreviewDialogProps) {
  const [noPaymentAtAll, setNoPaymentAtAll] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(total);
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paidDate, setPaidDate] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    const mod = await import("html2pdf.js");
    const html2pdf = mod.default || mod;
    const opt = {
      margin: 10,
      filename: `invoice-${invoiceNo || "preview"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as any;
    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  // Format date with weekday and long month name
  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format amount in PKR with thousands separators, consistent with UI (Rs.)
  const formatAmount = (amount: number) => `Rs. ${Math.floor(amount).toLocaleString()}`;

  // Remaining balance based on accumulated paid amount
  const remainingBalance = Math.max(0, total - paidAmount);

  // Inline SVG signature placeholder
  const signatureSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="70">
      <rect fill="white" width="100%" height="100%"/>
      <text x="10" y="45" font-family="cursive" font-size="26" fill="#555">Signature</text>
    </svg>
  `;
  const signatureSrc = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(signatureSvg)}`;
  const isPaymentMade = paidAmount > 0;

  return (
    <React.Fragment>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Invoice Preview - Left Side */}
          <div className="col-span-2">
            <div ref={invoiceRef}>
            <Card className="p-6">
              {/* Header */}
              <div className="mb-6 border-b pb-4">
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

              {/* Products Table */}
              <div className="mb-6">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2">Product</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b">
                        <td className="py-2">{product.name}</td>
                        <td className="text-right">Rs. {Math.floor(product.price)}</td>
                        <td className="text-right">{product.quantity}</td>
                        <td className="text-right">
                          Rs. {Math.floor(product.quantity * product.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sub Total:</span>
                  <span>Rs. {Math.floor(subtotal)}</span>
                </div>

                {charges.length > 0 && (
                  <div className="space-y-1">
                    {charges.map((charge, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{charge.item}:</span>
                        <span>Rs. {Math.floor(charge.value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>Rs. {Math.floor(total)}</span>
                </div>

                {/* Paid Info - Right Bottom */}
                <div className="mt-4 text-right text-sm space-y-1">
                  <div>
                    <span className="font-medium">Paid On:</span> {paidDate ? formatDateLong(paidDate) : "—"} — {formatAmount(paidAmount)}
                  </div>
                  <div>
                    <span className="font-medium">Remaining Balance:</span> {formatAmount(remainingBalance)}
                  </div>
                </div>

                {/* Signature - Bottom Right */}
                <div className="mt-6 flex justify-end">
                  <img src={signatureSrc} alt="Signature" className="h-12 w-auto" />
                </div>
              </div>
            </Card>
            </div>
          </div>

          {/* Actions - Right Side */}
          <div className="col-span-1">
            <div className="space-y-4">
              {/* Make/Edit Payment Section */}
              <div className="space-y-2">
                {isPaymentMade ? (
                  <Button
                    onClick={() => {
                      // Open dialog to adjust or add more payment
                      setPaymentType("partial");
                      setPaymentAmount(remainingBalance);
                      const d = new Date();
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const day = String(d.getDate()).padStart(2, "0");
                      setPaymentDate(`${y}-${m}-${day}`);
                      setPaymentDialogOpen(true);
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    Edit Payment
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Default to Full Payment with remaining amount
                      setPaymentType("full");
                      setPaymentAmount(remainingBalance);
                      // Reset date to today each time dialog opens
                      const d = new Date();
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const day = String(d.getDate()).padStart(2, "0");
                      setPaymentDate(`${y}-${m}-${day}`);
                      setPaymentDialogOpen(true);
                    }}
                    disabled={noPaymentAtAll}
                    className="w-full"
                    variant={noPaymentAtAll ? "outline" : "default"}
                  >
                    Make Payment
                  </Button>
                )}
                <div className="flex items-center gap-2 px-2">
                  <input
                    type="checkbox"
                    id="no-payment"
                    checked={noPaymentAtAll}
                    onChange={(e) => setNoPaymentAtAll(e.target.checked)}
                    className="w-4 h-4 rounded"
                    disabled={isPaymentMade}
                  />
                  <label htmlFor="no-payment" className="text-sm cursor-pointer">
                    No Payment At All
                  </label>
                </div>
              </div>

              {/* Create Order Button */}
              <div>
                <Button
                  onClick={onCreateOrder}
                  variant="outline"
                  className="w-full"
                  disabled={!isPaymentMade}
                >
                  Create Order
                </Button>
              </div>

              {/* Download / Print Invoice */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="text-xs underline text-muted-foreground hover:text-foreground"
                >
                  Download Invoice (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* Payment Dialog */}
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Make Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Type */}
          <div className="space-y-2">
            <Label className="text-sm">Payment Type</Label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="payment-type"
                  value="full"
                  checked={paymentType === "full"}
                  onChange={() => {
                    setPaymentType("full");
                    // Set to remaining when switching to full
                    setPaymentAmount(remainingBalance);
                  }}
                />
                Full Payment
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="payment-type"
                  value="partial"
                  checked={paymentType === "partial"}
                  onChange={() => {
                    setPaymentType("partial");
                    // Clamp current amount; if it was full, prefill to total
                    setPaymentAmount((amt) => {
                      const base = amt || remainingBalance;
                      return Math.max(0, Math.min(remainingBalance, base));
                    });
                  }}
                />
                Partial Payment
              </label>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => {
                const val = Number(e.target.value);
                const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(remainingBalance, val));
                setPaymentAmount(clamped);
              }}
              disabled={paymentType === "full"}
              min={0}
              max={Math.floor(remainingBalance)}
              step={1}
            />
            {paymentType === "full" && (
              <p className="text-xs text-muted-foreground">Full amount is locked to remaining balance.</p>
            )}
            {paymentType === "partial" && (
              <p className="text-xs text-muted-foreground">
                Remaining Balance after payment: {formatAmount(Math.max(0, remainingBalance - paymentAmount))}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Input
              id="payment-method"
              placeholder="e.g., Cash, Card, Bank Transfer"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="payment-date">Date</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const amt = Number(paymentAmount);
                const remaining = Math.max(0, total - paidAmount);
                if (isNaN(amt) || amt <= 0 || amt > remaining) {
                  alert("Please enter an amount within the remaining balance.");
                  return;
                }
                // Accumulate paid amount and update last paid date
                setPaidAmount((prev) => Math.min(total, prev + amt));
                setPaidDate(paymentDate);
                setPaymentDialogOpen(false);
              }}
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </React.Fragment>
  );
}
