"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Logo from "../../../public/images/DukaanKhataLogo.svg";

export function LandingFooter() {
  const locale = useLocale();
  const t = useTranslations("landing.footer");

  const links = {
    [t("product")]: [
      { label: t("features"), href: "#features" },
      { label: t("pricing"), href: "#pricing" },
      { label: t("security"), href: "#security" },
    ],
    [t("company")]: [
      { label: t("about"), href: "#about" },
      { label: t("blog"), href: "#blog" },
      { label: t("contact"), href: "#contact" },
    ],
    [t("legal")]: [
      { label: t("privacyPolicy"), href: "#privacy" },
      { label: t("termsOfService"), href: "#terms" },
    ],
  };

  return (
    <footer className="w-full border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 font-bold text-xl"
            >
              <div className=" flex items-center justify-center">
                {/* <span className="text-primary-foreground text-sm font-bold">D</span> */}
                <Image
                  src={Logo}
                  alt="DukaanKhata Logo"
                  width={120}
                  height={120}
                />
              </div>
              {/* <span className="hidden sm:inline">DukaanKhata</span> */}
            </Link>
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h4 className="font-semibold">{category}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("copyright")}</p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="sr-only">{t("facebookAlt")}</span>
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.991 22 12z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="sr-only">{t("twitterAlt")}</span>
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8.29 20c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-7.007 3.747 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
