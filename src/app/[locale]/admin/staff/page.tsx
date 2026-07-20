"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RolesTab } from "@/components/staff/roles-tab";
import { StaffTab } from "@/components/staff/staff-tab";
import { Users, Lock } from "lucide-react";

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
  const t = useTranslations("staffManagement");

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      </div>
      
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
        {activeTab === "staff" ? <StaffTab /> : <RolesTab />}
      </div>
    </div>
  );
}
