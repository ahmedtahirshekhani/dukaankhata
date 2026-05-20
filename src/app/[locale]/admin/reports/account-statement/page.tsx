"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyString, formatStatementDate } from "@/lib/utils";
import {
  FileText,
  Loader2,
  Calendar,
  Search,
  Printer,
  User,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";

interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

interface Transaction {
  id: string;
  type: string;
  description?: string;
  items?: TransactionItem[];
  amount?: number;
  debit?: number;
  credit?: number;
  balance: number;
  dateTime: string;
  orderId?: string | null;
}

interface StatementSummary {
  openingBalance: number;
  totalOrders: number;
  totalPurchaseBills?: number;
  totalPaymentsIn?: number;
  totalPaymentsOut?: number;
  currentBalance: number;
}

interface ReportMeta {
  title: string;
  fromDate: string;
  toDate: string;
  reportDate: string;
  reportTime: string;
  companyName: string;
  companyAddress: string;
  companyLogo?: string | null;
  customerId: string;
  customerName: string;
}

export default function AccountStatementLatestPage() {
  const t = useTranslations("accountStatement");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // For card slider
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Fetch branding
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch(`/${locale}/api/configuration/assets`);
        if (res.ok) {
          const data = await res.json();
          setBranding({
            name: data.companyName || "",
            address: data.companyAddress || "",
            phone: data.companyPhone || "",
            email: data.companyEmail || "",
            logo: data.companyLogo || null,
          });
        }
      } catch (err) {
        console.error("Failed to load branding", err);
      }
    };
    loadBranding();
  }, [locale]);

  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setFromDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  const fetchStatement = useCallback(async () => {
    if (!selectedCustomerId || !fromDate || !toDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        customerId: selectedCustomerId,
        fromDate,
        toDate,
      });
      const res = await fetch(
        `/${locale}/api/account-statement?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        setReportMeta(data.reportMeta || null);
      } else {
        setTransactions([]);
        setSummary(null);
        setReportMeta(null);
      }
    } catch (err) {
      console.error("Failed to fetch account statement:", err);
      setTransactions([]);
      setSummary(null);
      setReportMeta(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, fromDate, toDate, locale]);

  const handleGenerateStatement = () => {
    if (!isFormValid) return;
    fetchStatement();
  };

  const isFormValid = useMemo(
    () => selectedCustomerId && fromDate && toDate,
    [selectedCustomerId, fromDate, toDate]
  );

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";
      
      // Force columns to show for PDF capture
      reportRef.current.classList.add("is-exporting");
      
      // Reset scroll for all horizontal scroll containers inside reportRef
      const scrollContainers = reportRef.current.querySelectorAll(".overflow-x-auto");
      scrollContainers.forEach((el: any) => {
        el.scrollLeft = 0;
      });

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `account-statement-${reportMeta?.customerName || "customer"}_${fromDate}_to_${toDate}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "landscape"
          },
        })
        .from(reportRef.current)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184); // #94a3b8
            pdf.text(
              tCommon("pdfWatermarkText"),
              297 / 2, // Center of landscape A4 (297mm width)
              210 - 4, // 4mm from the bottom of A4 (210mm height)
              { align: "center" }
            );
          }
        })
        .save();
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      if (pdfHeader) pdfHeader.style.display = "none";
      if (reportRef.current) reportRef.current.classList.remove("is-exporting");
      setExportingPdf(false);
    }
  }, [tCommon, reportMeta, fromDate, toDate]);

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-red-600";
    if (balance < 0) return "text-green-600";
    return "text-gray-600";
  };

  const getTransactionType = (type: string) => {
    const types: Record<string, string> = {
      order: t("typeOrder"),
      payment_in: t("typePaymentIn"),
      payment_out: t("typePaymentOut"),
      purchase_bill: t("typePurchase"),
      adjustment: t("typeAdjustment"),
      opening_balance: t("typeOpeningBalance"),
    };
    return types[type] || type;
  };

  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

  // Card slider handlers
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
    }
  }, []);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -280, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 280, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => slider.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, summary]);

  // Card data array
  const summaryCards = summary ? [
    {
      title: t("openingBalance"),
      value: summary.openingBalance,
      color: "blue",
      icon: DollarSign,
      bgClass: "bg-blue-50",
      iconClass: "text-blue-600"
    },
    {
      title: t("netOrders"),
      value: summary.totalOrders,
      color: "orange",
      icon: Receipt,
      bgClass: "bg-orange-50",
      iconClass: "text-orange-600"
    },
    {
      title: t("netPayments"),
      value: (summary.totalPaymentsIn || 0) - (summary.totalPaymentsOut || 0),
      color: "green",
      icon: ArrowRightLeft,
      bgClass: "bg-green-50",
      iconClass: "text-green-600"
    },
    {
      title: t("currentBalance"),
      value: summary.currentBalance,
      color: summary.currentBalance > 0 ? "red" : "green",
      icon: summary.currentBalance > 0 ? TrendingUp : TrendingDown,
      bgClass: summary.currentBalance > 0 ? "bg-red-50" : "bg-green-50",
      iconClass: summary.currentBalance > 0 ? "text-red-600" : "text-green-600"
    }
  ] : [];

  return (
    <div className="min-h-screen md:py-6">

        {/* Page Header */}
        <div className="mb-6 mt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-7 w-7 text-gray-700 mt-1" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {t("title") || "Account Statement"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t("modalDescription") || "Select a party and date range to generate an account statement."}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-end gap-4">
              {/* Party Selection */}
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-[13px] font-medium text-gray-700">
                  {t("selectCustomer") || "Party"}
                </Label>
                <PartyDropdown
                  value={selectedCustomerId}
                  onValueChange={(val, party) => {
                    setSelectedCustomerId(val);
                    setSelectedCustomerName(party?.name || "");
                  }}
                  placeholder={t("selectCustomerPlaceholder") || "Select Party"}
                  className="w-full bg-white border-gray-200 h-10 rounded-md text-sm focus:ring-1 focus:ring-sky-200"
                  filterActiveOnly={true}
                  enableSearch={true}
                />
              </div>

              {/* From Date */}
              <div className="w-full md:w-48 space-y-1.5">
                <Label className="text-[13px] font-medium text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {t("fromDate") || "From Date"}
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate}
                  className="bg-white border-gray-200 h-10 rounded-md text-sm focus:ring-1 focus:ring-sky-200"
                />
              </div>

              {/* To Date */}
              <div className="w-full md:w-48 space-y-1.5">
                <Label className="text-[13px] font-medium text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {t("toDate") || "To Date"}
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  className="bg-white border-gray-200 h-10 rounded-md text-sm focus:ring-1 focus:ring-sky-200"
                />
              </div>

              {/* Generate Button */}
              <div className="w-full md:w-auto">
                <Button
                  onClick={handleGenerateStatement}
                  disabled={!isFormValid || loading}
                  className="w-full md:w-auto bg-[#7CD2F1] hover:bg-[#6bc2e1] text-white font-medium h-10 px-6 rounded-md transition-colors flex items-center justify-center gap-2 border-none shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {t("generateStatement") || "Generate"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards with Slider */}
        {summary && (
          <div className="relative">
            {/* Left Arrow */}
            {showLeftArrow && (
              <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-md p-1.5 border border-gray-200 hover:bg-gray-50 transition-all md:hidden"
                style={{ transform: "translateY(-50%)" }}
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}

            {/* Right Arrow */}
            {showRightArrow && (
              <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-md p-1.5 border border-gray-200 hover:bg-gray-50 transition-all md:hidden"
                style={{ transform: "translateY(-50%)" }}
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            )}

            {/* Slider Container */}
            <div
              ref={sliderRef}
              className="flex overflow-x-auto scroll-smooth gap-4 pb-2 hide-scrollbar md:grid md:grid-cols-4 md:overflow-visible"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <style jsx>{`
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              
              {summaryCards.map((card, index) => (
                <div 
                  key={index} 
                  className="flex-shrink-0 w-[280px] md:w-auto"
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">{card.title}</p>
                          <p className={`text-lg font-semibold mt-1 ${card.title === t("currentBalance") ? getBalanceColor(card.value) : "text-gray-800"}`}>
                            {formatCurrencyString(card.value)}
                          </p>
                        </div>
                        <div className={`p-2 ${card.bgClass} rounded-lg`}>
                          <card.icon className={`h-4 w-4 ${card.iconClass}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {/* Scroll Indicator Dots for Mobile */}
            {summary && (
              <div className="flex justify-center gap-1.5 mt-3 md:hidden">
                {summaryCards.map((_, idx) => {
                  const cardWidth = 280;
                  const currentIndex = Math.round(scrollPosition / cardWidth);
                  const isActive = currentIndex === idx;
                  return (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isActive ? "w-6 bg-blue-500" : "w-1.5 bg-gray-300"
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Transactions Section */}
        {loading ? (
          <Card className="border border-gray-200">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">{t("loadingTransactions")}</span>
            </CardContent>
          </Card>
        ) : hasSearched && transactions.length === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500">{t("noTransactions")}</p>
              <p className="text-xs text-gray-400 mt-1">Try different date range</p>
            </CardContent>
          </Card>
        ) : transactions.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={exportingPdf}
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                {t("downloadPdf")}
              </Button>
            </div>

            {/* Report Container for PDF */}
            <div ref={reportRef}>
              {/* PDF Header */}
              <div className="pdf-header" style={{ display: "none", backgroundColor: "white" }}>
                <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: "25%", verticalAlign: "top" }}>
                          {branding.logo && (
                            <Image
                              src={branding.logo}
                              alt="Company Logo"
                              width={150}
                              height={64}
                              unoptimized
                              style={{
                                height: "64px",
                                width: "auto",
                                objectFit: "contain",
                                display: "block",
                              }}
                            />
                          )}
                        </td>
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
                                      <span style={{ fontSize: "12px", marginRight: "4px" }}>☎</span>
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
                                      <span style={{ fontSize: "12px", marginRight: "4px" }}>✉</span>
                                      <span style={{ textTransform: "lowercase" }}>{branding.email}</span>
                                    </td>
                                  )}
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </td>
                        <td style={{ width: "25%", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{
                            fontWeight: 900,
                            fontSize: "22px",
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "-0.5px",
                          }}>
                            {t("title")}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[11px]">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500 font-medium">{t("customer")}:</span>
                      <span className="font-bold">{reportMeta?.customerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500 font-medium">Customer ID:</span>
                      <span className="font-medium text-gray-700">{reportMeta?.customerId}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500 font-medium">{t("period")}:</span>
                      <span className="font-medium text-gray-700">{reportMeta?.fromDate} to {reportMeta?.toDate}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500 font-medium">Generated On:</span>
                      <span className="font-medium text-gray-700">{reportMeta?.reportDate} at {reportMeta?.reportTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Table - Without horizontal scroll in UI */}
              <Card className="border-none shadow-none bg-white overflow-hidden">
                <div className="overflow-x-auto md:overflow-visible [.is-exporting_&]:overflow-visible">
                  <Table className="min-w-[800px] md:min-w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-b border-gray-100">
                        <TableHead className="w-[100px] text-center text-xs text-gray-600 font-bold uppercase">{t("date")}</TableHead>
                        <TableHead className="w-[80px] text-center text-xs text-gray-600 font-bold uppercase">{t("voucher")}</TableHead>
                        <TableHead className="w-[80px] text-center text-xs text-gray-600 font-bold uppercase">{t("type")}</TableHead>
                        <TableHead className="min-w-[200px] text-xs text-gray-600 font-bold uppercase">{t("descriptionItems")}</TableHead>
                        {/* These columns are hidden in UI but show in PDF */}
                        <TableHead className="w-[60px] text-center text-xs text-gray-600 font-bold uppercase hidden [.is-exporting_&]:table-cell print:table-cell">{t("qty")}</TableHead>
                        <TableHead className="w-[80px] text-right text-xs text-gray-600 font-bold uppercase hidden [.is-exporting_&]:table-cell print:table-cell">{t("rate")}</TableHead>
                        <TableHead className="w-[90px] text-right text-xs text-gray-600 font-bold uppercase hidden [.is-exporting_&]:table-cell print:table-cell">{t("amount")}</TableHead>
                        <TableHead className="w-[100px] text-right text-xs text-gray-600 font-bold uppercase">{t("debit")}</TableHead>
                        <TableHead className="w-[100px] text-right text-xs text-gray-600 font-bold uppercase">{t("credit")}</TableHead>
                        <TableHead className="w-[110px] text-right text-xs text-gray-600 font-bold uppercase">{t("balance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn, idx) => {
                        const hasItems = txn.items && txn.items.length > 0;
                        const isOpening = txn.id === "opening_balance";
                        return (
                          <TableRow
                            key={txn.id}
                            className={`${isOpening ? "bg-blue-50/30" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} border-b border-gray-100`}
                          >
                            <TableCell className="text-center py-2.5 text-xs text-gray-700">
                              {formatStatementDate(txn.dateTime)}
                            </TableCell>
                            <TableCell className="text-center py-2.5 text-xs text-gray-600">
                              {txn.orderId || "-"}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <span className="text-xs text-gray-600">
                                {getTransactionType(txn.type)}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="text-xs text-gray-700">
                                {txn.description}
                              </div>
                              {hasItems && (
                                <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                                  {txn.items?.map((item, itemIdx) => (
                                    <div key={itemIdx}>
                                      • {item.name} 
                                      {/* Show quantity inline only in UI, not in separate column */}
                                      <span className="inline md:inline [.is-exporting_&]:hidden print:hidden ml-1">
                                        (x{item.quantity})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            {/* PDF-only columns - show quantity, rate, amount in separate lines for PDF */}
                            <TableCell className="text-center py-2.5 text-xs text-gray-600 hidden [.is-exporting_&]:table-cell print:table-cell">
                              {hasItems ? (
                                <div className="space-y-0.5">
                                  {txn.items?.map((item, itemIdx) => (
                                    <div key={itemIdx}>{item.quantity}</div>
                                  ))}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 text-xs text-gray-600 hidden [.is-exporting_&]:table-cell print:table-cell">
                              {hasItems ? (
                                <div className="space-y-0.5">
                                  {txn.items?.map((item, itemIdx) => (
                                    <div key={itemIdx}>{formatCurrencyString(item.price)}</div>
                                  ))}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 text-xs text-gray-700 hidden [.is-exporting_&]:table-cell print:table-cell">
                              {hasItems ? (
                                <div className="space-y-0.5">
                                  {txn.items?.map((item, itemIdx) => (
                                    <div key={itemIdx}>{formatCurrencyString(item.amount)}</div>
                                  ))}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 text-xs text-red-600">
                              {txn.debit ? formatCurrencyString(txn.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 text-xs text-green-600">
                              {txn.credit ? formatCurrencyString(txn.credit) : "-"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 text-xs font-medium">
                              <span className={getBalanceColor(txn.balance)}>
                                {formatCurrencyString(txn.balance)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Summary */}
                <div className="border-t border-gray-100 bg-gray-50/30 p-3">
                  <div className="flex justify-end gap-6 text-xs font-bold uppercase">
                    <div>
                      <span className="text-gray-400">{t("totalDebit")}:</span>
                      <span className="ml-2 text-red-600">
                        {formatCurrencyString(totalDebit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">{t("totalCredit")}:</span>
                      <span className="ml-2 text-green-600">
                        {formatCurrencyString(totalCredit)}
                      </span>
                    </div>
                    <div className="pl-4 border-l border-gray-200">
                      <span className="text-gray-400">{t("closingBalance")}:</span>
                      <span className={`ml-2 ${getBalanceColor(summary?.currentBalance || 0)}`}>
                        {formatCurrencyString(summary?.currentBalance || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
    </div>
  );
}
