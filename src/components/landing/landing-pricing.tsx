"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { proAccessPaymentInfo } from "@/lib/contact-info";

const BASIC_FEATURES_COUNT = 4;
const PRO_FEATURES_COUNT = 6;

export function LandingPricing() {
  const locale = useLocale();
  const t = useTranslations("landing.pricing");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [proDialogOpen, setProDialogOpen] = useState(false);

  const basicFeatures = Array.from({ length: BASIC_FEATURES_COUNT }, (_, i) =>
    t(`basicFeature${i + 1}`),
  );
  const proFeatures = Array.from({ length: PRO_FEATURES_COUNT }, (_, i) =>
    t(`proFeature${i + 1}`),
  );
  const whatsappLink = `${proAccessPaymentInfo.proofWhatsappHref}?text=${encodeURIComponent(
    t("dialogWhatsappMessage"),
  )}`;
  const proPrice =
    billingCycle === "monthly" ? t("proPriceMonthly") : t("proPriceYearly");
  const proDescription =
    billingCycle === "monthly"
      ? t("proDescriptionMonthly")
      : t("proDescriptionYearly");
  const proBillingLabel =
    billingCycle === "monthly" ? t("billingMonthly") : t("billingYearly");

  return (
    <section
      id="pricing"
      className="w-full py-12 md:py-20 border-t border-border"
    >
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="text-left">
              <p className="text-sm font-medium text-muted-foreground">
                {t("compareTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("compareDescription")}
              </p>
            </div>

            <div className="inline-flex rounded-full border border-border bg-muted p-1">
              <Button
                type="button"
                variant={billingCycle === "monthly" ? "default" : "ghost"}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setBillingCycle("monthly")}
              >
                {t("billingMonthly")}
              </Button>
              <Button
                type="button"
                variant={billingCycle === "yearly" ? "default" : "ghost"}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setBillingCycle("yearly")}
              >
                {t("billingYearly")}
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="flex h-full flex-col p-6 text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("basicName")}
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {t("basicPrice")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("basicDescription")}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {basicFeatures.map((feature, index) => (
                  <li
                    key={`basicFeature${index + 1}`}
                    className="flex gap-3 text-sm"
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={`/${locale}/signup`} className="mt-6 block">
                <Button variant="outline" className="w-full" size="lg">
                  {t("basicButton")}
                </Button>
              </Link>
            </div>

            <div className="flex h-full flex-col p-6 text-left bg-primary/5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {t("proName")}
                </p>
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {t("popularBadge")}
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {proPrice}
                </span>
                <span className="text-sm text-muted-foreground">
                  {proBillingLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {proDescription}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                <li className="flex gap-3 text-sm">
                  <span>{t("proFeature0")}</span>
                </li>
                {proFeatures.map((feature, index) => (
                  <li
                    key={`proFeature${index + 1}`}
                    className={`flex gap-3 text-sm ${index >= 2 ? "pt-2" : ""}`}
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={() => setProDialogOpen(true)}
              >
                {t("proButton")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={proDialogOpen} onOpenChange={setProDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold text-foreground">
                {t("dialogAccountTitle", {
                  provider: proAccessPaymentInfo.provider,
                })}
              </p>
              <p className="text-muted-foreground">
                {proAccessPaymentInfo.provider}
              </p>
              <p className="font-medium text-foreground">
                {proAccessPaymentInfo.accountNumber}
              </p>
              <p className="text-muted-foreground">
                {proAccessPaymentInfo.accountHolder}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold text-foreground">
                {t("dialogWhatsappTitle")}
              </p>
              <p className="text-muted-foreground">
                {t("dialogWhatsappDescription", {
                  whatsapp: proAccessPaymentInfo.proofWhatsappDisplay,
                })}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProDialogOpen(false)}>
              {t("dialogClose")}
            </Button>
            <Button asChild>
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                {t("dialogOpenWhatsapp")}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
