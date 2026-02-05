"use client";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AIChatPage() {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <Sparkles className="h-16 w-16 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t("navigation.aiChat")}</h1>
        <p className="text-lg text-muted-foreground mb-4">
          {t("navigation.aiChatDescription")}
        </p>
        <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
          {t("common.comingSoon")}
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          {t("navigation.aiChatSubtext")}
        </p>
      </Card>
    </div>
  );
}
