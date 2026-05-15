// "use client";

// import React, { forwardRef } from "react";
// import { useTranslations } from "next-intl";
// import { Card } from "@/components/ui/card";
// import {
//   calculateDiscountValue,
//   calculateLineTotal,
// } from "@/lib/invoice/calculations";
// import { formatCurrencyString } from "@/lib/utils";
// import { Mail, Phone } from "lucide-react";

// export interface InvoiceProduct {
//   id: number | string;
//   name: string;
//   description?: string;
//   quantity: number;
//   quantityType?: "prime" | "damaged";
//   sell_price: number;
//   unit_of_measurement?: string;
//   discount?: number;
//   discountType?: "value" | "percentage";
// }

// export interface InvoiceCharge {
//   item: string;
//   value: number;
// }

// export interface InvoicePreviewProps {
//   invoiceNo: string;
//   customer: {
//     name: string;
//     email?: string;
//     phone?: string;
//     company_name?: string;
//     company_address?: string;
//     address?: string;
//   };
//   saleDate: string;
//   dueDate: string | null;
//   products: InvoiceProduct[];
//   subtotal: number;
//   charges: InvoiceCharge[];
//   overallDiscount?: number;
//   shippingCharges?: number;
//   total: number;
//   noPaymentAtAll: boolean;
//   paidAmount: number;
//   paidDate: string | null;
//   companyLogo?: string | null;
//   signatureImage?: string | null;
//   includeSignature?: boolean;
//   requestCustomerSignature?: boolean;
//   companyName?: string;
//   companyAddress?: string;
//   companyPhone?: string;
//   companyEmail?: string;
//   customerNotes?: string;
//   printFormat?: "a4" | "thermal" | "letter";
// }

// const formatDateLong = (dateStr: string) => {
//   if (!dateStr) return "";
//   const date = new Date(dateStr);
//   if (isNaN(date.getTime())) return dateStr;
//   return date.toLocaleDateString(undefined, {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });
// };

// const formatDateShort = (dateStr: string) => {
//   if (!dateStr) return "";
//   const date = new Date(dateStr);
//   if (isNaN(date.getTime())) return dateStr;
//   return date.toLocaleDateString(undefined, {
//     year: "numeric",
//     month: "long",
//     day: "2-digit",
//   });
// };

// const formatUom = (uom?: string) =>
//   uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";

// const truncateDescription = (desc?: string, limit = 100) => {
//   if (!desc) return "";
//   return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
// };

// // SVG Icons that work in print/PDF
// const PhoneIcon = () => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width="14"
//     height="14"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', marginBottom: '2px' }}
//   >
//     <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
//   </svg>
// );

// const MailIcon = () => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width="14"
//     height="14"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', marginBottom: '2px' }}
//   >
//     <rect width="20" height="16" x="2" y="4" rx="2" />
//     <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
//   </svg>
// );

// export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
//   (
//     {
//       invoiceNo,
//       customer,
//       saleDate,
//       dueDate,
//       products,
//       subtotal,
//       charges,
//       overallDiscount = 0,
//       shippingCharges = 0,
//       total,
//       noPaymentAtAll,
//       paidAmount,
//       paidDate,
//       companyLogo,
//       signatureImage,
//       includeSignature = true,
//       requestCustomerSignature = false,
//       companyName,
//       companyAddress,
//       companyPhone,
//       companyEmail,
//       customerNotes = "",
//       printFormat = "a4",
//     },
//     ref,
//   ) => {
//     const t = useTranslations("invoice");
//     const remainingBalance = Math.max(0, total - paidAmount);

//     // Format-specific styling
//     const isThermal = printFormat === "thermal";
//     const cardPadding = isThermal ? "p-3" : "p-6";
//     const headerTextSize = isThermal ? "text-lg" : "text-2xl";
//     const textSize = isThermal ? "text-xs" : "text-sm";
//     const fontBoldSize = isThermal ? "text-sm" : "text-lg";
//     const logoHeight = isThermal ? "h-10" : "h-16";
//     const signatureHeight = isThermal ? "h-12" : "h-20";
//     const gridCols = isThermal ? "grid-cols-1" : "grid-cols-2";

