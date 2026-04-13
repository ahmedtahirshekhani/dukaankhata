// // Quotation View/Print UI (with PDF download modal & design options)
// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useTranslations, useLocale } from "next-intl";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
// import Link from "next/link";
// import { ArrowLeft, Printer, Download, Share2, FileText, Loader2, Calendar, User } from "lucide-react";
// import { formatCurrencyString } from "@/lib/utils";
// import { Separator } from "@/components/ui/separator";

// export default function QuotationViewClient({ id }: { id: string }) {
//   const tInvoice = useTranslations("invoice");
//   const tCommon = useTranslations("common");
//   const locale = useLocale();
//   const router = useRouter();
//   const [quotation, setQuotation] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [downloadingPdf, setDownloadingPdf] = useState(false);
//   const quotationRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const fetchQuotation = async () => {
//       setLoading(true);
//       try {
//         const res = await fetch(`/${locale}/api/quotations/${id}`);
//         if (!res.ok) throw new Error("Quotation not found");
//         const data = await res.json();
//         setQuotation(data);
//       } catch (err: any) {
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchQuotation();
//   }, [id, locale]);

//   const handlePrint = () => {
//     window.print();
//   };

//   const handleDownloadPDF = async () => {
//     if (!quotationRef.current) return;
//     setDownloadingPdf(true);
//     try {
//       const html2pdf = (await import("html2pdf.js")).default;
//       const element = quotationRef.current;

//       // Store original styles
//       const originalPosition = element.style.position;
//       const originalTop = element.style.top;
//       const originalLeft = element.style.left;
//       const originalZIndex = element.style.zIndex;

//       // Make element temporarily fixed and visible for capture
//       element.style.position = "fixed";
//       element.style.top = "0";
//       element.style.left = "0";
//       element.style.zIndex = "9999";
//       element.style.backgroundColor = "white";

//       await html2pdf()
//         .set({
//           margin: 8,
//           filename: `Quotation-${quotation._id?.slice(-6) || id}.pdf`,
//           image: { type: "jpeg", quality: 0.98 },
//           html2canvas: { scale: 2, useCORS: true, logging: false },
//           jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
//         })
//         .from(element)
//         .save();

//       // Restore original styles
//       element.style.position = originalPosition;
//       element.style.top = originalTop;
//       element.style.left = originalLeft;
//       element.style.zIndex = originalZIndex;
//     } catch (error) {
//       console.error("PDF download error:", error);
//     } finally {
//       setDownloadingPdf(false);
//     }
//   };

//   if (loading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

//   if (error || !quotation) {
//     return (
//       <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
//         <div className="bg-destructive/10 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-destructive">
//           <FileText className="h-10 w-10" />
//         </div>
//         <h2 className="text-xl font-bold">{tCommon("error")}</h2>
//         <Button onClick={() => router.back()} variant="outline">{tCommon("back")}</Button>
//       </div>
//     );
//   }

//   const company = quotation.company || {
//     name: "Your Company Name",
//     address: "",
//     logo: null,
//     signatureImage: null,
//   };

//   return (
//     <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
//       {/* Action Bar - Hidden during Print */}
//       <div className="flex items-center justify-between gap-4 bg-background p-4 rounded-xl border shadow-sm sticky top-0 z-10 print:hidden">
//         <div className="flex items-center gap-3">
//           <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
//             <ArrowLeft className="h-5 w-5" />
//           </Button>
//           <span className="font-bold text-lg hidden md:block">{tInvoice("quotation_preview") || "Quotation Preview"}</span>
//         </div>

//         <div className="flex items-center gap-2">
//           <Button variant="outline" size="sm" asChild className="hidden sm:flex">
//             <Link href={`./edit`}><FileText className="h-4 w-4 mr-2" /> {tCommon("edit")}</Link>
//           </Button>
//           <Button variant="outline" size="sm" onClick={handlePrint}>
//             <Printer className="h-4 w-4 mr-2" /> {tCommon("print") || "Print"}
//           </Button>
//           <Button size="sm" onClick={handleDownloadPDF} disabled={downloadingPdf}>
//             {downloadingPdf ? (
//               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//             ) : (
//               <Download className="h-4 w-4 mr-2" />
//             )}
//             {tCommon("download") || "Download PDF"}
//           </Button>
//         </div>
//       </div>

