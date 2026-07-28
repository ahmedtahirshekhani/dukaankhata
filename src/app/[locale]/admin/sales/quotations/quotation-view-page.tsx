// Quotation View/Print UI (with PDF download modal & design options)
"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2, Printer, Replace } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { db } from "@/lib/db/offline-db";

export default function QuotationViewClient({ id }: { id: string }) {
    const tInvoice = useTranslations("invoice");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const router = useRouter();
    const [quotation, setQuotation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPartySignature, setShowPartySignature] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [branding, setBranding] = useState({
        name: "Dukan Khata",
        address: "Karachi, Pakistan",
        phone: "",
        email: "",
        logo: null as string | null,
        signatureImage: null as string | null,
    });
    const [errorDialog, setErrorDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        isSuccess?: boolean;
    }>({ open: false, title: "", message: "" });

    const quotationRef = useRef<HTMLDivElement>(null);

    const fetchQuotation = async () => {
        setLoading(true);
        try {
            const quot = await db.quotations.get(id);
            if (!quot) throw new Error("Quotation not found");
            
            // Populate party details from offline DB if missing or incomplete
            if (quot.party_id && (!quot.party_details || !quot.party_details.phone)) {
                const party = await db.parties.get(quot.party_id);
                if (party) {
                    quot.party_details = {
                        name: party.name,
                        company_name: party.company_name,
                        phone: party.phone,
                        email: party.email,
                        address: party.company_address || party.address,
                    };
                }
            }
            
            setQuotation(quot);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotation();
        const loadBranding = async () => {
            try {
                const tenantInfo = typeof window !== "undefined" ? localStorage.getItem("tenant_info") : null;
                const wsId = tenantInfo ? JSON.parse(tenantInfo).userId : "";

                // 1. Try to load branding from localStorage first (offline support)
                const cachedLogo = typeof window !== "undefined" ? localStorage.getItem(`companyLogo_${wsId}`) : null;
                const cachedSignature = typeof window !== "undefined" ? localStorage.getItem(`invoiceSignature_${wsId}`) : null;
                const cachedName = typeof window !== "undefined" ? localStorage.getItem(`companyName_${wsId}`) : null;
                const cachedAddress = typeof window !== "undefined" ? localStorage.getItem(`companyAddress_${wsId}`) : null;
                const cachedPhone = typeof window !== "undefined" ? localStorage.getItem(`companyPhone_${wsId}`) : null;
                const cachedEmail = typeof window !== "undefined" ? localStorage.getItem(`companyEmail_${wsId}`) : null;

                setBranding({
                    name: cachedName || "Dukan Khata",
                    address: cachedAddress || "Karachi, Pakistan",
                    phone: cachedPhone || "",
                    email: cachedEmail || "",
                    logo: cachedLogo || null,
                    signatureImage: cachedSignature || null,
                });

                // 2. Try to fetch from server if online and update cache
                const res = await fetch(`/${locale}/api/configuration/assets`);
                if (res.ok) {
                    const data = await res.json();
                    
                    const name = data.companyName || "Dukan Khata";
                    const address = data.companyAddress || "Karachi, Pakistan";
                    const phone = data.companyPhone || "";
                    const email = data.companyEmail || "";
                    const logo = data.companyLogo || null;
                    const signature = data.signatureImage || null;

                    setBranding({
                        name,
                        address,
                        phone,
                        email,
                        logo,
                        signatureImage: signature,
                    });

                    // Update localStorage cache
                    if (typeof window !== "undefined") {
                        if (name) localStorage.setItem("companyName", name);
                        if (address) localStorage.setItem("companyAddress", address);
                        if (phone) localStorage.setItem("companyPhone", phone);
                        if (email) localStorage.setItem("companyEmail", email);
                        if (logo) localStorage.setItem("companyLogo", logo);
                        else localStorage.removeItem("companyLogo");
                        if (signature) localStorage.setItem("invoiceSignature", signature);
                        else localStorage.removeItem("invoiceSignature");
                    }
                }
            } catch (err) {
                console.error("Failed to load branding (may be offline)", err);
            }
        };
        loadBranding();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, locale]);

    const handleConvert = async () => {
        setIsConverting(true);
        try {
            const res = await fetch(`/${locale}/api/quotations/${id}/convert`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setErrorDialog({
                    open: true,
                    title: tCommon("success"),
                    message: `Quotation converted to Sale successfully! Invoice No: ${data.invoiceNo}`,
                    isSuccess: true,
                });
                fetchQuotation();
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

    // ─── PDF Download ───────────────────────────────────────────────────────────
    const handleDownloadPDF = async () => {
        if (!quotationRef.current || !quotation) return;
        setDownloadingPdf(true);
        try {
            const html2pdf = (await import("html2pdf.js")).default;
            const element = quotationRef.current;
            const opt = {
                margin: [10, 10, 10, 10] as [number, number, number, number],
                filename: `Quotation-${quotation.quotation_no || "DOC"}.pdf`,
                image: { type: "jpeg" as const, quality: 1 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    scrollY: 0,
                    windowWidth: 794,           // Fixed A4-width — keeps icons + layout stable
                    backgroundColor: "#ffffff",
                },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
                pagebreak: { mode: ["avoid-all", "css", "legacy"] },
            };
            await html2pdf().set(opt).from(element).save();
        } catch (error) {
            console.error("PDF download error:", error);
        } finally {
            setDownloadingPdf(false);
        }
    };

    if (loading)
        return (
            <div className="h-[80vh] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );

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

    // ─── Calculated values ───────────────────────────────────────────────────────
    const subTotal =
        quotation.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;

    const discountAmount =
        quotation.discount > 0
            ? quotation.discount_type === "percentage"
                ? (subTotal * quotation.discount) / 100
                : quotation.discount
            : 0;

    const taxableAmount = subTotal - discountAmount;

    const taxAmount =
        quotation.tax > 0
            ? quotation.tax_type === "percentage"
                ? (taxableAmount * quotation.tax) / 100
                : quotation.tax
            : 0;

    const grandTotal = quotation.total_amount || taxableAmount + taxAmount;

    const formatDate = (dateStr: string) =>
        dateStr
            ? new Date(dateStr).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
              })
            : "N/A";

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">

            {/* ── Action Bar ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2 md:gap-4 bg-background p-2 md:p-4 rounded-xl border shadow-sm sticky top-16 z-30 print:hidden overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    <Link href={`../`}>
                        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    </Link>
                    <span className="text-sm md:text-lg whitespace-nowrap">
                        <span className="md:hidden">Preview</span>
                        <span className="hidden md:block">Quotation Preview</span>
                    </span>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2">
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

                    {/* Party Signature Toggle */}
                    <div className="flex items-center gap-2 px-2 md:px-3 border-l ml-1 md:ml-2 h-9">
                        <Label
                            htmlFor="party-sig-toggle"
                            className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap cursor-pointer"
                        >
                            Party Signature
                        </Label>
                        <Switch
                            id="party-sig-toggle"
                            checked={showPartySignature}
                            onCheckedChange={setShowPartySignature}
                            className="scale-75 md:scale-100"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="h-8 md:h-9 px-2 md:px-3 border-slate-300"
                    >
                        <Printer className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">{tCommon("print")}</span>
                    </Button>

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
                    </Button>
                </div>
            </div>

            {/* ── Quotation Paper ─────────────────────────────────────────────── */}
            {/*
                LAYOUT STRATEGY
                ─────────────────────────────────────────────────────────────────
                • Outer wrapper: display flex-col, minHeight 277mm (A4 minus margins).
                • A <div style={{flex:1}} /> spacer between content and footer pushes
                  the footer to the bottom on short (1-page) documents.
                • On multi-page documents html2pdf splits the page; the footer
                  (being normal flow) will appear on the LAST page only — which is
                  the correct professional behaviour for a "computer generated" note.
                • ALL layout uses inline style + HTML <table> so html2canvas renders
                  identically to the browser preview.
                • Phone ☎ and Email ✉ use HTML entities (&#9742; &#9993;) — no SVG,
                  no lucide, guaranteed to render in every context.
            */}
            <div
                ref={quotationRef}
                id="quotation-paper"
                className="quotation-paper bg-white border shadow-lg rounded-sm print:shadow-none print:border-none print:m-0"
                style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
            >
                {/* Inner flex column */}
                <div style={{ minHeight: "250mm", display: "flex", flexDirection: "column" }}>

                    {/* ── HEADER ──────────────────────────────────────────────── */}
                    <div className="quotation-header" style={{ padding: "24px 24px 20px", borderBottom: "1px solid #e2e8f0" }}>
                        <table className="quotation-a4-header" style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    {/* Logo */}
                                    <td style={{ width: "25%", verticalAlign: "top" }}>
                                        {branding.logo && (
                                            <img
                                                src={branding.logo}
                                                alt="Company Logo"
                                                style={{
                                                    height: "64px",
                                                    width: "auto",
                                                    objectFit: "contain",
                                                    display: "block",
                                                }}
                                            />
                                        )}
                                    </td>

                                    {/* Company Info — CENTER */}
                                    <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                                        <div style={{
                                            fontWeight: 900,
                                            fontSize: "22px",
                                            color: "#0f172a",
                                            textTransform: "uppercase",
                                            letterSpacing: "-0.5px",
                                            lineHeight: 1.2,
                                        }}>
                                            {branding.name}
                                        </div>
                                        <div style={{
                                            fontSize: "11px",
                                            color: "#64748b",
                                            marginTop: "4px",
                                            lineHeight: 1.5,
                                            whiteSpace: "pre-line",
                                        }}>
                                            {branding.address}
                                        </div>

                                        {/* Phone / Email
                                            Uses an inner <table> so both cells are
                                            perfectly vertically centred in EVERY renderer */}
                                        {(branding.phone || branding.email) && (
                                            <table style={{ margin: "6px auto 0", borderCollapse: "collapse" }}>
                                                <tbody>
                                                    <tr>
                                                        {branding.phone && (
                                                            <td style={{
                                                                paddingRight: branding.email ? "20px" : "0",
                                                                fontSize: "11px",
                                                                color: "#64748b",
                                                                verticalAlign: "middle",
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                                {/* ☎ HTML entity — no SVG needed */}
                                                                <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9742;</span>
                                                                <span>{branding.phone}</span>
                                                            </td>
                                                        )}
                                                        {branding.email && (
                                                            <td style={{
                                                                fontSize: "11px",
                                                                color: "#64748b",
                                                                verticalAlign: "middle",
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                                {/* ✉ HTML entity */}
                                                                <span style={{ fontSize: "12px", marginRight: "4px" }}>&#9993;</span>
                                                                <span style={{ textTransform: "lowercase" }}>{branding.email}</span>
                                                            </td>
                                                        )}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        )}
                                    </td>

                                    {/* Document Title — RIGHT */}
                                    <td className="quotation-title-cell" style={{ width: "25%", textAlign: "right", verticalAlign: "top" }}>
                                        <div style={{
                                            fontWeight: 900,
                                            fontSize: "22px",
                                            color: "#0f172a",
                                            textTransform: "uppercase",
                                            letterSpacing: "-0.5px",
                                        }}>
                                            {tInvoice("quotation") || "Quotation"}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── CUSTOMER & META ──────────────────────────────────────── */}
                    <div className="quotation-meta-container" style={{ padding: "20px 24px" }}>
                        <table className="quotation-customer-meta" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                                            {tInvoice("customerDetails") || "Party Details"}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                                            {quotation.party_details?.name || quotation.party_name}
                                        </div>
                                        {quotation.party_details?.company_name && (
                                            <div style={{ fontSize: "13px", color: "#334155", fontWeight: 500, marginTop: "2px" }}>
                                                {quotation.party_details.company_name}
                                            </div>
                                        )}
                                        {quotation.party_details?.address && (
                                            <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginTop: "2px", lineHeight: 1.4 }}>
                                                {quotation.party_details.address}
                                            </div>
                                        )}
                                        {quotation.party_details?.phone && (
                                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                                {quotation.party_details.phone}
                                            </div>
                                        )}
                                        {quotation.party_details?.email && (
                                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                                {quotation.party_details.email}
                                            </div>
                                        )}
                                    </td>

                                    {/* Quotation number / dates */}
                                    <td style={{ verticalAlign: "top", textAlign: "right" }}>
                                        <table style={{ marginLeft: "auto", borderCollapse: "collapse", fontSize: "13px" }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ color: "#64748b", paddingRight: "16px", paddingBottom: "4px" }}>
                                                        {tInvoice("quotation_number") || "No:"}
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: "#0f172a", paddingBottom: "4px" }}>
                                                        {quotation.quotation_no || `#${quotation._id?.slice(-6).toUpperCase()}`}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ color: "#64748b", paddingRight: "16px", paddingBottom: "4px" }}>
                                                        {tInvoice("date") || "Date"}:
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: "#0f172a", paddingBottom: "4px" }}>
                                                        {quotation.created_at ? formatDate(quotation.created_at) : "N/A"}
                                                    </td>
                                                </tr>
                                                {quotation.validity_date && (
                                                    <tr>
                                                        <td style={{ color: "#64748b", paddingRight: "16px" }}>
                                                            {tInvoice("valid_until") || "Valid Until"}:
                                                        </td>
                                                        <td style={{ fontWeight: 700, color: "#0f172a" }}>
                                                            {formatDate(quotation.validity_date)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── ITEMS TABLE ──────────────────────────────────────────── */}
                    <div className="quotation-items-container" style={{ padding: "0 24px 24px" }}>
                        <table className="quotation-items-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                            <thead>
                                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                        {tInvoice("item") || "Item"}
                                    </th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                        {tInvoice("sellPrice") || "Price"}
                                    </th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                        {tInvoice("qty") || "Qty"}
                                    </th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                        {tInvoice("uom") || "UOM"}
                                    </th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                        {tInvoice("total") || "Total"}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotation.items?.map((item: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.product_name}</div>
                                            {item.product_description && (
                                                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px", lineHeight: 1.4 }}>
                                                    {item.product_description}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 12px", color: "#475569" }}>
                                            {formatCurrencyString(item.unit_price || item.sell_price)}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 12px", color: "#334155" }}>
                                            {item.quantity}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 12px", color: "#475569" }}>
                                            {item.unit_of_measurement || "-"}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                                            {formatCurrencyString(item.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── TOTALS ──────────────────────────────────────────────── */}
                    <div className="quotation-totals-container" style={{ padding: "0 24px 24px", display: "flex", justifyContent: "flex-end" }}>
                        <table className="quotation-totals" style={{ width: "280px", borderCollapse: "collapse", fontSize: "13px" }}>
                            <tbody>
                                <tr>
                                    <td style={{ color: "#64748b", paddingBottom: "6px" }}>
                                        {tInvoice("subTotal") || "Sub Total"} 
                                    </td>
                                    <td style={{ textAlign: "right", paddingBottom: "6px", color: "#334155" }}>
                                        {formatCurrencyString(subTotal)}
                                    </td>
                                </tr>
                                {discountAmount > 0 && (
                                    <tr>
                                        <td style={{ color: "#ef4444", paddingBottom: "6px" }}>
                                            {tInvoice("discount") || "Discount"}
                                            {quotation.discount_type === "percentage" ? ` (${quotation.discount}%)` : ""} :
                                        </td>
                                        <td style={{ textAlign: "right", paddingBottom: "6px", color: "#ef4444" }}>
                                            -{formatCurrencyString(discountAmount)}
                                        </td>
                                    </tr>
                                )}
                                {taxAmount > 0 && (
                                    <tr>
                                        <td style={{ color: "#64748b", paddingBottom: "6px" }}>
                                            {tInvoice("tax") || "Tax"}
                                            {quotation.tax_type === "percentage" ? ` (${quotation.tax}%)` : ""} :
                                        </td>
                                        <td style={{ textAlign: "right", paddingBottom: "6px", color: "#334155" }}>
                                            +{formatCurrencyString(taxAmount)}
                                        </td>
                                    </tr>
                                )}
                                {/* Divider row */}
                                <tr>
                                    <td
                                        colSpan={2}
                                        style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0", paddingBottom: "8px" }}
                                    />
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>
                                        Grand Total :
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>
                                        {formatCurrencyString(grandTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── NOTES ───────────────────────────────────────────────── */}
                    {quotation.notes && (
                        <div className="quotation-notes-container" style={{ padding: "0 24px 24px" }}>
                            <div style={{
                                // borderLeft: "3px solid #e2e8f0",
                                paddingLeft: "12px",
                                paddingTop: "6px",
                                paddingBottom: "6px",
                                backgroundColor: "#f8fafc",
                                borderRadius: "0 6px 6px 0",
                                maxWidth: "420px",
                            }}>
                                <div style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "#475569",
                                    marginBottom: "4px",
                                }}>
                                    {tInvoice("notes") || "Notes & Terms"}:
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                                    {quotation.notes}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SPACER — pushes footer to bottom on short pages ──────── */}
                    <div style={{ flex: 1 }} />

                    {/* ── SIGNATURES ──────────────────────────────────────────── */}
                    <div className="quotation-sig-container" style={{ padding: "0 24px 28px" }}>
                        <table className="quotation-sig-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    {/* Company Signature */}
                                    <td style={{ verticalAlign: "bottom", width: "50%" }}>
                                        {branding.signatureImage && (
                                            <img
                                                src={branding.signatureImage}
                                                alt="Authorized Signature"
                                                style={{
                                                    height: "64px",
                                                    width: "auto",
                                                    display: "block",
                                                    marginBottom: "6px",
                                                }}
                                            />
                                        )}
                                        <div style={{
                                            width: "160px",
                                            borderTop: "1px solid #cbd5e1",
                                            marginBottom: "4px",
                                        }} />
                                        <div style={{
                                            fontSize: "9px",
                                            color: "#94a3b8",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.1em",
                                            fontWeight: 700,
                                        }}>
                                            {tInvoice("companySignature") || "Authorized Signature"}
                                        </div>
                                    </td>

                                    {/* Party Signature (toggle-able) */}
                                    {showPartySignature && (
                                        <td style={{ verticalAlign: "bottom", textAlign: "right" }}>
                                            <div style={{ display: "inline-block" }}>
                                                <div style={{
                                                    width: "192px",
                                                    height: "64px",
                                                    border: "2px dashed #e2e8f0",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    marginBottom: "6px",
                                                }}>
                                                    <span style={{
                                                        fontSize: "9px",
                                                        color: "#cbd5e1",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.1em",
                                                        fontWeight: 700,
                                                    }}>
                                                        Sign Here
                                                    </span>
                                                </div>
                                                <div style={{
                                                    width: "160px",
                                                    borderTop: "1px solid #cbd5e1",
                                                    marginBottom: "4px",
                                                    marginLeft: "auto",
                                                }} />
                                                <div style={{
                                                    fontSize: "9px",
                                                    color: "#94a3b8",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.1em",
                                                    fontWeight: 700,
                                                    textAlign: "right",
                                                }}>
                                                    {tInvoice("customerSignature") || "Party Signature"}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── FOOTER / DISCLAIMER ──────────────────────────────────── */}
                    {/*
                        Normal-flow footer. On 1-page docs the flex spacer above
                        pushes it to the very bottom. On multi-page docs it appears
                        naturally after all content on the last page — correct behaviour.
                    */}
                    <div style={{
                        borderTop: "1px solid #f1f5f9",
                        padding: "12px 24px",
                        textAlign: "center",
                    }}>
                        <p style={{ fontSize: "10px", color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
                            {tInvoice("computerGeneratedDisclaimer") || "This is a computer generated document from DukaanKhata.app"}
                        </p>
                    </div>

                </div>{/* end inner flex column */}
            </div>{/* end quotation-paper */}

            {/* ── Print CSS ───────────────────────────────────────────────────── */}
            <style jsx global>{`
                @media (max-width: 640px) {
                    .quotation-a4-header {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        text-align: center !important;
                        gap: 4px !important;
                    }
                    .quotation-a4-header td {
                        display: block !important;
                        width: 100% !important;
                        text-align: center !important;
                        padding: 0 !important;
                    }
                    .quotation-a4-header img {
                        margin: 0 auto !important;
                    }
                    .quotation-title-cell {
                        margin-top: 8px !important;
                    }
                    /* Stack Party and Quotation details on mobile */
                    .quotation-customer-meta {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 16px !important;
                    }
                    .quotation-customer-meta td {
                        display: block !important;
                        width: 100% !important;
                        padding-bottom: 0 !important;
                        text-align: left !important;
                    }
                    .quotation-customer-meta td:last-child {
                        text-align: left !important;
                    }
                    .quotation-customer-meta table {
                        margin-left: 0 !important;
                    }
                    .quotation-sig-table {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 24px !important;
                    }
                    .quotation-sig-table td {
                        display: block !important;
                        width: 100% !important;
                        text-align: left !important;
                    }
                    .quotation-sig-table td:last-child {
                        text-align: left !important;
                    }
                    .quotation-sig-table td:last-child > div {
                        margin-left: 0 !important;
                    }
                    .quotation-sig-table td:last-child > div > div:nth-child(2) {
                        margin-left: 0 !important;
                    }
                    .quotation-totals {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .quotation-paper {
                        width: 100% !important;
                        overflow-x: hidden !important;
                    }
                    .quotation-header {
                        padding: 16px 12px 12px !important;
                    }
                    .quotation-meta-container {
                        padding: 12px 12px !important;
                    }
                    .quotation-items-container {
                        padding: 0 12px 12px !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }
                    .quotation-items-table {
                        font-size: 11px !important;
                        min-width: 500px !important;
                    }
                    .quotation-items-table th, 
                    .quotation-items-table td {
                        padding: 8px 6px !important;
                    }
                    .quotation-totals-container {
                        padding: 0 12px 12px !important;
                    }
                    .quotation-notes-container {
                        padding: 0 12px 12px !important;
                    }
                    .quotation-sig-container {
                        padding: 0 12px 16px !important;
                    }
                }
                @media print {
                    body * { visibility: hidden; }
                    #quotation-paper,
                    #quotation-paper * { visibility: visible; }
                    #quotation-paper {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 10mm;
                        box-sizing: border-box;
                        border: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    @page { size: A4; margin: 0; }
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