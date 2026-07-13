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
import { LandingContact } from "@/components/landing/landing-contact";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { usePWA } from "@/components/pwa/pwa-context";
import Image from "next/image";

export function LandingHero() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const { canInstall, triggerInstall } = usePWA();
  const { data: session } = useSession();
  const router = useRouter();

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
            <div className="flex flex-col justify-center space-y-6 max-w-2xl lg:max-w-none mx-auto lg:mx-0 w-full">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-foreground">
                  <span className="text-primary">{t("titleHighlight")}</span>{" "}
                  {t("title")}
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  {t("description")}
                </p>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4 w-full">
                {/* Row 1: Start Free Trial & See Pricing */}
                <div className="flex flex-row items-center gap-3 w-full max-w-md lg:w-auto lg:max-w-none">
                  <Button
                    size="lg"
                    className="w-2/3 sm:w-auto lg:w-auto gap-2"
                    onClick={() => {
                      if (session?.user) {
                        router.push(`/${locale}/admin/welcome`);
                      } else {
                        router.push(`/${locale}/signup`);
                      }
                    }}
                  >
                    <span className="truncate">{t("dashboardButton")}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Button>
                  <Link href="#pricing" className="w-1/3 sm:w-auto lg:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full lg:w-auto gap-1 px-2 sm:gap-2 sm:px-4"
                    >
                      <span className="truncate">{t("seePricing")}</span>
                    </Button>
                  </Link>
                </div>

                {/* Row 2: Download App Button */}
                <div className="w-full max-w-md lg:w-auto lg:max-w-none">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={triggerInstall}
                    disabled={!canInstall}
                    className="w-full sm:w-auto lg:w-auto gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t("downloadAppButton")}
                  </Button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-row items-center justify-between sm:justify-start gap-4 sm:gap-8 pt-4 w-full max-w-md">
                <div className="text-left">
                  <div className="text-lg sm:text-2xl font-bold">{t("membersValue")}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("waitlistMembers")}
                  </p>
                </div>
                <div className="text-left">
                  <div className="text-lg sm:text-2xl font-bold">{t("uptimeValue")}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t("uptime")}</p>
                </div>
                <div className="text-left">
                  <div className="text-lg sm:text-2xl font-bold">{t("supportValue")}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t("support")}</p>
                </div>
              </div>

              {/* Trust Line */}
              <div className="flex flex-row items-center justify-between sm:justify-start gap-1 sm:gap-2.5 text-[9px] min-[360px]:text-[10px] sm:text-xs text-muted-foreground/80 font-medium w-full max-w-md whitespace-nowrap">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <span className="text-primary font-bold">✓</span>
                  <span>{t("trustNoCard")}</span>
                </div>
                <span className="text-muted-foreground/40 font-normal">·</span>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <span className="text-primary font-bold">✓</span>
                  <span>{t("trustCancel")}</span>
                </div>
                <span className="text-muted-foreground/40 font-normal">·</span>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <span className="text-primary font-bold">✓</span>
                  <span>{t("trustSupport")}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Hero Image */}
            <div className="flex items-center justify-center lg:justify-end w-full">
              <div className="w-full max-w-[540px] md:max-w-[640px] lg:max-w-none relative transition-all duration-300">
                <Image
                  src="/images/dashboard2.png"
                  alt={t("dashboardPreview")}
                  width={1200}
                  height={800}
                  className="w-full h-auto rounded-2xl border border-border"
                  priority
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
                <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                <p className="text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingPricing />

      {/* Contact Section */}
      <LandingContact />
    </>
  );
}