//       {/* Quotation Paper */}
//       <div
//         ref={quotationRef}
//         className="bg-white border shadow-lg rounded-sm overflow-hidden print:shadow-none print:border-none print:m-0"
//         id="quotation-paper"
//       >
//         {/* Header */}
//         <div className="p-6 md:p-8 border-b-2 border-primary/10 flex justify-between items-start bg-slate-50/50 print:bg-transparent">
//           <div className="space-y-3 md:space-y-4">
//             <div className="bg-primary text-white px-3 py-0.5 md:px-4 md:py-1 rounded text-xs md:text-sm font-bold uppercase tracking-widest inline-block">
//               {tInvoice("quotation") || "Quotation"}
//             </div>
//             <div className="space-y-1">
//               {company.logo && (
//                 <img src={company.logo} alt={tInvoice("companyLogoAlt") || "Company Logo"} className="h-8 md:h-12 w-auto mb-1 md:mb-2" />
//               )}
//               <h1 className="text-xl md:text-3xl font-black text-slate-800">{company.name}</h1>
//               {company.address && (
//                 <p className="text-[10px] md:text-xs text-muted-foreground max-w-xs">{company.address}</p>
//               )}
//             </div>
//           </div>

//           <div className="text-right space-y-1 md:space-y-2">
//             <div className="flex items-center justify-end gap-1 md:gap-2 text-slate-600">
//               <span className="text-[10px] md:text-xs font-bold uppercase">{tInvoice("quotation_number") || "No:"}</span>
//               <span className="font-mono font-bold text-xs md:text-sm">#{quotation._id?.slice(-6).toUpperCase() || "N/A"}</span>
//             </div>
//             <div className="flex items-center justify-end gap-1 md:gap-2 text-slate-600 text-xs md:text-sm">
//               <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
//               <span>{quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : "N/A"}</span>
//             </div>
//           </div>
//         </div>

//         {/* Party & Validity */}
//         <div className="p-6 md:p-8 grid md:grid-cols-2 gap-4 md:gap-8">
//           <div className="space-y-2 md:space-y-3">
//             <div className="flex items-center gap-2 text-primary border-b pb-1 md:pb-2">
//               <User className="h-3 w-3 md:h-4 md:w-4" />
//               <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{tInvoice("customerDetails") || "Bill To"}</span>
//             </div>
//             <div>
//               <h3 className="text-lg md:text-xl font-bold text-slate-800">{quotation.party_name || "Valued Customer"}</h3>
//               <p className="text-xs md:text-sm text-muted-foreground mt-1">{tInvoice("status") || "Status"}: <span className="capitalize text-primary font-medium">{quotation.status || "Pending"}</span></p>
//             </div>
//           </div>

//           <div className="md:text-right space-y-2 md:space-y-3">
//             <div className="flex items-center md:justify-end gap-2 text-primary border-b pb-1 md:pb-2">
//               <Calendar className="h-3 w-3 md:h-4 md:w-4" />
//               <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{tInvoice("validity_details") || "Validity Details"}</span>
//             </div>
//             <div>
//               <p className="text-xs md:text-sm text-muted-foreground">{tInvoice("valid_until") || "Valid Until"}:</p>
//               <p className="text-base md:text-lg font-bold text-slate-800">
//                 {quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "N/A"}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Items Table */}
//         <div className="px-4 md:px-8 pb-6 md:pb-8">
//           <div className="border rounded-lg overflow-x-auto">
//             <table className="w-full text-[11px] md:text-sm print:text-[10px]">
//               <thead className="bg-slate-50 border-b">
//                 <tr className="text-slate-600 font-bold">
//                   <th className="py-2 md:py-4 px-2 md:px-4 text-left w-8 md:w-12">#</th>
//                   <th className="py-2 md:py-4 px-2 md:px-4 text-left">{tInvoice("item") || "Item Description"}</th>
//                   <th className="py-2 md:py-4 px-2 md:px-4 text-center">{tInvoice("qty") || "Qty"}</th>
//                   <th className="py-2 md:py-4 px-2 md:px-4 text-right">{tInvoice("sellPrice") || "Unit Price"}</th>
//                   <th className="py-2 md:py-4 px-2 md:px-4 text-right">{tInvoice("total") || "Total"}</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y">
//                 {quotation.items?.map((item: any, idx: number) => (
//                   <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
//                     <td className="py-2 md:py-4 px-2 md:px-4 text-slate-400 font-mono text-[10px] md:text-sm">{idx + 1}</td>
//                     <td className="py-2 md:py-4 px-2 md:px-4">
//                       <div className="font-bold text-slate-800 text-[11px] md:text-sm">{item.product_name}</div>
//                       {item.product_description && (
//                         <div className="text-[9px] md:text-xs text-muted-foreground mt-0.5">{item.product_description}</div>
//                       )}
//                     </td>
//                     <td className="py-2 md:py-4 px-2 md:px-4 text-center font-semibold text-slate-700 text-[11px] md:text-sm">{item.quantity}</td>
//                     <td className="py-2 md:py-4 px-2 md:px-4 text-right font-mono text-slate-600 text-[10px] md:text-sm">{formatCurrencyString(item.unit_price || item.sell_price)}</td>
//                     <td className="py-2 md:py-4 px-2 md:px-4 text-right font-bold text-slate-800 text-[11px] md:text-sm">{formatCurrencyString(item.amount)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {/* Totals + Signature */}
//         <div className="p-6 md:p-8 bg-slate-50/30 border-t flex flex-col md:flex-row justify-between gap-6 md:gap-8">
//           <div className="flex-1 space-y-3 md:space-y-4">
//             {quotation.notes && (
//               <div className="space-y-1 md:space-y-2">
//                 <span className="text-[9px] md:text-[10px] font-black uppercase text-primary tracking-widest">{tInvoice("notes") || "Terms & Notes"}</span>
//                 <p className="text-[10px] md:text-xs text-muted-foreground bg-white p-2 md:p-3 border rounded-md italic">
//                   {quotation.notes}
//                 </p>
//               </div>
//             )}
//           </div>

