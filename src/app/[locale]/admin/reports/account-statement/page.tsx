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
import { usePermissions } from "@/hooks/use-permissions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function AccountStatementPage() {
  const t = useTranslations("accountStatement");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { can } = usePermissions();

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
    setExportingPdf(true);

    // Give React time to mount the Dialog and reportRef container in DOM
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!reportRef.current) {
        setExportingPdf(false);
        return;
    }

    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";

      // Force columns to show for PDF capture
      if (reportRef.current) {
        reportRef.current.classList.add("is-exporting");
      }

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
            width: 1123,
            windowWidth: 1123,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "landscape"
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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
    if (balance > 0) return "text-gray-900";
    if (balance < 0) return "text-gray-900";
    return "text-gray-900";
  };

  const getTransactionType = (type: string) => {
    const types: Record<string, string> = {
      order: t("typeOrder"),
      payment_in: t("typePaymentIn"),
      payment_out: t("typePaymentOut"),
      purchase_bill: t("typePurchase"),
      purchase_bill_payment: t("typePurchaseBillPayment"),
      adjustment: t("typeAdjustment"),
      sale_return: t("typeSaleReturn"),
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
      value: (summary.totalOrders || 0) - (summary.totalPurchaseBills || 0),
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
      iconClass: "text-gray-900"
    },
    {
      title: t("currentBalance"),
      value: summary.currentBalance,
      color: summary.currentBalance > 0 ? "red" : "green",
      icon: summary.currentBalance > 0 ? TrendingUp : TrendingDown,
      bgClass: summary.currentBalance > 0 ? "bg-red-50" : "bg-green-50",
      iconClass: summary.currentBalance > 0 ? "text-gray-900" : "text-gray-900"
    }
  ] : [];

  return (
    <div className="min-h-screen md:py-6">

      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {t("title") || "Account Statement"}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          {t("modalDescription") || "Generate party statement for date range"}
        </p>
      </div>

      {/* Filter Section */}
      <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row items-end gap-3 sm:gap-4">
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
                className="w-full bg-white border-gray-200 h-9 sm:h-10 rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-sky-200"
                filterActiveOnly={true}
                enableSearch={true}
              />
            </div>

            {/* Date Range: From: & To: side-by-side in same line */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              {/* From Date */}
              <div className="flex-1 md:w-36 space-y-1">
                <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>From:</span>
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate}
                  className="bg-white border-gray-200 h-9 sm:h-10 rounded-md text-xs sm:text-sm px-2 w-full focus:ring-1 focus:ring-sky-200"
                />
              </div>

              {/* To Date */}
              <div className="flex-1 md:w-36 space-y-1">
                <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span>To:</span>
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  className="bg-white border-gray-200 h-9 sm:h-10 rounded-md text-xs sm:text-sm px-2 w-full focus:ring-1 focus:ring-sky-200"
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="w-full md:w-auto shrink-0">
              <Button
                onClick={handleGenerateStatement}
                disabled={!isFormValid || loading}
                className="w-full md:w-auto bg-sky-500 hover:bg-sky-600 text-white font-medium h-9 sm:h-10 px-5 sm:px-6 rounded-md transition-colors flex items-center justify-center gap-2 border-none shadow-sm text-xs sm:text-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{t("generateStatement") || "Generate"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards with Slider */}
      {summary && (
        <div className="relative min-w-0 max-w-full overflow-hidden">
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
                    className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? "w-6 bg-blue-500" : "w-1.5 bg-gray-300"
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
          {/* Action Bar: Download PDF Button with top spacing */}
          {can('reports', 'export_account_statement') && (
            <div className="flex justify-end pt-4 mt-3 mb-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-medium h-9 text-xs px-4 rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0"
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                <span>{t("downloadPdf") || "Download PDF"}</span>
              </Button>
            </div>
          )}

          {/* Mobile View: Cards */}
          <div className="block md:hidden space-y-3">
            {transactions.map((txn) => {
              const isOpening = txn.id === "opening_balance";
              const hasItems = txn.items && txn.items.length > 0;
              return (
                <div
                  key={txn.id}
                  className={`bg-white border rounded-lg p-3.5 shadow-sm space-y-2 ${
                    isOpening ? "bg-blue-50/40 border-blue-200" : "border-gray-100"
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">
                      {formatStatementDate(txn.dateTime)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                      {getTransactionType(txn.type)} {txn.orderId ? `(${txn.orderId})` : ""}
                    </span>
                  </div>

                  <div className="text-xs text-gray-800">
                    <div className="font-medium">{txn.description}</div>
                    {hasItems && (
                      <div className="text-[11px] text-gray-500 mt-1 space-y-0.5 pl-2 border-l-2 border-gray-200">
                        {txn.items?.map((item, itemIdx) => (
                          <div key={itemIdx}>
                            • {item.name} <span className="text-gray-400">(x{item.quantity})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
                    <div>
                      {txn.debit ? (
                        <span className="text-gray-900 font-semibold">
                          {t("debit") || "Debit"}: {formatCurrencyString(txn.debit)}
                        </span>
                      ) : txn.credit ? (
                        <span className="text-gray-900 font-semibold">
                          {t("credit") || "Credit"}: {formatCurrencyString(txn.credit)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium mr-1">{t("balance")}:</span>
                      <span className={`font-semibold ${getBalanceColor(txn.balance)}`}>
                        {formatCurrencyString(txn.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Footer Summary */}
            <div className="bg-white border border-gray-100 rounded-lg p-3.5 shadow-sm space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">{t("totalDebit")}:</span>
                <span className="font-bold text-gray-900">{formatCurrencyString(totalDebit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">{t("totalCredit")}:</span>
                <span className="font-bold text-gray-900">{formatCurrencyString(totalCredit)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 font-bold">
                <span className="text-gray-700">{t("closingBalance")}:</span>
                <span className={getBalanceColor(summary?.currentBalance || 0)}>
                  {formatCurrencyString(summary?.currentBalance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop View Table */}
          <div className="hidden md:block bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <Card className="border-none shadow-none bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[800px] md:min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-100">
                      <TableHead className="w-[100px] text-center text-xs text-gray-600 font-bold uppercase">{t("date")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-600 font-bold uppercase">{t("voucher")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-600 font-bold uppercase">{t("type")}</TableHead>
                      <TableHead className="min-w-[200px] text-xs text-gray-600 font-bold uppercase">{t("descriptionItems")}</TableHead>
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
                          <TableCell className="text-center py-2.5 text-xs text-gray-600 max-w-[100px] break-all whitespace-normal">
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
                                    <span className="ml-1">
                                      (x{item.quantity})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900">
                            {txn.debit ? formatCurrencyString(txn.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900">
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
                    <span className="ml-2 text-gray-900">
                      {formatCurrencyString(totalDebit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">{t("totalCredit")}:</span>
                    <span className="ml-2 text-gray-900">
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

          {/* PDF Preview & Auto-Download Dialog Modal */}
          <Dialog
            open={exportingPdf}
            onOpenChange={(open) => {
              if (!open) setExportingPdf(false);
            }}
          >
            <DialogContent className="max-w-6xl w-full p-4 max-h-[90vh] flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-border">
              <DialogHeader className="pb-3 border-b border-border flex flex-row items-center justify-between shrink-0">
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Printer className="h-4 w-4 text-sky-500" />
                    <span>PDF Report Preview</span>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                    <span>Preparing & downloading your Landscape account statement PDF...</span>
                  </p>
                </div>
              </DialogHeader>

              {/* Scrollable Preview Area containing printable reportRef */}
              <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 bg-zinc-200/50 dark:bg-zinc-950/50 rounded-lg my-2 hide-scrollbar">
                <div 
                  ref={reportRef} 
                  className="bg-white mx-auto text-slate-900 font-sans"
                  style={{
                    width: "1123px", // A4 Landscape roughly
                    padding: "24px",
                    boxSizing: "border-box",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    borderRadius: "4px",
                  }}
                >
                  {/* PDF Header - Minimal & Professional A4 Layout */}
                  <div className="pdf-header" style={{ display: "none", backgroundColor: "white" }}>
                    <div style={{ paddingBottom: "16px", marginBottom: "16px", borderBottom: "2px solid #0f172a" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "40%", verticalAlign: "top" }}>
                        {branding.logo && (
                          <Image
                            src={branding.logo}
                            alt="Company Logo"
                            width={140}
                            height={50}
                            unoptimized
                            style={{
                              height: "50px",
                              width: "auto",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        )}
                        <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a", textTransform: "uppercase", marginTop: branding.logo ? "4px" : "0" }}>
                          {branding.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#1e293b", fontWeight: 500, marginTop: "4px", lineHeight: 1.4 }}>
                          {branding.address}
                        </div>
                        {(branding.phone || branding.email) && (
                          <div style={{ fontSize: "10px", color: "#334155", fontWeight: 600, marginTop: "2px" }}>
                            {branding.phone ? `Phone: ${branding.phone}` : ""}
                            {branding.phone && branding.email ? " | " : ""}
                            {branding.email ? `Email: ${branding.email}` : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ width: "60%", textAlign: "right", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a", textTransform: "uppercase" }}>
                          {t("title") || "ACCOUNT STATEMENT"}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Minimal Metadata Summary Bar */}
              <div style={{ marginBottom: "16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1", backgroundColor: "#f1f5f9" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{t("customer") || "Party"}</div>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          {reportMeta?.customerName}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1", backgroundColor: "#f1f5f9" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Customer ID</div>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          {reportMeta?.customerId || "-"}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1", backgroundColor: "#f1f5f9" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Period</div>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          {reportMeta?.fromDate} to {reportMeta?.toDate}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", backgroundColor: "#f1f5f9" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Generated</div>
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          {reportMeta?.reportDate}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Main Table - Without horizontal scroll in UI */}
            <Card className="border-none shadow-none bg-white overflow-hidden">
              <div className="overflow-x-auto md:overflow-visible [.is-exporting_&]:overflow-visible">
                <Table className="min-w-[800px] md:min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-100 [.is-exporting_&]:bg-[#0f172a] [.is-exporting_&]:border-[#0f172a]">
                      <TableHead className="w-[100px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("date")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("voucher")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("type")}</TableHead>
                      <TableHead className="min-w-[200px] text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("descriptionItems")}</TableHead>
                      {/* These columns are hidden in UI but show in PDF */}
                      <TableHead className="w-[60px] text-center text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("qty")}</TableHead>
                      <TableHead className="w-[80px] text-right text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("rate")}</TableHead>
                      <TableHead className="w-[90px] text-right text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("amount")}</TableHead>
                      <TableHead className="w-[100px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("debit")}</TableHead>
                      <TableHead className="w-[100px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("credit")}</TableHead>
                      <TableHead className="w-[110px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("balance")}</TableHead>
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
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium">
                            {formatStatementDate(txn.dateTime)}
                          </TableCell>
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium max-w-[100px] break-all whitespace-normal">
                            {txn.orderId || "-"}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <span className="text-xs text-gray-900 font-medium">
                              {getTransactionType(txn.type)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="text-xs text-gray-900 font-medium">
                              {txn.description}
                            </div>
                            {hasItems && (
                              <div className="text-[10px] text-gray-800 font-medium mt-1 space-y-0.5">
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
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{item.quantity}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{formatCurrencyString(item.price)}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{formatCurrencyString(item.amount)}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-semibold">
                            {txn.debit ? formatCurrencyString(txn.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-semibold">
                            {txn.credit ? formatCurrencyString(txn.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs font-bold text-gray-900">
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
                    <span className="ml-2 text-gray-900">
                      {formatCurrencyString(totalDebit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">{t("totalCredit")}:</span>
                    <span className="ml-2 text-gray-900">
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
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}
