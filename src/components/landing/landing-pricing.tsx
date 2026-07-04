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
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");

  const proFeatures = Array.from({ length: PRO_FEATURES_COUNT }, (_, i) =>
    t(`proFeature${i + 1}`),
  );
  // Dynamic values from env
  const envPlanName = process.env.NEXT_PUBLIC_PRO_PLAN_NAME || t("proName");
  const envPlanPrice = process.env.NEXT_PUBLIC_PRO_PLAN_PRICE || "1000";
  const trialDays = process.env.NEXT_PUBLIC_TRIAL_NUMBER_OF_DAYS || "7";

  const whatsappMessage = selectedPlan === "monthly"
    ? t("dialogWhatsappMessageMonthly")
    : t("dialogWhatsappMessageYearly");

  const whatsappLink = `${proAccessPaymentInfo.proofWhatsappHref}?text=${encodeURIComponent(
    whatsappMessage,
  )}`;

  return (
    <section
      id="pricing"
      className="w-full py-12 md:py-20 border-t border-border"
    >
      <div className="container mx-auto px-4">
        <div className="text-center space-y-6 mb-10">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("title")}
            </h2>
            <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
          {/* Monthly Card */}
          <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden flex flex-col justify-between">
            <div className="flex h-full flex-col p-8 text-left bg-gradient-to-b from-primary/5 to-transparent">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {envPlanName} - {t("billingMonthly")}
                </p>
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                  {t("popularBadge")}
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-foreground tracking-tight">
                  Rs.{envPlanPrice}
                </span>
                <span className="text-muted-foreground text-sm font-medium">/{t("billingMonthly").toLowerCase()}</span>
              </div>
              <p className="mt-3 text-muted-foreground text-sm">
                {t("proDescriptionMonthly")}
              </p>
              <ul className="mt-8 flex-1 space-y-4 border-t border-border/50 pt-8">
                {proFeatures.map((feature, index) => (
                  <li
                    key={`proFeature${index + 1}`}
                    className="flex gap-3 text-sm items-center"
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="font-medium text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 space-y-3">
                <Link href={`/${locale}/signup`} className="block">
                  <Button className="w-full text-base" size="lg">
                    {t("basicPrice", { days: trialDays })}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full text-base"
                  size="lg"
                  onClick={() => {
                    setSelectedPlan("monthly");
                    setProDialogOpen(true);
                  }}
                >
                  {t("proButton")}
                </Button>
              </div>
            </div>
          </div>

          {/* Yearly Card */}
          <div className="rounded-2xl border-2 border-primary bg-card shadow-xl overflow-hidden flex flex-col justify-between relative">
            <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-center py-1 text-xs font-semibold uppercase tracking-wider">
              {t("recommendedBadge")}
            </div>
            <div className="flex h-full flex-col p-8 pt-10 text-left bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {envPlanName} - {t("billingYearly")}
                </p>
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                  {t("discountBadge")}
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-foreground tracking-tight">
                   Rs.{(Number(envPlanPrice) * 10).toLocaleString()}
                </span>
                <span className="text-muted-foreground text-sm font-medium">/{t("billingYearly").toLowerCase()}</span>
              </div>
              <p className="mt-3 text-muted-foreground text-sm">
                {t("proDescriptionYearly")}
              </p>

              <ul className="mt-8 flex-1 space-y-4 border-t border-border/50 pt-8">
                {proFeatures.map((feature, index) => (
                  <li
                    key={`proFeature${index + 1}`}
                    className="flex gap-3 text-sm items-center"
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="font-medium text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 space-y-3">
                <Link href={`/${locale}/signup`} className="block">
                  <Button className="w-full text-base" size="lg">
                    {t("basicPrice", { days: trialDays })}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full text-base"
                  size="lg"
                  onClick={() => {
                    setSelectedPlan("yearly");
                    setProDialogOpen(true);
                  }}
                >
                  {t("proButton")}
                </Button>
              </div>
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
            {/* Selected Plan Premium Summary */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Selected Plan
              </p>
              <p className="font-bold text-lg text-foreground">
                {selectedPlan === "monthly" ? `${envPlanName} - Monthly` : `${envPlanName} - Yearly`}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                Amount to Send: <span className="text-foreground font-semibold">{selectedPlan === "monthly" ? `Rs.${envPlanPrice}` : "Rs.10,000"}</span>
              </p>
            </div>

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
