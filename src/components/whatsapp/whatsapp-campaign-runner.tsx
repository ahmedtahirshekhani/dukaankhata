"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Zap,
  Users,
  ChevronLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface Props {
  locale: string;
  campaignId: string;
  onBack: () => void;
}

interface ActivityLogItem {
  timestamp: string;
  customerName: string;
  phone: string;
  variantId: string;
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
}

export function WhatsappCampaignRunner({ locale, campaignId, onBack }: Props) {
  const [campaign, setCampaign] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Live progress
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Timers & banners
  const [statusMessage, setStatusMessage] = useState("Campaign Ready");
  const [currentRecipientName, setCurrentRecipientName] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  const [isBatchCooldownActive, setIsBatchCooldownActive] = useState(false);

  // Real-time activity terminal
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Loop control ref
  const isStopRequestedRef = useRef(false);

  // Fetch campaign details on mount
  const loadCampaignData = async () => {
    try {
      const res = await fetch(`/${locale}/api/whatsapp/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
        setSentCount(data.campaign.sent_count || 0);
        setFailedCount(data.campaign.failed_count || 0);
        setTotalCount(data.campaign.total_recipients || 0);
        setIsCompleted(data.campaign.status === "completed");

        // Populate initial logs
        if (data.logs && Array.isArray(data.logs)) {
          setActivityLogs(
            data.logs.map((l: any) => ({
              timestamp: new Date(l.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              customerName: l.customer_name || "Customer",
              phone: l.customer_phone || "",
              variantId: l.variant_id || "A",
              status: l.status,
              messageId: l.message_id,
              error: l.error,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to load campaign:", err);
      toast.error("Failed to load campaign data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignData();
  }, [campaignId, locale]);

  // Auto scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [activityLogs]);

  // Countdown timer helper
  const runCountdown = async (seconds: number, labelPrefix: string): Promise<boolean> => {
    for (let remaining = seconds; remaining > 0; remaining--) {
      if (isStopRequestedRef.current) return false;
      setCooldownRemaining(remaining);
      setStatusMessage(`${labelPrefix} (${remaining}s remaining)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCooldownRemaining(null);
    return true;
  };

  // Main campaign orchestrator loop
  const startCampaignRunner = async () => {
    if (!campaign) return;

    isStopRequestedRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    try {
      // Update status in DB
      await fetch(`/${locale}/api/whatsapp/campaigns/${campaignId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running" }),
      });

      let currentBatchCount = 0;
      const batchLimit = campaign.batch_size || 10;
      const batchCooldownDuration = campaign.batch_cooldown_seconds || 180;
      const baseCooldown = campaign.cooldown_seconds || 20;

      while (!isStopRequestedRef.current) {
        // Fetch fresh pending recipient
        const res = await fetch(`/${locale}/api/whatsapp/campaigns/${campaignId}`);
        if (!res.ok) break;
        const freshData = await res.json();
        const pendingRecipients = (freshData.campaign.recipients || []).filter((r: any) => r.status === "pending");

        if (pendingRecipients.length === 0) {
          setIsCompleted(true);
          setStatusMessage("🎉 All campaign messages successfully dispatched!");
          toast.success("Campaign finished successfully!");
          break;
        }

        const nextRecipient = pendingRecipients[0];
        setCurrentRecipientName(nextRecipient.customer_name);
        setStatusMessage(`Typing & sending to ${nextRecipient.customer_name}...`);

        // Send to single recipient
        const sendRes = await fetch(`/${locale}/api/whatsapp/campaigns/${campaignId}/send-recipient`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_index: nextRecipient.index }),
        });

        const sendData = await sendRes.json();
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        if (sendRes.ok && sendData.success) {
          setSentCount((prev) => prev + 1);
          currentBatchCount++;

          setActivityLogs((prev) => [
            ...prev,
            {
              timestamp: nowTime,
              customerName: sendData.customerName,
              phone: sendData.customerPhone,
              variantId: sendData.variantId,
              status: "sent",
              messageId: sendData.messageId,
            },
          ]);

          if (sendData.isCompleted) {
            setIsCompleted(true);
            setStatusMessage("🎉 Campaign Completed Successfully!");
            break;
          }
        } else {
          setFailedCount((prev) => prev + 1);
          setActivityLogs((prev) => [
            ...prev,
            {
              timestamp: nowTime,
              customerName: sendData.customerName || nextRecipient.customer_name,
              phone: nextRecipient.customer_phone,
              variantId: "N/A",
              status: "failed",
              error: sendData.error || "Send failed",
            },
          ]);
        }

        if (isStopRequestedRef.current) break;

        // Check if 10-message batch reached
        if (currentBatchCount >= batchLimit) {
          setIsBatchCooldownActive(true);
          currentBatchCount = 0; // reset batch count
          const continued = await runCountdown(
            batchCooldownDuration,
            "🛡️ 10-Message Safety Break: Pausing to protect WhatsApp account"
          );
          setIsBatchCooldownActive(false);
          if (!continued) break;
        } else {
          // Standard per-message cooldown with human jitter
          const jitter = campaign.cooldown_jitter ? Math.floor(Math.random() * 6) + 2 : 0;
          const totalDelay = baseCooldown + jitter;
          const continued = await runCountdown(totalDelay, "⏱️ Inter-Message Cooldown: Waiting");
          if (!continued) break;
        }
      }
    } catch (err) {
      console.error("Error in campaign runner loop:", err);
      toast.error("Error occurred while executing campaign");
    } finally {
      setIsRunning(false);
      setCurrentRecipientName("");
      setCooldownRemaining(null);
      setIsBatchCooldownActive(false);
    }
  };

  const handlePause = async () => {
    isStopRequestedRef.current = true;
    setIsPaused(true);
    setIsRunning(false);
    setStatusMessage("Campaign Paused");

    try {
      await fetch(`/${locale}/api/whatsapp/campaigns/${campaignId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      toast.info("Campaign paused. You can resume anytime.");
    } catch (e) {}
  };

  const handleResume = () => {
    startCampaignRunner();
  };

  const progressPercent = totalCount > 0 ? Math.round(((sentCount + failedCount) / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-3">Loading campaign details...</p>
      </Card>
    );
  }

  if (!campaign) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-destructive">Campaign not found</p>
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span>{campaign.name}</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isCompleted
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : isRunning
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse"
                        : isPaused
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? "Completed" : isRunning ? "Running" : isPaused ? "Paused" : "Ready"}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Anti-Ban Cooldown: {campaign.cooldown_seconds}s per message (+jitter) • Automatic safety break after every {campaign.batch_size || 10} messages.
                </CardDescription>
              </div>
            </div>

            {/* Main Action Controls */}
            <div className="flex items-center gap-2">
              {!isRunning && !isCompleted && (
                <Button
                  onClick={isPaused ? handleResume : startCampaignRunner}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isPaused ? "Resume Campaign" : "Start Campaign"}
                </Button>
              )}

              {isRunning && (
                <Button
                  variant="destructive"
                  onClick={handlePause}
                  className="flex items-center gap-2 font-semibold shadow-sm"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  Pause Campaign
                </Button>
              )}

              {isCompleted && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  Done (Back to Campaigns)
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar & Counters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Overall Campaign Progress</span>
              <span className="font-mono text-foreground">
                {sentCount + failedCount} / {totalCount} ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-3 rounded-full" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl border bg-muted/20 text-center">
              <div className="text-xs text-muted-foreground">Total Recipients</div>
              <div className="text-lg font-bold font-mono mt-0.5">{totalCount}</div>
            </div>
            <div className="p-3 rounded-xl border bg-green-500/10 text-center border-green-500/20">
              <div className="text-xs text-green-700 dark:text-green-300 font-medium">Delivered</div>
              <div className="text-lg font-bold font-mono text-green-700 dark:text-green-300 mt-0.5">{sentCount}</div>
            </div>
            <div className="p-3 rounded-xl border bg-destructive/10 text-center border-destructive/20">
              <div className="text-xs text-destructive font-medium">Failed / Skipped</div>
              <div className="text-lg font-bold font-mono text-destructive mt-0.5">{failedCount}</div>
            </div>
            <div className="p-3 rounded-xl border bg-blue-500/10 text-center border-blue-500/20">
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">Remaining</div>
              <div className="text-lg font-bold font-mono text-blue-700 dark:text-blue-300 mt-0.5">
                {Math.max(0, totalCount - (sentCount + failedCount))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Status / Cooldown Banner */}
      {(isRunning || cooldownRemaining !== null) && (
        <Card
          className={`shadow-md transition-all ${
            isBatchCooldownActive
              ? "border-amber-500 bg-amber-500/10 dark:bg-amber-950/30"
              : "border-blue-500 bg-blue-500/5 dark:bg-blue-950/20"
          }`}
        >
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {isBatchCooldownActive ? (
                <div className="p-2.5 rounded-full bg-amber-500 text-white animate-bounce shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2.5 rounded-full bg-blue-600 text-white shrink-0">
                  <Clock className="w-5 h-5 animate-spin" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {isBatchCooldownActive ? "10-Message Safety Break Active" : "Inter-Message Cooldown Active"}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isBatchCooldownActive
                    ? "Pausing 3 minutes to keep your WhatsApp number safe from spam detection and rate limits."
                    : currentRecipientName
                    ? `Preparing next dispatch after human delay...`
                    : "Executing automated delays with randomized jitter..."}
                </p>
              </div>
            </div>

            {cooldownRemaining !== null && (
              <div className="text-center sm:text-right shrink-0">
                <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {Math.floor(cooldownRemaining / 60) > 0 ? `${Math.floor(cooldownRemaining / 60)}m ` : ""}
                  {cooldownRemaining % 60}s
                </span>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Resuming automatically</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Activity Feed / Terminal */}
      <Card className="shadow-sm border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-md flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Live Delivery Log
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {activityLogs.length} events recorded
            </span>
          </div>
          <CardDescription className="text-xs">
            Real-time feed showing each dispatched message, variant rotation, and delivery confirmations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={logsContainerRef}
            className="rounded-xl border bg-muted/30 p-3 h-72 overflow-y-auto space-y-2 font-mono text-xs"
          >
            {activityLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                Ready to dispatch. Click &quot;Start Campaign&quot; above to begin sending messages.
              </div>
            ) : (
              activityLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-2 rounded-lg bg-card/80 border text-[11px] leading-relaxed"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground font-mono shrink-0">[{log.timestamp}]</span>
                    {log.status === "sent" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold text-foreground">{log.customerName}</span>
                      <span className="text-muted-foreground ml-1">({log.phone})</span>
                      <span className="ml-2 px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-sans text-[10px]">
                        Variant {log.variantId.replace("var_", "")}
                      </span>
                    </div>
                  </div>
                  <div>
                    {log.status === "sent" ? (
                      <span className="text-green-600 font-semibold">Delivered</span>
                    ) : (
                      <span className="text-destructive font-semibold">{log.error || "Failed"}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
