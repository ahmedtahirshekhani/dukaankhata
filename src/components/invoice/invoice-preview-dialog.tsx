"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import { db } from "@/lib/db/offline-db";

export const normalizeWhatsAppNumber = (phone?: string) => {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0") && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("3")) {
    digits = `92${digits}`;
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  return digits;
};

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
  onWhatsApp?: () => Promise<void> | void;
  isSendingWhatsApp?: boolean;
  disableWhatsApp?: boolean;
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
  onWhatsApp,
  isSendingWhatsApp = false,
  disableWhatsApp = false,
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
    "thermal",
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [internalSendingWhatsApp, setInternalSendingWhatsApp] = useState(false);
  const isSendingWhatsAppFinal = isSendingWhatsApp || internalSendingWhatsApp;
  const [zoomLevel, setZoomLevel] = useState(0.65);

  useEffect(() => {
    const updateZoom = () => {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 768) {
          // On mobile, zoom out based on screen width (subtract padding)
          const targetW = printFormat === 'letter' ? 816 : 794;
          setZoomLevel((window.innerWidth - 24) / targetW);
        } else {
          setZoomLevel(0.65); // standard desktop zoom
        }
      }
    };
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [printFormat, open]);

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
      const tenantInfo = typeof window !== "undefined" ? localStorage.getItem("tenant_info") : null;
      const wsId = tenantInfo ? JSON.parse(tenantInfo).userId : "";

      // Check localStorage first
      const cachedLogo =
        typeof window !== "undefined" ? localStorage.getItem(`companyLogo_${wsId}`) : null;
      const cachedSignature =
        typeof window !== "undefined"
          ? localStorage.getItem(`invoiceSignature_${wsId}`)
          : null;
      const cachedName =
        typeof window !== "undefined" ? localStorage.getItem(`companyName_${wsId}`) : null;
      const cachedAddress =
        typeof window !== "undefined"
          ? localStorage.getItem(`companyAddress_${wsId}`)
          : null;
      const cachedPhone =
        typeof window !== "undefined"
          ? localStorage.getItem(`companyPhone_${wsId}`)
          : null;
      const cachedEmail =
        typeof window !== "undefined"
          ? localStorage.getItem(`companyEmail_${wsId}`)
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
      if (logo) localStorage.setItem(`companyLogo_${wsId}`, logo);
      else localStorage.removeItem(`companyLogo_${wsId}`);

      if (sig) localStorage.setItem(`invoiceSignature_${wsId}`, sig);
      else localStorage.removeItem(`invoiceSignature_${wsId}`);

      if (addr) localStorage.setItem(`companyAddress_${wsId}`, addr);
      else localStorage.removeItem(`companyAddress_${wsId}`);

      if (name) localStorage.setItem(`companyName_${wsId}`, name);
      else localStorage.removeItem(`companyName_${wsId}`);

      if (phone) localStorage.setItem(`companyPhone_${wsId}`, phone);
      else localStorage.removeItem(`companyPhone_${wsId}`);

      if (email) localStorage.setItem(`companyEmail_${wsId}`, email);
      else localStorage.removeItem(`companyEmail_${wsId}`);
    } catch (err) {
      console.error("branding fetch failed", err);
    }
  };

  useEffect(() => {
    loadBranding(); // Use localStorage for immediate display, then background fetch

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
    setIsDownloading(true);
    // Wait a tick for the DOM to update so zoom is removed
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
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
            html2canvas: { scale: 2, windowWidth: 320 },
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

      await html2pdf().set(opt).from(invoiceRef.current).save();
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const [resolvedPhone, setResolvedPhone] = useState<string>(() => {
    return customer?.phone || (customer as any)?.phone_number || (customer as any)?.mobile || (customer as any)?.whatsapp || "";
  });

  useEffect(() => {
    let active = true;
    const directPhone = customer?.phone || (customer as any)?.phone_number || (customer as any)?.mobile || (customer as any)?.whatsapp || "";
    if (directPhone) {
      setResolvedPhone(directPhone);
      return;
    }

    const fetchParty = async () => {
      try {
        const partyId = (customer as any)?.id || (customer as any)?._id || (customer as any)?.customer_id;
        if (partyId) {
          const p = await db.parties.get(partyId.toString());
          if (active && p?.phone) {
            setResolvedPhone(p.phone);
            return;
          }
        }
        if (customer?.name) {
          const parties = await db.parties
            .filter((p) => Boolean(p.name && p.name.toLowerCase() === customer.name.toLowerCase() && p.is_delete !== 1))
            .toArray();
          if (active && parties.length > 0 && parties[0].phone) {
            setResolvedPhone(parties[0].phone);
          }
        }
      } catch (err) {
        console.error("Failed to fetch party phone:", err);
      }
    };

    fetchParty();

    return () => {
      active = false;
    };
  }, [customer, open]);

  const targetWhatsAppPhone = normalizeWhatsAppNumber(resolvedPhone);

  const handleDefaultWhatsApp = async () => {
    if (!invoiceRef.current) return;

    // 1. Resolve phone number directly and with DB fallback
    let rawPhone = resolvedPhone || customer?.phone || (customer as any)?.phone_number || (customer as any)?.mobile || (customer as any)?.whatsapp || "";
    let normalized = normalizeWhatsAppNumber(rawPhone);

    if (!normalized) {
      try {
        const partyId = (customer as any)?.id || (customer as any)?._id || (customer as any)?.customer_id;
        if (partyId) {
          const p = await db.parties.get(partyId.toString());
          if (p?.phone) {
            rawPhone = p.phone;
            normalized = normalizeWhatsAppNumber(p.phone);
            setResolvedPhone(p.phone);
          }
        }
        if (!normalized && customer?.name) {
          const parties = await db.parties
            .filter((p) => Boolean(p.name && p.name.toLowerCase() === customer.name.toLowerCase() && p.is_delete !== 1))
            .toArray();
          if (parties.length > 0 && parties[0].phone) {
            rawPhone = parties[0].phone;
            normalized = normalizeWhatsAppNumber(parties[0].phone);
            setResolvedPhone(parties[0].phone);
          }
        }
      } catch (err) {
        console.error("Party phone lookup error:", err);
      }
    }

    if (!normalized) {
      toast.error(
        t("whatsappMissingPartyNotice") ||
          "Is customer ka WhatsApp number add nahi hai. Pehle Party page se WhatsApp number add karein."
      );
      return;
    }

    const message = t("whatsappOrderMessage", {
      customerName: customer?.name || t("customer") || "Customer",
      invoiceNo: invoiceNo || "",
      currency: t("currencySymbol") || "Rs.",
      total: Math.floor(total || 0),
    });

    const whatsappUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp chat directly
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    // Generate & download PDF
    setInternalSendingWhatsApp(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      let opt: any;
      switch (printFormat) {
        case "thermal":
          opt = {
            margin: 5,
            filename: `${invoiceNo || "invoice"}_receipt.pdf`,
            image: { type: "jpeg", quality: 0.95 },
            html2canvas: { scale: 2, windowWidth: 320 },
            jsPDF: { unit: "mm", format: [80, 297], orientation: "portrait" },
          };
          break;
        case "letter":
          opt = {
            margin: 10,
            filename: `${invoiceNo || "invoice"}_letter.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
          };
          break;
        case "a4":
        default:
          opt = {
            margin: 10,
            filename: `${invoiceNo || "invoice"}_a4.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          };
          break;
      }

      await html2pdf().set(opt).from(invoiceRef.current).save();

      toast.success(
        t("whatsappPdfNotice") ||
          "PDF download ho gaya hai aur WhatsApp open ho gaya hai. Chat mein PDF attach karke send kar dein!"
      );
    } catch (err) {
      console.error("WhatsApp PDF download failed:", err);
    } finally {
      setInternalSendingWhatsApp(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!invoiceRef.current || typeof window === "undefined") return;

    setIsPrinting(true);
    // Wait a tick for the DOM to update so zoom is removed
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const html2canvas = (await import("html2canvas")).default;

      // Determine dimensions based on selected print format
      let windowWidth: number;
      let scale: number;

      switch (printFormat) {
        case "thermal":
          // 80mm width (approximately 302 pixels at 96 dpi)
          windowWidth = 320;
          scale = 2;
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

      // Calculate physical height in mm based on width
      const imgWidthMm = printFormat === "thermal" ? 80 : (printFormat === "letter" ? 215.9 : 210);
      const pxPerMm = canvas.width / imgWidthMm;
      const imgHeightMm = Math.ceil(canvas.height / pxPerMm);

      let pageCss = '';
      let imgCss = '';
      if (printFormat === "thermal") {
        pageCss = `@page { margin: 0mm !important; size: 80mm ${imgHeightMm}mm; }`;
        imgCss = `width: 80mm !important; max-width: 100%; margin: 0;`;
      } else if (printFormat === "letter") {
        pageCss = `@page { margin: 0mm !important; size: letter portrait; }`;
        imgCss = `width: calc(100% - 20mm); margin: 0 auto;`;
      } else {
        pageCss = `@page { margin: 0mm !important; size: A4 portrait; }`;
        imgCss = `width: calc(100% - 20mm); margin: 0 auto;`;
      }

      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${invoiceNo || "Invoice"}</title>
            <style>
              @media print {
                ${pageCss}
                body { margin: 0 !important; padding: 0 !important; background: white; }
                img { 
                  ${imgCss}
                  height: auto; 
                  display: block; 
                  break-inside: auto;
                  page-break-inside: auto;
                  break-before: avoid;
                  page-break-before: avoid;
                }
              }
              /* Screen styles (just in case) */
              body { margin: 0; background: white; }
              img { ${imgCss} height: auto; display: block; }
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
    } finally {
      setIsPrinting(false);
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
          className={`max-h-[90vh] overflow-y-auto overflow-x-hidden w-[95vw] sm:w-full ${printFormat === "thermal" ? "max-w-3xl" : "max-w-4xl"
            } p-3 sm:p-6 transition-all duration-300`}
        >
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {t("invoicePreview")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="lg:col-span-2 overflow-auto pb-4 custom-scrollbar max-w-full flex justify-center w-full">
              <div
                className="transition-all duration-300 origin-top"
                style={{
                  width: printFormat === 'thermal' ? '100%' : (printFormat === 'letter' ? '816px' : '794px'),
                  maxWidth: printFormat === 'thermal' ? '320px' : 'none',
                  minWidth: printFormat === 'thermal' ? '0' : (printFormat === 'letter' ? '816px' : '794px'),
                  zoom: (isPrinting || isDownloading || internalSendingWhatsApp) ? 1 : (printFormat === 'thermal' ? 1 : zoomLevel),
                }}
              >
                <InvoicePreview
                  ref={invoiceRef}
                  invoiceNo={invoiceNo}
                  customer={{
                    ...customer,
                    phone: resolvedPhone || customer?.phone,
                  }}
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
                  isScreen={!(isPrinting || isDownloading || internalSendingWhatsApp)}
                />
              </div>
            </div>

            <div className="space-y-4 lg:space-y-6">
              {hidePaymentActions ? (
                <div className="flex flex-col gap-3 sm:gap-4">
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
                          {t("letterSizeUS") || "Letter Size (US)"}
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
                      disabled={isPrinting || isCreatingOrder}
                    >
                      {isPrinting ? (
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      ) : (
                        <Printer className="h-3 w-3 mr-1.5" />
                      )}
                      {tCommon("print")}
                    </Button>
                    <Button
                      onClick={handleDownloadPdf}
                      variant="default"
                      size="sm"
                      className="w-full text-[11px] h-8"
                      disabled={isDownloading || isCreatingOrder}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1.5" />
                      )}
                      {t("downloadInvoice")}
                    </Button>
                  </div>
                  <Button
                    onClick={onWhatsApp || handleDefaultWhatsApp}
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] h-8 mt-2"
                    disabled={isSendingWhatsAppFinal || disableWhatsApp}
                  >
                    {isSendingWhatsAppFinal ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        {t("sendInvoicePdfOnWhatsApp")}
                      </span>
                    )}
                  </Button>
                  {!onWhatsApp && !targetWhatsAppPhone && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 text-center font-medium leading-tight">
                      ⚠️ {t("whatsappMissingPartyNotice") || "Is customer ka WhatsApp number add nahi hai. Pehle Party page se add karein."}
                    </p>
                  )}
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
                          className="w-full text-[11px] h-8"
                          disabled={isPrinting}
                        >
                          {isPrinting ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          ) : (
                            <Printer className="h-3 w-3 mr-1.5" />
                          )}
                          {tCommon("print")}
                        </Button>
                        <Button
                          onClick={handleDownloadPdf}
                          variant="outline"
                          size="sm"
                          className="w-full text-[11px] h-8"
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3 mr-1.5" />
                          )}
                          {t("downloadInvoice")}
                        </Button>
                      </div>
                      <Button
                        onClick={onWhatsApp || handleDefaultWhatsApp}
                        variant="outline"
                        size="sm"
                        className="w-full text-[11px] h-8 mt-2"
                        disabled={isSendingWhatsAppFinal || disableWhatsApp}
                      >
                        {isSendingWhatsAppFinal ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            {t("sendInvoicePdfOnWhatsApp")}
                          </span>
                        )}
                      </Button>
                      {!onWhatsApp && !targetWhatsAppPhone && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 text-center font-medium leading-tight">
                          ⚠️ {t("whatsappMissingPartyNotice") || "Is customer ka WhatsApp number add nahi hai. Pehle Party page se add karein."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 sm:mt-0 flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {tCommon("close") || "Close"}
            </Button>
          </DialogFooter>
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