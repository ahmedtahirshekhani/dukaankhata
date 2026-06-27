"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { supportContacts } from "@/lib/contact-info";

export function LandingContact() {
  const t = useTranslations("landing.contact");

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
                {supportContacts.map((c) => (
                  <li
                    key={c.name}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                  >
                    <span className="font-medium text-foreground flex items-center gap-2 min-w-[160px]">
                      <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                      {c.name}
                    </span>
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm sm:text-base"
                    >
                      {c.display}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
