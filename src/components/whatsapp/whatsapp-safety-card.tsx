"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Zap, Shuffle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export function WhatsappSafetyCard() {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/[0.03] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Anti-Ban Protection Engine</CardTitle>
              <CardDescription className="text-xs">
                Smart safety mechanisms configured to protect your WhatsApp account from spam filters and automation bans.
              </CardDescription>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            Active & Enforced
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Inter-Message Cooldown
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              15-45s delay between messages with randomized human jitter (+2-7s) so messages aren&apos;t sent mechanically.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              10-Message Batch Pause
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              After every 10 messages, an automatic 3-minute safety break cools down your number and resets WhatsApp rate thresholds.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Shuffle className="w-3.5 h-3.5 text-purple-600" />
              Message Variants (Spintax)
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Randomly rotates multiple message variants and inserts customer names so every message has a unique hash.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-card/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Typing Presence Emulation
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Simulates genuine human keyboard typing (&quot;composing...&quot;) for 1.5-3 seconds before sending each text.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
