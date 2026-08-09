"use client";

import { useEffect } from "react";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { trackHomepageViewed } from "@/lib/analytics/events";

export function LandingPage() {
  useEffect(() => {
    trackHomepageViewed();
  }, []);

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
