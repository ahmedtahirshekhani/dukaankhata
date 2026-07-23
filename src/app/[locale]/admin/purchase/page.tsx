"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, CreditCard } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PurchaseModulePage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tPurchase = useTranslations("purchaseModule");
  const { can } = usePermissions();
  const router = useRouter();

  const hasPurchaseSub = can('purchase', 'view_purchase_bill') || can('purchase', 'view_payment_out');

  useEffect(() => {
    if (!hasPurchaseSub) {
      router.replace(`/${locale}/admin`);
    }
  }, [hasPurchaseSub, router, locale]);

  const purchaseList = [
    {
      title: tNav("purchaseBill"),
      description: tNav("purchaseBillDescription") || "Manage purchase bills and receipts",
      href: `/${locale}/admin/purchase/purchase-bill`,
      icon: Receipt,
      color: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20",
    },
    {
      title: tNav("paymentOut"),
      description: tNav("paymentOutDescription") || "Record vendor payments paid",
      href: `/${locale}/admin/purchase/payment-out`,
      icon: CreditCard,
      color: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          {tNav("purchase")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {tNav("purchaseDescription")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {purchaseList
          .filter(item => {
            if (item.href.includes('purchase-bill') && !can('purchase', 'view_purchase_bill')) return false;
            if (item.href.includes('payment-out') && !can('purchase', 'view_payment_out')) return false;
            return true;
          })
          .map((item, idx) => {
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
                    {tPurchase("openModule")}
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