//     return (
//       <div ref={ref}>
//         <Card className={cardPadding}>
//           {/* Paper Body */}

//           <div className="mb-6 border-b pb-6">
//             <div className="flex justify-between items-start gap-4">
//               {/* Logo - Left */}
//               <div className="flex-1">
//                 {companyLogo && (
//                   <img
//                     src={companyLogo}
//                     alt="Company Logo"
//                     className={`${logoHeight} w-auto object-contain`}
//                   />
//                 )}
//               </div>

//               {/* Company Info - Center */}
//               <div className="flex-[2] text-center space-y-1">
//                 {/* Company Info - Center */}
//                 <div className="flex-[2] text-center space-y-1">
//                   {companyName && (
//                     <h1 className={`${headerTextSize} font-black text-slate-900 uppercase tracking-tight`}>
//                       {companyName}
//                     </h1>
//                   )}
//                   {companyAddress && (
//                     <p className={`${textSize} text-slate-600 whitespace-pre-line leading-relaxed`}>
//                       {companyAddress}
//                     </p>
//                   )}
//                   {(companyPhone || companyEmail) && (
//                     <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '24px', marginTop: '4px' }} className={`${textSize} text-slate-500`}>
//                       {companyPhone && (
//                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
//                           <span style={{ fontSize: '13px', lineHeight: 1 }}>&#9742;</span>
//                           <span style={{ fontVariantNumeric: 'tabular-nums' }}>{companyPhone}</span>
//                         </span>
//                       )}
//                       {companyEmail && (
//                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
//                           <span style={{ fontSize: '13px', lineHeight: 1 }}>✉</span>
//                           <span style={{ textTransform: 'lowercase' }}>{companyEmail}</span>
//                         </span>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Document Title - Right */}
//               <div className="flex-1 text-right">
//                 <h2 className={`${headerTextSize} font-black text-slate-900 uppercase tracking-tighter`}>
//                   {t("invoiceTitle")}
//                 </h2>
//               </div>
//             </div>
//           </div>

//           <div className="mb-6">
//             <div className={`grid ${gridCols} gap-4 ${textSize}`}>
//               <div>
//                 <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">{t("customerDetails")}</p>
//                 <div className="space-y-0.5">
//                   <p className="font-bold text-slate-900">{customer.name}</p>
//                   {(customer.company_name) && (
//                     <p className="text-slate-700 font-medium">{customer.company_name}</p>
//                   )}
//                   {(customer.company_address || customer.address) && (
//                     <p className="text-slate-600 text-[10px] leading-tight italic">
//                       {customer.company_address || customer.address}
//                     </p>
//                   )}
//                   {customer.phone && (
//                     <p className="text-slate-600">{customer.phone}</p>
//                   )}
//                   {customer.email && (
//                     <p className="text-slate-600">{customer.email}</p>
//                   )}
//                 </div>
//               </div>
//               <div className="space-y-1 text-right">
//                 <div className="flex justify-end gap-4">
//                   <span className="text-slate-500">{t("invoiceNoLabel")}:</span>
//                   <span className="font-bold">{invoiceNo}</span>
//                 </div>
//                 <div className="flex justify-end gap-4">
//                   <span className="text-slate-500">{t("invoiceDate")}:</span>
//                   <span className="font-bold">{formatDateShort(saleDate)}</span>
//                 </div>
//                 {dueDate && (
//                   <div className="flex justify-end gap-4 text-destructive">
//                     <span className="font-medium">{t("dueDate")}:</span>
//                     <span className="font-bold">{formatDateShort(dueDate)}</span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div className="mb-6">
//             <table className={`w-full ${textSize}`}>
//               <thead className="border-b">
//                 <tr>
//                   <th className="text-left py-2">{t("item")}</th>
//                   {!isThermal && (
//                     <th className="text-right py-2">{t("sellPrice")}</th>
//                   )}
//                   <th className="text-right py-2">{t("qty")}</th>
//                   {!isThermal && (
//                     <th className="text-right py-2">{t("uom")}</th>
//                   )}
//                   {!isThermal && (
//                     <th className="text-right py-2">{t("discount")}</th>
//                   )}
//                   <th className="text-right py-2">{t("total")}</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {products.map((product) => {
//                   const discountValue = calculateDiscountValue(product);
//                   const lineTotal = calculateLineTotal(product);
//                   return (
//                     <tr key={product.id} className="border-b">
//                       <td className="py-2">
//                         <div>
//                           <div className="font-medium">{product.name}</div>
//                           {product.description && (
//                             <div className="text-xs text-gray-500 mt-0.5">
//                               {truncateDescription(product.description)}
//                             </div>
//                           )}
//                         </div>
//                       </td>
//                       {!isThermal && (
//                         <td className="text-right">
//                           {formatCurrencyString(product.sell_price)}
//                         </td>
//                       )}
//                       <td className="text-right">
//                         {product.quantityType === "damaged" && (
//                           <span className="text-xs font-normal text-gray-500">
//                             (damaged){" "}
//                           </span>
//                         )}
//                         {product.quantity}
//                       </td>
//                       {!isThermal && (
//                         <td className="text-right">
//                           {formatUom(product.unit_of_measurement)}
//                         </td>
//                       )}
//                       {!isThermal && (
//                         <td className="text-right">
//                           {discountValue > 0
//                             ? formatCurrencyString(discountValue)
//                             : "-"}
//                         </td>
//                       )}
//                       <td className="text-right">
//                         {formatCurrencyString(lineTotal)}
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>

