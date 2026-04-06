"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PurchaseModulePage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tPurchase = useTranslations("purchaseModule");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tNav("purchase")}</h1>
        <p className="text-sm text-muted-foreground">{tNav("purchaseDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tNav("paymentOut")}</CardTitle>
            <CardDescription>{tNav("paymentOutDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/admin/payment-out`}>{tPurchase("openModule")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
