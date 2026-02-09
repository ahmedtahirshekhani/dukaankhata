"use client";

import { Link, Mail, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";

// Same contact details as error page (src/app/error.tsx) for consistency
const CONTACT_LINKS = {
  whatsapp: {
    href: "https://wa.me/491785141157",
    label: "+49 178 5141157 (Ahmed Tahir Shekhani)",
  },
  linkedin: {
    href: "https://www.linkedin.com/in/ahmedtahirshekhani/",
    label: "linkedin.com/in/ahmedtahirshekhani/",
  },
  email: {
    href: "mailto:ahmedtahir.developer@gmail.com",
    label: "ahmedtahir.developer@gmail.com",
  },
  phone: {
    href: "tel:+923352575725",
    label: "+92 335 2575725 (M. Kashan Shekhani)",
  },
} as const;

export function LandingContact() {
  const t = useTranslations("landing.contact");

  const items = [
    {
      key: "whatsapp" as const,
      icon: MessageCircle,
      labelKey: "whatsAppLabel" as const,
    },
    {
      key: "linkedin" as const,
      icon: Link,
      labelKey: "linkedInLabel" as const,
    },
    {
      key: "email" as const,
      icon: Mail,
      labelKey: "emailLabel" as const,
    },
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
                    <li key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <span className="font-medium text-foreground flex items-center gap-2 min-w-[140px]">
                        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                        {t(labelKey)}
                      </span>
                      <a
                        href={href}
                        target={key === "email" || key === "phone" ? undefined : "_blank"}
                        rel={key === "email" || key === "phone" ? undefined : "noopener noreferrer"}
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
