"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { supportContactInfo } from "@/lib/contact-info";

// Same contact details as error page (src/app/error.tsx) for consistency
const CONTACT_LINKS = {
  phone: {
    href: supportContactInfo.whatsappHref,
    label: supportContactInfo.phoneDisplay,
  },
} as const;

export function LandingContact() {
  const t = useTranslations("landing.contact");

  const items = [
    {
      key: "phone" as const,
      icon: Phone,
      labelKey: "phoneLabel" as const,
    },
  ];

  return (
    <section
      id="contact"
      className="w-full py-12 md:py-20 bg-muted/30 border-t border-border"
    >
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
            {t("sectionTitle")}
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            {t("sectionDescription")}
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <ul className="space-y-4">
                {items.map(({ key, icon: Icon, labelKey }) => {
                  const { href, label } = CONTACT_LINKS[key];
                  return (
                    <li
                      key={key}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                    >
                      <span className="font-medium text-foreground flex items-center gap-2 min-w-[140px]">
                        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                        {t(labelKey)}
                      </span>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm sm:text-base break-all"
                      >
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
