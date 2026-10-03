"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag, Sparkles, Clock, TrendingUp } from "lucide-react";

export default function SaleReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tReports = useTranslations("reportsModule");

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={tNav("saleReport")}
        description={tNav("saleReportDescription")}
      />

      <Card className="relative overflow-hidden border-border/50 bg-gradient-to-b from-card to-card/60 shadow-sm">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <ShoppingBag className="h-64 w-64 text-foreground" />
        </div>

        <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center sm:py-24 sm:px-6">
          <div className="relative mb-6">
            <div className="absolute -inset-2 rounded-full bg-teal-500/20 blur-xl animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/30 shadow-inner">
              <ShoppingBag className="h-10 w-10" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20 mb-4">
            <Clock className="h-3.5 w-3.5" />
            <span>{tCommon("comingSoon")}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
            {tNav("saleReport")}
          </h2>

          <p className="max-w-md text-sm sm:text-base text-muted-foreground mb-6">
            {tReports("comingSoonDescription")}
          </p>

          <p className="max-w-sm text-xs sm:text-sm text-muted-foreground/80 mb-8">
            {tReports("stayTuned")}
          </p>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/${locale}/admin/reports`}>
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
