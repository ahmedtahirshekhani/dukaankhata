"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import CreatableSelect from "react-select/creatable";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// Module-level cache to prevent duplicate API calls across component mounts
let categoriesCache: { value: string; label: string }[] | null = null;
let categoriesPromise: Promise<{ value: string; label: string }[]> | null = null;

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  translations?: {
    label: string;
    tooltip: string;
    placeholder: string;
    createLabel: (value: string) => string;
  };
}

const defaultCategories = [
  "General",
  "Electronics",
  "Clothing",
  "Books",
  "Home",
  "Consulting",
  "Maintenance",
  "Delivery",
  "Installation",
];

export function CategorySelector({
  value,
  onChange,
  translations,
}: CategorySelectorProps) {
  const t = useTranslations("products");
  const label = translations?.label ?? t("category");
  const tooltip = translations?.tooltip ?? t("categoryTooltip");
  const placeholder = translations?.placeholder ?? t("selectOrCreateCategory");
  const getCreateLabel =
    translations?.createLabel ??
    ((v: string) => t("createCategory", { value: v }));
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >(defaultCategories.map((cat) => ({ value: cat, label: cat })));
  const [selectedCategory, setSelectedCategory] = useState<{
    value: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    // Fetch categories from database
    const fetchCategories = async () => {
      try {
        // Return cached data if available
        if (categoriesCache) {
          setCategories(categoriesCache);
          return;
        }

        // Reuse in-flight request if available
        if (categoriesPromise) {
          const result = await categoriesPromise;
          setCategories(result);
          return;
        }

        // Create new fetch promise
        categoriesPromise = (async () => {
          const response = await fetch("/api/categories");
          if (!response.ok) {
            throw new Error("Failed to fetch categories");
          }

          const data = await response.json();
          const dbCategories = data.map((cat: any) => ({
            value: cat.name,
            label: cat.name,
          }));

          // Merge default categories with database categories, removing duplicates
          const merged = Array.from(
            new Map([
              ...defaultCategories.map((cat) => [
                cat,
                { value: cat, label: cat },
              ]),
              ...dbCategories.map((cat: any) => [cat.value, cat]),
            ]).values()
          ) as { value: string; label: string }[];

          categoriesCache = merged;
          return merged;
        })();

        const result = await categoriesPromise;
        setCategories(result);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    // Set default value to "General" if no value provided
    const defaultValue = value || "General";
    const found = categories.find((cat) => cat.value === defaultValue);
    setSelectedCategory(found || { value: "General", label: "General" });
    if (!value) {
      onChange("General");
    }
  }, [categories, onChange, value]);

  const handleCreateOption = async (inputValue: string) => {
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: inputValue }),
      });

      if (!response.ok) {
        console.error("Failed to create category");
        return;
      }

      const data = await response.json();
      const newOption = { value: data.name, label: data.name };
      setCategories((prev) => [...prev, newOption]);
      setSelectedCategory(newOption);
      onChange(data.name);
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const handleChange = (option: { value: string; label: string } | null) => {
    if (option) {
      setSelectedCategory(option);
      onChange(option.value);
    }
  };

  const customStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: "36px",
      fontSize: "14px",
      borderColor: "#d1d5db",
      "&:hover": {
        borderColor: "#9ca3af",
      },
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
        ? "#f3f4f6"
        : "white",
      color: state.isSelected ? "white" : "black",
      cursor: "pointer",
    }),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="category" className="">
          {label}
        </Label>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Info className="w-3 h-3 text-gray-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <CreatableSelect
        id="category"
        isClearable
        isSearchable
        options={categories}
        value={selectedCategory}
        onChange={handleChange}
        onCreateOption={handleCreateOption}
        placeholder={placeholder}
        styles={customStyles}
        formatCreateLabel={getCreateLabel}
      />
    </div>
  );
}
