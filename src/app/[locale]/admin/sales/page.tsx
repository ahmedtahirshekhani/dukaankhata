"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Receipt, Coins, RotateCcw, Store } from "lucide-react";

export default function SalesModulePage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tSales = useTranslations("salesModule");

  const salesList = [
    {
      title: tNav("quotations"),
      description: tNav("quotationsDescription") || "Create, manage, and print quotations/estimates",
      href: `/${locale}/admin/sales/quotations`,
      icon: FileText,
      color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20",
    },
    {
      title: tNav("invoice"),
      description: tNav("invoiceDescription") || "Manage invoice transactions",
      href: `/${locale}/admin/sales/invoice`,
      icon: Receipt,
      color: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20",
    },
    {
      title: tNav("paymentIn"),
      description: tNav("paymentInDescription") || "Record party payments received",
      href: `/${locale}/admin/sales/payment-in`,
      icon: Coins,
      color: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20",
    },
    {
      title: tNav("saleReturn"),
      description: tNav("saleReturnDescription") || "Record party transactions",
      href: `/${locale}/admin/sales/sale-return`,
      icon: RotateCcw,
      color: "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20",
    },
    {
      title: tNav("counterSale"),
      description: tNav("counterSaleDescription") || "Payment processing",
      href: `/${locale}/admin/sales/counter-sale`,
      icon: Store,
      color: "bg-violet-500/10 text-violet-500 dark:bg-violet-500/20",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
          {tNav("sales")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {tNav("salesDescription")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {salesList.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card key={idx} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-foreground/20">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-300">
                <Icon className="h-32 w-32" />
              </div>
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className={`p-3 rounded-2xl ${item.color} transition-transform duration-300 group-hover:scale-105`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-xl font-bold">{item.title}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
                    {item.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Button asChild className="group-hover:translate-x-1 transition-transform duration-200">
                  <Link href={item.href}>
                    {tSales("openModule")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
