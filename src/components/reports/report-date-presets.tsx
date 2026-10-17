"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toHTMLDateString } from "@/lib/date-utils";

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "allTime"
  | "custom";

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export function getPresetDateRange(preset: string): DateRange {
  const now = new Date();

  switch (preset) {
    case "today": {
      const today = toHTMLDateString(now);
      return { fromDate: today, toDate: today };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yDate = toHTMLDateString(y);
      return { fromDate: yDate, toDate: yDate };
    }
    case "thisWeek": {
      const first = new Date(now);
      const day = first.getDay();
      const diff = first.getDate() - day + (day === 0 ? -6 : 1);
      first.setDate(diff);
      return { fromDate: toHTMLDateString(first), toDate: toHTMLDateString(now) };
    }
    case "lastWeek": {
      const lastSun = new Date(now);
      const day = lastSun.getDay();
      const diffToLastSun = day === 0 ? 7 : day;
      lastSun.setDate(now.getDate() - diffToLastSun);
      const lastMon = new Date(lastSun);
      lastMon.setDate(lastSun.getDate() - 6);
      return { fromDate: toHTMLDateString(lastMon), toDate: toHTMLDateString(lastSun) };
    }
    case "thisMonth": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromDate: toHTMLDateString(firstDay), toDate: toHTMLDateString(now) };
    }
    case "lastMonth": {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: toHTMLDateString(firstDayLastMonth), toDate: toHTMLDateString(lastDayLastMonth) };
    }
    case "thisYear": {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      return { fromDate: toHTMLDateString(firstDayYear), toDate: toHTMLDateString(now) };
    }
    case "allTime":
    default: {
      return { fromDate: "", toDate: "" };
    }
  }
}

export interface ReportDatePresetsProps {
  activePreset: string;
  onSelectPreset: (preset: string, fromDate: string, toDate: string) => void;
  className?: string;
}

export function ReportDatePresets({
  activePreset,
  onSelectPreset,
  className,
}: ReportDatePresetsProps) {
  const tCommon = useTranslations("common");

  const presets = [
    { key: "today", label: tCommon("today") || "Today" },
    { key: "yesterday", label: tCommon("yesterday") || "Yesterday" },
    { key: "thisWeek", label: tCommon("thisWeek") || "This Week" },
    { key: "lastWeek", label: tCommon("lastWeek") || "Last Week" },
    { key: "thisMonth", label: tCommon("thisMonth") || "This Month" },
    { key: "lastMonth", label: tCommon("lastMonth") || "Last Month" },
    { key: "thisYear", label: tCommon("thisYear") || "This Year" },
    { key: "allTime", label: tCommon("allTime") || "All Time" },
  ];

  const handlePresetClick = (key: string) => {
    const range = getPresetDateRange(key);
    onSelectPreset(key, range.fromDate, range.toDate);
  };

  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none", className)}>
      {presets.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant={activePreset === preset.key ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick(preset.key)}
          className="h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