//           <div className="border-t pt-4 space-y-2">
//             <div className={`flex justify-between ${textSize}`}>
//               <span>Sub Total:</span>
//               <span>{formatCurrencyString(subtotal)}</span>
//             </div>

//             {overallDiscount > 0 && (
//               <div className={`flex justify-between ${textSize}`}>
//                 <span>Overall Discount:</span>
//                 <span>
//                   - {formatCurrencyString(Math.min(overallDiscount, subtotal))}
//                 </span>
//               </div>
//             )}

//             {shippingCharges > 0 && (
//               <div className={`flex justify-between ${textSize}`}>
//                 <span>{t("shippingCharges")}</span>
//                 <span>{formatCurrencyString(shippingCharges)}</span>
//               </div>
//             )}

//             {charges.length > 0 && (
//               <div className="space-y-1">
//                 {charges.map((charge, idx) => (
//                   <div key={idx} className={`flex justify-between ${textSize}`}>
//                     <span>{charge.item} :</span>
//                     <span>{formatCurrencyString(charge.value)}</span>
//                   </div>
//                 ))}
//               </div>
//             )}

//             <div
//               className={`flex justify-between font-bold ${fontBoldSize} border-t pt-2`}
//             >
//               <span>{t("total")} :</span>
//               <span>{formatCurrencyString(total)}</span>
//             </div>

//             <div className={`mt-4 text-right ${textSize} space-y-1`}>
//               {!noPaymentAtAll && paidAmount > 0 && (
//                 <div>
//                   <span className="font-medium">{t("paidOn")}</span>{" "}
//                   {paidDate ? formatDateLong(paidDate) : "—"} —{" "}
//                   {formatCurrencyString(paidAmount)}
//                 </div>
//               )}
//               <div>
//                 <span className="font-medium">{t("remainingBalance")}</span>{" "}
//                 {formatCurrencyString(remainingBalance)}
//               </div>
//             </div>

//             {customerNotes && (
//               <div className={`mt-6 text-sm text-muted-foreground border-l-2 border-primary/20 pl-4 py-1 bg-slate-50/50 rounded-r-lg max-w-md`}>
//                 <p className="font-bold text-slate-700 mb-1 text-[10px] uppercase tracking-wider">
//                   {t("customerNotes") || "Notes & Terms"}:
//                 </p>
//                 <p className="italic leading-relaxed whitespace-pre-line text-xs">
//                   {customerNotes}
//                 </p>
//               </div>
//             )}

