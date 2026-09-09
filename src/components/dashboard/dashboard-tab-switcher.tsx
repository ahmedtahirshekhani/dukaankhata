"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export interface DashboardTabSwitcherProps {
  activeTab: "customers" | "sales" | "items";
  onTabChange: (tab: "customers" | "sales" | "items") => void;
  canViewCustomers: boolean;
  canViewSales: boolean;
  canViewProducts: boolean;
  tDash: (key: string) => string;
}

export function DashboardTabSwitcher({
  activeTab,
  onTabChange,
  canViewCustomers,
  canViewSales,
  canViewProducts,
  tDash,
}: DashboardTabSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {canViewCustomers && (
        <Button
          type="button"
          size="sm"
          variant={activeTab === "customers" ? "default" : "outline"}
          onClick={() => onTabChange("customers")}
        >
          {tDash("customers") || "Customers"}
        </Button>
      )}
      {canViewSales && (
        <Button
          type="button"
          size="sm"
          variant={activeTab === "sales" ? "default" : "outline"}
          onClick={() => onTabChange("sales")}
        >
          {tDash("sales") || "Sales"}
        </Button>
      )}
      {canViewProducts && (
        <Button
          type="button"
          size="sm"
          variant={activeTab === "items" ? "default" : "outline"}
          onClick={() => onTabChange("items")}
        >
          {tDash("items") || "Items"}
        </Button>
      )}
    </div>
  );
}

