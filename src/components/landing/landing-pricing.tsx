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
import { cn } from "@/lib/utils";
import plansData from "@/data/DK_Plan.json";

const BASIC_FEATURES_COUNT = 4;

const renderFeatureText = (text: string) => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length > 1) {
    return parts.map((part, index) => {
      return index % 2 === 1 ? (
        <strong key={index} className="text-foreground font-bold">
          {part}
        </strong>
      ) : (
        part
      );
    });
  }
  return text;
};

export function LandingPricing() {
  const locale = useLocale();
  const t = useTranslations("landing.pricing");
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | "lifetime">("monthly");
  const [selectedPlanPrice, setSelectedPlanPrice] = useState("1000");
  const [selectedPlanName, setSelectedPlanName] = useState("DukaanKhata Pro");

  const trialDays = process.env.NEXT_PUBLIC_TRIAL_NUMBER_OF_DAYS || "7";

  const whatsappMessage = selectedPlan === "monthly"
    ? t("dialogWhatsappMessageMonthly")
    : selectedPlan === "yearly"
    ? t("dialogWhatsappMessageYearly")
    : t("dialogWhatsappMessageLifetime");

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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-8">
          {plansData.map((plan) => {
            const isYearly = plan.billing === "yearly";
            const isLifetime = plan.billing === "lifetime";
            const billingLabel = isLifetime
              ? t("billingLifetime")
              : isYearly
              ? t("billingYearly")
              : t("billingMonthly");

            const isCampaignLive = process.env.NEXT_PUBLIC_IS_YEARLY_CAMPAIGN_LIVE === "true";
            const campaignName = process.env.NEXT_PUBLIC_YEARLY_CAMPAIGN_NAME || "";
            const campaignPrice = process.env.NEXT_PUBLIC_YEARLY_CAMPAIGN_NEW_PRICES || "";

            let displayPrice = plan.price;
            let displayOriginalPrice = plan.originalPrice;
            let displayBadgeText = plan.hasDiscountBadge ? plan.discountBadgeText : null;
            let isCampaignApplied = false;

            if (isYearly && isCampaignLive && campaignPrice) {
              displayOriginalPrice = plan.price; // Show original price as crossed out
              displayPrice = campaignPrice;
              if (campaignName) {
                displayBadgeText = campaignName;
              }
              isCampaignApplied = true;
            }

            return (
              <div 
                key={plan.id}
                className={cn(
                  "rounded-2xl bg-card overflow-hidden flex flex-col justify-between relative",
                  plan.isRecommended ? "border-2 border-primary shadow-xl" : "border border-border shadow-lg"
                )}
              >
                {plan.isRecommended && (
                  <div className="absolute top-0 right-0 left-0 bg-primary text-primary-foreground text-center py-1 text-xs font-semibold uppercase tracking-wider">
                    {t("recommendedBadge")}
                  </div>
                )}
                
                <div className={cn(
                  "flex h-full flex-col p-8 text-left",
                  plan.isRecommended 
                    ? "pt-10 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" 
                    : "bg-gradient-to-b from-primary/5 to-transparent"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      {plan.name} ({billingLabel})
                    </p>
                    {plan.isPopular && !isCampaignApplied && (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                        {t("popularBadge")}
                      </span>
                    )}
                    {displayBadgeText && (
                      <span className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm whitespace-nowrap",
                        isCampaignApplied ? "bg-red-500 animate-pulse" : "bg-emerald-600"
                      )}>
                        {displayBadgeText}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-6 flex flex-col gap-1">
                    {displayOriginalPrice && (
                      <span className="text-xl line-through text-muted-foreground font-semibold">
                        {plan.currency}{displayOriginalPrice}
                      </span>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-foreground tracking-tight">
                        {plan.currency}{displayPrice}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/{billingLabel.toLowerCase()}</span>
                    </div>
                  </div>
                  
                  <p className="mt-3 text-muted-foreground text-sm">
                    {plan.description}
                  </p>

                  <ul className="mt-8 flex-1 space-y-4 border-t border-border/50 pt-8">
                    {plan.features.map((feature, index) => (
                      <li
                        key={`feature-${index}`}
                        className="flex gap-3 text-sm items-center"
                      >
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                        <span className="font-medium text-muted-foreground">{renderFeatureText(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 flex flex-col items-center gap-3">
                    {!isLifetime && (
                      <Link 
                        href={`/${locale}/signup`} 
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hover:underline"
                      >
                        {t("startForFree")}
                      </Link>
                    )}
                    <Button
                      variant={plan.isRecommended ? "default" : "outline"}
                      className="w-full text-base"
                      size="lg"
                      onClick={() => {
                        setSelectedPlan(plan.id as "monthly" | "yearly" | "lifetime");
                        setSelectedPlanPrice(displayPrice);
                        setSelectedPlanName(plan.name);
                        setProDialogOpen(true);
                      }}
                    >
                      {plan.billing === "lifetime" ? t("contactSales") : t("proButton")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <Link href={`/${locale}/signup`}>
            <Button 
              className="bg-black hover:bg-black/90 text-white dark:bg-white dark:text-black dark:hover:bg-white/90 text-lg px-8 py-6 rounded-xl shadow-lg transition-transform hover:scale-105" 
              size="lg"
            >
              {t("startFreeTrial")}
            </Button>
          </Link>
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
                {selectedPlan === "monthly" 
                  ? `${selectedPlanName} - Monthly` 
                  : selectedPlan === "yearly" 
                  ? `${selectedPlanName} - Yearly` 
                  : `${selectedPlanName} - Lifetime`}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                Amount to Send: <span className="text-foreground font-semibold">Rs.{selectedPlanPrice}</span>
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
