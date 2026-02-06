"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ProductTranslations = {
  searchProducts: string;
  type: string;
  all: string;
  goods: string;
  services: string;
  category: string;
  branch: string;
  sellPriceRange: string;
  costPriceRange: string;
  min: string;
  max: string;
  resetFilters: string;
  priceRanges: string;
  price?: string;
};

interface ProductFiltersProps {
  searchTerm: string;
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
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilterChange: (type: "type" | "category" | "branch", value: string) => void;
  onPriceRangeChange: (field: string, value: string) => void;
  onClearAll: () => void;
  capitalizeFirstLetter: (str: string | undefined | null) => string;
  isMobileDialog?: boolean;
  /** Optional override; if not provided, uses next-intl "products" namespace */
  translations?: ProductTranslations;
}

export function ProductFilters({
  searchTerm,
  filters,
  priceRanges,
  categories,
  branches,
  onSearchChange,
  onFilterChange,
  onPriceRangeChange,
  onClearAll,
  capitalizeFirstLetter,
  isMobileDialog = false,
  translations: translationsProp,
}: ProductFiltersProps) {
  const t = useTranslations("products");
  const searchPlaceholder =
    translationsProp?.searchProducts ?? t("searchProducts");
  const typeLabel = translationsProp?.type ?? t("type");
  const allLabel = translationsProp?.all ?? t("all");
  const goodsLabel = translationsProp?.goods ?? t("goods");
  const servicesLabel = translationsProp?.services ?? t("services");
  const categoryLabel = translationsProp?.category ?? t("category");
  const branchLabel = translationsProp?.branch ?? t("branch");
  const sellPriceRangeLabel =
    translationsProp?.sellPriceRange ?? t("sellPriceRange");
  const costPriceRangeLabel =
    translationsProp?.costPriceRange ?? t("costPriceRange");
  const minPlaceholder = translationsProp?.min ?? t("min");
  const maxPlaceholder = translationsProp?.max ?? t("max");
  const resetFiltersLabel = translationsProp?.resetFilters ?? t("resetFilters");
  const priceRangesLabel = translationsProp?.priceRanges ?? t("priceRanges");
  const priceLabel = translationsProp?.price ?? t("price");
  // Check if any filters are active
  const hasActiveFilters =
    filters.type !== "all" ||
    filters.category !== "all" ||
    filters.branch !== "all" ||
    priceRanges.sellPriceMin !== "" ||
    priceRanges.sellPriceMax !== "" ||
    priceRanges.costPriceMin !== "" ||
    priceRanges.costPriceMax !== "";

  return (
    <div
      className={
        isMobileDialog
          ? "flex flex-col gap-3 w-full"
          : "flex items-center gap-2 w-full md:w-auto overflow-x-auto"
      }
    >
      {/* Desktop Search - Hidden on Mobile */}
      <div className="hidden md:block relative w-48 flex-shrink-0">
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={onSearchChange}
          className="pr-8 h-9 text-sm"
        />
        <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-9 text-xs flex-shrink-0"
          >
            <span className="text-muted-foreground hidden sm:inline">
              {typeLabel}:
            </span>
            <span>
              {filters.type === "all"
                ? allLabel
                : filters.type === "goods"
                ? goodsLabel
                : servicesLabel}
            </span>
            <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuLabel>{typeLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.type === "all"}
            onCheckedChange={() => onFilterChange("type", "all")}
          >
            {allLabel}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.type === "goods"}
            onCheckedChange={() => onFilterChange("type", "goods")}
          >
            {goodsLabel}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.type === "services"}
            onCheckedChange={() => onFilterChange("type", "services")}
          >
            {servicesLabel}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      {/* Branch Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-9 text-xs flex-shrink-0"
          >
            <span className="text-muted-foreground hidden sm:inline">
              {branchLabel}:
            </span>
            <span className="truncate max-w-[80px] sm:max-w-none">
              {filters.branch === "all" ? allLabel : filters.branch}
            </span>
            <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 max-h-64 overflow-y-auto"
        >
          <DropdownMenuLabel>{branchLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.branch === "all"}
            onCheckedChange={() => onFilterChange("branch", "all")}
          >
            {allLabel}
          </DropdownMenuCheckboxItem>
          {branches.map((branch) => (
            <DropdownMenuCheckboxItem
              key={branch}
              checked={filters.branch === branch}
              onCheckedChange={() => onFilterChange("branch", branch)}
            >
              {capitalizeFirstLetter(branch)}
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
                <Input
                  type="number"
                  placeholder={minPlaceholder}
                  value={priceRanges.sellPriceMin}
                  onChange={(e) =>
                    onPriceRangeChange("sellPriceMin", e.target.value)
                  }
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
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
                <Input
                  type="number"
                  placeholder={minPlaceholder}
                  value={priceRanges.costPriceMin}
                  onChange={(e) =>
                    onPriceRangeChange("costPriceMin", e.target.value)
                  }
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
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
