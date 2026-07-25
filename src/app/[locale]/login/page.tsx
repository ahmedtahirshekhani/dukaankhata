"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff, Home } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { supportContact } from "@/lib/constants";
import { proAccessPaymentInfo } from "@/lib/contact-info";

function LoginForm({ params }: { params: { locale: string } }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const mapAuthError = (rawError?: string | null) => {
    if (!rawError) return t("loginError");

    const err = rawError.toLowerCase();

    if (err.includes("account_deleted")) {
      return t("accountDeleted", { phone: supportContact.phone });
    }

    if (err.includes("login_blocked")) {
      return t("loginBlockedError", { number: proAccessPaymentInfo.proofWhatsappDisplay });
    }

    if (
      err === "credentialssignin" ||
      err.includes("credential") ||
      err.includes("invalid")
    ) {
      return t("invalidCredentials");
    }

    if (
      err.includes("email already") ||
      err.includes("duplicate") ||
      err.includes("already registered")
    ) {
      return t("emailAlreadyExists");
    }

    if (err.includes("missing required") || err.includes("required fields")) {
      return t("missingFields");
    }

    if (err.includes("network") || err.includes("fetch")) {
      return t("networkError");
    }

    if (
      err === "configuration" ||
      err === "callbackrouteerror" ||
      err.includes("server") ||
      err.includes("internal")
    ) {
      return t("serverError");
    }

    return rawError;
  };

  // Avoid SSR/CSR markup mismatches by rendering only after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Basic client-side validation
    if (!email || !password) {
      setError(t("requiredField"));
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("invalidEmail"));
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(mapAuthError(result.error));
      } else if (result?.ok) {
        // Successful login - redirect to callback or welcome page
        if (callbackUrl) {
          router.push(callbackUrl);
        } else {
          router.push(`/${params.locale}/admin/welcome`);
        }
      } else {
        // Unexpected result state
        setError(t("loginError"));
      }
    } catch (err) {
      // Handle network errors, fetch failures, or other exceptions
      if (
        err instanceof TypeError &&
        (err.message.includes("fetch") || err.message.includes("network"))
      ) {
        setError(t("networkError"));
      } else if (err instanceof Error) {
        // Log unexpected errors for debugging
        console.error("Login error:", err);
        setError(t("loginError"));
      } else {
        setError(t("loginError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

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
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl text-center">
            {t("signInTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("signInSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  disabled={isLoading}
                />
                <span>{t("rememberMe")}</span>
              </label>
              <Link
                href={`/${params.locale}/forgot-password`}
                className="text-blue-600 hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("signingIn") : t("signIn")}
            </Button>

            <div className="text-center text-sm">
              <span>{t("noAccount")} </span>
              <Link
                href={`/${params.locale}/signup`}
                className="text-blue-600 hover:underline font-medium"
              >
                {t("signUp")}
              </Link>
            </div>
          </form>
          {/* Support contact details */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p className="font-medium">{t("needHelpContactSupport")}</p>
            <div className="flex flex-col gap-1 items-center">
              <p>
                Call or Whatsapp:{" "}
                <a
                  href={`tel:${supportContact.phone.replace(/\s/g, "")}`}
                  className="text-blue-600 hover:underline"
                >
                  {supportContact.phone}
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage({ params }: { params: { locale: string } }) {
  return (
    <Suspense fallback={null}>
      <LoginForm params={params} />
    </Suspense>
  );
}
