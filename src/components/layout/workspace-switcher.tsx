"use client";

import { useTranslations, useLocale } from "next-intl";
import { useUserProfile } from "@/hooks/use-user-profile";
import { usePermissions } from "@/hooks/use-permissions";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SyncEngine } from "@/lib/sync/sync-engine";

import { Store, ChevronRight, CheckCircle, Building2, PlusCircle, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

interface WorkspaceSwitcherProps {
  sidebarMinimized?: boolean;
  activeCompanyName?: string;
}

export function WorkspaceSwitcher({ sidebarMinimized, activeCompanyName }: WorkspaceSwitcherProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { hasModuleAccess } = usePermissions();
  const tNav = useTranslations("navigation");
  const { user, updateSession } = useUserProfile();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Also listen to the custom appNetworkStatus event from admin-layout
    const handleAppNetwork = (e: any) => {
      if (e.detail !== undefined) setIsOnline(e.detail.isOnline);
    };
    window.addEventListener("appNetworkStatus", handleAppNetwork);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("appNetworkStatus", handleAppNetwork);
    };
  }, []);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) {
      setError(t("requiredField"));
      return;
    }
    
    setError("");
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/shops/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newShopName })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("failedToCreateShop"));
        setIsSubmitting(false);
        return;
      }
      
      // Update session with new active workspace and force reload
      await updateSession({ active_workspace_id: data.shopId });
      setIsModalOpen(false);
      setNewShopName("");
      await SyncEngine.clearCacheAndResync();
      window.location.href = `/${locale}/admin`; // Force full reload to rebuild workspaces in auth.ts
    } catch (err) {
      setError(t("networkError"));
      setIsSubmitting(false);
    }
  };

  if (!user?.workspaces || user.workspaces.length === 0) {
    return null;
  }

  const activeWorkspace = user.workspaces.find(
    (w) => w.id === user.active_workspace_id
  );

  const displayShopName = activeCompanyName || activeWorkspace?.name || "My Shop";

  return (
    <div className="mb-4 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={`w-full h-auto py-1.5 flex items-center border border-primary/20 bg-primary/5 hover:bg-gradient-to-r hover:from-primary/15 hover:to-primary/5 text-primary transition-all duration-300 shadow-sm rounded-lg cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              sidebarMinimized ? "justify-center sm:px-0" : "justify-between px-2.5"
            }`}
            title={sidebarMinimized ? t("switchWorkspace") : ""}
          >
            <div className={`flex items-center gap-2.5 truncate ${sidebarMinimized ? "sm:pr-0" : "pr-2"}`}>
              <div className="flex items-center justify-center bg-primary text-primary-foreground rounded-md w-7 h-7 shrink-0 shadow-sm">
                <Store className="h-3.5 w-3.5" />
              </div>
              <div className={`flex flex-col items-start min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}>
                <span className="truncate text-xs font-bold tracking-tight">
                  {displayShopName}
                </span>
                <span className="text-[9px] text-primary/80 font-semibold tracking-wider uppercase">
                  {activeWorkspace?.type || "Workspace"}
                </span>
              </div>
            </div>
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 opacity-50 ${sidebarMinimized ? "sm:hidden" : ""}`} />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-2 shadow-2xl rounded-xl border-primary/10">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
            {t("switchWorkspace")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1.5" />
          <div className="space-y-1">
            {user.workspaces.map((ws: any) => {
              const isActive = ws.id === user.active_workspace_id;
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={async (e) => {
                    if (!isOnline && !isActive) {
                      e.preventDefault();
                      setShowOfflineAlert(true);
                      return;
                    }
                    if (!isActive) {
                      await updateSession({ active_workspace_id: ws.id });
                      await SyncEngine.clearCacheAndResync();
                      window.location.href = `/${locale}/admin`;
                    } else if (hasModuleAccess("settings")) {
                      router.push(`/${locale}/admin/configuration`);
                    }
                  }}
                  className={`flex items-center gap-2 cursor-pointer p-1.5 rounded-lg transition-all ${
                    !isOnline && !isActive 
                      ? "opacity-50 cursor-not-allowed" 
                      : isActive
                        ? "bg-primary/10 text-primary hover:bg-primary/20 focus:bg-primary/20 focus:text-primary"
                        : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center rounded-md w-6 h-6 shrink-0 border ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className={`truncate text-xs font-medium ${
                        isActive ? "font-bold text-primary" : ""
                      }`}
                    >
                      {ws.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize leading-tight">
                      {ws.type}
                    </span>
                  </div>
                  {isActive && (
                    hasModuleAccess("settings") ? (
                      <Settings className="h-4 w-4 text-primary shrink-0 drop-shadow-sm transition-transform hover:rotate-90" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 drop-shadow-sm" />
                    )
                  )}
                </DropdownMenuItem>
              );
            })}
            
            <DropdownMenuItem
              onClick={(e) => {
                if ((user?.workspaces?.length ?? 0) >= 5) {
                  e.preventDefault();
                  return;
                }
                if (!isOnline) {
                  e.preventDefault();
                  setShowOfflineAlert(true);
                  return;
                }
                setIsModalOpen(true);
              }}
              disabled={(user?.workspaces?.length ?? 0) >= 5}
              className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                !isOnline || (user?.workspaces?.length ?? 0) >= 5
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer text-primary hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary"
              }`}
            >
              <div className="flex items-center justify-center rounded-md w-8 h-8 shrink-0 border border-primary/20 bg-primary/5">
                <PlusCircle className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-sm font-bold">
                  {t("addNewShop")}
                </span>
                {user.workspaces.length >= 5 && (
                  <span className="text-[10px] text-amber-600 font-semibold whitespace-normal leading-tight mt-0.5">
                    {t("maxShopsLimitReached") || "Maximum limit of 5 shops reached."}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isModalOpen} onOpenChange={(open) => !isSubmitting && setIsModalOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateShop}>
            <DialogHeader>
              <DialogTitle>{t("addNewShop")}</DialogTitle>
              <DialogDescription>
                {t("addNewShopDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col space-y-4 py-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="shopName">{t("companyName")}</Label>
                <Input
                  id="shopName"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder={t("shopNamePlaceholder")}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        open={showOfflineAlert}
        onOpenChange={setShowOfflineAlert}
        title={t("offlineWorkspaceSwitchErrorTitle")}
        description={t("offlineWorkspaceSwitchErrorDesc")}
        confirmLabel={t("understood")}
        onConfirm={() => setShowOfflineAlert(false)}
        variant="warning"
      />
    </div>
  );
}
