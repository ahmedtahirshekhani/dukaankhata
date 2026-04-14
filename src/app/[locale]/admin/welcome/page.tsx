"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WelcomePage() {
  const t = useTranslations("welcome");
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground text-lg mt-2">
            {t("subtitle")}
            <br />
            {t("instruction")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
