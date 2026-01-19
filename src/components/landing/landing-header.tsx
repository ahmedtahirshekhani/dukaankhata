"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import Logo from "../../../public/images/DukaanKhataLogo.svg";

export function LandingHeader() {
  const locale = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationLinks = [
    { href: "#features", label: "Features" },
    { href: "#benefits", label: "Benefits" },
    { href: "#pricing", label: "Pricing" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 min-h-24 flex items-center">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-xl"
        >
          <div className=" flex items-center justify-center">
            {/* <span className="text-primary-foreground text-sm font-bold">D</span> */}
            <Image src={Logo}  alt="DukaanKhata Logo" width={120} height={120}/>
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
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {/* <Link
            href={`/login`}
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
          </Link> */}
          <Link href={`/${locale}/waitlist`}>
            <Button
              className="hidden sm:inline-flex"
              size="sm"
            >
              Join Waitlist
            </Button>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href={`/${locale}/admin`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link href={`/${locale}/waitlist`} className="w-full">
              <Button className="w-full">
                Join Waitlist
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
