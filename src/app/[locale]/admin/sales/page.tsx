"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SalesModulePage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tSales = useTranslations("salesModule");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tNav("sales")}</h1>
        <p className="text-sm text-muted-foreground">{tNav("salesDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{tNav("quotations")}</CardTitle>
            <CardDescription>{tNav("quotationsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/quotations`}>{tSales("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tNav("invoice")}</CardTitle>
            <CardDescription>{tNav("invoiceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/invoice`}>{tSales("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tNav("paymentIn")}</CardTitle>
            <CardDescription>{tNav("paymentInDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/payment-in`}>{tSales("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tNav("saleReturn")}</CardTitle>
            <CardDescription>{tNav("saleReturnDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/sale-return`}>{tSales("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tNav("counterSale")}</CardTitle>
            <CardDescription>{tNav("counterSaleDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/counter-sale`}>{tSales("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
