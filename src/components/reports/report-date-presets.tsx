"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toHTMLDateString, getPKTParts } from "@/lib/date-utils";

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "last7Days"
  | "thisMonth"
  | "lastMonth"
  | "last30Days"
  | "thisYear"
  | "allTime"
  | "custom";

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export function getPresetDateRange(preset: string): DateRange {
  const now = new Date();
  const pkt = getPKTParts(now);

  const year = pkt ? pkt.year : now.getFullYear();
  const month = pkt ? pkt.month : now.getMonth() + 1;
  const day = pkt ? pkt.day : now.getDate();
  const todayStr = toHTMLDateString(now);

  switch (preset) {
    case "today": {
      return { fromDate: todayStr, toDate: todayStr };
    }
    case "yesterday": {
      const y = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0));
      const yDate = toHTMLDateString(y);
      return { fromDate: yDate, toDate: yDate };
    }
    case "thisWeek": {
      const cur = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const dayOfWeek = cur.getUTCDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(Date.UTC(year, month - 1, day + diffToMonday, 12, 0, 0));
      return { fromDate: toHTMLDateString(monday), toDate: todayStr };
    }
    case "lastWeek": {
      const cur = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const dayOfWeek = cur.getUTCDay();
      const diffToLastSun = dayOfWeek === 0 ? 7 : dayOfWeek;
      const lastSun = new Date(Date.UTC(year, month - 1, day - diffToLastSun, 12, 0, 0));
      const lastMon = new Date(Date.UTC(year, month - 1, day - diffToLastSun - 6, 12, 0, 0));
      return { fromDate: toHTMLDateString(lastMon), toDate: toHTMLDateString(lastSun) };
    }
    case "last7Days": {
      const d = new Date(Date.UTC(year, month - 1, day - 6, 12, 0, 0));
      return { fromDate: toHTMLDateString(d), toDate: todayStr };
    }
    case "thisMonth": {
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      return { fromDate: firstDay, toDate: todayStr };
    }
    case "lastMonth": {
      const firstDayLastMonth = new Date(Date.UTC(year, month - 2, 1, 12, 0, 0));
      const lastDayLastMonth = new Date(Date.UTC(year, month - 1, 0, 12, 0, 0));
      return { fromDate: toHTMLDateString(firstDayLastMonth), toDate: toHTMLDateString(lastDayLastMonth) };
    }
    case "last30Days": {
      const d = new Date(Date.UTC(year, month - 1, day - 29, 12, 0, 0));
      return { fromDate: toHTMLDateString(d), toDate: todayStr };
    }
    case "thisYear": {
      const firstDayYear = `${year}-01-01`;
      return { fromDate: firstDayYear, toDate: todayStr };
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
    { key: "today", label: tCommon("today")},
    { key: "yesterday", label: tCommon("yesterday")},
    { key: "thisWeek", label: tCommon("thisWeek")},
    { key: "lastWeek", label: tCommon("lastWeek")},
    { key: "last7Days", label: tCommon("last7Days")},
    { key: "thisMonth", label: tCommon("thisMonth")},
    { key: "lastMonth", label: tCommon("lastMonth")},
    { key: "last30Days", label: tCommon("last30Days")},
    { key: "thisYear", label: tCommon("thisYear")},
    { key: "allTime", label: tCommon("allTime")},
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
