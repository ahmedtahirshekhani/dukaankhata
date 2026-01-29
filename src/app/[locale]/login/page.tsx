"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/language-switcher";
import { supportContact } from "@/lib/constants";

export default function LoginPage({ params }: { params: { locale: string } }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        // NextAuth returns different error types
        // "CredentialsSignin" is the standard error for invalid credentials
        // Other errors might indicate server issues
        if (
          result.error === "CredentialsSignin" ||
          result.error.toLowerCase().includes("credential")
        ) {
          setError(t("invalidCredentials"));
        } else {
          // For other errors (network, server, etc.), show generic error
          setError(t("loginError"));
        }
      } else if (result?.ok) {
        // Successful login - redirect to admin
        router.push(`/${params.locale}/admin`);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-3">
          <div className="mb-4 w-full text-center [&>*]:w-full">
            <LanguageSwitcher />
          </div>
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
            <p className="font-medium">Need help? Contact Support</p>
            <div className="flex flex-col gap-1 items-center">
              <p>
                Email:{" "}
                <a
                  href={`mailto:${supportContact.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {supportContact.email}
                </a>
              </p>
              <p>
                Call or Whatsapp:{" "}
                <a
                  href={`tel:${supportContact.phone.replace(/\s/g, "")}`}
                  className="text-blue-600 hover:underline"
                >
                  {supportContact.phone}
                </a>
              </p>
              <p>
                WhatsApp Only:{" "}
                <a
                  href={`https://wa.me/${supportContact.whatsapp.replace(
                    /[^\d]/g,
                    "",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {supportContact.whatsapp}
                </a>
              </p>
              <p>
                LinkedIn:{" "}
                <a
                  href={supportContact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {supportContact.linkedin}
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
