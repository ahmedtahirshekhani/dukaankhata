"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Package, Users, TrendingUp } from "lucide-react";

export default function ReportsModulePage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tReports = useTranslations("reportsModule");
  const tCommon = useTranslations("common");

  const reportsList = [
    {
      title: tNav("accountStatement"),
      description: tNav("accountStatementDescription") || "View party account statements",
      href: `/${locale}/admin/reports/account-statement`,
      icon: FileText,
      color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20",
      isComingSoon: false,
    },
    {
      title: tNav("stockReport"),
      description: tNav("stockReportDescription") || "View current stock levels, valuation, and inventory details",
      href: `/${locale}/admin/reports/stock`,
      icon: Package,
      color: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20",
      isComingSoon: false,
    },
    {
      title: tNav("receivableSummary"),
      description: tNav("receivableSummaryDescription") || "Summary of outstanding receivables from all parties",
      href: `/${locale}/admin/reports/receivable-summary`,
      icon: Users,
      color: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20",
      isComingSoon: false,
    },
    {
      title: tNav("profitability"),
      description: tNav("profitabilityDescription") || "Track business revenue, expenses, and net profit margins",
      href: `/${locale}/admin/reports/profitability`,
      icon: TrendingUp,
      color: "bg-violet-500/10 text-violet-500 dark:bg-violet-500/20",
      isComingSoon: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{tNav("reports")}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">{tNav("reportsDescription")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {reportsList.map((report, idx) => {
          const Icon = report.icon;
          return (
            <Card key={idx} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-foreground/20">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-300">
                <Icon className="h-32 w-32" />
              </div>
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className={`p-3 rounded-2xl ${report.color} transition-transform duration-300 group-hover:scale-105`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-xl font-bold">{report.title}</CardTitle>
                    {report.isComingSoon && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
                        {tCommon("comingSoon") || "Coming Soon"}
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
                    {report.description}
                  </CardDescription>
                </div>
              </CardHeader>
              {!report.isComingSoon && (
                <CardContent className="pt-2">
                  <Button asChild className="group-hover:translate-x-1 transition-transform duration-200">
                    <Link href={report.href}>
                      {tReports("openModule")}
                    </Link>
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