//           <div className="w-full md:w-80 space-y-2 md:space-y-3">
//             <div className="flex justify-between items-center text-[11px] md:text-sm">
//               <span className="text-muted-foreground font-medium">{tInvoice("subTotal") || "Subtotal"}</span>
//               <span className="font-bold text-slate-700 font-mono text-[11px] md:text-sm">
//                 {formatCurrencyString(quotation.items?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0)}
//               </span>
//             </div>

//             {quotation.discount > 0 && (
//               <div className="flex justify-between items-center text-[11px] md:text-sm">
//                 <span className="text-destructive font-medium">{tInvoice("discount") || "Discount"} {quotation.discount_type === "percentage" ? `(${quotation.discount}%)` : ""}</span>
//                 <span className="font-bold text-destructive font-mono text-[11px] md:text-sm">-{formatCurrencyString(
//                   quotation.discount_type === "percentage"
//                     ? (quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) * quotation.discount / 100)
//                     : quotation.discount
//                 )}</span>
//               </div>
//             )}

//             {quotation.tax > 0 && (
//               <div className="flex justify-between items-center text-[11px] md:text-sm">
//                 <span className="text-slate-600 font-medium">{tInvoice("tax") || "Tax"} {quotation.tax_type === "percentage" ? `(${quotation.tax}%)` : ""}</span>
//                 <span className="font-bold text-slate-700 font-mono text-[11px] md:text-sm">+{formatCurrencyString(
//                   quotation.tax_type === "percentage"
//                     ? ((quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) - (quotation.discount_type === "percentage" ? (quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) * quotation.discount / 100) : quotation.discount)) * quotation.tax / 100)
//                     : quotation.tax
//                 )}</span>
//               </div>
//             )}

//             <Separator className="bg-slate-200 h-[1px] md:h-[2px]" />

//             <div className="flex justify-between items-center py-1 md:py-2 bg-primary/5 px-2 md:px-3 rounded-lg border border-primary/10">
//               <span className="text-primary font-black uppercase tracking-tighter text-xs md:text-sm">{tInvoice("total") || "Grand Total"}</span>
//               <span className="text-lg md:text-2xl font-black text-primary font-mono tracking-tighter">
//                 {formatCurrencyString(quotation.total_amount || 0)}
//               </span>
//             </div>

//             {/* Signature Section */}
//             <div className="pt-3 md:pt-4 mt-1 md:mt-2 border-t border-dashed border-slate-200">
//               <div className="flex justify-between items-end gap-2 md:gap-4">
//                 <div className="flex-1 text-center">
//                   <div className="border-t border-slate-400 pt-1 md:pt-2 text-[8px] md:text-[10px] font-bold uppercase text-slate-500">
//                     {tInvoice("customerSignature") || "Customer Signature"}
//                   </div>
//                 </div>
//                 <div className="flex-1 text-center">
//                   {company.signatureImage ? (
//                     <div className="flex flex-col items-center">
//                       <img
//                         src={company.signatureImage}
//                         alt={tInvoice("companySignature") || "Authorized Signature"}
//                         className="h-8 md:h-12 w-auto object-contain mb-1"
//                       />
//                       <div className="text-[8px] md:text-[10px] font-bold uppercase text-slate-500">{tInvoice("companySignature") || "Authorized Signature"}</div>
//                     </div>
//                   ) : (
//                     <div className="border-t border-slate-400 pt-1 md:pt-2 text-[8px] md:text-[10px] font-bold uppercase text-slate-500">
//                       {tInvoice("companySignature") || "Authorized Signature"}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="p-2 md:p-4 bg-slate-800 text-white text-center text-[8px] md:text-[10px] font-medium tracking-widest uppercase print:bg-white print:text-slate-400 print:border-t">
//           {tInvoice("thanksForYourBusiness") || "Thank you for choosing"} {company.name}
//         </div>
//       </div>

