// src/app/[locale]/admin/reports/item-wise-sales/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  Package,
  DollarSign,
  Percent,
  Award,
  Loader2,
  Tag,
  Receipt,
  Sparkles
} from "lucide-react";
import { exportItemWiseSalesToExcel } from "@/lib/excel";
import { formatReadableDate, toHTMLDateString } from "@/lib/date-utils";
import { ItemSaleRecord, ItemWiseSaleSummary } from "@/types/item-wise-sales";
import { ReportPdfHeader, ReportPdfKpi, ReportPdfMetaItem } from "@/components/reports/report-pdf-header";
import { getUomShortcut } from "@/lib/uom";

export default function ItemWiseSaleReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("itemWiseSaleReportPage");
  const { can } = usePermissions();

  // Date States (default: Last 30 Days)
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toHTMLDateString(d);
  });
  const [toDate, setToDate] = useState<string>(() => toHTMLDateString(new Date()));
  const [activePreset, setActivePreset] = useState<string>("last30Days");

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [sortBy, setSortBy] = useState<string>("totalRevenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Data States
  const [items, setItems] = useState<ItemSaleRecord[]>([]);
  const [summary, setSummary] = useState<ItemWiseSaleSummary>({
    totalProductsCount: 0,
    totalItemsSold: 0,
    totalGrossRevenue: 0,
    totalDiscountGiven: 0,
    totalNetRevenue: 0,
    totalProfitEarned: 0,
    overallProfitMargin: 0,
    topSellingItem: null,
    topRevenueItem: null,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Branding State
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Printable Report Ref for PDF
  const reportRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch Branding Info
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
        console.error("Failed to load branding assets", err);
      }
    };
    loadBranding();
  }, [locale]);

  // 2. Fetch Categories for Filter Dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch(`/${locale}/api/categories`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.categories || [];
          setCategories(
            list.map((c: any) => ({
              id: c.id || c._id,
              name: c.category_name || c.name,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    loadCategories();
  }, [locale]);

  // 3. Preset Date Range Handler
  const handleDatePreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case "today":
        start = new Date();
        end = new Date();
        break;
      case "yesterday":
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case "thisWeek": {
        const day = now.getDay();
        const diff = (day + 6) % 7;
        start.setDate(start.getDate() - diff);
        break;
      }
      case "lastWeek": {
        const day = now.getDay();
        const diff = (day + 6) % 7;
        start.setDate(start.getDate() - diff - 7);
        end.setDate(end.getDate() - diff - 1);
        break;
      }
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last30Days":
        start.setDate(start.getDate() - 30);
        break;
      case "ytd":
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }

    setFromDate(toHTMLDateString(start));
    setToDate(toHTMLDateString(end));
    setCurrentPage(1);
  };

  // 4. Fetch Report Data
  const fetchReport = useCallback(
    async (isExport = false) => {
      if (!fromDate || !toDate) return;

      if (!isExport) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          fromDate,
          toDate,
          page: String(isExport ? 1 : currentPage),
          limit: String(isExport ? -1 : pageSize),
          category: selectedCategory,
          search: searchQuery,
          sortBy,
          sortOrder,
        });

        const res = await fetch(`/${locale}/api/reports/item-wise-sales?${params.toString()}`, {
          signal: isExport ? undefined : abortControllerRef.current?.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (isExport) {
            return data;
          }
          setItems(data.items || []);
          setSummary(data.summary || {
            totalProductsCount: 0,
            totalItemsSold: 0,
            totalGrossRevenue: 0,
            totalDiscountGiven: 0,
            totalNetRevenue: 0,
            totalProfitEarned: 0,
            overallProfitMargin: 0,
            topSellingItem: null,
            topRevenueItem: null,
          });
          setTotalCount(data.pagination?.totalCount || 0);
        } else {
          if (!isExport) {
            setItems([]);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to load Item Wise Sale Report:", err);
        }
      } finally {
        if (!isExport) {
          setLoading(false);
        }
      }
    },
    [locale, fromDate, toDate, currentPage, pageSize, selectedCategory, searchQuery, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // 5. Export to Excel
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const exportData = await fetchReport(true);
      if (exportData && exportData.items) {
        exportItemWiseSalesToExcel(
          exportData.items,
          exportData.summary,
          fromDate,
          toDate,
          `item-wise-sales-report-${fromDate}_to_${toDate}.xlsx`
        );
      }
    } catch (err) {
      console.error("Failed to export Excel:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 6. Export to PDF (html2pdf.js)
  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!reportRef.current) {
      setIsExportingPdf(false);
      return;
    }

    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";
      reportRef.current.classList.add("is-exporting");

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `item-wise-sales-report-${fromDate}_to_${toDate}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
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
            orientation: "landscape",
          },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(reportRef.current)
        .save();
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      if (pdfHeader) pdfHeader.style.display = "none";
      if (reportRef.current) reportRef.current.classList.remove("is-exporting");
      setIsExportingPdf(false);
    }
  }, [fromDate, toDate]);

  const formatCurrency = (amount: number) => {
    return `Rs. ${Math.round(amount).toLocaleString("en-PK")}`;
  };

  const pdfKpis: ReportPdfKpi[] = useMemo(
    () => [
      { label: "Total Products", value: summary.totalProductsCount },
      { label: "Units Sold", value: `${summary.totalItemsSold}` },
      { label: "Gross Sales", value: formatCurrency(summary.totalGrossRevenue) },
      { label: "Discounts", value: formatCurrency(summary.totalDiscountGiven) },
      { label: "Net Revenue", value: formatCurrency(summary.totalNetRevenue), highlight: true },
      {
        label: "Gross Profit",
        value: `${formatCurrency(summary.totalProfitEarned)} (${summary.overallProfitMargin}%)`,
        highlight: true,
      },
    ],
    [summary]
  );

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    const list: ReportPdfMetaItem[] = [];
    if (selectedCategory && selectedCategory !== "all") {
      list.push({ label: "Category", value: selectedCategory });
    }
    if (searchQuery) {
      list.push({ label: "Search Keyword", value: searchQuery });
    }
    return list;
  }, [selectedCategory, searchQuery]);

  // DataTable Columns Definition
  const columns: ColumnDef<ItemSaleRecord>[] = useMemo(
    () => [
      {
        id: "rank",
        header: t("rank"),
        className: "w-10 text-center",
        cell: (_, idx) => {
          const rank = (currentPage - 1) * pageSize + idx + 1;
          return rank <= 3 ? (
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                rank === 1
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  : rank === 2
                  ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}
            >
              {rank}
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">{rank}</span>
          );
        },
      },
      {
        id: "productName",
        accessorKey: "productName",
        header: t("item"),
        sortable: true,
        className: "min-w-[180px]",
        cell: (row) => (
          <div>
            <div className="font-semibold text-xs text-foreground">{row.productName}</div>
            {row.sku && row.sku !== "-" && (
              <span className="text-[10px] text-muted-foreground">SKU: {row.sku}</span>
            )}
          </div>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        header: t("category"),
        className: "w-[110px]",
        cell: (row) => (
          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
            {row.category || "Uncategorized"}
          </Badge>
        ),
      },
      {
        id: "totalQuantitySold",
        accessorKey: "totalQuantitySold",
        header: t("qtySold"),
        sortable: true,
        className: "w-[90px] text-right justify-end",
        cell: (row) => (
          <div className="text-right">
            <div className="font-medium text-xs">
              {row.totalQuantitySold} <span className="text-[10px] text-muted-foreground">{getUomShortcut(row.uom) || "pcs"}</span>
            </div>
            {Boolean(row.totalReturnedQuantity && row.totalReturnedQuantity > 0) && (
              <div className="text-[9px] text-rose-500 font-normal">
                -{row.totalReturnedQuantity} ret
              </div>
            )}
          </div>
        ),
      },
      {
        id: "avgSellingPrice",
        header: t("avgPrice"),
        className: "w-[95px] text-right justify-end",
        cell: (row) => (
          <div>
            <div className="text-xs font-medium">{formatCurrency(row.avgSellingPrice)}</div>
            {row.minSellPrice !== row.maxSellPrice && (
              <div className="text-[9px] text-muted-foreground">
                {Math.round(row.minSellPrice)} - {Math.round(row.maxSellPrice)}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "totalDiscount",
        header: t("discount"),
        className: "w-[85px] text-right justify-end",
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.totalDiscount > 0 ? formatCurrency(row.totalDiscount) : "-"}
          </span>
        ),
      },
      {
        id: "totalRevenue",
        accessorKey: "totalRevenue",
        header: t("netRevenue"),
        sortable: true,
        className: "w-[110px] text-right justify-end",
        cell: (row) => (
          <span className="text-xs font-bold text-foreground">
            {formatCurrency(row.totalRevenue)}
          </span>
        ),
      },
      {
        id: "totalProfit",
        accessorKey: "totalProfit",
        header: t("profit"),
        sortable: true,
        className: "w-[100px] text-right justify-end",
        cell: (row) => (
          <div>
            <div className={`text-xs font-semibold ${row.totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatCurrency(row.totalProfit)}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {row.profitMargin}% margin
            </div>
          </div>
        ),
      },
      {
        id: "currentStock",
        header: t("currentStock"),
        className: "w-[105px] text-center",
        cell: (row) => {
          const qty = typeof row.currentStock === "number" ? row.currentStock : 0;
          const isOut = qty <= 0;
          const isLow = qty > 0 && qty <= 5;
          return (
            <div className="flex flex-col items-center justify-center gap-0.5">
              <span
                className={`font-semibold text-xs ${
                  isOut
                    ? "text-rose-600 dark:text-rose-400"
                    : isLow
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {qty} <span className="text-[10px] text-muted-foreground">{getUomShortcut(row.uom) || "pcs"}</span>
              </span>
              {isOut && (
                <Badge variant="destructive" className="text-[8px] h-4 px-1 py-0 font-medium">
                  {t("outOfStock")}
                </Badge>
              )}
              {isLow && (
                <Badge
                  variant="secondary"
                  className="text-[8px] h-4 px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 font-medium"
                >
                  {t("lowStock")}
                </Badge>
              )}
            </div>
          );
        },
      },
    ],
    [currentPage, pageSize, t]
  );

  return (
    <div className="p-1 sm:p-1 w-full space-y-1">
      {/* Compact Page Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-7 w-7 rounded-full">
              <Link href={`/${locale}/admin/reports`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-xl font-bold">{t("title")}</span>
          </div>
        }
        description={t("description")}
        className="mb-1"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            {can("reports", "export_item_wise_sales") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel || loading || items.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  {isExportingExcel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>{t("exportExcel")}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || loading || items.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  <span>{t("downloadPdf")}</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Date Presets Row */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: "today", label: "Today" },
          { key: "yesterday", label: "Yesterday" },
          { key: "thisWeek", label: "This Week" },
          { key: "lastWeek", label: "Last Week" },
          { key: "thisMonth", label: "This Month" },
          { key: "lastMonth", label: "Last Month" },
          { key: "last30Days", label: "Last 30 Days" },
          { key: "ytd", label: "YTD" },
        ].map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? "default" : "outline"}
            size="sm"
            onClick={() => handleDatePreset(preset.key)}
            className="h-6 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Compact Filters Toolbar */}
      <Card className="p-2.5 sm:p-3 border-border/60 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground w-12 shrink-0">{t("fromDate")}:</span>
            <DatePicker
              value={fromDate}
              onChange={(val) => {
                setFromDate(val);
                setActivePreset("custom");
                setCurrentPage(1);
              }}
              className="h-7 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground w-10 shrink-0">{t("toDate")}:</span>
            <DatePicker
              value={toDate}
              onChange={(val) => {
                setToDate(val);
                setActivePreset("custom");
                setCurrentPage(1);
              }}
              className="h-7 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground w-14 shrink-0">{t("category")}:</span>
            <Select
              value={selectedCategory}
              onValueChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder={t("allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground w-12 shrink-0">{t("sortBy")}:</span>
            <Select value={sortBy} onValueChange={(val) => handleSort(val)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totalRevenue">{t("sortRevenue")}</SelectItem>
                <SelectItem value="totalQuantitySold">{t("sortQuantity")}</SelectItem>
                <SelectItem value="totalProfit">{t("sortProfit")}</SelectItem>
                <SelectItem value="productName">{t("sortName")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards using Reusable StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <StatCard
          title={t("totalNetRevenue")}
          value={summary.totalNetRevenue}
          icon={<DollarSign className="h-3.5 w-3.5 text-indigo-600" />}
          isPrivacy={false}
          currency="Rs."
          isLoading={loading}
        />

        <StatCard
          title={t("totalUnitsSold")}
          value={summary.totalItemsSold}
          icon={<Package className="h-3.5 w-3.5 text-emerald-600" />}
          isPrivacy={false}
          isLoading={loading}
        />

        <StatCard
          title="Gross Sales"
          value={summary.totalGrossRevenue}
          icon={<Receipt className="h-3.5 w-3.5 text-blue-600" />}
          isPrivacy={false}
          currency="Rs."
          isLoading={loading}
        />

        <StatCard
          title={t("totalDiscount")}
          value={summary.totalDiscountGiven}
          icon={<Tag className="h-3.5 w-3.5 text-amber-600" />}
          isPrivacy={false}
          currency="Rs."
          isLoading={loading}
        />

        <StatCard
          title={t("grossProfit")}
          value={summary.totalProfitEarned}
          icon={<TrendingUp className="h-3.5 w-3.5 text-violet-600" />}
          isPrivacy={false}
          currency="Rs."
          isLoading={loading}
        />

        <StatCard
          title="Profit Margin"
          value={summary.overallProfitMargin}
          icon={<Percent className="h-3.5 w-3.5 text-pink-600" />}
          isPrivacy={false}
          currency="%"
          isLoading={loading}
        />
      </div>

      {/* Top Performers Banner Strip */}
      {(summary.topSellingItem || summary.topRevenueItem) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {summary.topSellingItem && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
              <Award className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-amber-800 dark:text-amber-300">Top Selling: </span>
                <span className="font-bold">{summary.topSellingItem.name}</span>
                <span className="text-muted-foreground ml-1">({summary.topSellingItem.quantity} units)</span>
              </div>
            </div>
          )}

          {summary.topRevenueItem && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-indigo-800 dark:text-indigo-300">Top Revenue: </span>
                <span className="font-bold">{summary.topRevenueItem.name}</span>
                <span className="text-muted-foreground ml-1">({formatCurrency(summary.topRevenueItem.revenue)})</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Data Table Component */}
      <DataTable
        columns={columns}
        data={items}
        isLoading={loading}
        sortConfig={{ key: sortBy, direction: sortOrder }}
        onSort={(key) => handleSort(key)}
        pageSize={pageSize}
        currentPage={currentPage}
        totalCount={totalCount}
        onPageChange={(page) => setCurrentPage(page)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        searchTerm={searchQuery}
        onSearchChange={(term) => {
          setSearchQuery(term);
          setCurrentPage(1);
        }}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noData")}
        keyExtractor={(row, index) => row.productId || row._id || index.toString()}
        renderMobileCard={(row) => (
          <div className="border rounded-lg p-3 shadow-xs bg-card space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-foreground">{row.productName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {row.category} {row.sku && row.sku !== "-" ? `• SKU: ${row.sku}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-foreground">{formatCurrency(row.totalRevenue)}</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Profit: {formatCurrency(row.totalProfit)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">Qty Sold</span>
                <span className="font-semibold">{row.totalQuantitySold} {getUomShortcut(row.uom) || "pcs"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Avg Rate</span>
                <span className="font-semibold">{formatCurrency(row.avgSellingPrice)}</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px]">Stock</span>
                <span
                  className={
                    row.currentStock <= 0
                      ? "font-bold text-rose-600"
                      : row.currentStock <= 5
                      ? "font-bold text-amber-600"
                      : "font-medium text-emerald-600"
                  }
                >
                  {row.currentStock} {getUomShortcut(row.uom) || "pcs"}
                </span>
              </div>
            </div>
          </div>
        )}
      />

      {/* PDF Export Modal */}
      <Dialog
        open={isExportingPdf}
        onOpenChange={(open) => {
          if (!open) setIsExportingPdf(false);
        }}
      >
        <DialogContent className="max-w-6xl w-full p-4 max-h-[90vh] flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-border">
          <DialogHeader className="pb-2 border-b border-border flex flex-row items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Printer className="h-4 w-4 text-indigo-500" />
                <span>PDF Report Preview</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                <span>Preparing & downloading your Item Wise Sale Report PDF...</span>
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 bg-zinc-200/50 dark:bg-zinc-950/50 rounded-lg my-2 hide-scrollbar">
            <div
              ref={reportRef}
              className="bg-white mx-auto text-slate-900 font-sans"
              style={{
                width: "1123px",
                padding: "20px",
                boxSizing: "border-box",
                borderRadius: "4px",
              }}
            >
              {/* Reusable Global Report PDF Header with Branding, Meta & KPIs */}
              <ReportPdfHeader
                branding={branding}
                title="ITEM WISE SALE REPORT"
                fromDate={fromDate}
                toDate={toDate}
                metaItems={pdfMetaItems}
                kpis={pdfKpis}
              />

        {/* Printable Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
              <th style={{ padding: "5px 6px", textAlign: "center", width: "35px" }}>#</th>
              <th style={{ padding: "5px 6px", textAlign: "left" }}>Item Name</th>
              <th style={{ padding: "5px 6px", textAlign: "left", width: "100px" }}>SKU</th>
              <th style={{ padding: "5px 6px", textAlign: "left", width: "110px" }}>Category</th>
              <th style={{ padding: "5px 6px", textAlign: "right", width: "75px" }}>Qty Sold</th>
              <th style={{ padding: "5px 6px", textAlign: "right", width: "85px" }}>Avg Rate</th>
              <th style={{ padding: "5px 6px", textAlign: "right", width: "75px" }}>Discount</th>
              <th style={{ padding: "5px 6px", textAlign: "right", width: "100px" }}>Net Sales</th>
              <th style={{ padding: "5px 6px", textAlign: "right", width: "90px" }}>Profit</th>
              <th style={{ padding: "5px 6px", textAlign: "center", width: "65px" }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.productId || idx}
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                }}
              >
                <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: "bold", color: "#64748b" }}>
                  {idx + 1}
                </td>
                <td style={{ padding: "5px 6px", fontWeight: "bold", color: "#0f172a" }}>
                  {item.productName}
                </td>
                <td style={{ padding: "5px 6px", color: "#475569" }}>{item.sku || "-"}</td>
                <td style={{ padding: "5px 6px", color: "#475569" }}>{item.category || "-"}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>
                  {item.totalQuantitySold} {getUomShortcut(item.uom) || "pcs"}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right" }}>
                  {formatCurrency(item.avgSellingPrice)}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", color: "#64748b" }}>
                  {item.totalDiscount > 0 ? formatCurrency(item.totalDiscount) : "-"}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold", color: "#0f172a" }}>
                  {formatCurrency(item.totalRevenue)}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "bold", color: item.totalProfit >= 0 ? "#059669" : "#dc2626" }}>
                  {formatCurrency(item.totalProfit)}
                </td>
                <td
                  style={{
                    padding: "5px 6px",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: item.currentStock <= 0 ? "#dc2626" : item.currentStock <= 5 ? "#d97706" : "#0f172a",
                  }}
                >
                  {item.currentStock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

              <div style={{ marginTop: "10px", borderTop: "2px solid #0f172a", paddingTop: "6px" }}>
                <table style={{ width: "100%", fontSize: "10px", fontWeight: "bold" }}>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "left" }}>Total Records: {totalCount} Items</td>
                      <td style={{ textAlign: "right" }}>
                        Total Net Revenue: <span style={{ fontSize: "12px", color: "#0f172a" }}>{formatCurrency(summary.totalNetRevenue)}</span>
                        {" | "}
                        Total Profit: <span style={{ fontSize: "12px", color: "#059669" }}>{formatCurrency(summary.totalProfitEarned)}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
