// src/components/reports/report-filter-card.tsx
"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportSearchAndAdvancedFilters,
  ReportSortOption,
} from "./report-search-and-advanced-filters";

export interface ReportFilterCardProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (val: string) => void;
  onToDateChange: (val: string) => void;
  fromDateLabel: string;
  toDateLabel: string;
  paymentStatus: string;
  onPaymentStatusChange: (val: string) => void;
  paymentStatusLabel: string;
  allStatusesLabel: string;
  paidLabel: string;
  partialLabel: string;
  unpaidLabel: string;
  extraFilterSlot?: React.ReactNode;

  // Search & Advanced Filters Props
  searchTerm: string;
  onSearchTermChange: (val: string) => void;
  searchPlaceholder?: string;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  activeAdvancedFilterCount: number;
  onResetFilters: () => void;
  minAmount: string;
  onMinAmountChange: (val: string) => void;
  maxAmount: string;
  onMaxAmountChange: (val: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  sortOptions: ReportSortOption[];
  advancedLabels: {
    filters: string;
    resetFilters: string;
    minAmount: string;
    maxAmount: string;
    sortBy: string;
  };
}

export function ReportFilterCard({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  fromDateLabel,
  toDateLabel,
  paymentStatus,
  onPaymentStatusChange,
  paymentStatusLabel,
  allStatusesLabel,
  paidLabel,
  partialLabel,
  unpaidLabel,
  extraFilterSlot,
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  activeAdvancedFilterCount,
  onResetFilters,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  sortBy,
  sortOrder,
  onSortChange,
  sortOptions,
  advancedLabels,
}: ReportFilterCardProps) {
  return (
    <Card className="border border-border/50 bg-card shadow-sm">
      <CardContent className="p-3.5 sm:p-4 space-y-3">
        {/* Row 1: Primary Filters */}
        <div
          className={`grid grid-cols-1 ${
            extraFilterSlot
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-3"
          } gap-3`}
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {fromDateLabel}:
            </label>
            <DatePicker
              value={fromDate}
              max={toDate}
              onChange={onFromDateChange}
              className="w-full h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {toDateLabel}:
            </label>
            <DatePicker
              value={toDate}
              min={fromDate}
              onChange={onToDateChange}
              className="w-full h-8 text-xs"
            />
          </div>

          {extraFilterSlot && <div>{extraFilterSlot}</div>}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {paymentStatusLabel}:
            </label>
            <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={allStatusesLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{allStatusesLabel}</SelectItem>
                <SelectItem value="paid">{paidLabel}</SelectItem>
                <SelectItem value="partial">{partialLabel}</SelectItem>
                <SelectItem value="unpaid">{unpaidLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Search & Advanced Filters */}
        <ReportSearchAndAdvancedFilters
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          searchPlaceholder={searchPlaceholder}
          showAdvancedFilters={showAdvancedFilters}
          onToggleAdvancedFilters={onToggleAdvancedFilters}
          activeAdvancedFilterCount={activeAdvancedFilterCount}
          onResetFilters={onResetFilters}
          minAmount={minAmount}
          onMinAmountChange={onMinAmountChange}
          maxAmount={maxAmount}
          onMaxAmountChange={onMaxAmountChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          sortOptions={sortOptions}
          labels={advancedLabels}
        />
      </CardContent>
    </Card>
  );
}
