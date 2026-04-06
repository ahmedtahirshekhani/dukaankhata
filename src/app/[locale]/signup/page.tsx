"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff, X, Home } from "lucide-react";
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
    phoneNumber: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = (): boolean => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.name ||
      !formData.companyName ||
      !formData.phoneNumber
    ) {
      setError(t("requiredField"));
      return false;
    }

    const phoneDigits = formData.phoneNumber.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t("invalidEmail"));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
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
          phone: fullPhone,
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
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        companyName: "",
        countryCode: "+92",
        phoneNumber: "",
      });

      // Redirect to welcome page after 1.5 seconds
      setTimeout(() => {
        router.push(`/${params.locale}/welcome`);
      }, 1500);
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
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
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
  };

  const handleCountryCodeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      countryCode: value,
    }));
  };

  // Check if all required form fields are filled
  const isFormComplete = () => {
    return (
      formData.name.trim() !== "" &&
      formData.companyName.trim() !== "" &&
      formData.email.trim() !== "" &&
      formData.phoneNumber.trim() !== "" &&
      formData.password.trim() !== "" &&
      formData.confirmPassword.trim() !== ""
    );
  };

  // Check if passwords match
  const doPasswordsMatch = () => {
    return formData.password === formData.confirmPassword;
  };

  // Show mismatch icon when both fields have content but don't match
  const showPasswordMismatch = () => {
    return (
      formData.password.length > 0 &&
      formData.confirmPassword.length > 0 &&
      !doPasswordsMatch()
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col relative">
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
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-center">
              {t("signUpTitle")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("signUpSubtitle")}
            </CardDescription>
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

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
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.countryCode}
                    onValueChange={handleCountryCodeChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger
                      className="w-[170px]"
                      aria-label="Country code"
                    >
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    id="phone"
                    name="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    placeholder="3001234567"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="flex-1"
                  />
                </div>
              </div>

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
                    disabled={isLoading}
                    className={showPasswordMismatch() ? "pr-20" : "pr-10"}
                  />
                  {showPasswordMismatch() && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 text-red-500">
                      <X size={18} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
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
                    disabled={isLoading}
                    className={showPasswordMismatch() ? "pr-20" : "pr-10"}
                  />
                  {showPasswordMismatch() && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 text-red-500">
                      <X size={18} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isFormComplete()}
              >
                {isLoading ? t("creatingAccount") : t("signUp")}
              </Button>

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
        </Card>
      </div>
    </div>
  );
}
