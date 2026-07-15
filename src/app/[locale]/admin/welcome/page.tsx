"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu } from "lucide-react";
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
          <p className="text-muted-foreground text-lg mt-2 leading-relaxed">
            {t("subtitle")}
            <br />
            {t.rich("instruction", {
              sidebar: (chunks) => (
                <>
                  <span className="hidden sm:inline font-bold text-foreground">
                    {chunks}
                  </span>
                  <span className="inline-flex sm:hidden items-center gap-1 font-bold text-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border">
                    <Menu className="h-4 w-4 text-sky-500" /> icon
                  </span>
                </>
              ),
            })}
          </p>
        </CardContent>
      </Card>

      <StepVideos />
    </div>
  );
}