//       {/* Global Print Styles - Hide Entire Admin Layout */}
//       <style jsx global>{`
//         @media print {
//           /* Hide everything except the quotation paper */
//           body * {
//             visibility: hidden !important;
//           }
//           #quotation-paper,
//           #quotation-paper * {
//             visibility: visible !important;
//           }
//           #quotation-paper {
//             position: absolute !important;
//             top: 0 !important;
//             left: 0 !important;
//             width: 100% !important;
//             margin: 0 !important;
//             padding: 0 !important;
//             background: white !important;
//             box-shadow: none !important;
//             border: none !important;
//           }
//           /* Remove page margins */
//           @page {
//             margin: 0.5in;
//           }
//           /* Ensure no extra spacing */
//           body {
//             margin: 0 !important;
//             padding: 0 !important;
//             background: white !important;
//           }
//         }
//       `}</style>

//       {/* Mobile Share */}
//       <div className="flex md:hidden gap-2 print:hidden">
//         <Button variant="outline" className="flex-1" onClick={() => {
//           if (navigator.share) {
//             navigator.share({ title: `Quotation ${quotation._id}`, url: window.location.href });
//           }
//         }}>
//           <Share2 className="h-4 w-4 mr-2" /> {tCommon("share") || "Share"}
//         </Button>
//       </div>
//     </div>
//   );
// }



"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, FileText, Loader2 } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function QuotationViewClient({ id }: { id: string }) {
  const t = useTranslations("invoice");
  const locale = useLocale();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const res = await fetch(`/${locale}/api/quotations/${id}`);
        const data = await res.json();
        setQuotation(data.quotation || data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  }, [id, locale]);

  // --- Direct PDF Download Logic (No API) ---
  const downloadPDF = async () => {
    const element = document.getElementById("quotation-content");
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Quotation-${quotation._id?.slice(-6) || "draft"}.pdf`);
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!quotation) return <div className="text-center py-20">Quotation not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Top Bar - Simple & Clean */}
      <div className="flex items-center justify-between border-b pb-4 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="font-bold text-xl">Quotation Details</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button size="sm" onClick={downloadPDF}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div id="quotation-content" className="bg-white p-8 border rounded-sm shadow-sm print:shadow-none print:border-none">
        
        {/* Header: Company Info */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-2xl font-black text-primary">NASPOS</h2>
            <p className="text-sm text-muted-foreground">Professional Software Solutions</p>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold uppercase text-muted-foreground/50">Quotation</h3>
            <p className="text-sm font-mono">#{quotation._id?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-10 mb-10 text-sm">
          <div>
            <p className="font-bold text-muted-foreground uppercase text-[10px] mb-1">Customer</p>
            <p className="text-lg font-bold">{quotation.party_name}</p>
            <p className="text-muted-foreground">Status: {quotation.status || "Pending"}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-muted-foreground uppercase text-[10px] mb-1">Dates</p>
            <p><strong>Issue Date:</strong> {new Date(quotation.created_at).toLocaleDateString()}</p>
            <p><strong>Valid Until:</strong> {new Date(quotation.validity_date).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm mb-10">
          <thead className="bg-slate-50 border-y">
            <tr className="text-left">
              <th className="py-3 px-2">Description</th>
              <th className="py-3 px-2 text-center">Qty</th>
              <th className="py-3 px-2 text-right">Unit Price</th>
              <th className="py-3 px-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {quotation.items?.map((item: any, i: number) => (
              <tr key={i}>
                <td className="py-4 px-2">
                  <p className="font-bold">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.product_description}</p>
                </td>
                <td className="py-4 px-2 text-center">{item.quantity}</td>
                <td className="py-4 px-2 text-right font-mono">{formatCurrencyString(item.unit_price || item.sell_price)}</td>
                <td className="py-4 px-2 text-right font-bold">{formatCurrencyString(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Summary */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrencyString(quotation.items?.reduce((s:any,i:any)=>s+i.amount,0))}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Discount</span>
                <span className="font-mono">-{formatCurrencyString(quotation.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black border-t pt-2 text-primary">
              <span>Total Amount</span>
              <span className="font-mono">{formatCurrencyString(quotation.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        {quotation.notes && (
          <div className="mt-10 pt-6 border-t border-dashed">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Notes / Terms</p>
            <p className="text-xs text-muted-foreground">{quotation.notes}</p>
          </div>
        )}

        {/* Signature for Print */}
        <div className="mt-20 hidden print:flex justify-between">
          <div className="border-t w-40 text-center pt-2 text-[10px] uppercase font-bold text-muted-foreground">Customer Sign</div>
          <div className="border-t w-40 text-center pt-2 text-[10px] uppercase font-bold text-muted-foreground">Authorised Sign</div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; padding: 0; }
          #quotation-content { border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}