"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function LandingHeader({ onJoinClick }: { onJoinClick: () => void }) {
  const locale = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationLinks = [
    { href: "#features", label: "Features" },
    { href: "#benefits", label: "Benefits" },
    { href: "#pricing", label: "Pricing" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-xl"
        >
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">D</span>
          </div>
          <span className="hidden sm:inline">DukaanKhata</span>
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
          <Link
            href={`/login`}
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
          </Link>
          <Button
            onClick={onJoinClick}
            className="hidden sm:inline-flex"
            size="sm"
          >
            Join Waitlist
          </Button>

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
            <Button onClick={onJoinClick} className="w-full">
              Join Waitlist
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
