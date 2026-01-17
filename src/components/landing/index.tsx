"use client";

import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <LandingHeader />

      {/* Main Content */}
      <main className="flex-1">
        <LandingHero />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
