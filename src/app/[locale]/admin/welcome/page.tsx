"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Menu } from "lucide-react";
import { StepVideos } from "./step-videos";

export default function WelcomePage() {
  const t = useTranslations("welcome");
  return (
    <div className="flex flex-col space-y-6 p-4 sm:p-6 lg:p-4 max-w-[1600px] mx-auto w-full">
      <Card className="w-full shadow-sm bg-white dark:bg-card p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">{t("title")}.</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {t.rich("instruction", {
              sidebar: (chunks) => (
                <>
                  <span className="hidden sm:inline font-bold text-foreground">
                    {chunks}
                  </span>
                  <span className="inline-flex sm:hidden items-center font-bold text-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border">
                    {chunks}
                  </span>
                </>
              ),
            })}
          </p>
        </div>
      </Card>

      <StepVideos />
    </div>
  );
}
