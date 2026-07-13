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
      { label: t("features"), href: `/${locale}#features` },
      { label: t("pricing"), href: `/${locale}#pricing` },
      { label: t("security"), href: `/${locale}#benefits` },
    ],
    [t("company")]: [
      { label: t("about"), href: `/${locale}#benefits` },
      { label: t("blog"), href: "#" },
      { label: t("contact"), href: `/${locale}#contact` },
    ],
    [t("legal")]: [
      { label: t("privacyPolicy"), href: "#" },
      { label: t("termsOfService"), href: "#" },
    ],
  };

  return (
    <footer className="w-full border-t border-border bg-gradient-to-b from-transparent to-muted/40">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="grid gap-12 md:grid-cols-4 mb-12">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 font-bold text-xl"
            >
              <div className="flex items-center justify-center">
                <Image
                  src={Logo}
                  alt="DukaanKhata Logo"
                  width={140}
                  height={140}
                />
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t("tagline")}
            </p>
          </div>

          {/* Links columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground/80">
                {category}
              </h4>
              <ul className="space-y-3">
                {items.map((item, idx) => (
                  <li key={idx}>
                    <a
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom copyright & socials */}
        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            {t("copyright")}
          </p>
          <div className="flex items-center gap-6">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/dukaankhata1/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors duration-200"
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

            {/* Instagram */}
            <a
              href="https://instagram.com/dukaankhata.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              <span className="sr-only">{t("instagramAlt")}</span>
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12.315 2c2.43 0 2.784.008 3.81.056 1 .046 1.682.21 2.27.441a4.902 4.902 0 011.67 1.087 4.876 4.876 0 011.087 1.67c.23.59.394 1.272.44 2.27.049 1.026.056 1.38.056 3.81s-.007 2.784-.056 3.81c-.046 1-.21 1.682-.441 2.27a4.902 4.902 0 01-1.087 1.67 4.876 4.876 0 01-1.67 1.087c-.59.23-1.272.394-2.27.44-1.026.049-1.38.056-3.81.056s-2.784-.007-3.81-.056c-1-.046-1.682-.21-2.27-.441a4.9 4.9 0 01-1.67-1.087 4.876 4.876 0 01-1.087-1.67c-.23-.59-.394-1.272-.44-2.27-.049-1.026-.056-1.38-.056-3.81s.007-2.784.056-3.81c.046-1 .21-1.682.441-2.27a4.9 4.9 0 011.087-1.67 4.876 4.876 0 011.67-1.087c.59-.23 1.272-.394 2.27-.44 1.026-.049 1.38-.056 3.81-.056zM12 6.865A5.135 5.135 0 1017.135 12 5.135 5.135 0 0012 6.865zm0 8.469A3.333 3.333 0 1112 8.667a3.333 3.333 0 010 6.667zm5.29-8.47a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"
                  clipRule="evenodd"
                />
              </svg>
            </a>

            {/* TikTok */}
            <a
              href="https://tiktok.com/@dukaankhata.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              <span className="sr-only">{t("tiktokAlt")}</span>
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.74-3.94-1.74-.22-.2-.43-.43-.64-.67-.07 3.26-.02 6.52-.05 9.77-.1 1.67-.77 3.37-2.02 4.5-1.35 1.24-3.23 1.9-5.02 1.83-2.18-.03-4.33-1.12-5.54-2.92-1.31-1.89-1.44-4.52-.45-6.52 1.02-2.11 3.23-3.64 5.6-3.77.08 1.33.02 2.66.05 4-.98.07-2.01.55-2.61 1.35-.68.85-.75 2.1-.22 3.01.52.92 1.58 1.53 2.63 1.5 1.03-.02 2.02-.62 2.45-1.57.43-.88.42-1.91.43-2.88-.01-4.88-.01-9.76-.01-14.64z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