//             {(signatureImage && includeSignature) ||
//               requestCustomerSignature ? (
//               <div
//                 className={`mt-10 flex ${isThermal ? "flex-col gap-4" : "justify-between items-end gap-6"}`}
//               >
//                 {signatureImage && includeSignature && (
//                   <div className="flex flex-col items-start gap-2">
//                     <img
//                       src={signatureImage}
//                       alt="Company Signature"
//                       className={`${signatureHeight} w-auto`}
//                     />
//                     <div className="w-40 border-t border-gray-300" />
//                     <span className="text-xs text-muted-foreground">
//                       {companyName}
//                     </span>
//                   </div>
//                 )}
//                 {requestCustomerSignature && (
//                   <div className="flex flex-col items-end gap-2 flex-1">
//                     <div
//                       className={`${signatureHeight} ${isThermal ? "w-full" : "w-48"} border-2 border-dashed border-gray-300 flex items-center justify-center rounded-lg`}
//                     >
//                       <span className="text-xs text-muted-foreground">
//                         {t("customerSignature")}
//                       </span>
//                     </div>
//                     <div className="w-40 border-t border-gray-300" />
//                     <span className="text-xs text-muted-foreground font-bold">
//                       {customer.name}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             ) : null}

//             {/* Computer Generated Disclaimer */}
//             <div className="mt-8 pt-4 border-t border-slate-100 text-center">
//               <p className="text-[10px] text-slate-400 italic">
//                 {t("computerGeneratedDisclaimer") || "This is a computer generated document from DukaanKhata.app"}
//               </p>
//             </div>
//           </div>
//         </Card>
//       </div>
//     );
//   },
// );

// InvoicePreview.displayName = "InvoicePreview";




"use client";

import React, { forwardRef } from "react";
import { useTranslations } from "next-intl";
import {
  calculateDiscountValue,
  calculateLineTotal,
} from "@/lib/invoice/calculations";
import { formatCurrencyString } from "@/lib/utils";

export interface InvoiceProduct {
  id: number | string;
  name: string;
  description?: string;
  quantity: number;
  quantityType?: "prime" | "damaged";
  sell_price: number;
  unit_of_measurement?: string;
  discount?: number;
  discountType?: "value" | "percentage";
}

export interface InvoiceCharge {
  item: string;
  value: number;
}

export interface InvoicePreviewProps {
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
  noPaymentAtAll: boolean;
  paidAmount: number;
  paidDate: string | null;
  companyLogo?: string | null;
  signatureImage?: string | null;
  includeSignature?: boolean;
  requestCustomerSignature?: boolean;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerNotes?: string;
  printFormat?: "a4" | "thermal" | "letter";
}

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

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const formatUom = (uom?: string) =>
  uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";

