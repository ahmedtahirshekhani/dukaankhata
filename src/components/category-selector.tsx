"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import CreatableSelect from "react-select/creatable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
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

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const [categories, setCategories] = useState<{ value: string; label: string }[]>(
    defaultCategories.map((cat) => ({ value: cat, label: cat }))
  );
  const [selectedCategory, setSelectedCategory] = useState<{ value: string; label: string } | null>(
    null
  );

  useEffect(() => {
    // Fetch categories from database
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          const dbCategories = data.map((cat: any) => ({
            value: cat.name,
            label: cat.name,
          }));
          // Merge default categories with database categories, removing duplicates
          const merged = Array.from(
            new Map([
              ...defaultCategories.map((cat) => [cat, { value: cat, label: cat }]),
              ...dbCategories.map((cat: any) => [cat.value, cat]),
            ]).values()
          );
          setCategories(merged);
        }
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
  }, [categories]);

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
      backgroundColor: state.isSelected ? "#3b82f6" : state.isFocused ? "#f3f4f6" : "white",
      color: state.isSelected ? "white" : "black",
      cursor: "pointer",
    }),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="category" className="">
          Category
        </Label>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Info className="w-3 h-3 text-gray-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Select a category for organization and filtering
          </TooltipContent>
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
        placeholder="Select or create a category"
        styles={customStyles}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
      />
    </div>
  );
}
