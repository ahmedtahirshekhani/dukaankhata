"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2, Layers, Home } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ConfigurationPage({
  params,
}: {
  params: { locale: string };
}) {
  const router = useRouter();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("configurationPage");
  const { data: session, update: updateSession } = useSession();
  const { user, refreshSession } = useUserProfile();
  const { can } = usePermissions();

  const isOwner = (session?.user as any)?.role === "owner" || (user as any)?.role === "owner";
  const workspaces = (session?.user as any)?.workspaces || user?.workspaces || [];
  const isSoleWorkspace = workspaces.length <= 1;
  const canViewConfig = can("configuration", "view");
  const canEditConfig = can("configuration", "edit");
  const canViewPaymentMethods = can("payment_methods", "view");

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

  // Delete Data Modal State
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleteDataPassword, setDeleteDataPassword] = useState("");
  const [deleteDataError, setDeleteDataError] = useState<string>("");
  const [isDeletingData, setIsDeletingData] = useState(false);

  // Delete Entire Workspace Modal State
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false);
  const [deleteWorkspacePassword, setDeleteWorkspacePassword] = useState("");
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string>("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<"inventory" | "company" | "danger">("inventory");

  // Feature Switches State
  const [enableCounterSale, setEnableCounterSale] = useState(true);
  const [enableAiChat, setEnableAiChat] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);
  const [stockValuationMethod, setStockValuationMethod] = useState<"average" | "fifo">("average");

  useEffect(() => {
    const load = async () => {
      try {
        if (typeof window !== "undefined") {
          const savedCounter = localStorage.getItem("setting_counterSale");
          if (savedCounter) setEnableCounterSale(savedCounter === "true");
          const savedAi = localStorage.getItem("setting_aiChat");
          if (savedAi) setEnableAiChat(savedAi === "true");
          const savedWa = localStorage.getItem("setting_wa");
          if (savedWa) setEnableWhatsApp(savedWa === "true");
          const savedMethod = localStorage.getItem("setting_stockValuationMethod");
          if (savedMethod === "fifo" || savedMethod === "average") {
            setStockValuationMethod(savedMethod);
          }

          const wsId = (session?.user as any)?.id || "";

          // Pre-fill from local storage to allow offline viewing immediately
          setCompanyName(localStorage.getItem(`companyName_${wsId}`) || (session?.user as any)?.company || "");
          setCompanyAddress(localStorage.getItem(`companyAddress_${wsId}`) || "");
          setCompanyPhone(localStorage.getItem(`companyPhone_${wsId}`) || "");
          setCompanyEmail(localStorage.getItem(`companyEmail_${wsId}`) || "");
          setCompanyLogo(localStorage.getItem(`companyLogo_${wsId}`) || null);
          setSignatureImage(localStorage.getItem(`invoiceSignature_${wsId}`) || null);
        }

        try {
          const [assetsRes, configRes] = await Promise.all([
            fetch(`/${params.locale}/api/configuration/assets`),
            fetch(`/${params.locale}/api/configurations`),
          ]);

          if (assetsRes.ok) {
            const data = await assetsRes.json();
            const wsId = (session?.user as any)?.id || "";
            const savedCompanyName = data.companyName || localStorage.getItem(`companyName_${wsId}`) || (session?.user as any)?.company || "";
            const savedCompanyAddress = data.companyAddress || localStorage.getItem(`companyAddress_${wsId}`) || "";
            const savedCompanyPhone = data.companyPhone || localStorage.getItem(`companyPhone_${wsId}`) || "";
            const savedCompanyEmail = data.companyEmail || localStorage.getItem(`companyEmail_${wsId}`) || "";

            setCompanyName(savedCompanyName);
            setCompanyAddress(savedCompanyAddress as string);
            setCompanyPhone(savedCompanyPhone as string);
            setCompanyEmail(savedCompanyEmail as string);
            setCompanyLogo(data.companyLogo || localStorage.getItem(`companyLogo_${wsId}`) || null);
            setSignatureImage(data.signatureImage || localStorage.getItem(`invoiceSignature_${wsId}`) || null);
          }

            if (configRes.ok) {
              const cfg = await configRes.json();
              if (cfg.stock_valuation_method === "fifo" || cfg.stock_valuation_method === "average") {
                setStockValuationMethod(cfg.stock_valuation_method);
                localStorage.setItem("setting_stockValuationMethod", cfg.stock_valuation_method);
              }
            if (typeof cfg.is_counterSale_enable === "boolean") {
              setEnableCounterSale(cfg.is_counterSale_enable);
              localStorage.setItem("setting_counterSale", String(cfg.is_counterSale_enable));
            }
            if (typeof cfg.is_AI_Chat_Enable === "boolean") {
              setEnableAiChat(cfg.is_AI_Chat_Enable);
              localStorage.setItem("setting_aiChat", String(cfg.is_AI_Chat_Enable));
            }
            if (typeof cfg.is_Whatsapp_enable === "boolean") {
              setEnableWhatsApp(cfg.is_Whatsapp_enable);
              localStorage.setItem("setting_wa", String(cfg.is_Whatsapp_enable));
            }
          }
        } catch (fetchErr) {
          console.warn("Offline or failed to fetch config from server, using local data");
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
      stock_valuation_method: updates.stockValuationMethod ?? stockValuationMethod,
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
    } catch (err) {
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

  const handleValuationMethodChange = (method: "average" | "fifo") => {
    setStockValuationMethod(method);
    localStorage.setItem("setting_stockValuationMethod", method);
    window.dispatchEvent(new Event("featureSettingsUpdated"));
    window.dispatchEvent(new Event("stockValuationMethodUpdated"));
    syncFeatureSettings({ stockValuationMethod: method });
  };

  const handleDeleteData = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteDataError("");
    if (!deleteDataPassword) {
      setDeleteDataError(t("enterPassword"));
      return;
    }
    
    setIsDeletingData(true);
    try {
      const res = await fetch(`/${params.locale}/api/settings/delete-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deleteDataPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete data");
      }
      
      // Clear offline DB and resync right away
      const { SyncEngine } = await import('@/lib/sync/sync-engine');
      await SyncEngine.clearCacheAndResync();

      setShowDeleteDataModal(false);
      setDeleteDataPassword("");
      // Reload the page
      window.location.reload();
    } catch (err: any) {
      setDeleteDataError(err.message || "Something went wrong");
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteWorkspaceError("");
    if (!deleteWorkspacePassword) {
      setDeleteWorkspaceError(t("enterPassword"));
      return;
    }

    setIsDeletingWorkspace(true);
    try {
      const res = await fetch(`/${params.locale}/api/settings/delete-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deleteWorkspacePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "CANNOT_DELETE_ONLY_WORKSPACE") {
          throw new Error(t("cannotDeleteOnlyWorkspaceDesc"));
        }
        throw new Error(data.error || "Failed to delete workspace");
      }

      const wsId = (session?.user as any)?.id || "";
      if (typeof window !== "undefined") {
        localStorage.removeItem(`companyName_${wsId}`);
        localStorage.removeItem(`companyAddress_${wsId}`);
        localStorage.removeItem(`companyPhone_${wsId}`);
        localStorage.removeItem(`companyEmail_${wsId}`);
        localStorage.removeItem(`companyLogo_${wsId}`);
        localStorage.removeItem(`invoiceSignature_${wsId}`);
      }

      // If user has other remaining workspaces, switch to the next one
      if (data.remainingCount > 0 && data.nextWorkspaceId) {
        const { SyncEngine } = await import('@/lib/sync/sync-engine');
        await updateSession?.({ active_workspace_id: data.nextWorkspaceId });
        await SyncEngine.clearCacheAndResync();
        window.location.href = `/${params.locale}/admin`;
      } else {
        // Scenario B: Last remaining workspace deleted -> clear DB and sign out to login screen
        const { clearUserDatabase } = await import('@/lib/db/offline-db');
        await clearUserDatabase();
        await signOut({ callbackUrl: `/${params.locale}/login` });
      }
    } catch (err: any) {
      setDeleteWorkspaceError(err.message || "Something went wrong");
    } finally {
      setIsDeletingWorkspace(false);
    }
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
      const wsId = (session?.user as any)?.id || "";
      // Update localStorage so invoice and other components can use cached values immediately
      if (companyName) {
        localStorage.setItem(`companyName_${wsId}`, companyName);
      } else {
        localStorage.removeItem(`companyName_${wsId}`);
      }
      if (companyAddress) {
        localStorage.setItem(`companyAddress_${wsId}`, companyAddress);
      } else {
        localStorage.removeItem(`companyAddress_${wsId}`);
      }
      if (companyPhone) {
        localStorage.setItem(`companyPhone_${wsId}`, companyPhone);
      } else {
        localStorage.removeItem(`companyPhone_${wsId}`);
      }
      if (companyEmail) {
        localStorage.setItem(`companyEmail_${wsId}`, companyEmail);
      } else {
        localStorage.removeItem(`companyEmail_${wsId}`);
      }
      if (companyLogo) {
        localStorage.setItem(`companyLogo_${wsId}`, companyLogo);
      } else {
        localStorage.removeItem(`companyLogo_${wsId}`);
      }
      if (signatureImage) {
        localStorage.setItem(`invoiceSignature_${wsId}`, signatureImage);
      } else {
        localStorage.removeItem(`invoiceSignature_${wsId}`);
      }

      // Queue the sync operations
      const { db } = await import('@/lib/db/offline-db');
      const { SyncEngine } = await import('@/lib/sync/sync-engine');

      await db.syncQueue.add({
        collection: 'configurations', // Using a generic collection name for UI purposes
        method: 'POST',
        url: `/${params.locale}/api/configuration/assets`,
        data: { companyName, companyAddress, companyPhone, companyEmail, companyLogo, signatureImage },
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      SyncEngine.pushQueue();

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
      <div className="flex-1 space-y-5 w-full mx-auto animate-in fade-in duration-300">
        {/* PageHeader with integrated navigation tabs */}
        <PageHeader
          title={tNav("configuration")}
          description={tNav("configurationDescription")}
          actions={
            <div className="w-full sm:w-auto overflow-x-auto scrollbar-none py-0.5">
              <div
                className={cn(
                  "grid sm:inline-flex items-center p-1 bg-muted/70 border rounded-xl gap-1 w-full sm:w-auto",
                  canEditConfig ? "grid-cols-3" : "grid-cols-2"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={cn(
                    "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0",
                    activeTab === "inventory"
                      ? "bg-background text-primary shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t("tabInventoryFeatures")}</span>
                  <span className="sm:hidden truncate">{t("tabInventoryShort") || "Inventory"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("company")}
                  className={cn(
                    "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0",
                    activeTab === "company"
                      ? "bg-background text-primary shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t("tabCompanyProfile")}</span>
                  <span className="sm:hidden truncate">{t("tabCompanyShort") || "Company"}</span>
                </button>
                {canEditConfig && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("danger")}
                    className={cn(
                      "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap min-w-0",
                      activeTab === "danger"
                        ? "bg-background text-destructive shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{t("tabDangerZone")}</span>
                    <span className="sm:hidden truncate">{t("tabDangerShort") || "Danger"}</span>
                  </button>
                )}
              </div>
            </div>
          }
        />

        {message && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm flex items-center justify-between animate-in fade-in duration-200 font-medium">
            <span>{message}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Stock Valuation Skeleton */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3.5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Skeleton className="h-28 rounded-xl" />
                  <Skeleton className="h-28 rounded-xl" />
                </div>
              </CardContent>
            </Card>

            {/* Feature Modules Skeleton */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3.5 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          canViewConfig && (
            <>
              {/* TAB 1: INVENTORY & FEATURE MODULES */}
              {activeTab === "inventory" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Stock Valuation Method Card */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base sm:text-lg">{t("stockValuationTitle")}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {t("stockValuationDescription")}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Weighted Average Option */}
                        <div
                          onClick={() => handleValuationMethodChange("average")}
                          className={cn(
                            "p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between",
                            stockValuationMethod === "average"
                              ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                              : "border-border hover:border-muted-foreground/30 bg-card"
                          )}
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 pr-2">
                                <h4 className="font-bold text-foreground text-xs sm:text-sm">
                                  {t("weightedAverageTitle")}
                                </h4>
                                <Badge className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary hover:bg-primary/25 border-primary/20 shadow-none font-semibold">
                                  {t("weightedAverageBadge")}
                                </Badge>
                              </div>
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                                  stockValuationMethod === "average"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/40"
                                )}
                              >
                                {stockValuationMethod === "average" && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                              {t("weightedAverageDesc")}
                            </p>
                          </div>
                        </div>

                        {/* FIFO Option */}
                        <div
                          onClick={() => handleValuationMethodChange("fifo")}
                          className={cn(
                            "p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between",
                            stockValuationMethod === "fifo"
                              ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                              : "border-border hover:border-muted-foreground/30 bg-card"
                          )}
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 pr-2">
                                <h4 className="font-bold text-foreground text-xs sm:text-sm">
                                  {t("fifoTitle")}
                                </h4>
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/40 text-primary font-semibold">
                                  {t("fifoBadge")}
                                </Badge>
                              </div>
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                                  stockValuationMethod === "fifo"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/40"
                                )}
                              >
                                {stockValuationMethod === "fifo" && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                              {t("fifoDesc")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Feature Modules Card */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3.5">
                      <CardTitle className="text-base sm:text-lg">{t("featureModules")}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{t("featureModulesDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                          <div className="space-y-0.5 pr-2">
                            <Label className="text-xs sm:text-sm font-semibold">{t("counterSaleTitle")}</Label>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t("counterSaleDesc")}</p>
                          </div>
                          <Switch checked={enableCounterSale} onCheckedChange={handleToggleCounter} />
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                          <div className="space-y-0.5 pr-2">
                            <Label className="text-xs sm:text-sm font-semibold">{t("aiChatTitle")}</Label>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t("aiChatDesc")}</p>
                          </div>
                          <Switch checked={enableAiChat} onCheckedChange={handleToggleAi} />
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border rounded-xl">
                          <div className="space-y-0.5 pr-2">
                            <Label className="text-xs sm:text-sm font-semibold">{t("whatsappTitle")}</Label>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t("whatsappDesc")}</p>
                          </div>
                          <Switch checked={enableWhatsApp} onCheckedChange={handleToggleWa} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 2: COMPANY PROFILE & BRANDING */}
              {activeTab === "company" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3.5">
                      <CardTitle className="text-base sm:text-lg">{t("companyDetails")}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {t("companyDetailsDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Left Column: Text Inputs */}
                        <div className="space-y-3.5">
                          <div className="space-y-1.5">
                            <Label htmlFor="company-name" className="text-xs font-semibold">{t("companyName")}</Label>
                            <Input
                              id="company-name"
                              type="text"
                              placeholder={t("enterCompanyName")}
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="company-phone" className="text-xs font-semibold">{t("companyPhone")}</Label>
                            <Input
                              id="company-phone"
                              type="text"
                              placeholder={t("enterCompanyPhone")}
                              value={companyPhone}
                              onChange={(e) => setCompanyPhone(e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="company-email" className="text-xs font-semibold">{t("companyEmail")}</Label>
                            <Input
                              id="company-email"
                              type="email"
                              placeholder={t("enterCompanyEmail")}
                              value={companyEmail}
                              onChange={(e) => setCompanyEmail(e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="company-address" className="text-xs font-semibold">{t("companyAddress")}</Label>
                            <Input
                              id="company-address"
                              type="text"
                              placeholder={t("enterCompanyAddress")}
                              value={companyAddress}
                              onChange={(e) => setCompanyAddress(e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>
                        </div>

                        {/* Right Column: Logo & Signature */}
                        <div className="space-y-3.5">
                          {/* Logo */}
                          <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="company-logo" className="text-xs font-semibold">{t("companyLogo")}</Label>
                              {companyLogo && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setCompanyLogo(null)}
                                  className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 p-1"
                                >
                                  {tCommon("delete")}
                                </Button>
                              )}
                            </div>
                            <Input
                              id="company-logo"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoChange}
                              className="text-xs"
                            />
                            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                            {companyLogo && (
                              <div className="mt-2 flex items-center justify-center p-2 bg-background rounded-lg border border-border">
                                <img src={companyLogo} alt={t("companyLogoAlt")} className="h-14 max-w-full object-contain" />
                              </div>
                            )}
                          </div>

                          {/* Signature */}
                          <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="authorized-signature" className="text-xs font-semibold">{t("authorizedSignature")}</Label>
                              {signatureImage && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSignatureImage(null)}
                                  className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 p-1"
                                >
                                  {tCommon("delete")}
                                </Button>
                              )}
                            </div>
                            <Input
                              id="authorized-signature"
                              type="file"
                              accept="image/*"
                              onChange={handleSignatureChange}
                              className="text-xs"
                            />
                            {signatureError && <p className="text-xs text-destructive">{signatureError}</p>}
                            {signatureImage && (
                              <div className="mt-2 flex items-center justify-center p-2 bg-background rounded-lg border border-border">
                                <img src={signatureImage} alt={t("authorizedSignatureAlt")} className="h-14 max-w-full object-contain" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {canEditConfig && (
                        <div className="mt-6 flex justify-end">
                          <Button onClick={handleSave} disabled={isSaving} className="font-semibold px-6">
                            {isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t("saving")}
                              </>
                            ) : (
                              t("saveDetails")
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TAB 3: DANGER ZONE */}
              {activeTab === "danger" && canEditConfig && (
                <div className="animate-in fade-in duration-150">
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-3.5">
                      <CardTitle className="text-destructive text-base sm:text-lg">{t("dangerZone") || "Danger Zone"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-destructive text-sm">{t("deleteAllDataTitle") || "Delete All Workspace Data"}</h3>
                          <p className="text-xs text-destructive/80">{t("deleteAllDataDescription") || "This will delete all sales, expenses, and records for this workspace. Cash defaults will be reset."}</p>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => setShowDeleteDataModal(true)}
                          className="text-xs w-full sm:w-auto shrink-0 font-medium"
                        >
                          {t("deleteAllDataButton") || "Delete Data"}
                        </Button>
                      </div>

                      <div className="border-t border-destructive/20 my-2" />

                      {/* Option 2: Delete Entire Workspace */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-destructive text-sm">{t("deleteWorkspaceTitle") || "Delete Workspace"}</h3>
                          <p className="text-xs text-destructive/80">{t("deleteWorkspaceDescription") || "Permanently delete this entire workspace along with all its sales, expenses, inventory, staff roles, and settings. This cannot be undone."}</p>
                          {!isOwner && (
                            <p className="text-[11px] text-destructive italic mt-1 font-medium">{t("onlyOwnerCanDeleteWorkspace") || "Only the workspace owner can delete this workspace."}</p>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => setShowDeleteWorkspaceModal(true)}
                          disabled={!isOwner}
                          className="text-xs w-full sm:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {t("deleteWorkspaceButton") || "Delete Workspace"}
                        </Button>
                      </div>

                      {isSoleWorkspace && (
                        <div className="mt-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="leading-relaxed text-xs">
                              {t("cannotDeleteOnlyWorkspaceDesc") || "You cannot delete your only workspace. If you want to delete your entire account, please go to the Settings page and click Delete Account."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => router.push(`/${params.locale}/admin/settings`)}
                            className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs text-xs shrink-0 font-medium transition-colors cursor-pointer"
                          >
                            {t("goToSettings")}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )
        )}

          {/* Delete All Data Modal */}
          <Dialog
            open={showDeleteDataModal}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteDataPassword("");
                setDeleteDataError("");
              }
              setShowDeleteDataModal(open);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  {t("deleteAllDataTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("deleteAllDataWarning")}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleDeleteData} className="space-y-4">
                {deleteDataError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {deleteDataError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="delete-data-password">
                    {t("enterPassword")} <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="delete-data-password"
                    type="password"
                    value={deleteDataPassword}
                    onChange={(e) => setDeleteDataPassword(e.target.value)}
                    placeholder={t("enterPasswordDescription")}
                    disabled={isDeletingData}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDeleteDataModal(false);
                      setDeleteDataPassword("");
                      setDeleteDataError("");
                    }}
                    disabled={isDeletingData}
                  >
                    {t("cancelDeletion")}
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeletingData}
                  >
                    {isDeletingData ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("deleting")}
                      </>
                    ) : (
                      t("confirmDeletion")
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Entire Workspace Modal */}
          <Dialog
            open={showDeleteWorkspaceModal}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteWorkspacePassword("");
                setDeleteWorkspaceError("");
              }
              setShowDeleteWorkspaceModal(open);
            }}
          >
            <DialogContent className="max-w-md">
              {isSoleWorkspace ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      {t("cannotDeleteOnlyWorkspaceTitle")}
                    </DialogTitle>
                    <DialogDescription className="text-gray-700 pt-2 leading-relaxed">
                      {t("cannotDeleteOnlyWorkspaceDesc")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2 mt-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {t("cannotDeleteOnlyWorkspaceDesc")}
                    </span>
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDeleteWorkspaceModal(false)}
                    >
                      {t("cancelDeletion")}
                    </Button>
                    <Button
                      type="button"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => {
                        setShowDeleteWorkspaceModal(false);
                        router.push(`/${params.locale}/admin/settings`);
                      }}
                    >
                      {t("goToSettings")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      {t("deleteWorkspaceTitle") || "Delete Workspace"}
                    </DialogTitle>
                    <DialogDescription>
                      {t("deleteWorkspaceWarning") || "Are you sure you want to permanently delete this workspace and all its data? This cannot be undone."}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleDeleteWorkspace} className="space-y-4">
                    {deleteWorkspaceError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {deleteWorkspaceError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="delete-workspace-password">
                        {t("enterPassword") || "Enter Password"} <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="delete-workspace-password"
                        type="password"
                        value={deleteWorkspacePassword}
                        onChange={(e) => setDeleteWorkspacePassword(e.target.value)}
                        placeholder={t("enterPasswordDescription") || "Enter password to confirm"}
                        disabled={isDeletingWorkspace}
                      />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDeleteWorkspaceModal(false);
                          setDeleteWorkspacePassword("");
                          setDeleteWorkspaceError("");
                        }}
                        disabled={isDeletingWorkspace}
                      >
                        {t("cancelDeletion") || "Cancel"}
                      </Button>
                      <Button
                        type="submit"
                        className="bg-red-700 hover:bg-red-800 text-white"
                        disabled={isDeletingWorkspace}
                      >
                        {isDeletingWorkspace ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("deletingWorkspace") || "Deleting Workspace..."}
                          </>
                        ) : (
                          t("confirmDeletion") || "Confirm"
                        )}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>

          {!canViewConfig && !canViewPaymentMethods && (
            <div className="text-center p-8 text-muted-foreground border rounded-lg bg-muted/30 mt-8">
              You do not have permission to view configuration or payment methods.
            </div>
          )}
      </div>
    </ProtectedRoute>
  );
}
