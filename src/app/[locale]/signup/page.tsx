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
  const signupInputClassName = "placeholder:opacity-50 focus:placeholder-transparent transition-all";

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
    const steps = allowOtp
      ? [
          { step: 1, label: "Business" },
          { step: 2, label: "Contact" },
          { step: 3, label: "Verify" },
          { step: 4, label: "Security" },
        ]
      : [
          { step: 1, label: "Business" },
          { step: 2, label: "Contact" },
          { step: 4, label: "Security" },
        ];

    const currentStepIndex = allowOtp 
      ? (currentStep === 4 ? 4 : currentStep) 
      : (currentStep === 1 ? 1 : currentStep === 2 ? 2 : 3);

    return (
      <div className="w-full space-y-2 pt-2 pb-1">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-0.5">
          <span>Step {currentStepIndex} of {steps.length}</span>
          <span className="font-bold text-sky-500">
            {steps.find((_, idx) => (idx + 1) === currentStepIndex)?.label || ""}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full">
          {steps.map((item, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentStepIndex > stepNum;
            const isActive = currentStepIndex === stepNum;

            return (
              <div
                key={item.label}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isCompleted || isActive
                    ? "bg-sky-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
                title={item.label}
              />
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
                placeholder="Enter your name"
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
                placeholder="Enter company name"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4 z-10">
        <Link href={`/${params.locale}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Home className="h-4 w-4" />
            {t("home")}
          </Button>
        </Link>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        {isCreatingBusiness ? (
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="space-y-2 text-center">
              <h3 className="text-xl font-bold text-foreground">
                Launching your Dukaan Khata...
              </h3>
              <p className="text-muted-foreground text-sm">
                Please wait while we finalize your account and configure your business.
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl text-center">
                {t("signUpTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("signUpSubtitle")}
              </CardDescription>
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
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">
                    {success}
                  </div>
                )}

                {renderStepContent()}

                <div className="space-y-2 pt-2">
                  {/* CTA Button (Continue / Submit) */}
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      className="w-full"
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
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Working...
                        </>
                      ) : currentStep === 2 ? (
                        <>
                          {allowOtp ? "Send OTP" : "Continue"}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      ) : currentStep === 3 ? (
                        <>
                          {emailVerified ? "Continue" : "Verify Email"}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || otpLoading || !isStepFourComplete}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("creatingAccount")}
                        </span>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  )}

                  {/* Resend OTP button */}
                  {currentStep === 3 && otpSent && !emailVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={sendOtp}
                      disabled={isLoading || otpLoading || resendCooldown > 0}
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Sending...
                        </>
                      ) : resendCooldown > 0 ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Resend in {resendCooldown}s
                        </>
                      ) : (
                        <>
                          Resend OTP
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}

                  {/* Back Button */}
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setCurrentStep((prev) => {
                          if (prev === 4 && !allowOtp) return 2;
                          return prev > 1 ? (prev - 1) as SignupStep : prev;
                        })
                      }
                      disabled={isLoading || otpLoading}
                    >
                      Back
                    </Button>
                  )}
                </div>

                <div className="text-center text-sm pt-2">
                  <span>{t("alreadyHaveAccount")} </span>
                  <Link
                    href={`/${params.locale}/login`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {t("signIn")}
                  </Link>
                </div>

                <div className="mt-4 text-center text-xs text-muted-foreground">
                  <p className="font-medium">
                    Need help? Contact Support:{" "}
                    <a href="tel:03352575725" className="text-blue-600 hover:underline">
                      03352575725
                    </a>
                    {" / "}
                    <a href="tel:03212575665" className="text-blue-600 hover:underline">
                      03212575665
                    </a>
                  </p>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
