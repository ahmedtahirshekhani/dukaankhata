"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language/language-switcher";
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
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError(t("requiredField"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("invalidEmail"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t("loginError") }));
        throw new Error(data.error || t("loginError"));
      }

      setSuccess(true);
      // keep email in message, but clear input
      setEmail("");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push(`/${params.locale}/login`);
      }, 3000);
    } catch (err) {
      setError(t("loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">{t("forgotPassword")}</CardTitle>
          <CardDescription>{t("forgotPasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {t("forgotPasswordSuccessMessage")}
              </div>
              <p className="text-sm text-gray-600">{t("redirectingToLogin")}</p>
            </div>
          ) : (
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
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("loading") : t("sendResetLink")}
              </Button>

              <Link
                href={`/${params.locale}/login`}
                className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("signIn")}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
