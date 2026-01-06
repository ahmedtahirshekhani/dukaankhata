"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InvoicePreview, type InvoiceCharge, type InvoiceProduct } from "@/components/invoice/invoice-preview";
import { PaymentDialog } from "@/components/invoice/payment-dialog";

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
  overallDiscount?: number;
  shippingCharges?: number;
  total: number;
  onMakePayment?: () => void;
  onCreateOrder: (paymentDetails: {
    paymentMethod: string;
    paidAmount: number;
    paidDate: string | null;
    noPaymentAtAll: boolean;
  }) => void;
  hidePaymentActions?: boolean;
  initialPayment?: {
    method: string;
    paid_amount: number;
    paid_date: string;
    no_payment_at_all: boolean;
  } | null;
  companyName?: string;
  customerNotes?: string;
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
  overallDiscount = 0,
  shippingCharges = 0,
  total,
  onMakePayment,
  onCreateOrder,
  hidePaymentActions = false,
  initialPayment = null,
  companyName,
  customerNotes = "",
}: InvoicePreviewDialogProps) {
  const [noPaymentAtAll, setNoPaymentAtAll] = useState(initialPayment?.no_payment_at_all || false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(initialPayment?.method || "");
  const [paidAmount, setPaidAmount] = useState<number>(initialPayment?.paid_amount || 0);
  const [paidDate, setPaidDate] = useState<string | null>(
    initialPayment?.paid_date ? new Date(initialPayment.paid_date).toISOString().split("T")[0] : null
  );
  const invoiceRef = useRef<HTMLDivElement | null>(null);
  const isCreatingRef = useRef(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [requestCustomerSignature, setRequestCustomerSignature] = useState(false);
  const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [paymentSeed, setPaymentSeed] = useState<{ amount: number; method: string; date: string }>(() => ({
    amount: initialPayment?.paid_amount || total,
    method: initialPayment?.method || "",
    date: initialPayment?.paid_date ? new Date(initialPayment.paid_date).toISOString().split("T")[0] : getToday(),
  }));

  useEffect(() => {
    const loadBranding = async () => {
      try {
        // Check localStorage first
        const cachedLogo = typeof window !== 'undefined' ? localStorage.getItem('companyLogo') : null;
        const cachedSignature = typeof window !== 'undefined' ? localStorage.getItem('invoiceSignature') : null;
        
        // Set cached values if available
        if (cachedLogo) setCompanyLogo(cachedLogo);
        if (cachedSignature) setSignatureImage(cachedSignature);
        
        // Always fetch from API to ensure we have latest data
        const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
        const res = await fetch(`/${locale || ''}/api/configuration/assets`);
        const data = await res.json();
        if (res.ok) {
          const logo = data.companyLogo || null;
          const sig = data.signatureImage || null;
          
          // Update state with API data
          setCompanyLogo(logo);
          setSignatureImage(sig);
          
          // Update localStorage cache
          if (logo) {
            localStorage.setItem('companyLogo', logo);
          } else {
            localStorage.removeItem('companyLogo');
          }
          if (sig) {
            localStorage.setItem('invoiceSignature', sig);
          } else {
            localStorage.removeItem('invoiceSignature');
          }
        }
      } catch (err) {
        // Silent fail; fall back to cached values if they exist
        console.error('branding fetch failed', err);
      }
    };
    loadBranding();
  }, []);

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    const mod = await import("html2pdf.js");
    const html2pdf = mod.default || mod;
    const opt = {
      margin: 10,
      filename: `${invoiceNo || "preview"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as any;
    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  const remainingBalance = Math.max(0, total - paidAmount);

  const isPaymentMade = paidAmount > 0;

  const todayStr = getToday();
  const newPaymentSeed = {
    amount: remainingBalance || total,
    method: paymentMethod,
    date: todayStr,
  };
  const editPaymentSeed = {
    amount: paidAmount || total,
    method: paymentMethod,
    date: paidDate || todayStr,
  };

  return (
    <React.Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>

          <div className={hidePaymentActions ? "flex flex-col gap-4" : "grid grid-cols-3 gap-6"}>
            <div className={hidePaymentActions ? "w-full" : "col-span-2"}>
              <InvoicePreview
                ref={invoiceRef}
                invoiceNo={invoiceNo}
                customerName={customerName}
                saleDate={saleDate}
                dueDate={dueDate}
                products={products}
                subtotal={subtotal}
                charges={charges}
                overallDiscount={overallDiscount}
                shippingCharges={shippingCharges}
                total={total}
                noPaymentAtAll={noPaymentAtAll}
                paidAmount={paidAmount}
                paidDate={paidDate}
                companyLogo={companyLogo}
                signatureImage={signatureImage}
                includeSignature={includeSignature}
                requestCustomerSignature={requestCustomerSignature}
                companyName={companyName}
                customerNotes={customerNotes}
              />
            </div>

            {hidePaymentActions ? (
              <div className="flex justify-center pt-4">
                <Button onClick={handleDownloadPdf} variant="default">
                  Download Invoice (PDF)
                </Button>
              </div>
            ) : (
              <div className="col-span-1">
                <div className="space-y-4">
                  <div className="space-y-2">
                    {isPaymentMade ? (
                      <Button
                        onClick={() => {
                          setPaymentSeed(editPaymentSeed);
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
                          setPaymentSeed(newPaymentSeed);
                          setNoPaymentAtAll(false);
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
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNoPaymentAtAll(checked);
                          if (checked) {
                            setPaidAmount(0);
                            setPaidDate(null);
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor="no-payment" className="text-sm cursor-pointer">
                        No Payment At All
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1 gap-3">
                    <Label className="text-sm">Include signature in invoice</Label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeSignature}
                      onClick={() => setIncludeSignature((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeSignature ? "bg-primary" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${includeSignature ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 gap-3">
                    <Label className="text-sm">Request customer signature</Label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={requestCustomerSignature}
                      onClick={() => setRequestCustomerSignature((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${requestCustomerSignature ? "bg-primary" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${requestCustomerSignature ? "translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div>
                    <Button
                      onClick={() =>
                        onCreateOrder({
                          paymentMethod,
                          paidAmount,
                          paidDate,
                          noPaymentAtAll,
                        })
                      }
                      variant="outline"
                      className="w-full"
                      disabled={!(isPaymentMade || noPaymentAtAll)}
                    >
                      Create Order
                    </Button>
                  </div>

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
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        total={total}
        defaultAmount={paymentSeed.amount}
        defaultMethod={paymentSeed.method}
        defaultDate={paymentSeed.date}
        onConfirm={({ amount, method, date }) => {
          setPaymentMethod(method);
          setPaidAmount(amount);
          setPaidDate(date);
          setNoPaymentAtAll(false);
        }}
      />
    </React.Fragment>
  );
}
