"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { RolesTab } from "@/components/staff/roles-tab";
import { StaffTab } from "@/components/staff/staff-tab";
import { Users, Lock, WifiOff } from "lucide-react";

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
  const t = useTranslations("staffManagement");
  const tCommon = useTranslations("common");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleAppNetwork = (e: any) => {
      if (e.detail?.isOnline !== undefined) setIsOnline(e.detail.isOnline);
    };
    window.addEventListener("appNetworkStatus", handleAppNetwork);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("appNetworkStatus", handleAppNetwork);
    };
  }, []);

  return (
    <div className="flex-1 space-y-4 p-2 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      </div>

      {!isOnline && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-800 dark:text-amber-300 flex items-center gap-3">
          <WifiOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs sm:text-sm font-medium">
            <span className="font-bold">{tCommon("offlineWorkspaceSwitchErrorTitle")}:</span>{" "}
            {tCommon("offlineWorkspaceSwitchErrorDesc")}
          </div>
        </div>
      )}
      
      <div className="flex space-x-1 border-b border-border/50">
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "staff"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          {t("staffMembersTab")}
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="w-4 h-4" />
          {t("rolesPermissionsTab")}
        </button>
      </div>

      <div className="pt-4">
        <div className={activeTab === "staff" ? "block" : "hidden"}>
          <StaffTab />
        </div>
        <div className={activeTab === "roles" ? "block" : "hidden"}>
          <RolesTab />
        </div>
      </div>
    </div>
  );
}
