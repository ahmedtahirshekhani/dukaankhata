"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  TrendingUp,
  Download,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { LandingContact } from "@/components/landing/landing-contact";
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
import { usePWA } from "@/components/pwa/pwa-context";

export function LandingHero() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const { canInstall, triggerInstall } = usePWA();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const whatsappMessage = encodeURIComponent(
    "Hi, I have sent the payment screenshot for PRO access. Please share the PRO code.",
  );
  const whatsappLink = `https://wa.me/923212575665?text=${whatsappMessage}`;

  const features = [
    {
      icon: Zap,
      title: t("lightningFastTitle"),
      description: t("lightningFastDesc"),
    },
    {
      icon: Users,
      title: t("customerManagementTitle"),
      description: t("customerManagementDesc"),
    },
    {
      icon: TrendingUp,
      title: t("smartAnalyticsTitle"),
      description: t("smartAnalyticsDesc"),
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="w-full py-12 md:py-20 lg:py-28 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            {/* Left Column */}
            <div className="flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                  {t("title")}
                  <span className="text-primary"> {t("titleHighlight")}</span>
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  {t("description")}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={`/${locale}/admin/welcome`}>
                  <Button size="lg" className="gap-2">
                    {t("dashboardButton")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={triggerInstall}
                  disabled={!canInstall}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t("downloadAppButton")}
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-2xl font-bold">{t("membersValue")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("waitlistMembers")}
                  </p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{t("uptimeValue")}</div>
                  <p className="text-sm text-muted-foreground">{t("uptime")}</p>
                </div>
              </div>
            </div>

            {/* Right Column - Hero Image */}
            <div className="flex items-center justify-center">
              <div className="w-full relative">
                <img
                  src="/images/dashboard.jpeg"
                  alt={t("dashboardPreview")}
                  className="w-full h-auto rounded-2xl shadow-2xl border border-border"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="w-full py-12 md:py-20 border-t border-border"
      >
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("powerfullFeatures")}
            </h2>
            <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
              {t("powerfullFeaturesDescription")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="w-full py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("whyChoose")}
            </h2>
            <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
              {t("whyChooseDesc")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
            {[
              t("benefit1"),
              t("benefit2"),
              t("benefit3"),
              t("benefit4"),
              t("benefit5"),
              t("benefit6"),
            ].map((benefit, index) => (
              <div key={index} className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                <p className="text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="pricing"
        className="w-full py-12 md:py-20 border-t border-border"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-6 text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("ctaTitle")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {t("ctaDescription")}
            </p>
          </div>

          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div className="text-left">
                <p className="text-sm font-medium text-muted-foreground">
                  Compare plans
                </p>
                <p className="text-xs text-muted-foreground">
                  Switch between monthly and yearly billing
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
                  Monthly
                </Button>
                <Button
                  type="button"
                  variant={billingCycle === "yearly" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => setBillingCycle("yearly")}
                >
                  Yearly
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="flex h-full flex-col p-6 text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Basic
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    Free
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ideal for getting started
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Up to 50 products</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Basic khata and sales tracking</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Customer support</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Multi-language support</span>
                  </li>
                </ul>

                <Link href={`/${locale}/signup`} className="mt-6 block">
                  <Button variant="outline" className="w-full" size="lg">
                    Start Free
                  </Button>
                </Link>
              </div>

              <div className="flex h-full flex-col p-6 text-left bg-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Pro
                  </p>
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Popular
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {billingCycle === "monthly" ? "Rs.1000" : "Rs.10,000"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {billingCycle === "monthly" ? "/month" : "/year"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {billingCycle === "monthly"
                    ? "Billed monthly"
                    : "Billed yearly"}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex gap-3 text-sm">
                    <span>Everything in Basic Plan +</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Up to 500 products</span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Invoices and receipts</span>
                  </li>
                  <li className="flex gap-3 text-sm pt-1">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Priority support and multi-language access</span>
                  </li>
                  <li className="flex gap-3 text-sm pt-2">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>AI-powered insights and decisions</span>
                  </li>
                  <li className="flex gap-3 text-sm pt-2">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>New feature accessibility</span>
                  </li>
                  <li className="flex gap-3 text-sm pt-2">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                    <span>Premium Customer support</span>
                  </li>
                </ul>

                <Button
                  className="mt-6 w-full"
                  size="lg"
                  onClick={() => setProDialogOpen(true)}
                >
                  Start Pro
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={proDialogOpen} onOpenChange={setProDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Complete PRO Payment</DialogTitle>
            <DialogDescription>
              Send the payment to the account below, then share the proof
              screenshot on WhatsApp to receive your PRO access code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold text-foreground">
                Payment Account - Nayapay
              </p>
              <p className="text-muted-foreground">Nayapay</p>
              <p className="font-medium text-foreground">03352575725</p>
              <p className="text-muted-foreground">Muhammad Kashan Shekhani</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="font-semibold text-foreground">Share Screenshot</p>
              <p className="text-muted-foreground">
                Send your proof screenshot to{" "}
                <span className="font-medium text-foreground">03212575665</span>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProDialogOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                Open WhatsApp
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Section */}
      <LandingContact />
    </>
  );
}
