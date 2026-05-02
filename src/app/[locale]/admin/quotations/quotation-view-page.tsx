// Quotation View/Print UI (with PDF download modal & design options)
"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2, Calendar, User, Printer, Share2, Replace } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

export default function QuotationViewClient({ id }: { id: string }) {
    const tInvoice = useTranslations("invoice");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const router = useRouter();
    const [quotation, setQuotation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [errorDialog, setErrorDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        isSuccess?: boolean;
    }>({
        open: false,
        title: "",
        message: "",
    });

    const quotationRef = useRef<HTMLDivElement>(null);

    const fetchQuotation = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/${locale}/api/quotations/${id}`);
            if (!res.ok) throw new Error("Quotation not found");
            const data = await res.json();
            // Check if data is nested or direct
            setQuotation(data.quotation || data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotation();
    }, [id, locale]);

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const res = await fetch(`/${locale}/api/quotations/${id}/convert`, {
                method: "POST",
            });

            if (res.ok) {
                const data = await res.json();
                setErrorDialog({
                    open: true,
                    title: tCommon("success"),
                    message: `Quotation converted to Sale successfully! Invoice No: ${data.invoiceNo}`,
                    isSuccess: true,
                });
                fetchQuotation(); // Refresh data to update status
            } else {
                const errorData = await res.json();
                throw new Error(errorData?.error || "Failed to convert quotation");
            }
        } catch (error) {
            setErrorDialog({
                open: true,
                title: tCommon("error"),
                message: error instanceof Error ? error.message : "Error converting quotation",
            });
        } finally {
            setIsConverting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // --- Perfect PDF Download Function ---
    const handleDownloadPDF = async () => {
        if (!quotationRef.current || !quotation) return;
        setDownloadingPdf(true);

        try {
            // Dynamic import to keep bundle size small
            const html2pdf = (await import("html2pdf.js")).default;
            const element = quotationRef.current;

            const opt = {
                margin: [10, 10, 10, 10] as [number, number, number, number], // Proper margins for A4
                filename: `Quotation-${quotation.quotation_no || "DOC"}.pdf`,
                image: { type: 'jpeg' as const, quality: 1 }, // Maximum quality
                html2canvas: {
                    scale: 2, // High resolution
                    useCORS: true,
                    letterRendering: true,
                    scrollY: 0,
                    windowWidth: element.scrollWidth // Design preserve karne ke liye window width fix
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait' as const
                }
            };

            // Generate and Save
            await html2pdf().set(opt).from(element).save();

        } catch (error) {
            console.error("PDF download error:", error);
        } finally {
            setDownloadingPdf(false);
        }
    };

    if (loading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    if (error || !quotation) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
                <div className="bg-destructive/10 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-destructive">
                    <FileText className="h-10 w-10" />
                </div>
                <h2 className="text-xl">{tCommon("error")}</h2>
                <Button onClick={() => router.back()} variant="outline">{tCommon("back")}</Button>
            </div>
        );
    }

    const company = quotation.company || {
        name: "Dukan Khata ",
        address: "Karachi, Pakistan",
        logo: null,
        signatureImage: null,
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6" 
        // style={{ fontFamily: 'Google Sans Flex, Helvetica Neue, system-ui, -apple-system, sans-serif' }}
        >
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 md:gap-4 bg-background p-2 md:p-4 rounded-xl border shadow-sm sticky top-0 z-30 print:hidden overflow-x-auto no-scrollbar">
                {/* Left Side: Back & Title */}
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <Link href={`../`}>
                        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    </Link>
                    <span className="text-sm md:text-lg whitespace-nowrap">
                        {/* Mobile pe chota text ya sirf Preview */}
                        <span className="md:hidden">Preview</span>
                        <span className="hidden md:block">Quotation Preview</span>
                    </span>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-1.5 md:gap-2">
                    {/* Convert to Sale - Hidden if already converted */}
                    {quotation.status !== "converted" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleConvert}
                            disabled={isConverting}
                            className="h-8 md:h-9 px-2 md:px-3 border-slate-300"
                        >
                            {isConverting ? (
                                <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
                            ) : (
                                <Replace className="h-4 w-4 md:mr-2" />
                            )}
                            <span className="hidden md:inline">{tCommon("convertToSale")}</span>
                        </Button>
                    )}

                    {/* Edit - Icon on Mobile */}
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 md:h-9 px-2 md:px-3 border-primary text-primary"
                    >
                        <Link href={`./edit`}>
                            <FileText className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">{tCommon("edit")}</span>
                        </Link>
                    </Button>

                    {/* Print - Hidden on very small screens to save space (Optional) */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="h-8 md:h-9 px-2 md:px-3 border-slate-300 xs:flex"
                    >
                        <Printer className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">{tCommon("print")}</span>
                    </Button>

                    {/* Download - Always prominent */}
                    <Button
                        size="sm"
                        onClick={handleDownloadPDF}
                        disabled={downloadingPdf}
                        className="h-8 md:h-9 px-2 md:px-4 shadow-md shadow-primary/20"
                    >
                        {downloadingPdf ? (
                            <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 md:mr-2" />
                        )}
                        <span className="hidden sm:inline">{tCommon("download")}</span>
                        {/* Mobile pe agar download word hatana ho to spans use karein */}
                    </Button>
                </div>
            </div>

            {/* Quotation Paper Content */}
            <div
                ref={quotationRef}
                className="bg-white border shadow-lg rounded-sm overflow-hidden print:shadow-none print:border-none print:m-0"
                id="quotation-paper"
            >
                {/* Paper Header */}
                <div className="p-8 border-b-2 border-primary/10 flex justify-between items-start bg-slate-50/50 print:bg-transparent">
                    <div className="space-y-4">
                        <div className="bg-primary text-white px-4 py-1 rounded text-xs uppercase tracking-widest inline-block">
                            {tInvoice("quotation") || "Quotation"}
                        </div>
                        <div className="space-y-1">
                            {company.logo && (
                                <img src={company.logo} alt="Logo" className="h-12 w-auto mb-2" />
                            )}
                            <h1 className="text-3xl font-black text-slate-800 tracking-tighter">{company.name}</h1>
                            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{company.address}</p>
                        </div>
                    </div>

                    <div className="text-right space-y-2">
                        <div className="flex items-center justify-end gap-2 text-slate-600">
                            <span className="text-[10px] font-bold uppercase tracking-widest">{tInvoice("quotation_number") || "No:"}</span>
                            <span className="font-mono font-bold text-sm">{quotation.quotation_no || `#${quotation._id?.slice(-6).toUpperCase()}`}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-slate-600 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : "N/A"}</span>
                        </div>
                    </div>
                </div>

                {/* Customer & Info Grid */}
                <div className="p-8 grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-primary border-b pb-2">
                            <User className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{tInvoice("customerDetails") || "Bill To"}</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{quotation.party_details?.name || quotation.party_name || "Valued Customer"}</h3>
                            {quotation.party_details?.company_name && (
                                <p className="text-sm font-medium text-slate-600 italic">{quotation.party_details.company_name}</p>
                            )}
                            {quotation.party_details?.phone && (
                                <p className="text-xs text-muted-foreground mt-1">{quotation.party_details.phone}</p>
                            )}
                            {quotation.party_details?.address && (
                                <p className="text-xs text-muted-foreground whitespace-pre-line max-w-[250px]">{quotation.party_details.address}</p>
                            )}
                            <p className="text-sm text-muted-foreground mt-2">Status: <span className={`font-bold uppercase text-[10px] tracking-widest ${quotation.status === "converted" ? "text-green-600" : "text-primary"}`}>{quotation.status || "Pending"}</span></p>
                        </div>
                    </div>

                    <div className="text-right space-y-3">
                        <div className="flex items-center justify-end gap-2 text-primary border-b pb-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{tInvoice("validity_details") || "Validity"}</span>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">{tInvoice("valid_until") || "Valid Until"}</p>
                            <p className="text-lg font-bold text-slate-800">
                                {quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "N/A"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="px-8 pb-8">
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                                    <th className="py-4 px-4 text-left w-12">#</th>
                                    <th className="py-4 px-4 text-left">{tInvoice("item") || "Item"}</th>
                                    <th className="py-4 px-4 text-center">{tInvoice("qty") || "Qty"}</th>
                                    <th className="py-4 px-4 text-right">{tInvoice("sellPrice") || "Price"}</th>
                                    <th className="py-4 px-4 text-right">{tInvoice("total") || "Total"}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {quotation.items?.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="py-4 px-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="py-4 px-4">
                                            <div className=" text-slate-800">{item.product_name}</div>
                                            {item.product_description && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.product_description}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-center text-slate-700">{item.quantity}</td>
                                        <td className="py-4 px-4 text-right text-slate-600">{formatCurrencyString(item.unit_price || item.sell_price)}</td>
                                        <td className="py-4 px-4 text-right text-primary">{formatCurrencyString(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totals & Notes */}
                <div className="p-8 bg-slate-50/30 border-t flex flex-col md:flex-row justify-between gap-8 items-start">
                    <div className="flex-1 w-full space-y-4">
                        {quotation.notes && (
                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest">Notes & Terms</span>
                                <p className="text-xs text-muted-foreground bg-white p-4 border rounded-md italic shadow-inner">
                                    {quotation.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="w-full md:w-80 space-y-3 bg-white p-4 rounded-xl border shadow-sm">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{tInvoice("subTotal")}</span>
                            <span className="text-slate-700 ">
                                {formatCurrencyString(quotation.items?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0)}
                            </span>
                        </div>

                        {/* {quotation.discount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-destructive font-medium">{tInvoice("discount") || "Discount"}</span>
                                <span className="font-bold text-destructive font-mono">
                                    -{formatCurrencyString(quotation.discount_type === "percentage"
                                        ? (quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) * quotation.discount / 100)
                                        : quotation.discount
                                    )}
                                </span>
                            </div>
                        )} */}

                        {quotation.discount > 0 && (
                            <div className="flex justify-between items-center text-[11px] md:text-sm">
                                <span className="text-destructive">{tInvoice("discount")} {quotation.discount_type === "percentage" ? `(${quotation.discount}%)` : ""}</span>
                                <span className="text-destructive text-[11px] md:text-sm">-{formatCurrencyString(
                                    quotation.discount_type === "percentage"
                                        ? (quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) * quotation.discount / 100)
                                        : quotation.discount
                                )}</span>
                            </div>
                        )}

                        {quotation.tax > 0 && (
                            <div className="flex justify-between items-center text-[11px] md:text-sm">
                                <span className="text-slate-600">{tInvoice("tax") || "Tax"} {quotation.tax_type === "percentage" ? `(${quotation.tax}%)` : ""}</span>
                                <span className="text-slate-700 text-[11px] md:text-sm">+{formatCurrencyString(
                                    quotation.tax_type === "percentage"
                                        ? ((quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) - (quotation.discount_type === "percentage" ? (quotation.items?.reduce((s: any, i: any) => s + i.amount, 0) * quotation.discount / 100) : quotation.discount)) * quotation.tax / 100)
                                        : quotation.tax
                                )}</span>
                            </div>
                        )}

                        <Separator className="h-[2px]" />

                        <div className="flex justify-between items-center py-2 bg-primary/5 px-3 rounded-lg border border-primary/20">
                            <span className="text-primary uppercase text-xs tracking-tighter">Grand Total</span>
                            <span className="text-2xl text-primary">
                                {formatCurrencyString(quotation.total_amount || 0)}
                            </span>
                        </div>

                        {/* Signature Area */}
                        <div className="pt-6 mt-4 border-t border-dashed">
                            <div className="flex justify-between gap-4">
                                <div className="flex-1 text-center">
                                    <div className="h-10 border-b border-slate-200"></div>
                                    <span className="text-[8px] font-bold uppercase text-slate-400 mt-1 block">Customer</span>
                                </div>
                                <div className="flex-1 text-center">
                                    {company.signatureImage ? (
                                        <img src={company.signatureImage} className="h-10 mx-auto object-contain" />
                                    ) : (
                                        <div className="h-10 border-b border-slate-200"></div>
                                    )}
                                    <span className="text-[8px] font-bold uppercase text-slate-400 mt-1 block">Authorized</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-800 text-white text-center text-[10px] font-bold tracking-[0.2em] uppercase print:hidden">
                    {tInvoice("thanksForYourBusiness") || "Thank you for your business"}
                </div>
            </div>

                        <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;700&display=swap');
                @media print {
                    body * { visibility: hidden; }
                    #quotation-paper, #quotation-paper * { visibility: visible; }
                    #quotation-paper { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
                    @page { size: A4; margin: 10mm; }
                }
            `}</style>

            <ErrorDialog
                open={errorDialog.open}
                onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
                title={errorDialog.title}
                message={errorDialog.message}
                isSuccess={errorDialog.isSuccess}
            />
        </div>
    );
}
