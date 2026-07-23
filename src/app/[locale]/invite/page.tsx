"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

function InviteContent() {
  const t = useTranslations("auth"); // Using auth translations for basic text
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [inviteData, setInviteData] = useState<{ email: string; userExists: boolean } | null>(null);
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/staff/invite/accept?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || t("invalidOrExpiredToken"));
        } else {
          setInviteData(data);
        }
      } catch (err: any) {
        setError(t("networkError"));
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (inviteData && !inviteData.userExists) {
      if (!name || !password) {
        setError(t("missingFields"));
        setIsSubmitting(false);
        return;
      }
      if (password.length < 8) {
        setError(t("passwordTooShort"));
        setIsSubmitting(false);
        return;
      }
    } else if (inviteData && inviteData.userExists) {
      // Check if we have session and if it matches
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();
        
        if (!sessionData?.user || sessionData.user.email !== inviteData.email) {
          router.push(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/invite?token=${token}`)}`);
          return;
        }
      } catch (err) {
        // Continue to API call if session check fails, let backend handle it
      }
    }

    try {
      const res = await fetch("/api/staff/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || t("acceptInvitationFailed"));
        if (res.status === 401) {
          setError(t("loginRequiredToAccept", { email: inviteData?.email ?? "" }));
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          if (inviteData?.userExists) {
            router.push(`/${locale}/admin/welcome`);
          } else {
            router.push(`/${locale}/login`);
          }
        }, 2000);
      }
    } catch (err) {
      setError(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t("acceptInvitation")}</CardTitle>
          <CardDescription>
            {t("joinWorkspace")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !inviteData ? (
            <div className="space-y-4">
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium text-center">
                {error}
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/${locale}/login`}>Go to Login</Link>
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium">{t("invitationAccepted")}</h3>
              <p className="text-sm text-muted-foreground">{t("redirectingToLogin")}</p>
            </div>
          ) : inviteData ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input value={inviteData.email} disabled />
              </div>

              {inviteData.userExists ? (
                <div className="text-sm text-muted-foreground rounded-md bg-muted p-3">
                  {t("accountExistsConfirmLink")}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t("name")}</Label>
                    <Input
                      id="name"
                      placeholder={t("namePlaceholder")}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("password")}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("passwordPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {inviteData.userExists ? t("loginToAccept", { defaultValue: "Login to Accept" }) : t("createAccountAndAccept")}
              </Button>
              
              {inviteData.userExists && (
                <div className="text-center mt-2">
                  <Link href={`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/invite?token=${token}`)}`} className="text-sm text-primary hover:underline">
                    {t("loginToDifferentAccount")}
                  </Link>
                </div>
              )}
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <InviteContent />
    </Suspense>
  );
}
