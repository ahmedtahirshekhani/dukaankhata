"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AuthErrorContent({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const t = useTranslations("auth");

  const getErrorMessage = (): string => {
    switch (error) {
      case "InvalidCallback":
        return "Invalid callback URL";
      case "Callback":
        return "An error occurred during the callback";
      case "OAuthCallback":
        return "An error occurred during OAuth callback";
      case "EmailSignInError":
        return "Could not send sign in email";
      case "CredentialsSignin":
        return t("invalidCredentials");
      case "SessionCallback":
        return t("sessionExpired");
      default:
        return error || "An authentication error occurred";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-red-200">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-center text-red-700">{t("error")}</CardTitle>
          <CardDescription className="text-center">
            {getErrorMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            {t("sessionExpired")}
          </p>
          <Link href={`/${locale}/login`} className="block">
            <Button className="w-full">
              {t("signIn")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage({ params }: { params: { locale: string } }) {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
      <AuthErrorContent locale={params.locale} />
    </Suspense>
  );
}
