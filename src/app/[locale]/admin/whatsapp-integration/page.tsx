"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
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
import { Loader2, MessageCircle, CheckCircle2, Send, RefreshCw, ShieldCheck, LogOut, FileText, Calendar, Clock } from "lucide-react";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/whatsapp/template-utils";

export default function WhatsappIntegrationPage() {
  const locale = useLocale();

  // Active tab state
  const [activeTab, setActiveTab] = useState<"session" | "otp">("session");

  // Tab 1: OTP verification states
  const [phoneNumber, setPhoneNumber] = useState("03");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(0);
  const otpTime = Number(process.env.NEXT_PUBLIC_OTP_TIME) || 30;

  // Tab 2: WhatsApp Web Session & Automated Reminders states
  const [sessionStatus, setSessionStatus] = useState<"disconnected" | "qrcode" | "connected">("disconnected");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [connectedSessionPhone, setConnectedSessionPhone] = useState<string | null>(null);
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(false);
  const [minOverdueDays, setMinOverdueDays] = useState(1);
  const [reminderTimePkt, setReminderTimePkt] = useState("10:00");
  const [reminderFrequency, setReminderFrequency] = useState<string>("daily");
  const [reminderTemplate, setReminderTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [isConnectingSession, setIsConnectingSession] = useState(false);
  const [isSendingTestReminders, setIsSendingTestReminders] = useState(false);

  // Test Message Box states
  const [testRecipientPhone, setTestRecipientPhone] = useState("03");
  const [testMessageText, setTestMessageText] = useState("Assalam-o-Alaikum! This is a test message sent from DukaanKhata.");
  const [isSendingCustomTest, setIsSendingCustomTest] = useState(false);

  // Fetch initial data
  useEffect(() => {
    async function initData() {
      try {
        // Fetch OTP verified number
        const resOtp = await fetch(`/${locale}/api/users/whatsapp`);
        if (resOtp.ok) {
          const data = await resOtp.json();
          if (data.whatsapp_number) {
            setPhoneNumber(data.whatsapp_number);
            setIsSuccess(true);
            setShowOtp(true);
          }
        }

        // Fetch WhatsApp Session state & settings
        const resSession = await fetch(`/${locale}/api/whatsapp/session`);
        if (resSession.ok) {
          const sData = await resSession.json();
          setSessionStatus(sData.status || "disconnected");
          setQrCodeData(sData.qrcode || null);
          setConnectedSessionPhone(sData.connected_phone || null);
          setAutoReminderEnabled(Boolean(sData.auto_reminder_enabled));
          setMinOverdueDays(sData.min_overdue_days || 1);
          setReminderTimePkt(sData.reminder_time_pkt || sData.reminder_time || "10:00");
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

  // Real-time polling effect to detect when QR code is scanned on phone
  useEffect(() => {
    if (sessionStatus === "connected") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/${locale}/api/whatsapp/session`);
        if (res.ok) {
          const sData = await res.json();
          if (sData.status !== sessionStatus) {
            setSessionStatus(sData.status || "disconnected");
            setQrCodeData(sData.qrcode || null);
            setConnectedSessionPhone(sData.connected_phone || null);
            if (sData.status === "connected") {
              toast.success("WhatsApp Linked & Connected!");
            }
          } else if (sData.qrcode && sData.qrcode !== qrCodeData) {
            setQrCodeData(sData.qrcode);
          }
        }
      } catch (err) {
        // Silent poll error handling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionStatus, qrCodeData, locale]);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Fetch session status refresh
  const refreshSessionStatus = async () => {
    setIsConnectingSession(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" })
      });
      const data = await res.json();
      if (res.ok) {
        setSessionStatus(data.status);
        setQrCodeData(data.qrcode);
        setConnectedSessionPhone(data.connected_phone);
        toast.success("WhatsApp Session refreshed");
      } else {
        toast.error(data.error || "Failed to connect WhatsApp session");
      }
    } catch (err: any) {
      toast.error("Error connecting session");
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
        body: JSON.stringify({ action: "disconnect" })
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
          reminder_template: tmpl
        })
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
        body: JSON.stringify({ force: true })
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
          message: testMessageText
        })
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

  const handleVerify = async () => {
    if (!phoneNumber || phoneNumber.length !== 11) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/${locale}/api/users/whatsapp/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }
      setShowOtp(true);
      setCountdown(otpTime);
      toast.success("OTP has been sent to your WhatsApp!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.some((digit) => digit === "")) return;
    const code = otp.join("");
    setIsVerifyingOtp(true);
    try {
      const res = await fetch(`/${locale}/api/users/whatsapp/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: phoneNumber, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid OTP code");
      }
      setIsSuccess(true);
      toast.success("Successfully Verified!");
    } catch (e: any) {
      toast.error(e.message || "Failed to verify OTP.");
    } finally {
      setIsVerifyingOtp(false);
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your WhatsApp account to automatically send payment reminders & messages directly from your phone.
          </p>
        </div>
      </div>

      {/* Custom Tab Switcher */}
      <div className="flex justify-center my-6">
        <div className="inline-flex p-1 bg-muted rounded-xl border">
          <button
            onClick={() => setActiveTab("session")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "session"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4 text-green-600" />
            Link Your WhatsApp (QR Scan)
          </button>
          <button
            onClick={() => setActiveTab("otp")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "otp"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Verify Phone Number (OTP)
          </button>
        </div>
      </div>

      {/* Tab 1: QR Code Session & Automated Reminders */}
      {activeTab === "session" && (
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
                  Scan the QR code with WhatsApp on your mobile device (**WhatsApp Settings → Linked Devices**).
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
                        Messages will be sent directly from your connected WhatsApp account.
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
                      Waiting for QR code scan... Auto-checking status.
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

            {/* Card 2: Automated Reminders Configuration */}
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reminderTimePkt" className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Scheduled Time
                    </Label>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded">
                      Pakistan Time (PKT - UTC+5)
                    </span>
                  </div>
                  <Input
                    id="reminderTimePkt"
                    type="time"
                    value={reminderTimePkt}
                    onChange={(e) => {
                      setReminderTimePkt(e.target.value);
                      handleSaveAutomationSettings(autoReminderEnabled, minOverdueDays, e.target.value, reminderFrequency);
                    }}
                  />
                </div>

                <div className="pt-2 border-t">
                  <Button 
                    onClick={handleTriggerRemindersNow}
                    disabled={isSendingTestReminders}
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

          </div>

          {/* Card 3: Custom Message Template Editor */}
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Custom WhatsApp Reminder Template
              </CardTitle>
              <CardDescription>
                Customize the message template sent to customers. Click variable tags below to insert them into your text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 pb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center mr-1">Available Tags:</span>
                <Button variant="outline" size="sm" onClick={() => insertTag("{customer_name}")} className="text-xs font-mono py-1 h-7">
                  + {"{customer_name}"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertTag("{shop_name}")} className="text-xs font-mono py-1 h-7">
                  + {"{shop_name}"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertTag("{balance}")} className="text-xs font-mono py-1 h-7">
                  + {"{balance}"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertTag("{payment_link}")} className="text-xs font-mono py-1 h-7">
                  + {"{payment_link}"}
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
                  Reset to Default Template
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

          {/* Card 4: Send Test Message Box */}
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Send className="w-5 h-5 text-green-600" />
                Send Test Message
              </CardTitle>
              <CardDescription>
                Send a custom test WhatsApp message to any phone number to test your connected session.
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
                disabled={isSendingCustomTest}
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Standard OTP Verification */}
      {activeTab === "otp" && (
        <div className="flex justify-center items-center">
          <Card className="w-full max-w-md shadow-lg border-primary/10">
            {!isSuccess && (
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                  <MessageCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Verify Phone Number</CardTitle>
                <CardDescription>
                  {!showOtp 
                    ? "Enter your WhatsApp number to verify ownership."
                    : "An OTP code has been sent to your WhatsApp number."}
                </CardDescription>
              </CardHeader>
            )}
            <CardContent className={isSuccess ? "pt-6" : ""}>
              {!showOtp ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">WhatsApp Number</Label>
                    <Input
                      id="phone"
                      placeholder="03XXXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "");
                        if (!val.startsWith("03")) {
                          val = "03" + val.replace(/^0?3?/, "");
                        }
                        if (val.length <= 11) {
                          setPhoneNumber(val);
                        }
                      }}
                      className="text-lg"
                    />
                  </div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white" 
                    size="lg"
                    onClick={handleVerify}
                    disabled={phoneNumber.length !== 11 || isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      "Send Code"
                    )}
                  </Button>
                </div>
              ) : isSuccess ? (
                <div className="flex flex-col items-center justify-center space-y-6 py-6">
                  <div className="bg-blue-50 p-4 rounded-full border border-blue-100">
                    <CheckCircle2 className="w-12 h-12 text-blue-600" />
                  </div>
                  <p className="text-center text-lg font-medium text-foreground px-4">
                    Your WhatsApp number has been verified.
                  </p>
                  <div className="bg-muted px-4 py-2 rounded-lg text-sm font-semibold tracking-wider text-muted-foreground border">
                    {phoneNumber}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => {
                      setIsSuccess(false);
                      setShowOtp(false);
                      setOtp(["", "", "", "", "", ""]);
                      setPhoneNumber("03");
                    }}
                  >
                    Change Number
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2 text-center">
                    <Label>Enter 6-digit code</Label>
                    <div className="flex justify-center gap-2 mt-4">
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          ref={(el) => { inputRefs.current[index] = el; }}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          className="w-12 h-12 text-center text-2xl font-bold p-0 border-2"
                        />
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white" 
                    size="lg"
                    onClick={handleVerifyOtp}
                    disabled={otp.some((digit) => digit === "") || isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
