"use client";

import { CheckCircle2, Star } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FREE_FEATURES_COUNT = 6;
const PLAN_1000_FEATURES_COUNT = 7;
const PLAN_5000_FEATURES_COUNT = 8;

export function LandingPricing() {
  const locale = useLocale();
  const t = useTranslations("landing.pricing");

  const freeFeatures = Array.from({ length: FREE_FEATURES_COUNT }, (_, i) =>
    t(`freeFeature${i + 1}`)
  );
  const plan1000Features = Array.from(
    { length: PLAN_1000_FEATURES_COUNT },
    (_, i) => t(`plan1000Feature${i + 1}`)
  );
  const plan5000Features = Array.from(
    { length: PLAN_5000_FEATURES_COUNT },
    (_, i) => t(`plan5000Feature${i + 1}`)
  );

  const plans = [
    {
      name: t("freeName"),
      price: t("freePrice"),
      description: t("freeDescription"),
      features: freeFeatures,
      cta: t("ctaFree"),
      href: `/${locale}/signup`,
      highlighted: false,
    },
    {
      name: t("plan1000Name"),
      price: t("plan1000Price"),
      description: t("plan1000Description"),
      features: plan1000Features,
      cta: t("ctaPlan1000"),
      href: `/${locale}/signup`,
      highlighted: true,
    },
    {
      name: t("plan5000Name"),
      price: t("plan5000Price"),
      description: t("plan5000Description"),
      features: plan5000Features,
      cta: t("ctaPlan5000"),
      href: `/${locale}/signup`,
      highlighted: false,
    },
  ];

  return (
    <section
      id="pricing"
      className="w-full py-12 md:py-20 border-t border-border"
    >
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
            {t("sectionTitle")}
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            {t("sectionSubtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={cn(
                "flex flex-col hover:shadow-lg transition-shadow",
                plan.highlighted &&
                  "ring-2 ring-primary shadow-md border-primary/30 relative"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Star className="h-3 w-3" />
                    {t("popularBadge")}
                  </span>
                </div>
              )}
              <CardHeader className="text-center space-y-2 pb-2">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold tracking-tight">
                    {plan.price}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-4">
                <Link href={plan.href} className="w-full">
                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full"
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
