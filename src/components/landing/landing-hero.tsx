"use client";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePWA } from "@/components/pwa-context";

export function LandingHero() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const { deferredPrompt, triggerInstall } = usePWA();

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
                <Link href={`/${locale}/waitlist`}>
                  <Button size="lg" className="gap-2">
                    {t("joinWaitlistButton")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={triggerInstall}
                  disabled={!deferredPrompt}
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
              <div className="w-full max-w-md h-96 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-muted-foreground">
                    {t("dashboardPreview")}
                  </p>
                </div>
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
      <section className="w-full py-12 md:py-20 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              {t("ctaTitle")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {t("ctaDescription")}
            </p>
            <Link href={`/${locale}/waitlist`}>
              <Button size="lg" className="gap-2">
                {t("ctaButton")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
