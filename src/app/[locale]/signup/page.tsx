"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Home,
  Loader2,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const COUNTRY_CODES = [
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+91", label: "India (+91)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
];

type SignupStep = 1 | 2 | 3 | 4;

export default function SignUpPage({ params }: { params: { locale: string } }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    companyName: "",
    countryCode: "+92",
    phoneNumber: "03",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<SignupStep>(1);
  const [otp, setOtp] = useState("");
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!otpSent || resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [otpSent, resendCooldown]);

  const normalizedPhoneNumber = formData.phoneNumber.replace(/\D/g, "");

  const fullPhoneNumber = `${formData.countryCode}${normalizedPhoneNumber}`;

  const validateStepOne = (): boolean => {
    if (!formData.name.trim() || !formData.companyName.trim()) {
      setError(t("requiredField"));
      return false;
    }

    return true;
  };

  const validateStepTwo = (): boolean => {
    if (!formData.email.trim() || !formData.phoneNumber.trim()) {
      setError(t("requiredField"));
      return false;
    }

    if (normalizedPhoneNumber.length < 11) {
      setError("Phone number must be at least 11 digits");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("invalidEmail"));
      return false;
    }

    return true;
  };

  const validateStepThree = (): boolean => {
    if (!otp.trim()) {
      setError(t("requiredField"));
      return false;
    }

    if (otp.replace(/\s/g, "").length < 6) {
      setError("Enter the 6-digit OTP sent to your email");
      return false;
    }

    return true;
  };

  const validateStepFour = (): boolean => {
    if (!formData.password || !formData.confirmPassword) {
      setError(t("requiredField"));
      return false;
    }

    if (formData.password.length < 8) {
      setError(t("passwordTooShort"));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordMismatch"));
      return false;
    }

    return true;
  };

  const sendOtp = async () => {
    if (!validateStepTwo()) {
      return false;
    }

    setOtpLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/signup/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          companyName: formData.companyName,
          phone: fullPhoneNumber,
          phoneCountryCode: formData.countryCode,
          phoneNumber: formData.phoneNumber,
        }),
      });

      if (!response.ok) {
        let errorMessage = t("signUpError");

        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          if (response.status >= 500) {
            errorMessage = t("serverError");
          }
        }

        setError(errorMessage);
        return false;
      }

      const data = await response.json().catch(() => ({}));
      setEmailVerificationToken(data.verificationToken || data.token || "");
      setSuccess("OTP sent to your email.");
      setOtpSent(true);
      setResendCooldown(Number(data.cooldownSeconds || 30));
      setEmailVerified(false);
      setOtp("");
      setCurrentStep(3);
      return true;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(t("networkError"));
      } else {
        setError(t("signUpError"));
      }

      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!validateStepThree()) {
      return false;
    }

    setOtpLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/signup/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          otp: otp.replace(/\s/g, ""),
          verificationToken: emailVerificationToken,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Invalid OTP. Please try again.";

        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          if (response.status >= 500) {
            errorMessage = t("serverError");
          }
        }

        setError(errorMessage);
        return false;
      }

      setEmailVerified(true);
      setSuccess("Email verified successfully.");
      setCurrentStep(4);
      return true;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(t("networkError"));
      } else {
        setError(t("signUpError"));
      }

      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateStepFour()) {
      return;
    }

    if (!emailVerified) {
      setError("Please verify your email first.");
      return;
    }

    setIsLoading(true);

    try {
      const normalizedLocalPhone = formData.phoneNumber.replace(/\D/g, "");
      const fullPhone = `${formData.countryCode}${normalizedLocalPhone}`;

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName,
          phone: fullPhoneNumber,
          phoneCountryCode: formData.countryCode,
          phoneNumber: formData.phoneNumber,
        }),
      });

      // Handle network errors or non-JSON responses
      if (!response.ok) {
        let errorMessage = t("signUpError");

        try {
          const data = await response.json();

          // Map API error messages to translation keys
          if (data.error) {
            const apiError = data.error.toLowerCase();

            if (
              apiError.includes("missing required fields") ||
              apiError.includes("missing required")
            ) {
              errorMessage = t("missingFields");
            } else if (
              apiError.includes("password must be at least 8") ||
              (apiError.includes("password") && apiError.includes("8"))
            ) {
              errorMessage = t("passwordTooShort");
            } else if (
              apiError.includes("email already registered") ||
              apiError.includes("email already")
            ) {
              errorMessage = t("emailAlreadyExists");
            } else if (
              apiError.includes("phone number already") ||
              apiError.includes("phone already")
            ) {
              errorMessage = t("phoneAlreadyExists");
            } else if (
              apiError.includes("failed to create user") ||
              apiError.includes("internal server error")
            ) {
              errorMessage = t("serverError");
            } else {
              // Use the API error message if it doesn't match known patterns
              errorMessage = data.error;
            }
          }
        } catch (parseError) {
          // If response is not JSON, use status-based error messages
          if (response.status >= 500) {
            errorMessage = t("serverError");
          } else if (response.status === 400) {
            errorMessage = t("signUpError");
          }
        }

        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        setError(t("signUpError"));
        setIsLoading(false);
        return;
      }

      setSuccess(t("signUpSuccess"));

      if (typeof window !== "undefined" && formData.companyName.trim()) {
        localStorage.setItem("companyName", formData.companyName.trim());
      }

      const email = formData.email;
      const password = formData.password;

      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        companyName: "",
        countryCode: "+92",
        phoneNumber: "03",
      });
      setOtp("");
      setEmailVerificationToken("");
      setEmailVerified(false);
      setOtpSent(false);
      setResendCooldown(0);
      setCurrentStep(1);

      setIsCreatingBusiness(true);

      // Auto login the user
      await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      const delay = Number(process.env.NEXT_PUBLIC_SIGNUP_TIME || 5) * 1000;

      // Redirect to welcome page after delay
      setTimeout(() => {
        router.push(`/${params.locale}/admin/welcome`);
      }, delay);
    } catch (err) {
      // Handle network errors, fetch failures, etc.
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(t("networkError"));
      } else {
        setError(t("signUpError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phoneNumber") {
      let digitsOnly = value.replace(/\D/g, "");
      
      if (!digitsOnly.startsWith("03")) {
        digitsOnly = "03" + digitsOnly.replace(/^0*/, "").replace(/^3/, "");
      }
      if (digitsOnly.length < 2) {
        digitsOnly = "03";
      }

      setFormData((prev) => ({
        ...prev,
        phoneNumber: digitsOnly,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "email") {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      setEmailVerificationToken("");
    }
  };

  const handleOtpBoxChange = (index: number, value: string) => {
    if (isLoading || otpLoading || emailVerified) return;
    
    const digitsOnly = value.replace(/\D/g, "");
    if (!digitsOnly && value !== "") return;

    if (digitsOnly.length > 1) {
      const newOtp = (otp.padEnd(6, " ").slice(0, index) + digitsOnly).slice(0, 6);
      setOtp(newOtp);
      const nextIndex = Math.min(index + digitsOnly.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const currentOtpArray = otp.padEnd(6, " ").split("");
    
    if (digitsOnly) {
      currentOtpArray[index] = digitsOnly;
      setOtp(currentOtpArray.join("").trimEnd());
      if (index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    } else {
      currentOtpArray[index] = " ";
      setOtp(currentOtpArray.join("").trimEnd());
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLoading || otpLoading || emailVerified) return;
    if (e.key === "Backspace") {
      const currentOtpArray = otp.padEnd(6, " ").split("");
      if (!currentOtpArray[index] || currentOtpArray[index] === " ") {
        if (index > 0) {
          otpInputRefs.current[index - 1]?.focus();
          currentOtpArray[index - 1] = " ";
          setOtp(currentOtpArray.join("").trimEnd());
        }
      } else {
        currentOtpArray[index] = " ";
        setOtp(currentOtpArray.join("").trimEnd());
      }
    }
  };

  const handleCountryCodeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      countryCode: value,
    }));
  };

  const goToNextStep = async () => {
    setError("");
    setSuccess("");

    if (currentStep === 1) {
      if (validateStepOne()) {
        setCurrentStep(2);
      }
      return;
    }

    if (currentStep === 2) {
      if (emailVerified || otpSent) {
        setCurrentStep(3);
        return;
      }
      await sendOtp();
      return;
    }

    if (currentStep === 3) {
      if (emailVerified) {
        setCurrentStep(4);
      } else {
        await verifyOtp();
      }
      return;
    }
  };

  const isStepOneComplete = formData.name.trim() && formData.companyName.trim();
  const isStepTwoComplete =
    formData.email.trim() && formData.phoneNumber.trim() && normalizedPhoneNumber.length >= 11;
  const isStepThreeComplete = otp.replace(/\s/g, "").length === 6;
  const isStepFourComplete =
    formData.password.trim() && formData.confirmPassword.trim() && emailVerified;

  const showPasswordMismatch =
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;

  const getStepState = (step: SignupStep) => {
    const isComplete = currentStep > step || (step === 3 && currentStep === 3 && emailVerified);
    const isActive = currentStep === step;

    return { isComplete, isActive };
  };

  const renderStatusBars = () => {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((step) => {
            const { isComplete, isActive } = getStepState(step as SignupStep);

            return (
              <div
                key={step}
                className={`h-2 rounded-full transition-colors ${
                  isComplete
                    ? "bg-primary"
                    : isActive
                      ? "bg-secondary"
                      : "bg-muted"
                }`}
              />
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>
            {emailVerified ? "Email verified" : currentStep === 3 ? "Verify email" : "Continue"}
          </span>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t("name")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Muhammad Ali Khan"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">
              {t("companyName")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder={t("companyNamePlaceholder")}
              value={formData.companyName}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
            />
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              {t("email")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              name="phoneNumber"
              type="tel"
              inputMode="numeric"
              placeholder="0300 1234567"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
            />
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground space-y-3">
            <div>
              We will send a verification code to <span className="font-medium">{formData.email}</span>.
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={sendOtp}
              disabled={isLoading || otpLoading || otpSent}
            >
              {otpLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : otpSent ? (
                "OTP sent"
              ) : (
                "Send OTP"
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">
              Email OTP <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2 justify-between">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    otpInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp[index] && otp[index] !== " " ? otp[index] : ""}
                  onChange={(e) => handleOtpBoxChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={isLoading || otpLoading || emailVerified}
                  className="w-12 h-12 text-center text-lg"
                />
              ))}
            </div>
          </div>

          {emailVerified && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-secondary/30 px-3 py-2 text-sm text-foreground">
              <Check className="h-4 w-4" />
              Email verified.
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">
            {t("password")} <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
              className={showPasswordMismatch ? "pr-20" : "pr-10"}
            />
            {showPasswordMismatch && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 text-red-500">
                <X size={18} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || otpLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            {t("confirmPassword")} <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("confirmPasswordPlaceholder")}
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
              className={showPasswordMismatch ? "pr-20" : "pr-10"}
            />
            {showPasswordMismatch && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2 text-red-500">
                <X size={18} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading || otpLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {!emailVerified && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-secondary/20 px-3 py-2 text-sm text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Verify your email before creating the account.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-secondary/20 flex flex-col relative">
      {/* Mobile Navbar */}
      <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={`/${params.locale}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              {t("home")}
            </Button>
          </Link>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Desktop Buttons */}
      <div className="hidden md:block absolute top-4 left-4 z-10">
        <Link href={`/${params.locale}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Home className="h-4 w-4" />
            {t("home")}
          </Button>
        </Link>
      </div>
      <div className="hidden md:block absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl overflow-hidden border-border shadow-2xl shadow-foreground/5">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
          {isCreatingBusiness ? (
            <CardContent className="flex flex-col items-center justify-center py-24 space-y-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-bold text-foreground">
                  Launching your Dukaan Khata...
                </h3>
                <p className="text-muted-foreground">
                  Please wait while we finalize your account and configure your business.
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-4 pb-4">
                <div className="space-y-2 text-center">
              <CardTitle className="text-2xl md:text-3xl text-center">
                {t("signUpTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("signUpSubtitle")}
              </CardDescription>
            </div>

            {renderStatusBars()}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                  {success}
                </div>
              )}

              {renderStepContent()}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    className="w-full sm:w-auto sm:ml-auto gap-2"
                    onClick={goToNextStep}
                    disabled={
                      isLoading ||
                      otpLoading ||
                      (currentStep === 1 && !isStepOneComplete) ||
                      (currentStep === 2 && !isStepTwoComplete) ||
                      (currentStep === 3 && !isStepThreeComplete)
                    }
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Working...
                      </>
                    ) : currentStep === 2 ? (
                      <>
                        Send OTP
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : currentStep === 3 ? (
                      <>
                        {emailVerified ? "Continue" : "Verify Email"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full sm:w-auto sm:ml-auto"
                    disabled={isLoading || otpLoading || !isStepFourComplete}
                  >
                    {isLoading ? t("creatingAccount") : "Create Account"}
                  </Button>
                )}

                <div className="flex items-center justify-between gap-3 sm:order-first sm:mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep((prev) => (prev > 1 ? (prev - 1) as SignupStep : prev))}
                    disabled={currentStep === 1 || isLoading || otpLoading}
                  >
                    Back
                  </Button>

                  {currentStep === 3 && otpSent && !emailVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendOtp}
                      disabled={isLoading || otpLoading || resendCooldown > 0}
                      className="gap-2"
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : resendCooldown > 0 ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Resend OTP in {resendCooldown}s
                        </>
                      ) : (
                        <>
                          Resend OTP
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-center text-sm">
                <span>{t("alreadyHaveAccount")} </span>
                <Link
                  href={`/${params.locale}/login`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {t("signIn")}
                </Link>
              </div>
            </form>
          </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
