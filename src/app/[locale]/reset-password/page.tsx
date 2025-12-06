"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function ResetPasswordPage({ params }: { params: { locale: string } }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"checking" | "invalid" | "ready" | "submitting" | "success">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function validate() {
      if (!token) {
        setStatus("invalid");
        return;
      }
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error("Invalid");
        setStatus("ready");
      } catch {
        setStatus("invalid");
      }
    }
    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError(t("requiredField"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch(`/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Reset failed" }));
        throw new Error(data.error || "Reset failed");
      }

      setStatus("success");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push(`/${params.locale}/login`);
      }, 3000);
    } catch (err: any) {
      setError(err?.message || "Reset failed");
      setStatus("ready");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {status === "checking" && "Validating your link..."}
            {status === "invalid" && "This reset link is invalid or has expired."}
            {status === "ready" && "Create a new password for your account."}
            {status === "success" && "Your password has been reset successfully."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "invalid" && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                Invalid or expired token.
              </div>
              <Link href={`/${params.locale}/forgot-password`} className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
                <ArrowLeft className="w-4 h-4" />
                Back to Forgot Password
              </Link>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                Password updated. Redirecting to sign in...
              </div>
              <Link href={`/${params.locale}/login`} className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
                <ArrowLeft className="w-4 h-4" />
                {t("signIn")}
              </Link>
            </div>
          )}

          {(status === "ready" || status === "submitting") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={status === "submitting"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={status === "submitting"}
                />
              </div>

              <Button type="submit" className="w-full" disabled={status === "submitting"}>
                {status === "submitting" ? t("loading") : "Set New Password"}
              </Button>

              <Link href={`/${params.locale}/login`} className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium">
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
