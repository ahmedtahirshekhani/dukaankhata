"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useUserProfile } from "@/hooks/use-user-profile";
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
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PaymentMethodSection } from "@/components/configuration/payment-method-section";
import { Switch } from "@/components/ui/switch";

export default function ConfigurationPage({
  params,
}: {
  params: { locale: string };
}) {
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("configurationPage");
  const { data: session } = useSession();
  const { refreshSession } = useUserProfile();

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Feature Switches State
  const [enableCounterSale, setEnableCounterSale] = useState(true);
  const [enableAiChat, setEnableAiChat] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const cachedCompanyName =
          typeof window !== "undefined"
            ? localStorage.getItem("companyName")
            : null;
            
        if (typeof window !== "undefined") {
          const savedCounter = localStorage.getItem("setting_counterSale");
          if (savedCounter) setEnableCounterSale(savedCounter === "true");
          const savedAi = localStorage.getItem("setting_aiChat");
          if (savedAi) setEnableAiChat(savedAi === "true");
          const savedWa = localStorage.getItem("setting_wa");
          if (savedWa) setEnableWhatsApp(savedWa === "true");
        }

        const res = await fetch(`/${params.locale}/api/configuration/assets`);
        const data = await res.json();
        if (res.ok) {
          // Use saved company name if available, otherwise use the name from session
          const savedCompanyName =
            cachedCompanyName ||
            data.companyName ||
            (session?.user as any)?.company ||
            "";
          const savedCompanyAddress = 
            data.companyAddress || 
            (typeof window !== "undefined" ? localStorage.getItem("companyAddress") : "") || 
            "";
          const savedCompanyPhone = 
            data.companyPhone || 
            (typeof window !== "undefined" ? localStorage.getItem("companyPhone") : "") || 
            "";
          const savedCompanyEmail = 
            data.companyEmail || 
            (typeof window !== "undefined" ? localStorage.getItem("companyEmail") : "") || 
            "";
          setCompanyName(savedCompanyName);
          setCompanyAddress(savedCompanyAddress as string);
          setCompanyPhone(savedCompanyPhone as string);
          setCompanyEmail(savedCompanyEmail as string);
          setCompanyLogo(data.companyLogo || null);
          setSignatureImage(data.signatureImage || null);
        }
      } catch (err) {
        console.error("Failed to load configuration assets", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [params.locale, session]);

  const syncFeatureSettings = async (updates: any) => {
    const payload = {
      is_counterSale_enable: updates.counterSale ?? enableCounterSale,
      is_AI_Chat_Enable: updates.aiChat ?? enableAiChat,
      is_Whatsapp_enable: updates.wa ?? enableWhatsApp,
    };
    
    try {
      const { db } = await import('@/lib/db/offline-db');
      const { SyncEngine } = await import('@/lib/sync/sync-engine');
      
      await db.syncQueue.add({
        collection: 'configurations',
        method: 'PUT',
        url: `/${params.locale}/api/configurations`,
        data: payload,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      SyncEngine.pushQueue();
    } catch(err) {
      console.error(err);
    }
  };

  const handleToggleCounter = (val: boolean) => {
    setEnableCounterSale(val);
    localStorage.setItem("setting_counterSale", String(val));
    window.dispatchEvent(new Event("featureSettingsUpdated"));
    syncFeatureSettings({ counterSale: val });
  };

  const handleToggleAi = (val: boolean) => {
    setEnableAiChat(val);
    localStorage.setItem("setting_aiChat", String(val));
    window.dispatchEvent(new Event("featureSettingsUpdated"));
    syncFeatureSettings({ aiChat: val });
  };

  const handleToggleWa = (val: boolean) => {
    setEnableWhatsApp(val);
    localStorage.setItem("setting_wa", String(val));
    window.dispatchEvent(new Event("featureSettingsUpdated"));
    syncFeatureSettings({ wa: val });
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("onlyImageFilesAllowed"));
      (e.target as HTMLInputElement).value = "";
      return;
    }
    setLogoError("");
    const url = await readFileAsDataUrl(file);
    setCompanyLogo(url);
  };

  const handleSignatureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSignatureError(t("onlyImageFilesAllowed"));
      (e.target as HTMLInputElement).value = "";
      return;
    }
    setSignatureError("");
    const url = await readFileAsDataUrl(file);
    setSignatureImage(url);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      // Save configuration assets
      const configRes = await fetch(
        `/${params.locale}/api/configuration/assets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName, companyAddress, companyPhone, companyEmail, companyLogo, signatureImage }),
        },
      );
      const configData = await configRes.json();
      if (!configRes.ok) {
        throw new Error(configData?.error || "Failed to save");
      }

      // Also update user profile with company name to keep everything in sync
      if (companyName) {
        try {
          await fetch(`/${params.locale}/api/users/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company: companyName }),
          });
        } catch (err) {
          console.error("Failed to update user profile with company name", err);
        }
      }

      // Update localStorage so invoice and other components can use cached values
      if (companyName) {
        localStorage.setItem("companyName", companyName);
      } else {
        localStorage.removeItem("companyName");
      }
      if (companyAddress) {
        localStorage.setItem("companyAddress", companyAddress);
      } else {
        localStorage.removeItem("companyAddress");
      }
      if (companyPhone) {
        localStorage.setItem("companyPhone", companyPhone);
      } else {
        localStorage.removeItem("companyPhone");
      }
      if (companyEmail) {
        localStorage.setItem("companyEmail", companyEmail);
      } else {
        localStorage.removeItem("companyEmail");
      }
      if (companyLogo) {
        localStorage.setItem("companyLogo", companyLogo);
      } else {
        localStorage.removeItem("companyLogo");
      }
      if (signatureImage) {
        localStorage.setItem("invoiceSignature", signatureImage);
      } else {
        localStorage.removeItem("invoiceSignature");
      }

      // Dispatch custom event to update UI across all components
      window.dispatchEvent(
        new CustomEvent("companyDetailsUpdated", {
          detail: { companyName, companyAddress, companyPhone, companyEmail, companyLogo, signatureImage },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("profileDetailsUpdated", {
          detail: { companyName },
        }),
      );

      // Refresh session to reflect updated company name everywhere
      try {
        await refreshSession();
      } catch (err) {
        console.error("Failed to refresh session", err);
      }

      setMessage(t("detailsSaved"));
      setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setMessage(err?.message || t("failedToSave"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute locale={params.locale}>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{tNav("configuration")}</h1>
            <p className="text-gray-600 mt-2">
              {tNav("configurationDescription")}
            </p>
            <PaymentMethodSection locale={params.locale} />
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t("featureModules")}</CardTitle>
              <CardDescription>{t("featureModulesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("counterSaleTitle")}</Label>
                  <p className="text-sm text-gray-500">{t("counterSaleDesc")}</p>
                </div>
                <Switch checked={enableCounterSale} onCheckedChange={handleToggleCounter} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("aiChatTitle")}</Label>
                  <p className="text-sm text-gray-500">{t("aiChatDesc")}</p>
                </div>
                <Switch checked={enableAiChat} onCheckedChange={handleToggleAi} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("whatsappTitle")}</Label>
                  <p className="text-sm text-gray-500">{t("whatsappDesc")}</p>
                </div>
                <Switch checked={enableWhatsApp} onCheckedChange={handleToggleWa} />
              </div>
            </CardContent>
          </Card>

          {message && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
              {message}
            </div>
          )}

          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              {t("loading")}
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("companyDetails")}</CardTitle>
                  <CardDescription>
                    {t("companyDetailsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Company Name */}
                    <div className="space-y-2">
                      <Label htmlFor="company-name">{t("companyName")}</Label>
                      <Input
                        id="company-name"
                        type="text"
                        placeholder={t("enterCompanyName")}
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>

                    {/* Company Address */}
                    <div className="space-y-2">
                      <Label htmlFor="company-address">{t("companyAddress")}</Label>
                      <Input
                        id="company-address"
                        type="text"
                        placeholder={t("enterCompanyAddress")}
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                      />
                    </div>

                    {/* Company Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">{t("companyPhone")}</Label>
                      <Input
                        id="company-phone"
                        type="text"
                        placeholder={t("enterCompanyPhone")}
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                      />
                    </div>

                    {/* Company Email */}
                    <div className="space-y-2">
                      <Label htmlFor="company-email">{t("companyEmail")}</Label>
                      <Input
                        id="company-email"
                        type="email"
                        placeholder={t("enterCompanyEmail")}
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                      />
                    </div>

                    {/* Company Logo */}
                    <div className="space-y-2">
                      <Label htmlFor="company-logo">{t("companyLogo")}</Label>
                      <Input
                        id="company-logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                      />
                      {logoError && (
                        <p className="text-xs text-red-600">{logoError}</p>
                      )}
                      {companyLogo && (
                        <div className="mt-2">
                          <img
                            src={companyLogo}
                            alt={t("companyLogoAlt")}
                            className="h-16 w-auto rounded border"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setCompanyLogo(null);
                              }}
                            >
                              {tCommon("delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Authorized Signature */}
                    <div className="space-y-2">
                      <Label htmlFor="authorized-signature">
                        {t("authorizedSignature")}
                      </Label>
                      <Input
                        id="authorized-signature"
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureChange}
                      />
                      {signatureError && (
                        <p className="text-xs text-red-600">{signatureError}</p>
                      )}
                      {signatureImage && (
                        <div className="mt-2">
                          <img
                            src={signatureImage}
                            alt={t("authorizedSignatureAlt")}
                            className="h-16 w-auto rounded border"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSignatureImage(null);
                              }}
                            >
                              {tCommon("delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? t("saving") : t("saveDetails")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
