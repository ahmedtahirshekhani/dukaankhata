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
import { AlertCircle, Loader2 } from "lucide-react";

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

  // Feature Switches State
  const [enableCounterSale, setEnableCounterSale] = useState(true);
  const [enableAiChat, setEnableAiChat] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);

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
          const res = await fetch(`/${params.locale}/api/configuration/assets`);
          if (res.ok) {
            const data = await res.json();
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
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{tNav("configuration")}</h1>
            <p className="text-gray-600 mt-2">
              {tNav("configurationDescription")}
            </p>
          </div>

          {canViewConfig && (
            <>
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

                  {canEditConfig && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? t("saving") : t("saveDetails")}
                      </Button>
                    </div>
                  )}

                  {canEditConfig && (
                    <Card className="mt-8 border-red-200 bg-red-50/50">
                      <CardHeader>
                        <CardTitle className="text-red-600">{t("dangerZone") || "Danger Zone"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1 text-red-900/90">
                            <h3 className="font-medium text-red-800">{t("deleteAllDataTitle") || "Delete All Workspace Data"}</h3>
                            <p className="text-sm">{t("deleteAllDataDescription") || "This will delete all sales, expenses, and records for this workspace. Cash defaults will be reset."}</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setShowDeleteDataModal(true)}
                            className="bg-red-600 text-white hover:bg-red-50 hover:text-red-700 border-red-200 w-full sm:w-auto shrink-0"
                          >
                            {t("deleteAllDataButton") || "Delete Data"}
                          </Button>
                        </div>

                        <div className="border-t border-red-200/80 my-2" />

                        {/* Option 2: Delete Entire Workspace */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1 text-red-900/90">
                            <h3 className="font-medium text-red-800">{t("deleteWorkspaceTitle") || "Delete Workspace"}</h3>
                            <p className="text-sm">{t("deleteWorkspaceDescription") || "Permanently delete this entire workspace along with all its sales, expenses, inventory, staff roles, and settings. This cannot be undone."}</p>
                            {!isOwner && (
                              <p className="text-xs text-red-600 italic mt-1 font-medium">{t("onlyOwnerCanDeleteWorkspace") || "Only the workspace owner can delete this workspace."}</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setShowDeleteWorkspaceModal(true)}
                            disabled={!isOwner}
                            className="bg-red-700 text-white hover:bg-red-800 hover:text-white border-red-300 w-full sm:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("deleteWorkspaceButton") || "Delete Workspace"}
                          </Button>
                        </div>

                        {isSoleWorkspace && (
                          <div className="mt-1 p-3 rounded-lg bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <p className="leading-relaxed">
                                {t("cannotDeleteOnlyWorkspaceDesc") || "You cannot delete your only workspace. If you want to delete your entire account, please go to the Settings page and click Delete Account."}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/${params.locale}/admin/settings`)}
                              className="border-amber-300 bg-white hover:bg-amber-100 text-amber-900 hover:text-slate-600 text-xs shrink-0 font-medium"
                            >
                              {t("goToSettings")}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
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
                <div className="text-center p-8 text-muted-foreground border rounded-lg bg-gray-50 mt-8">
                  You do not have permission to view configuration or payment methods.
                </div>
              )}
            </div>
        </div>
    </ProtectedRoute>
  );
}
