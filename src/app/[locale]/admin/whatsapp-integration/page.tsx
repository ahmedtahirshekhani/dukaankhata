"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MessageCircle, CheckCircle2 } from "lucide-react";

export default function WhatsappIntegrationPage() {
  const [phoneNumber, setPhoneNumber] = useState("03");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locale = useLocale();
  const [countdown, setCountdown] = useState(0);
  const otpTime = Number(process.env.NEXT_PUBLIC_OTP_TIME) || 30;

  useEffect(() => {
    async function fetchWhatsappNumber() {
      try {
        const res = await fetch(`/${locale}/api/users/whatsapp`);
        if (res.ok) {
          const data = await res.json();
          if (data.whatsapp_number) {
            setPhoneNumber(data.whatsapp_number);
            setIsSuccess(true);
            setShowOtp(true);
          }
        }
      } catch (e) {
        console.error("Failed to fetch whatsapp number", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWhatsappNumber();
  }, [locale]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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
    if (value.length > 1) return; // Only allow 1 character per box

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
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

  const handleResendOtp = async () => {
    setCountdown(otpTime);
    try {
      const res = await fetch(`/${locale}/api/users/whatsapp/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend OTP");
      }
      toast.success(`A new OTP code has been sent to your WhatsApp number ${phoneNumber}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP. Please try again.");
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
        <h2 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h2>
      </div>

      <div className="flex justify-center items-center mt-10">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          {!isSuccess && (
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-2">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Connect WhatsApp</CardTitle>
              <CardDescription>
                {!showOtp 
                  ? "Enter your WhatsApp number to receive notifications and updates."
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
                {/* Blue theme tick */}
                <div className="bg-blue-50 p-4 rounded-full border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50 shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                
                {/* Message only */}
                <p className="text-center text-lg font-medium text-foreground px-4">
                  Your WhatsApp number has been verified and connected.
                </p>
                
                {/* Number which is connected */}
                <div className="bg-muted hover:bg-muted/80 transition-colors px-4 py-2 rounded-lg text-sm font-semibold tracking-wider text-muted-foreground border">
                  {phoneNumber}
                </div>
                
                {/* Button says Change Number */}
                <Button 
                  variant="outline" 
                  className="w-full mt-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-950/20 text-blue-600 dark:text-blue-400"
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
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-2xl font-bold p-0 border-2 focus-visible:ring-green-500 focus-visible:border-green-500"
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

                <div className="text-center space-y-2 mt-4">
                  <div className="text-sm text-muted-foreground">
                    Didn't receive code?{" "}
                    {countdown > 0 ? (
                      <span className="font-medium text-muted-foreground">
                        Resend in {countdown}s
                      </span>
                    ) : (
                      <button 
                        className="text-green-600 font-medium hover:underline"
                        onClick={handleResendOtp}
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                  <div>
                    <Button 
                      variant="link" 
                      className="text-sm text-muted-foreground"
                      onClick={() => {
                        setShowOtp(false);
                        setOtp(["", "", "", "", "", ""]);
                      }}
                    >
                      Change Number
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
