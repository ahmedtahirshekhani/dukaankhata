"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepVideos } from "./step-videos";

export default function WelcomePage() {
  const t = useTranslations("welcome");
  return (
    <div className="flex flex-col space-y-10 p-4 sm:p-6 lg:p-4 max-w-[1600px] mx-auto w-full">
      <Card className="w-full shadow-sm bg-white dark:bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-lg mt-2">
            {t("subtitle")}
            <br />
            {t("instruction")}
          </p>
        </CardContent>
      </Card>

      <StepVideos />
    </div>
  );
}
