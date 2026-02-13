"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { Menu, X, Download } from "lucide-react";
import { useState } from "react";
import Logo from "../../../public/images/DukaanKhataLogo.svg";
import { usePWA } from "@/components/pwa/pwa-context";

export function LandingHeader() {
  const locale = useLocale();
  const t = useTranslations("landing.header");
  const { dismissedBanner, canInstall, triggerInstall } = usePWA();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationLinks = [
    { href: "#features", label: t("features") },
    { href: "#benefits", label: t("benefits") },
    { href: "#pricing", label: t("pricing") },
    { href: "#contact", label: t("contact") },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-16 flex items-center">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 font-bold text-xl"
          >
            <div className="flex items-center justify-center">
              {/* <span className="text-primary-foreground text-sm font-bold">D</span> */}
              <Image src={Logo} alt="DukaanKhata Logo" width={64} height={64} />
            </div>
            {/* <span className="hidden sm:inline">DukaanKhata</span> */}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <LanguageSwitcher />

            <Button
              size="sm"
              variant="outline"
              onClick={triggerInstall}
              disabled={!canInstall}
              className="hidden md:inline-flex gap-2"
            >
              <Download className="h-4 w-4" />
              {t("downloadApp")}
            </Button>

            {/* <Link
              href={`/login`}
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link> */}
            <Link href={`/${locale}/admin`}>
              <Button className="hidden sm:inline-flex" size="sm">
                {t("dashboard")}
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Fixed Position */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 top-16 z-20 bg-black/20 transition-all duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="md:hidden fixed top-16 right-0 z-30 w-80 max-w-[90vw] border-l border-border bg-background shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto animate-in slide-in-from-right-52 duration-300">
            <nav className="px-6 py-6 flex flex-col gap-2">
              {navigationLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors py-3 px-3 rounded-md hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-border my-2 pt-4">
                <Link href={`/${locale}/admin`} className="w-full">
                  <Button className="w-full">{t("dashboard")}</Button>
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
