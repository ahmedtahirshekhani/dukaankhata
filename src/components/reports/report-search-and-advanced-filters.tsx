// src/components/reports/report-search-and-advanced-filters.tsx
"use client";

import React from "react";
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ReportSortOption {
  value: string; // e.g. "invoice_date-desc" or "total_amount-asc"
  label: string;
}

export interface ReportSearchAndAdvancedFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchPlaceholder?: string;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  activeAdvancedFilterCount: number;
  onResetFilters: () => void;
  minAmount: string;
  onMinAmountChange: (value: string) => void;
  maxAmount: string;
  onMaxAmountChange: (value: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  sortOptions: ReportSortOption[];
  labels: {
    filters: string;
    resetFilters: string;
    minAmount: string;
    maxAmount: string;
    sortBy: string;
  };
}

export function ReportSearchAndAdvancedFilters({
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
  labels,
}: ReportSearchAndAdvancedFiltersProps) {
  const currentSortValue = `${sortBy}-${sortOrder}`;
  const hasMatchingOption = sortOptions.some((opt) => opt.value === currentSortValue);

  return (
    <div className="space-y-2.5 pt-2 border-t border-border/40">
      {/* Row 2: Search and Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder={searchPlaceholder || "Search..."}
            className="h-8 text-xs pl-8 pr-7 w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchTermChange("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant={showAdvancedFilters || activeAdvancedFilterCount > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleAdvancedFilters}
            className="h-8 text-xs px-2.5 gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{labels.filters}</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="flex items-center justify-center h-4 w-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                {activeAdvancedFilterCount}
              </span>
            )}
            {showAdvancedFilters ? (
              <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
            title={labels.resetFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{labels.resetFilters}</span>
          </Button>
        </div>
      </div>

      {/* Expandable Advanced Filters */}
      {showAdvancedFilters && (
        <div className="p-3 rounded-lg bg-muted/40 border border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {labels.minAmount}:
            </label>
            <Input
              type="number"
              value={minAmount}
              onChange={(e) => onMinAmountChange(e.target.value)}
              placeholder="0"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {labels.maxAmount}:
            </label>
            <Input
              type="number"
              value={maxAmount}
              onChange={(e) => onMaxAmountChange(e.target.value)}
              placeholder="e.g. 100000"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {labels.sortBy}:
            </label>
            <Select
              value={currentSortValue}
              onValueChange={(val) => {
                const [f, o] = val.split("-");
                onSortChange(f, o as "asc" | "desc");
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={labels.sortBy} />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                {!hasMatchingOption && (
                  <SelectItem value={currentSortValue}>
                    {sortBy.replace(/_/g, " ")} ({sortOrder.toUpperCase()})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
