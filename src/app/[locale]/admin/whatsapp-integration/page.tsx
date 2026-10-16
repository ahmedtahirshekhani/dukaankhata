"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  MessageCircle,
  CheckCircle2,
  Send,
  RefreshCw,
  LogOut,
  FileText,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Layers,
  History,
} from "lucide-react";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/whatsapp/template-utils";
import { WhatsappSafetyCard } from "@/components/whatsapp/whatsapp-safety-card";
import { WhatsappCampaignBuilder } from "@/components/whatsapp/whatsapp-campaign-builder";
import { WhatsappCampaignRunner } from "@/components/whatsapp/whatsapp-campaign-runner";
import { WhatsappCampaignsList } from "@/components/whatsapp/whatsapp-campaigns-list";

export default function WhatsappIntegrationPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();

  // Active Tab: "connection" | "campaigns" | "reminders"
  const initialTab = searchParams.get("tab") === "campaigns" ? "campaigns" : searchParams.get("tab") === "reminders" ? "reminders" : "campaigns";
  const [activeTab, setActiveTab] = useState<"connection" | "campaigns" | "reminders">(initialTab);

  // Marketing campaign sub-view: "list" | "create" | "runner"
  const [campaignView, setCampaignView] = useState<"list" | "create" | "runner">("list");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // WhatsApp Web Session states
  const [sessionStatus, setSessionStatus] = useState<"disconnected" | "qrcode" | "connected">("disconnected");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [connectedSessionPhone, setConnectedSessionPhone] = useState<string | null>(null);
  const [isConnectingSession, setIsConnectingSession] = useState(false);

  // Automated Reminders states
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(false);
  const [minOverdueDays, setMinOverdueDays] = useState(1);
  const [reminderTimePkt, setReminderTimePkt] = useState("13:00");
  const [reminderFrequency, setReminderFrequency] = useState<string>("daily");
  const [reminderTemplate, setReminderTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [isSendingTestReminders, setIsSendingTestReminders] = useState(false);

  // Test Message Box states
  const [testRecipientPhone, setTestRecipientPhone] = useState("03");
  const [testMessageText, setTestMessageText] = useState("Assalam-o-Alaikum! This is a test message sent from DukaanKhata.");
  const [isSendingCustomTest, setIsSendingCustomTest] = useState(false);

  // Fetch initial session & settings
  useEffect(() => {
    async function initData() {
      try {
        const resSession = await fetch(`/${locale}/api/whatsapp/session`);
        if (resSession.ok) {
          const sData = await resSession.json();
          setSessionStatus(sData.status || "disconnected");
          setQrCodeData(sData.qrcode || null);
          setConnectedSessionPhone(sData.connected_phone || null);
          setAutoReminderEnabled(Boolean(sData.auto_reminder_enabled));
          setMinOverdueDays(sData.min_overdue_days || 1);
          setReminderTimePkt(sData.reminder_time_pkt || sData.reminder_time || "13:00");
          setReminderFrequency(sData.reminder_frequency || "daily");
          setReminderTemplate(sData.reminder_template || DEFAULT_REMINDER_TEMPLATE);
        }
      } catch (e) {
        console.error("Failed to fetch whatsapp integration info", e);
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, [locale]);

  // Vercel-optimized QR Code Scan detection loop
  // When in QR code state, uses long-poll wait endpoint to hold serverless socket open
  useEffect(() => {
    if (sessionStatus === "connected") return;

    let isMounted = true;
    let abortController = new AbortController();

    async function pollScanStatus() {
      while (isMounted && sessionStatus !== "connected") {
        try {
          const endpoint = sessionStatus === "qrcode"
            ? `/${locale}/api/whatsapp/session?wait=true`
            : `/${locale}/api/whatsapp/session`;

          const res = await fetch(endpoint, { signal: abortController.signal });
          if (res.ok && isMounted) {
            const sData = await res.json();
            if (sData.status !== sessionStatus) {
              setSessionStatus(sData.status || "disconnected");
              setQrCodeData(sData.qrcode || null);
              setConnectedSessionPhone(sData.connected_phone || null);
              if (sData.status === "connected") {
                toast.success("WhatsApp Linked & Connected!");
                break;
              }
            } else if (sData.qrcode && sData.qrcode !== qrCodeData) {
              setQrCodeData(sData.qrcode);
            }
          }
        } catch (err: any) {
          if (err.name === "AbortError") break;
          // Short delay on network error before retrying
          await new Promise((r) => setTimeout(r, 3000));
        }

        // If not in QR mode, wait 4s between polls
        if (sessionStatus !== "qrcode") {
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    }

    pollScanStatus();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [sessionStatus, qrCodeData, locale]);

  // Connect & Refresh QR code (awaiting QR from backend)
  const refreshSessionStatus = async () => {
    setIsConnectingSession(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionStatus(data.status);
        setQrCodeData(data.qrcode);
        setConnectedSessionPhone(data.connected_phone);
        if (data.status === "connected") {
          toast.success("WhatsApp is already connected!");
        } else {
          toast.success("QR Code ready! Scan with your mobile device.");
        }
      } else {
        toast.error(data.error || "Failed to initialize WhatsApp QR code");
      }
    } catch (err: any) {
      toast.error("Error generating WhatsApp QR code");
    } finally {
      setIsConnectingSession(false);
    }
  };

  const disconnectSession = async () => {
    setIsConnectingSession(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        setSessionStatus("disconnected");
        setQrCodeData(null);
        setConnectedSessionPhone(null);
        toast.success("Disconnected WhatsApp Session");
      }
    } catch (err) {
      toast.error("Failed to disconnect");
    } finally {
      setIsConnectingSession(false);
    }
  };

  const handleSaveAutomationSettings = async (
    enabled: boolean,
    days: number,
    timePkt: string,
    frequency: string,
    template?: string
  ) => {
    setAutoReminderEnabled(enabled);
    setReminderTimePkt(timePkt);
    setReminderFrequency(frequency);
    const tmpl = template !== undefined ? template : reminderTemplate;

    try {
      const res = await fetch(`/${locale}/api/whatsapp/session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_reminder_enabled: enabled,
          min_overdue_days: days,
          reminder_time_pkt: timePkt,
          reminder_frequency: frequency,
          reminder_template: tmpl,
        }),
      });
      if (res.ok) {
        toast.success("Automated reminder settings saved!");
      }
    } catch (err) {
      toast.error("Failed to update settings");
    }
  };

  const insertTag = (tag: string) => {
    setReminderTemplate((prev) => `${prev} ${tag}`);
  };

  const handleTriggerRemindersNow = async () => {
    setIsSendingTestReminders(true);
    try {
      const res = await fetch(`/${locale}/api/cron/send-owner-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        if ((data.totalRemindersSent || 0) > 0) {
          toast.success(`Processed! Sent ${data.totalRemindersSent} reminder(s).`);
        } else if ((data.totalErrors || 0) > 0) {
          toast.error(`Attempted dispatches but ${data.totalErrors} message(s) failed. Make sure your WhatsApp device is linked.`);
        } else {
          toast.info(data.message || "No overdue customers with valid phone numbers were found.");
        }
      } else {
        toast.error(data.error || "Failed to trigger reminders");
      }
    } catch (err) {
      toast.error("Error triggering reminders");
    } finally {
      setIsSendingTestReminders(false);
    }
  };

  const handleSendCustomTestMessage = async () => {
    if (!testRecipientPhone || testRecipientPhone.length !== 11) {
      toast.error("Please enter a valid 11-digit phone number (e.g. 03001234567)");
      return;
    }
    if (!testMessageText.trim()) {
      toast.error("Message text cannot be empty");
      return;
    }

    setIsSendingCustomTest(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testRecipientPhone,
          message: testMessageText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Test message sent successfully!");
      } else {
        toast.error(data.error || "Failed to send message");
      }
    } catch (err: any) {
      toast.error("Error sending test message");
    } finally {
      setIsSendingCustomTest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h2>
        </div>
        <div className="flex justify-center items-center mt-10">
          <Card className="w-full max-w-md shadow-lg border-primary/10">
            <CardContent className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <MessageCircle className="w-8 h-8 text-green-600" />
            WhatsApp Marketing &amp; Reminders
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Run automated marketing campaigns, broadcast personalized deals, and send payment reminders directly from your connected WhatsApp account.
          </p>
        </div>

        {/* Global Connection Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            sessionStatus === "connected"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-300 dark:border-green-800"
              : sessionStatus === "qrcode"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              sessionStatus === "connected" ? "bg-green-500" : sessionStatus === "qrcode" ? "bg-amber-500" : "bg-slate-400"
            }`} />
            {sessionStatus === "connected" ? "WhatsApp Connected" : sessionStatus === "qrcode" ? "Scan QR Code" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b">
        <div className="flex space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "campaigns"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            Marketing Campaigns
          </button>

          <button
            onClick={() => setActiveTab("connection")}
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "connection"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="w-4 h-4 text-green-600" />
            WhatsApp Device Connection
            {sessionStatus === "connected" && (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("reminders")}
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "reminders"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
            Automated Udhaar Reminders
          </button>
        </div>
      </div>

      {/* TAB 1: MARKETING CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Anti-Ban Safety Overview Card */}
          <WhatsappSafetyCard />

          {/* Device Not Connected Warning Banner if Disconnected */}
          {sessionStatus !== "connected" && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                    WhatsApp Device Not Connected
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Connect your WhatsApp account by scanning the QR code before running live marketing campaigns.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("connection")}
                className="bg-white dark:bg-slate-900 border-amber-300 text-amber-900 dark:text-amber-100 font-semibold text-xs shrink-0"
              >
                Connect WhatsApp Device →
              </Button>
            </div>
          )}

          {/* Sub-views: List vs Builder vs Live Runner */}
          {campaignView === "create" ? (
            <WhatsappCampaignBuilder
              locale={locale}
              onCampaignCreated={(campId) => {
                setActiveCampaignId(campId);
                setCampaignView("runner");
              }}
              onCancel={() => setCampaignView("list")}
            />
          ) : campaignView === "runner" && activeCampaignId ? (
            <WhatsappCampaignRunner
              locale={locale}
              campaignId={activeCampaignId}
              onBack={() => {
                setCampaignView("list");
                setActiveCampaignId(null);
              }}
            />
          ) : (
            <WhatsappCampaignsList
              locale={locale}
              onCreateNew={() => setCampaignView("create")}
              onOpenCampaign={(campId) => {
                setActiveCampaignId(campId);
                setCampaignView("runner");
              }}
            />
          )}
        </div>
      )}

      {/* TAB 2: DEVICE CONNECTION & QR CODE */}
      {activeTab === "connection" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Connection & QR Code */}
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    WhatsApp Device Session
                  </CardTitle>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    sessionStatus === "connected"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : sessionStatus === "qrcode"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {sessionStatus === "connected" ? "Connected" : sessionStatus === "qrcode" ? "Scan QR Code" : "Disconnected"}
                  </span>
                </div>
                <CardDescription>
                  Scan the QR code with WhatsApp on your mobile phone (**WhatsApp Settings → Linked Devices → Link a Device**).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center flex flex-col items-center justify-center">
                {sessionStatus === "connected" ? (
                  <div className="py-6 space-y-4">
                    <div className="bg-green-50 text-green-700 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-green-200">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-foreground">WhatsApp Linked Successfully</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Messages and campaigns will be sent directly from your connected WhatsApp account.
                      </p>
                      {connectedSessionPhone && (
                        <div className="inline-block bg-muted px-3 py-1 rounded-md text-xs font-semibold mt-2 border">
                          Phone: +{connectedSessionPhone}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={disconnectSession} 
                      disabled={isConnectingSession}
                      className="mt-4"
                    >
                      {isConnectingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                      Disconnect Device
                    </Button>
                  </div>
                ) : qrCodeData ? (
                  <div className="space-y-4 py-2">
                    <div className="p-3 bg-white rounded-xl shadow-inner inline-block border-2 border-green-500">
                      <img src={qrCodeData} alt="WhatsApp QR Code" className="w-56 h-56 object-contain mx-auto" />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
                      Listening for mobile scan... Socket kept alive automatically on Vercel.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshSessionStatus} 
                      disabled={isConnectingSession}
                    >
                      {isConnectingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Refresh QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="py-8 space-y-4">
                    <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                      <MessageCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-md font-semibold">No Device Linked</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        Click below to generate a QR code and connect your store&apos;s WhatsApp account.
                      </p>
                    </div>
                    <Button 
                      onClick={refreshSessionStatus} 
                      disabled={isConnectingSession}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isConnectingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Generate QR Code
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Send Test Message Box */}
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Send className="w-5 h-5 text-green-600" />
                  Send Test Message
                </CardTitle>
                <CardDescription>
                  Send a custom test message to any WhatsApp number to verify your connection and formatting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testPhone">Recipient WhatsApp Number</Label>
                  <Input
                    id="testPhone"
                    placeholder="03XXXXXXXXX"
                    value={testRecipientPhone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "");
                      if (!val.startsWith("03")) {
                        val = "03" + val.replace(/^0?3?/, "");
                      }
                      if (val.length <= 11) {
                        setTestRecipientPhone(val);
                      }
                    }}
                    className="max-w-md font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testMessage">Message Text</Label>
                  <Textarea
                    id="testMessage"
                    rows={3}
                    value={testMessageText}
                    onChange={(e) => setTestMessageText(e.target.value)}
                    placeholder="Type your message here..."
                  />
                </div>

                <Button
                  onClick={handleSendCustomTestMessage}
                  disabled={isSendingCustomTest || sessionStatus !== "connected"}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  {isSendingCustomTest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Message...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Test Message
                    </>
                  )}
                </Button>
                {sessionStatus !== "connected" && (
                  <p className="text-xs text-muted-foreground italic">
                    * Please link your WhatsApp device via QR code first.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED UDHAAR REMINDERS */}
      {activeTab === "reminders" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Automated Reminders Configuration */}
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  Automated Udhaar Reminders
                </CardTitle>
                <CardDescription>
                  Configure automated background payment reminders sent from your WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">Automated Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically send payment reminders to customers with overdue balances.
                    </p>
                  </div>
                  <Switch
                    checked={autoReminderEnabled}
                    onCheckedChange={(checked) => handleSaveAutomationSettings(checked, minOverdueDays, reminderTimePkt, reminderFrequency)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminderFrequency" className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Reminder Frequency
                  </Label>
                  <Select
                    value={reminderFrequency}
                    onValueChange={(val) => {
                      setReminderFrequency(val);
                      handleSaveAutomationSettings(autoReminderEnabled, minOverdueDays, reminderTimePkt, val);
                    }}
                  >
                    <SelectTrigger id="reminderFrequency">
                      <SelectValue placeholder="Select Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">📅 Daily (Everyday)</SelectItem>
                      <SelectItem value="weekly">📅 Weekly (Every 7 Days)</SelectItem>
                      <SelectItem value="biweekly">📅 Every 2 Weeks (Every 14 Days)</SelectItem>
                      <SelectItem value="monthly">📅 Monthly (Every 30 Days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Scheduled Dispatch Time</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Automated reminders are dispatched every day at <strong className="text-foreground font-bold">1:00 PM Pakistan Time (PKT)</strong>.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-1 rounded shrink-0 ml-2">
                    1:00 PM PKT
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <Button 
                    onClick={handleTriggerRemindersNow}
                    disabled={isSendingTestReminders || sessionStatus !== "connected"}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm flex items-center justify-center gap-2 py-5"
                  >
                    {isSendingTestReminders ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Dispatching Overdue Reminders...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Overdue Reminders Now (All Overdue Customers)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Custom Message Template Editor */}
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Custom Reminder Template
                </CardTitle>
                <CardDescription>
                  Customize the message template sent to overdue customers. Click variable tags to insert.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center mr-1">Tags:</span>
                  <Button variant="outline" size="sm" onClick={() => insertTag("{customer_name}")} className="text-xs font-mono py-1 h-7">
                    + {"{customer_name}"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertTag("{shop_name}")} className="text-xs font-mono py-1 h-7">
                    + {"{shop_name}"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertTag("{balance}")} className="text-xs font-mono py-1 h-7">
                    + {"{balance}"}
                  </Button>
                </div>

                <Textarea
                  rows={6}
                  value={reminderTemplate}
                  onChange={(e) => setReminderTemplate(e.target.value)}
                  placeholder="Write your reminder message template..."
                  className="font-mono text-sm"
                />

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReminderTemplate(DEFAULT_REMINDER_TEMPLATE);
                      handleSaveAutomationSettings(autoReminderEnabled, minOverdueDays, reminderTimePkt, reminderFrequency, DEFAULT_REMINDER_TEMPLATE);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset to Default
                  </Button>

                  <Button
                    onClick={() => handleSaveAutomationSettings(autoReminderEnabled, minOverdueDays, reminderTimePkt, reminderFrequency, reminderTemplate)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
