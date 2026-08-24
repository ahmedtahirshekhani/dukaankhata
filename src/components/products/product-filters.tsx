"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { SearchIcon, FilterIcon, ChevronDownIcon, XIcon } from "lucide-react";

interface ProductFiltersProps {
  filters: {
    type: string;
    category: string;
    branch: string;
  };
  priceRanges: {
    sellPriceMin: string;
    sellPriceMax: string;
    costPriceMin: string;
    costPriceMax: string;
  };
  categories: string[];
  branches: string[];
  onFilterChange: (type: "type" | "category" | "branch", value: string) => void;
  onPriceRangeChange: (field: string, value: string) => void;
  onClearAll: () => void;
  capitalizeFirstLetter: (str: string | undefined | null) => string;
}

export function ProductFilters({
  filters,
  priceRanges,
  categories,
  branches,
  onFilterChange,
  onPriceRangeChange,
  onClearAll,
  capitalizeFirstLetter,
}: ProductFiltersProps) {
  const t = useTranslations("products");
  const typeLabel = t("type");
  const allLabel = t("all");
  const goodsLabel = t("goods");
  const servicesLabel = t("services");
  const categoryLabel = t("category");
  const branchLabel = t("branch");
  const sellPriceRangeLabel = t("sellPriceRange");
  const costPriceRangeLabel = t("costPriceRange");
  const minPlaceholder = t("min");
  const maxPlaceholder = t("max");
  const resetFiltersLabel = t("resetFilters");
  const priceRangesLabel = t("priceRanges");
  const priceLabel = t("price");
  // Check if any filters are active
  const hasActiveFilters =
    filters.category !== "all" ||
    priceRanges.sellPriceMin !== "" ||
    priceRanges.sellPriceMax !== "" ||
    priceRanges.costPriceMin !== "" ||
    priceRanges.costPriceMax !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* Category Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-9 text-xs flex-shrink-0"
          >
            <span className="text-muted-foreground hidden sm:inline">
              {categoryLabel}:
            </span>
            <span className="truncate max-w-[80px] sm:max-w-none">
              {filters.category === "all" ? allLabel : filters.category}
            </span>
            <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 max-h-64 overflow-y-auto"
        >
          <DropdownMenuLabel>{categoryLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.category === "all"}
            onCheckedChange={() => onFilterChange("category", "all")}
          >
            {allLabel}
          </DropdownMenuCheckboxItem>
          {categories.map((cat) => (
            <DropdownMenuCheckboxItem
              key={cat}
              checked={filters.category === cat}
              onCheckedChange={() => onFilterChange("category", cat)}
            >
              {capitalizeFirstLetter(cat)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Price Range Filters */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-9 flex-shrink-0"
          >
            <FilterIcon className="w-3 h-3" />
            <span className="text-xs hidden sm:inline">{priceRangesLabel}</span>
            <span className="text-xs sm:hidden">{priceLabel}</span>
            <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 sm:w-80 p-4">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                {sellPriceRangeLabel}
              </Label>
              <div className="flex gap-2">
                <NumericInput
                  min="0"
                  placeholder={minPlaceholder}
                  value={priceRanges.sellPriceMin}
                  onChange={(e) =>
                    onPriceRangeChange("sellPriceMin", e.target.value)
                  }
                  className="h-8 text-xs"
                />
                <NumericInput
                  min="0"
                  placeholder={maxPlaceholder}
                  value={priceRanges.sellPriceMax}
                  onChange={(e) =>
                    onPriceRangeChange("sellPriceMax", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                {costPriceRangeLabel}
              </Label>
              <div className="flex gap-2">
                <NumericInput
                  min="0"
                  placeholder={minPlaceholder}
                  value={priceRanges.costPriceMin}
                  onChange={(e) =>
                    onPriceRangeChange("costPriceMin", e.target.value)
                  }
                  className="h-8 text-xs"
                />
                <NumericInput
                  min="0"
                  placeholder={maxPlaceholder}
                  value={priceRanges.costPriceMax}
                  onChange={(e) =>
                    onPriceRangeChange("costPriceMax", e.target.value)
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset Filters Button - Icon only on mobile, only show if filters active */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-9 w-9 md:w-auto md:px-3 p-0 flex-shrink-0"
        >
          <XIcon className="w-4 h-4" />
          <span className="hidden md:inline md:ml-1 text-xs">
            {resetFiltersLabel}
          </span>
        </Button>
      )}
    </div>
  );
}
