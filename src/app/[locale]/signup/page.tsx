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
  User,
  Store,
  Mail,
  Phone,
  Lock,
  Key,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const allowOtp = process.env.NEXT_PUBLIC_ALLOW_SIGNUP_OTP === "true";

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
  const [contactDetailsConfirmed, setContactDetailsConfirmed] = useState(false);
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const signupInputClassName =
    "h-11 px-4 border-border/80 bg-background/50 hover:bg-background/80 focus:bg-background text-foreground shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200 rounded-xl";

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

    if (normalizedPhoneNumber.length !== 11 || !normalizedPhoneNumber.startsWith("03")) {
      setError("Phone number must be exactly 11 digits starting with 03");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("invalidEmail"));
      return false;
    }

    if (!allowOtp && !contactDetailsConfirmed) {
      setError("Please confirm your email and phone number are correct.");
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

    if (!validateStepOne()) {
      setCurrentStep(1);
      return;
    }

    if (!validateStepTwo()) {
      setCurrentStep(2);
      return;
    }

    if (!validateStepFour()) {
      setCurrentStep(4);
      return;
    }

    if (allowOtp && !emailVerified) {
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
              apiError.includes("company name already") ||
              apiError.includes("company already")
            ) {
              errorMessage = t("companyAlreadyExists");
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
      setContactDetailsConfirmed(false);
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

      // Redirect to admin dashboard after delay
      setTimeout(() => {
        router.push(`/${params.locale}/admin?signup=true`);
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
    setError("");

    if (name === "phoneNumber") {
      let digitsOnly = value.replace(/\D/g, "");
      
      if (!digitsOnly.startsWith("03")) {
        digitsOnly = "03" + digitsOnly.replace(/^0*/, "").replace(/^3/, "");
      }
      if (digitsOnly.length < 2) {
        digitsOnly = "03";
      }
      if (digitsOnly.length > 11) {
        digitsOnly = digitsOnly.slice(0, 11);
      }

      setFormData((prev) => ({
        ...prev,
        phoneNumber: digitsOnly,
      }));
      setContactDetailsConfirmed(false);
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
      setContactDetailsConfirmed(false);
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
      if (!validateStepTwo()) {
        return;
      }

      // Check if email or phone already exists
      setOtpLoading(true);
      setError("");
      setSuccess("");
      try {
        const response = await fetch("/api/auth/signup/check-exists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            phone: fullPhoneNumber,
          }),
        });

        if (!response.ok) {
          let errorMessage = "Registration check failed";
          try {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } catch {}

          const apiError = errorMessage.toLowerCase();
          if (apiError.includes("email already")) {
            setError(t("emailAlreadyExists"));
          } else if (apiError.includes("phone already") || apiError.includes("phone number already")) {
            setError(t("phoneAlreadyExists"));
          } else {
            setError(errorMessage);
          }
          return;
        }
      } catch (err) {
        setError("Network error occurred. Please try again.");
        return;
      } finally {
        setOtpLoading(false);
      }

      if (!allowOtp) {
        setCurrentStep(4);
        return;
      }
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
    formData.email.trim() &&
    formData.phoneNumber.trim() &&
    normalizedPhoneNumber.length === 11 &&
    (!allowOtp ? contactDetailsConfirmed : true);
  const isStepThreeComplete = otp.replace(/\s/g, "").length === 6;
  const isStepFourComplete =
    formData.password.length >= 8 &&
    formData.confirmPassword === formData.password &&
    (emailVerified || !allowOtp);

  const getStepState = (step: SignupStep) => {
    const isComplete = currentStep > step || (step === 3 && currentStep === 3 && emailVerified);
    const isActive = currentStep === step;

    return { isComplete, isActive };
  };

  const renderStatusBars = () => {
    const steps: { step: SignupStep; label: string; icon: any }[] = allowOtp
      ? [
          { step: 1, label: "Business", icon: Store },
          { step: 2, label: "Contact", icon: Mail },
          { step: 3, label: "Verify", icon: Key },
          { step: 4, label: "Security", icon: Lock },
        ]
      : [
          { step: 1, label: "Business", icon: Store },
          { step: 2, label: "Contact", icon: Mail },
          { step: 4, label: "Security", icon: Lock },
        ];

    const leftPercent = allowOtp ? "12.5%" : "16.67%";
    const totalWidthPercent = allowOtp ? "75%" : "66.67%";
    
    let activeWidth = "0%";
    if (allowOtp) {
      if (currentStep === 2) activeWidth = "25%";
      else if (currentStep === 3) activeWidth = "50%";
      else if (currentStep === 4) activeWidth = "75%";
    } else {
      if (currentStep === 2) activeWidth = "33.33%";
      else if (currentStep === 4) activeWidth = "66.67%";
    }

    return (
      <div className="relative w-full max-w-lg mx-auto py-3 px-1 my-2">
        {/* Connection Line Background */}
        <div 
          className="absolute top-[28px] h-[2px] bg-muted -z-0"
          style={{ left: leftPercent, width: totalWidthPercent }}
        />
        {/* Connection Line Active Progress */}
        <div
          className="absolute top-[28px] h-[2px] bg-primary transition-all duration-500 -z-0"
          style={{
            left: leftPercent,
            width: activeWidth,
          }}
        />

        <div className="relative z-10 flex justify-between items-center w-full">
          {steps.map((item) => {
            const StepIcon = item.icon;
            const isCompleted =
              currentStep > item.step ||
              (item.step === 3 && currentStep === 3 && emailVerified);
            const isActive = currentStep === item.step;

            return (
              <div key={item.step} className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : isActive
                      ? "bg-background border-primary text-primary ring-4 ring-primary/15 font-bold"
                      : "bg-muted border-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4.5 w-4.5 stroke-[3]" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold tracking-wider uppercase mt-2.5 transition-colors duration-300 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold tracking-wider text-foreground uppercase">
              {t("name")} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="name"
                name="name"
                placeholder="Muhammad Ali Khan"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isLoading || otpLoading}
                className={signupInputClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-xs font-bold tracking-wider text-foreground uppercase">
              {t("companyName")} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="companyName"
                name="companyName"
                placeholder={t("companyNamePlaceholder")}
                value={formData.companyName}
                onChange={handleChange}
                required
                disabled={isLoading || otpLoading}
                className={signupInputClassName}
              />
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold tracking-wider text-foreground uppercase">
              {t("email")} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading || otpLoading}
                className={signupInputClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-bold tracking-wider text-foreground uppercase">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="phone"
                name="phoneNumber"
                type="tel"
                inputMode="numeric"
                placeholder="03001234567"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                disabled={isLoading || otpLoading}
                className={signupInputClassName}
              />
            </div>
          </div>

          {!allowOtp && (
            <div className="flex items-start gap-2.5 pt-2">
              <Checkbox
                id="confirm-details"
                checked={contactDetailsConfirmed}
                onCheckedChange={(checked) => setContactDetailsConfirmed(!!checked)}
                disabled={isLoading || otpLoading}
              />
              <label
                htmlFor="confirm-details"
                className="text-xs font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
              >
                I confirm that my email and phone number are correct.
              </label>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm text-foreground space-y-3">
            <div className="flex gap-2.5 items-start">
              <Mail className="h-5 w-5 text-primary mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Verify your email address</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We sent a verification code to <span className="font-bold text-foreground">{formData.email}</span>. Please enter the code below.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground/80 pl-7">
              If you do not see it in your inbox, please check your spam or junk folder.
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-bold tracking-wider text-foreground uppercase block text-center">
              Enter 6-Digit OTP
            </Label>
            <div className="flex gap-2 sm:gap-3 justify-center max-w-sm mx-auto">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    otpInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[index] && otp[index] !== " " ? otp[index] : ""}
                  onChange={(e) => handleOtpBoxChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={isLoading || otpLoading || emailVerified}
                  className="w-11 h-11 text-center text-lg font-bold bg-background border-border/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl transition-all duration-200"
                />
              ))}
            </div>
          </div>

          {emailVerified && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4 stroke-[3]" />
              <span className="font-semibold">Email verified successfully!</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-bold tracking-wider text-foreground uppercase">
            {t("password")} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading || otpLoading}
              className={`${signupInputClassName} pr-16`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {formData.password && (
                formData.password.length >= 8 ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4.5 w-4.5 text-destructive shrink-0" />
                )
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading || otpLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-xs font-bold tracking-wider text-foreground uppercase">
            {t("confirmPassword")} <span className="text-destructive">*</span>
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
              className={`${signupInputClassName} pr-16`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {formData.confirmPassword && (
                (formData.confirmPassword === formData.password && formData.password.length >= 8) ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4.5 w-4.5 text-destructive shrink-0" />
                )
              )}
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading || otpLoading}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        {formData.password && formData.password.length < 8 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium pl-1">
            Password is too short (must be at least 8 characters).
          </div>
        )}

        {allowOtp && !emailVerified && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
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
            <Button variant="outline" size="sm" className="gap-2 rounded-lg">
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
          <Button variant="outline" size="sm" className="gap-2 rounded-lg">
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
        <Card className="w-full max-w-lg overflow-hidden border border-border/80 bg-background/80 backdrop-blur-md shadow-2xl shadow-foreground/5 rounded-3xl relative">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
          {isCreatingBusiness ? (
            <CardContent className="flex flex-col items-center justify-center py-24 space-y-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-bold text-foreground">
                  Launching your Dukaan Khata...
                </h3>
                <p className="text-muted-foreground text-sm">
                  Please wait while we finalize your account and configure your business.
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-4 pb-4">
                <div className="space-y-2 text-center">
                  <CardTitle className="text-2xl md:text-3xl text-center font-bold tracking-tight">
                    {t("signUpTitle")}
                  </CardTitle>
                  <CardDescription className="text-center text-muted-foreground text-sm">
                    {t("signUpSubtitle")}
                  </CardDescription>
                </div>

                {renderStatusBars()}
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-medium animate-in fade-in duration-300">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-start gap-2.5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm font-medium animate-in fade-in duration-300">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{success}</span>
                    </div>
                  )}

                  {renderStepContent()}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                    {/* CTA Button (Continue / Submit) */}
                    <div className="w-full sm:w-auto sm:order-2 sm:ml-auto">
                      {currentStep < 4 ? (
                        <Button
                          type="button"
                          className="w-full h-11 px-6 rounded-xl gap-2 font-semibold shadow-lg shadow-primary/20"
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
                              {allowOtp ? "Send OTP" : "Continue"}
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
                          className="w-full h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20"
                          disabled={isLoading || otpLoading || !isStepFourComplete}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t("creatingAccount")}
                            </span>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Resend OTP button */}
                    {currentStep === 3 && otpSent && !emailVerified && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto h-11 px-4 rounded-xl gap-2 border-border/85 sm:order-1"
                        onClick={sendOtp}
                        disabled={isLoading || otpLoading || resendCooldown > 0}
                      >
                        {otpLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : resendCooldown > 0 ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Resend in {resendCooldown}s
                          </>
                        ) : (
                          <>
                            Resend OTP
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}

                    {/* Back Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto h-11 px-5 rounded-xl border-border/85 sm:order-1"
                      onClick={() =>
                        setCurrentStep((prev) => {
                          if (prev === 4 && !allowOtp) return 2;
                          return prev > 1 ? (prev - 1) as SignupStep : prev;
                        })
                      }
                      disabled={currentStep === 1 || isLoading || otpLoading}
                    >
                      Back
                    </Button>
                  </div>

                  <div className="text-center text-sm text-muted-foreground pt-2">
                    <span>{t("alreadyHaveAccount")} </span>
                    <Link
                      href={`/${params.locale}/login`}
                      className="text-primary hover:underline font-semibold"
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
