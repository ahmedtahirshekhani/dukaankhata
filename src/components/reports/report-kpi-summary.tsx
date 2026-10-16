// src/components/reports/report-kpi-summary.tsx
"use client";

import React from "react";
import { StatCard } from "@/components/dashboard/stat-card";

export interface ReportKpiCardItem {
  title: string;
  value: string;
  icon: React.ReactNode;
  subValue: string;
  isExpense?: boolean;
}

export interface ReportKpiSummaryProps {
  items: ReportKpiCardItem[];
  isLoading?: boolean;
}

export function ReportKpiSummary({ items, isLoading = false }: ReportKpiSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {items.map((item, index) => (
        <StatCard
          key={index}
          title={item.title}
          value={item.value}
          icon={item.icon}
          subValue={item.subValue}
          isExpense={item.isExpense}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
