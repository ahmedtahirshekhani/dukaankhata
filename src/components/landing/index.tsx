"use client";

import { useState } from "react";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { WaitlistModal } from "@/components/landing/waitlist-modal";

export function LandingPage() {
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <LandingHeader onJoinClick={() => setWaitlistModalOpen(true)} />

      {/* Main Content */}
      <main className="flex-1">
        <LandingHero onJoinClick={() => setWaitlistModalOpen(true)} />
      </main>

      {/* Footer */}
      <LandingFooter />

      {/* Waitlist Modal */}
      <WaitlistModal
        open={waitlistModalOpen}
        onOpenChange={setWaitlistModalOpen}
      />
    </div>
  );
}