const truncateDescription = (desc?: string, limit = 25) => {
  if (!desc) return "";
  return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
};

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
      companyAddress,
      companyPhone,
      companyEmail,
      customerNotes = "",
      printFormat = "a4",
    },
    ref,
  ) => {
    const t = useTranslations("invoice");
    const remainingBalance = Math.max(0, total - paidAmount);
    const isThermal = printFormat === "thermal";

    // ─── Size tokens ────────────────────────────────────────────────────────────
    // All sizing via inline styles so html2canvas / print see identical values.
    const S = isThermal
      ? {
          outerPad: "12px",
          outerPadNum: 12,
          minHeight: "auto",       // Thermal has no fixed page height
          headerFontSize: "15px",
          textFontSize: "11px",
          boldFontSize: "13px",
          labelFontSize: "9px",
          logoH: "40px",
          sigH: "48px",
          sigW: "120px",
          headerGap: "8px",
          sectionGap: "12px",
        }
      : {
          outerPad: "24px",
          outerPadNum: 24,
          minHeight: "277mm",      // A4 / Letter — ensures footer sticks to bottom
          headerFontSize: "22px",
          textFontSize: "13px",
          boldFontSize: "16px",
          labelFontSize: "9px",
          logoH: "64px",
          sigH: "64px",
          sigW: "192px",
          headerGap: "16px",
          sectionGap: "24px",
        };

    return (
      /*
        OUTER DIV — the ref target that html2pdf / html2canvas captures.
        white background + border so it looks like a paper card.
      */
      <div
        ref={ref}
        className="invoice-preview-container"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          boxSizing: "border-box",
          width: "100%",
          position: "relative",
          margin: "0 auto",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 640px) {
            .invoice-a4-header {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              text-align: center !important;
              gap: 4px !important;
            }
            .invoice-a4-header td {
              display: block !important;
              width: 100% !important;
              text-align: center !important;
              padding: 0 !important;
            }
            .invoice-a4-header img {
              margin: 0 auto !important;
            }
            .invoice-title-cell {
              margin-top: 8px !important;
            }
            /* Stack Party and Invoice details on mobile as requested */
            .invoice-customer-meta {
              display: flex !important;
              flex-direction: column !important;
              gap: 16px !important;
            }
            .invoice-customer-meta td {
              display: block !important;
              width: 100% !important;
              padding-bottom: 0 !important;
              text-align: left !important;
            }
            .invoice-customer-meta td:last-child {
              text-align: left !important;
            }
            .invoice-customer-meta table {
              margin-left: 0 !important;
            }
            .invoice-items-table {
              font-size: 10px !important;
            }
            .invoice-items-table th, .invoice-items-table td {
              padding: 4px 2px !important;
            }
            .invoice-totals-container {
              font-size: 11px !important;
            }
            .invoice-sig-box {
              width: 140px !important;
              height: 48px !important;
            }
            .invoice-sig-box span {
              font-size: 8px !important;
            }
            .invoice-sig-line {
              width: 120px !important;
            }
          }
        `}} />
        {/*
          INNER FLEX COLUMN
          • minHeight keeps A4/Letter content area tall enough that the spacer
            pushes the footer to the bottom even with very few items.
          • Thermal has no fixed height — it just wraps content naturally.
        */}
        <div
          style={{
            minHeight: S.minHeight,
            display: "flex",
            flexDirection: "column",
            padding: S.outerPad,
            boxSizing: "border-box",
          }}
        >

          {/* ══════════════════════════════════════════════════════════════════
              HEADER  (Logo | Company Info | Document Title)
              Uses an HTML <table> so every renderer aligns cells identically.
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: S.sectionGap, marginBottom: S.sectionGap }}>
            {isThermal ? (
              /* ── THERMAL HEADER: stacked centre ── */
              <div style={{ textAlign: "center" }}>
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    style={{ height: S.logoH, width: "auto", objectFit: "contain", display: "block", margin: "0 auto 8px" }}
                  />
                )}
                {companyName && (
                  <div style={{ fontWeight: 900, fontSize: S.headerFontSize, color: "#0f172a", textTransform: "uppercase", letterSpacing: "-0.3px" }}>
                    {companyName}
                  </div>
                )}
                {companyAddress && (
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px", lineHeight: 1.4, whiteSpace: "pre-line" }}>
                    {companyAddress}
                  </div>
                )}
                {(companyPhone || companyEmail) && (
                  <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "12px", marginTop: "4px", fontSize: "10px", color: "#64748b" }}>
                    {companyPhone && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <span>&#9742;</span>
                        <span>{companyPhone}</span>
                      </span>
                    )}
                    {companyEmail && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                        <span>&#9993;</span>
                        <span style={{ textTransform: "lowercase" }}>{companyEmail}</span>
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontWeight: 900, fontSize: S.headerFontSize, color: "#0f172a", textTransform: "uppercase", marginTop: "8px", letterSpacing: "-0.3px" }}>
                  {t("invoiceTitle")}
                </div>
              </div>
            ) : (
              /* ── A4 / LETTER HEADER: three-column table ── */
              <table className="invoice-a4-header" style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    {/* Logo — LEFT */}
                    <td style={{ width: "25%", verticalAlign: "top" }}>
                      {companyLogo && (
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          style={{ height: S.logoH, width: "auto", objectFit: "contain", display: "block" }}
                        />
                      )}
                    </td>

                    {/* Company Info — CENTER */}
                    <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                      {companyName && (
                        <div style={{
                          fontWeight: 900,
                          fontSize: S.headerFontSize,
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "-0.5px",
                          lineHeight: 1.2,
                        }}>
                          {companyName}
                        </div>
                      )}
                      {companyAddress && (
                        <div style={{
                          fontSize: "11px",
                          color: "#64748b",
                          marginTop: "4px",
                          lineHeight: 1.5,
                          whiteSpace: "pre-line",
                        }}>
                          {companyAddress}
                        </div>
                      )}
                      {/* Phone / Email — inner table keeps perfect vertical alignment */}
                      {(companyPhone || companyEmail) && (
                        <table style={{ margin: "6px auto 0", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              {companyPhone && (
                                <td style={{
                                  paddingRight: companyEmail ? "20px" : "0",
                                  fontSize: "11px",
                                  color: "#64748b",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9742;</span>
                                  <span>{companyPhone}</span>
                                </td>
                              )}
                              {companyEmail && (
                                <td style={{
                                  fontSize: "11px",
                                  color: "#64748b",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9993;</span>
                                  <span style={{ textTransform: "lowercase" }}>{companyEmail}</span>
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </td>

                    {/* Document Title — RIGHT */}
                    <td className="invoice-title-cell" style={{ width: "25%", textAlign: "right", verticalAlign: "top" }}>
                      <div style={{
                        fontWeight: 900,
                        fontSize: S.headerFontSize,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "-0.5px",
                      }}>
                        {t("invoiceTitle")}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CUSTOMER + INVOICE META
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: S.sectionGap }}>
            {isThermal ? (
              /* ── THERMAL: stacked ── */
              <div style={{ fontSize: S.textFontSize }}>
                <div style={{ fontSize: S.labelFontSize, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: "4px" }}>
                  {t("customerDetails")}
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{customer.name}</div>
                {customer.company_name && <div style={{ color: "#334155" }}>{customer.company_name}</div>}
                {(customer.company_address || customer.address) && (
                  <div style={{ fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>{customer.company_address || customer.address}</div>
                )}
                {customer.phone && <div style={{ color: "#64748b" }}>{customer.phone}</div>}
                {customer.email && <div style={{ color: "#64748b" }}>{customer.email}</div>}

                <div style={{ marginTop: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>{t("invoiceNoLabel")}:</span>
                    <span style={{ fontWeight: 700 }}>{invoiceNo}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                    <span style={{ color: "#64748b" }}>{t("invoiceDate")}:</span>
                    <span style={{ fontWeight: 700 }}>{formatDateShort(saleDate)}</span>
                  </div>
                  {dueDate && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#ef4444" }}>
                      <span style={{ fontWeight: 500 }}>{t("dueDate")}:</span>
                      <span style={{ fontWeight: 700 }}>{formatDateShort(dueDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── A4 / LETTER: two-column table ── */
              <table className="invoice-customer-meta" style={{ width: "100%", borderCollapse: "collapse", fontSize: S.textFontSize }}>
                <tbody>
                  <tr>
                    {/* Customer details */}
                    <td style={{ verticalAlign: "top", width: "50%" }}>
                      <div style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#94a3b8",
                        marginBottom: "6px",
                      }}>
                        {t("customerDetails") || "Party Details"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                        {customer.name}
                      </div>
                      {customer.company_name && (
                        <div style={{ fontSize: "13px", color: "#334155", fontWeight: 500, marginTop: "2px" }}>
                          {customer.company_name}
                        </div>
                      )}
                      {(customer.company_address || customer.address) && (
                        <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginTop: "2px", lineHeight: 1.4 }}>
                          {customer.company_address || customer.address}
                        </div>
                      )}
                      {customer.phone && (
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {customer.email}
                        </div>
                      )}
                    </td>

                    {/* Invoice number / dates */}
                    <td style={{ verticalAlign: "top", textAlign: "right" }}>
                      <div style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#94a3b8",
                        marginBottom: "6px",
                      }}>
                        {t("invoiceDetails") || "Invoice Details"}
                      </div>
                      <table style={{ marginLeft: "auto", borderCollapse: "collapse", fontSize: "13px" }}>
                        <tbody>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "16px", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {t("invoiceNoLabel") || "Invoice No:"}
                            </td>
                            <td style={{ fontWeight: 700, color: "#0f172a", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {invoiceNo}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#64748b", paddingRight: "16px", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {t("invoiceDate") || "Date"}:
                            </td>
                            <td style={{ fontWeight: 700, color: "#0f172a", paddingBottom: "4px", whiteSpace: "nowrap" }}>
                              {formatDateShort(saleDate)}
                            </td>
                          </tr>
                          {dueDate && (
                            <tr>
                              <td style={{ color: "#ef4444", paddingRight: "16px", whiteSpace: "nowrap" }}>
                                {t("dueDate") || "Due Date"}:
                              </td>
                              <td style={{ fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap" }}>
                                {formatDateShort(dueDate)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              ITEMS TABLE
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: S.sectionGap }}>
            <table className="invoice-items-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: S.textFontSize }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("item")}
                  </th>
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("sellPrice")}
                    </th>
                  )}
                  <th style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("qty")}
                  </th>
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("uom")}
                    </th>
                  )}
                  {!isThermal && (
                    <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                      {t("discount")}
                    </th>
                  )}
                  <th style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                    {t("total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const discountValue = calculateDiscountValue(product);
                  const lineTotal = calculateLineTotal(product);
                  return (
                    <tr key={product.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: isThermal ? "6px 4px" : "10px 8px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{product.name}</div>
                        {product.description && (
                          <div style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            marginTop: "2px",
                            lineHeight: 1.4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: isThermal ? "120px" : "350px"
                          }}>
                            {truncateDescription(product.description)}
                          </div>
                        )}
                      </td>
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {formatCurrencyString(product.sell_price)}
                        </td>
                      )}
                      <td style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", color: "#334155" }}>
                        {product.quantityType === "damaged" && (
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>(dmg) </span>
                        )}
                        {product.quantity}
                      </td>
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {formatUom(product.unit_of_measurement)}
                        </td>
                      )}
                      {!isThermal && (
                        <td style={{ textAlign: "right", padding: "10px 8px", color: "#475569" }}>
                          {discountValue > 0 ? formatCurrencyString(discountValue) : "-"}
                        </td>
                      )}
                      <td style={{ textAlign: "right", padding: isThermal ? "6px 4px" : "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                        {formatCurrencyString(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TOTALS
          ══════════════════════════════════════════════════════════════════ */}
          <div className="invoice-totals-container" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginBottom: S.sectionGap }}>
            {/* Sub Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
              <span style={{ color: "#64748b" }}>Sub Total:</span>
              <span style={{ color: "#334155" }}>{formatCurrencyString(subtotal)}</span>
            </div>

            {/* Overall Discount */}
            {overallDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#64748b" }}>Overall Discount:</span>
                <span style={{ color: "#ef4444" }}>- {formatCurrencyString(Math.min(overallDiscount, subtotal))}</span>
              </div>
            )}

            {/* Shipping */}
            {shippingCharges > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#64748b" }}>{t("shippingCharges")}</span>
                <span style={{ color: "#334155" }}>{formatCurrencyString(shippingCharges)}</span>
              </div>
            )}

            {/* Extra Charges */}
            {charges.map((charge, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: S.textFontSize, marginBottom: "6px" }}>
                <span style={{ color: "#64748b" }}>{charge.item}:</span>
                <span style={{ color: "#334155" }}>{formatCurrencyString(charge.value)}</span>
              </div>
            ))}

            {/* Grand Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: S.boldFontSize, borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}>
              <span style={{ color: "#0f172a" }}>{t("total")} :</span>
              <span style={{ color: "#0f172a" }}>{formatCurrencyString(total)}</span>
            </div>

            {/* Payment Info */}
            <div style={{ marginTop: "12px", textAlign: "right", fontSize: S.textFontSize }}>
              {!noPaymentAtAll && paidAmount > 0 && (
                <div style={{ marginBottom: "4px", color: "#334155" }}>
                  <span style={{ fontWeight: 600 }}>{t("paidOn")}</span>{" "}
                  {paidDate ? formatDateLong(paidDate) : "—"} —{" "}
                  {formatCurrencyString(paidAmount)}
                </div>
              )}
              <div style={{ color: "#334155" }}>
                <span style={{ fontWeight: 600 }}>{t("remainingBalance")}</span>{" "}
                {formatCurrencyString(remainingBalance)}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CUSTOMER NOTES
          ══════════════════════════════════════════════════════════════════ */}
          {customerNotes && (
            <div style={{
              marginBottom: S.sectionGap,
              borderLeft: "3px solid #e2e8f0",
              paddingLeft: "12px",
              paddingTop: "6px",
              paddingBottom: "6px",
              backgroundColor: "#f8fafc",
              borderRadius: "0 6px 6px 0",
              maxWidth: "420px",
            }}>
              <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "4px" }}>
                {t("customerNotes") || "Notes & Terms"}:
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {customerNotes}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SPACER — pushes footer to bottom on short-content pages.
              On multi-page docs this collapses and footer sits after content.
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ flex: 1 }} />

          {/* ══════════════════════════════════════════════════════════════════
              SIGNATURES
          ══════════════════════════════════════════════════════════════════ */}
          {((signatureImage && includeSignature) || requestCustomerSignature) && (
            <div style={{ marginTop: isThermal ? "16px" : "32px" }}>
              {isThermal ? (
                /* ── THERMAL signatures: stacked ── */
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {signatureImage && includeSignature && (
                    <div>
                      <img src={signatureImage} alt="Company Signature" style={{ height: S.sigH, width: "auto", display: "block", marginBottom: "6px" }} />
                      <div style={{ width: "120px", borderTop: "1px solid #cbd5e1", marginBottom: "4px" }} />
                      <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{companyName}</div>
                    </div>
                  )}
                  {requestCustomerSignature && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        width: "100%", height: S.sigH, border: "2px dashed #e2e8f0", borderRadius: "6px",
                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px",
                      }}>
                        <span style={{ fontSize: "9px", color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                          {t("customerSignature")}
                        </span>
                      </div>
                      <div style={{ width: "120px", borderTop: "1px solid #cbd5e1", marginBottom: "4px", marginLeft: "auto" }} />
                      <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{customer.name}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── A4 / LETTER signatures: side by side ── */
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      {signatureImage && includeSignature ? (
                        <td style={{ verticalAlign: "bottom", width: "50%" }}>
                          <img src={signatureImage} alt="Company Signature" style={{ height: S.sigH, width: "auto", display: "block", marginBottom: "6px" }} />
                          <div style={{ width: "160px", borderTop: "1px solid #cbd5e1", marginBottom: "4px" }} />
                          <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{companyName}</div>
                        </td>
                      ) : (
                        <td style={{ width: "50%" }} />
                      )}
                      {requestCustomerSignature && (
                        <td style={{ verticalAlign: "bottom", textAlign: "right" }}>
                          <div style={{ display: "inline-block" }}>
                            <div className="invoice-sig-box" style={{
                              width: S.sigW, height: S.sigH,
                              border: "2px dashed #e2e8f0", borderRadius: "8px",
                              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px",
                            }}>
                              <span style={{ fontSize: "9px", color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                                {t("customerSignature")}
                              </span>
                            </div>
                            <div className="invoice-sig-line" style={{ width: "160px", borderTop: "1px solid #cbd5e1", marginBottom: "4px", marginLeft: "auto" }} />
                            <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, textAlign: "right" }}>
                              {customer.name}
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              FOOTER / DISCLAIMER
              Normal-flow (not fixed/absolute) so:
              • 1-page  → flex spacer pushes it to bottom of page
              • Multi-page → appears naturally after last content block
          ══════════════════════════════════════════════════════════════════ */}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: isThermal ? "16px" : "32px", paddingTop: "10px", textAlign: "center" }}>
            <p style={{ fontSize: "10px", color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
              {t("computerGeneratedDisclaimer") || "This is a computer generated document from DukaanKhata.app"}
            </p>
          </div>

        </div>{/* end inner flex column */}
      </div>
    );
  },
);

InvoicePreview.displayName = "InvoicePreview";