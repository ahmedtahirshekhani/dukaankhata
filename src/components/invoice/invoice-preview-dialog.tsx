"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2, Printer, Receipt, Download } from "lucide-react";
import {
  InvoicePreview,
  type InvoiceCharge,
  type InvoiceProduct,
} from "@/components/invoice/invoice-preview";
import { PaymentDialog } from "@/components/invoice/payment-dialog";
import { Switch } from "../ui/switch";

type BrandingPayload = {
  companyLogo: string | null;
  signatureImage: string | null;
  companyAddress: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
};

let brandingCache: BrandingPayload | null = null;
let brandingInFlight: Promise<BrandingPayload> | null = null;

// Helper to clear cache if needed
export const clearBrandingCache = () => {
  brandingCache = null;
  brandingInFlight = null;
};

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNo: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    company_address?: string;
    address?: string;
  };
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
  }) => Promise<void> | void;
  isCreatingOrder?: boolean;
  hidePaymentActions?: boolean;
  initialPayment?: {
    method: string;
    paid_amount: number;
    paid_date: string;
    no_payment_at_all: boolean;
  } | null;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerNotes?: string;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
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
  onMakePayment,
  onCreateOrder,
  isCreatingOrder = false,
  hidePaymentActions = false,
  initialPayment = null,
  companyName: initialCompanyName,
  companyAddress: initialCompanyAddress,
  companyPhone: initialCompanyPhone,
  companyEmail: initialCompanyEmail,
  customerNotes = "",
}: InvoicePreviewDialogProps) {
  const t = useTranslations("invoice");
  const tCommon = useTranslations("common");

  const [noPaymentAtAll, setNoPaymentAtAll] = useState(
    initialPayment?.no_payment_at_all || false,
  );
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    initialPayment?.method || "",
  );
  const [paidAmount, setPaidAmount] = useState<number>(
    initialPayment?.paid_amount || 0,
  );
  const [paidDate, setPaidDate] = useState<string | null>(
    initialPayment?.paid_date
      ? new Date(initialPayment.paid_date).toISOString().split("T")[0]
      : null,
  );
  const invoiceRef = useRef<HTMLDivElement | null>(null);
  const isCreatingRef = useRef(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName || "");
  const [companyAddress, setCompanyAddress] = useState<string>(initialCompanyAddress || "");
  const [companyPhone, setCompanyPhone] = useState<string>(initialCompanyPhone || "");
  const [companyEmail, setCompanyEmail] = useState<string>(initialCompanyEmail || "");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [requestCustomerSignature, setRequestCustomerSignature] =
    useState(false);
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal" | "letter">(
    "a4",
  );

  const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [todayStr, setTodayStr] = useState(getToday());
  const [paymentSeed, setPaymentSeed] = useState<{
    amount: number;
    method: string;
    date: string;
  }>(() => ({
    amount: initialPayment?.paid_amount || total,
    method: initialPayment?.method || "",
    date: initialPayment?.paid_date
      ? new Date(initialPayment.paid_date).toISOString().split("T")[0]
      : getToday(),
  }));

  useEffect(() => {
    setPaidAmount(initialPayment?.paid_amount || 0);
    setPaymentMethod(initialPayment?.method || "");
    setPaidDate(initialPayment?.paid_date
      ? new Date(initialPayment.paid_date).toISOString().split("T")[0]
      : null);
    setNoPaymentAtAll(initialPayment?.no_payment_at_all || false);
    
    // Also update payment seed
    setPaymentSeed({
      amount: initialPayment?.paid_amount || total,
      method: initialPayment?.method || "",
      date: initialPayment?.paid_date
        ? new Date(initialPayment.paid_date).toISOString().split("T")[0]
        : getToday(),
    });
  }, [initialPayment, total]);

  const loadBranding = async (force = false) => {
    if (force) {
      brandingCache = null;
      brandingInFlight = null;
    }
    try {
      // Check localStorage first
      const cachedLogo =
        typeof window !== "undefined" ? localStorage.getItem("companyLogo") : null;
      const cachedSignature =
        typeof window !== "undefined"
          ? localStorage.getItem("invoiceSignature")
          : null;
      const cachedName =
        typeof window !== "undefined" ? localStorage.getItem("companyName") : null;
      const cachedAddress =
        typeof window !== "undefined"
          ? localStorage.getItem("companyAddress")
          : null;
      const cachedPhone =
        typeof window !== "undefined"
          ? localStorage.getItem("companyPhone")
          : null;
      const cachedEmail =
        typeof window !== "undefined"
          ? localStorage.getItem("companyEmail")
          : null;

      // Set cached values if available
      if (cachedLogo) setCompanyLogo(cachedLogo);
      if (cachedSignature) setSignatureImage(cachedSignature);
      if (cachedAddress) setCompanyAddress(cachedAddress);
      if (cachedName) setCompanyName(cachedName);
      if (cachedPhone) setCompanyPhone(cachedPhone);
      if (cachedEmail) setCompanyEmail(cachedEmail);

      let data: BrandingPayload;

      if (brandingCache) {
        data = brandingCache;
      } else {
        if (!brandingInFlight) {
          brandingInFlight = (async () => {
            const locale =
              typeof window !== "undefined"
                ? window.location.pathname.split("/")[1]
                : "";
            const res = await fetch(`/${locale || ""}/api/configuration/assets`);
            const payload = await res.json();
            if (!res.ok) {
              throw new Error("Failed to fetch branding assets");
            }

            return {
              companyLogo: payload.companyLogo || null,
              signatureImage: payload.signatureImage || null,
              companyAddress: payload.companyAddress || "",
              companyName: payload.companyName || "",
              companyPhone: payload.companyPhone || "",
              companyEmail: payload.companyEmail || "",
            };
          })().finally(() => {
            brandingInFlight = null;
          });
        }

        data = await brandingInFlight;
        brandingCache = data;
      }

      const logo = data.companyLogo || null;
      const sig = data.signatureImage || null;
      const addr = data.companyAddress || "";
      const name = data.companyName || "";
      const phone = data.companyPhone || "";
      const email = data.companyEmail || "";

      // Update state with API data
      setCompanyLogo(logo);
      setSignatureImage(sig);
      setCompanyAddress(addr || initialCompanyAddress || "");
      setCompanyName(name || initialCompanyName || "");
      setCompanyPhone(phone || initialCompanyPhone || "");
      setCompanyEmail(email || initialCompanyEmail || "");

      // Update localStorage cache
      if (logo) localStorage.setItem("companyLogo", logo);
      else localStorage.removeItem("companyLogo");

      if (sig) localStorage.setItem("invoiceSignature", sig);
      else localStorage.removeItem("invoiceSignature");

      if (addr) localStorage.setItem("companyAddress", addr);
      else localStorage.removeItem("companyAddress");

      if (name) localStorage.setItem("companyName", name);
      else localStorage.removeItem("companyName");

      if (phone) localStorage.setItem("companyPhone", phone);
      else localStorage.removeItem("companyPhone");

      if (email) localStorage.setItem("companyEmail", email);
      else localStorage.removeItem("companyEmail");
    } catch (err) {
      console.error("branding fetch failed", err);
    }
  };

  useEffect(() => {
    loadBranding(true); // Force fresh load on mount to avoid stale data from other pages

    const handleUpdate = () => {
      loadBranding();
    };
    window.addEventListener("companyDetailsUpdated", handleUpdate);
    return () => {
      window.removeEventListener("companyDetailsUpdated", handleUpdate);
    };
  }, []);

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    const mod = await import("html2pdf.js");
    const html2pdf = mod.default || mod;

    let opt: any;

    switch (printFormat) {
      case "thermal":
        // Thermal printer (80mm width, common for receipts)
        opt = {
          margin: 5,
          filename: `${invoiceNo || "preview"}_receipt.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 1.5 },
          jsPDF: { unit: "mm", format: [80, 297], orientation: "portrait" },
        };
        break;
      case "letter":
        // US Letter size
        opt = {
          margin: 10,
          filename: `${invoiceNo || "preview"}_letter.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
        };
        break;
      case "a4":
      default:
        // A4 size (default)
        opt = {
          margin: 10,
          filename: `${invoiceNo || "preview"}_a4.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };
        break;
    }

    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  const handlePrintInvoice = async () => {
    if (!invoiceRef.current || typeof window === "undefined") return;

    try {
      const html2canvas = (await import("html2canvas")).default;

      // Determine dimensions based on selected print format
      let windowWidth: number;
      let scale: number;

      switch (printFormat) {
        case "thermal":
          // 80mm width (approximately 226 pixels at 72 dpi)
          windowWidth = 226;
          scale = 1.5;
          break;
        case "letter":
          // 8.5 inches (612 pixels)
          windowWidth = 612;
          scale = 2;
          break;
        case "a4":
        default:
          // A4 width (approximately 794 pixels at 96 dpi)
          windowWidth = 794;
          scale = 2;
          break;
      }

      // Capture invoice with format-specific dimensions
      const canvas = await html2canvas(invoiceRef.current, {
        scale: scale,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: windowWidth,
      });

      const imageData = canvas.toDataURL("image/png");

      // Create hidden iframe for printing
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        return;
      }

      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${invoiceNo || "Invoice"}</title>
            <style>
              @page { margin: 0; }
              body { margin: 10mm; padding: 0; background: white; }
              img { max-width: 100%; height: auto; display: block; }
            </style>
          </head>
          <body>
            <img src="${imageData}" />
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for content to render, then trigger print
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Remove iframe after a delay
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 300);
    } catch (error) {
      console.error("Print error:", error);
    }
  };

  const remainingBalance = Math.max(0, total - paidAmount);

  const isPaymentMade = paidAmount > 0;

  const newPaymentSeed = {
    amount: remainingBalance || total,
    method: paymentMethod,
    date: todayStr || saleDate || "",
  };
  const editPaymentSeed = {
    amount: paidAmount || total,
    method: paymentMethod,
    date: paidDate || todayStr || saleDate || "",
  };

  // Common disabled condition for all action buttons
  const isActionDisabled = !(isPaymentMade || noPaymentAtAll) || isCreatingOrder;

  return (
    <React.Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto overflow-x-hidden w-[95vw] sm:w-full ${
            printFormat === "thermal" ? "max-w-3xl" : "max-w-4xl"
          } p-3 sm:p-6 transition-all duration-300`}
        >
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {t("invoicePreview")}
            </DialogTitle>
          </DialogHeader>

          <div
            className={
              hidePaymentActions
                ? "flex flex-col gap-4"
                : "flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6"
            }
          >
            <div
              className={
                hidePaymentActions 
                  ? "w-full overflow-x-auto" 
                  : "lg:col-span-2 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar max-w-full"
              }
            >
              <div className={`md:min-w-0 inline-block w-full transition-all duration-300 ${printFormat === 'thermal' ? 'max-w-[320px] mx-auto block' : ''}`}>
                <InvoicePreview
                  ref={invoiceRef}
                  invoiceNo={invoiceNo}
                  customer={customer}
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
                  companyAddress={companyAddress}
                  companyPhone={companyPhone}
                  companyEmail={companyEmail}
                  customerNotes={customerNotes}
                  printFormat={printFormat}
                />
              </div>
            </div>

            {hidePaymentActions ? (
              <div className="flex flex-col gap-3 sm:gap-4 pt-2 sm:pt-4">
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-xs sm:text-sm font-medium">
                    {t("printFormat")}
                  </Label>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="printFormat"
                        value="a4"
                        checked={printFormat === "a4"}
                        onChange={(e) => setPrintFormat("a4")}
                        className="w-4 h-4"
                      />
                      <span className="text-xs sm:text-sm">
                        {t("a4SizeStandard")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="printFormat"
                        value="thermal"
                        checked={printFormat === "thermal"}
                        onChange={(e) => setPrintFormat("thermal")}
                        className="w-3 h-3 sm:w-4 sm:h-4"
                      />
                      <span className="text-xs sm:text-sm">
                        {t("thermalReceipt80mm")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="printFormat"
                        value="letter"
                        checked={printFormat === "letter"}
                        onChange={(e) => setPrintFormat("letter")}
                        className="w-3 h-3 sm:w-4 sm:h-4"
                      />
                      <span className="text-xs sm:text-sm">
                        {t("letterSizeUS")}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Party Signature Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs sm:text-sm font-bold text-slate-700">Party Signature</Label>
                    <p className="text-[10px] text-muted-foreground italic">Show &quot;Sign Here&quot; box for customer</p>
                  </div>
                  <Switch 
                    checked={requestCustomerSignature} 
                    onCheckedChange={setRequestCustomerSignature}
                  />
                </div>
                
                {/* UPDATED: Smaller buttons with consistent sizing */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handlePrintInvoice}
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] h-8"
                    disabled={isCreatingOrder}
                  >
                    <Printer className="h-3 w-3 mr-1.5" />
                    {tCommon("print")}
                  </Button>
                  <Button
                    onClick={handleDownloadPdf}
                    variant="default"
                    size="sm"
                    className="w-full text-[11px] h-8"
                    disabled={isCreatingOrder}
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    {t("downloadInvoice")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-1">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between px-1 gap-2 sm:gap-3">
                    <Label className="text-xs sm:text-sm">
                      {t("includeSignatureInInvoice")}
                    </Label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeSignature}
                      onClick={() => setIncludeSignature((v) => !v)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors ${includeSignature ? "bg-primary" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-white shadow transform transition-transform ${includeSignature ? "translate-x-4 sm:translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1 gap-2 sm:gap-3">
                    <Label className="text-xs sm:text-sm">
                      {t("requestCustomerSignature")}
                    </Label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={requestCustomerSignature}
                      onClick={() => setRequestCustomerSignature((v) => !v)}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors ${requestCustomerSignature ? "bg-primary" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-white shadow transform transition-transform ${requestCustomerSignature ? "translate-x-4 sm:translate-x-5" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Payment Details</Label>
                    {!noPaymentAtAll && (
                      isPaymentMade ? (
                        <Button
                          onClick={() => {
                            setPaymentSeed(editPaymentSeed);
                            setPaymentDialogOpen(true);
                          }}
                          className="w-full"
                          variant="outline"
                        >
                          {t("editPayment")}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setPaymentSeed(newPaymentSeed);
                            setNoPaymentAtAll(false);
                            setPaymentDialogOpen(true);
                          }}
                          className="w-full"
                          variant="default"
                        >
                          Make Payment
                        </Button>
                      )
                    )}
                    <div className="flex items-center gap-2 px-2 pt-1">
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
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded"
                      />
                      <label
                        htmlFor="no-payment"
                        className="text-xs sm:text-sm cursor-pointer"
                      >
                        {t("noPaymentAtAll")}
                      </label>
                    </div>
                  </div>

                  <div>
                    <Button
                      onClick={async () => {
                        if (isCreatingRef.current || isCreatingOrder) return;
                        isCreatingRef.current = true;
                        try {
                          await onCreateOrder({
                            paymentMethod,
                            paidAmount,
                            paidDate,
                            noPaymentAtAll,
                          });
                        } finally {
                          isCreatingRef.current = false;
                        }
                      }}
                      variant="default"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled={isActionDisabled}
                    >
                      {isCreatingOrder ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("creatingOrder")}
                        </>
                      ) : (
                        t("createOrder")
                      )}
                    </Button>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="space-y-2 mb-3">
                      <Label className="text-xs font-medium">
                        {t("printFormat")}
                      </Label>
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="printFormat"
                            value="a4"
                            checked={printFormat === "a4"}
                            onChange={(e) => setPrintFormat("a4")}
                            className="w-3 h-3"
                          />
                          <span className="text-xs flex items-center gap-1.5">{t("a4Size")}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="printFormat"
                            value="thermal"
                            checked={printFormat === "thermal"}
                            onChange={(e) => setPrintFormat("thermal")}
                            className="w-3 h-3"
                          />
                          <span className="text-xs flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                            {t("thermalReceipt")}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="printFormat"
                            value="letter"
                            checked={printFormat === "letter"}
                            onChange={(e) => setPrintFormat("letter")}
                            className="w-3 h-3"
                          />
                          <span className="text-xs flex items-center gap-1.5">{t("letterSize")}</span>
                        </label>
                      </div>
                    </div>
                    
                    {/* UPDATED: Smaller buttons with consistent sizing */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handlePrintInvoice}
                        variant="outline"
                        size="sm"
                        className="w-24 text-[11px] h-8"
                        disabled={isCreatingOrder}
                      >
                        <Printer className="h-3 w-3 mr-1.5" />
                        {tCommon("print")}
                      </Button>
                      <Button
                        onClick={handleDownloadPdf}
                        variant="outline"
                        size="sm"
                        className="w-24 text-[11px] h-8"
                        disabled={isCreatingOrder}
                      >
                        <Download className="h-3 w-3 mr-1.5" />
                        {t("downloadInvoice")}
                      </Button>
                    </div>
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