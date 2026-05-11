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
let branchesCache: { value: string; label: string }[] | null = null;
let branchesPromise: Promise<{ value: string; label: string }[]> | null = null;

interface BranchSelectorProps {
  value: string;
  onChange: (value: string) => void;
  translations?: {
    label: string;
    tooltip: string;
    placeholder: string;
    createLabel: (value: string) => string;
  };
}

const defaultBranches = ["Main"];

export function BranchSelector({
  value,
  onChange,
  translations,
}: BranchSelectorProps) {
  const t = useTranslations("products");
  const label = translations?.label ?? t("branch");
  const tooltip = translations?.tooltip ?? t("branchTooltip");
  const placeholder = translations?.placeholder ?? t("selectOrCreateBranch");
  const getCreateLabel =
    translations?.createLabel ??
    ((v: string) => t("createBranch", { value: v }));
  const [branches, setBranches] = useState<{ value: string; label: string }[]>(
    defaultBranches.map((branch) => ({ value: branch, label: branch }))
  );
  const [selectedBranch, setSelectedBranch] = useState<{
    value: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    // Fetch branches from database
    const fetchBranches = async () => {
      try {
        // Return cached data if available
        if (branchesCache) {
          setBranches(branchesCache);
          return;
        }

        // Reuse in-flight request if available
        if (branchesPromise) {
          const result = await branchesPromise;
          setBranches(result);
          return;
        }

        // Create new fetch promise
        branchesPromise = (async () => {
          const response = await fetch("/api/branches");
          if (!response.ok) {
            throw new Error("Failed to fetch branches");
          }

          const data = await response.json();
          const dbBranches = data.map((branch: any) => ({
            value: branch.name,
            label: branch.name,
          }));

          // Merge default branches with database branches, removing duplicates
          const merged = Array.from(
            new Map([
              ...defaultBranches.map((branch) => [
                branch,
                { value: branch, label: branch },
              ]),
              ...dbBranches.map((branch: any) => [branch.value, branch]),
            ]).values()
          ) as { value: string; label: string }[];

          branchesCache = merged;
          return merged;
        })();

        const result = await branchesPromise;
        setBranches(result);
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    // Set default value to "Main" if no value provided
    const defaultValue = value || "Main";
    const found = branches.find((branch) => branch.value === defaultValue);
    setSelectedBranch(found || { value: "Main", label: "Main" });
    if (!value) {
      onChange("Main");
    }
  }, [branches, onChange, value]);

  const handleCreateOption = async (inputValue: string) => {
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: inputValue }),
      });

      if (!response.ok) {
        console.error("Failed to create branch");
        return;
      }

      const data = await response.json();
      const newOption = { value: data.name, label: data.name };
      setBranches((prev) => [...prev, newOption]);
      setSelectedBranch(newOption);
      onChange(data.name);
    } catch (error) {
      console.error("Error creating branch:", error);
    }
  };

  const handleChange = (option: { value: string; label: string } | null) => {
    if (option) {
      setSelectedBranch(option);
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
        <Label htmlFor="branch" className="">
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
        id="branch"
        isClearable
        isSearchable
        options={branches}
        value={selectedBranch}
        onChange={handleChange}
        onCreateOption={handleCreateOption}
        placeholder={placeholder}
        styles={customStyles}
        formatCreateLabel={getCreateLabel}
      />
    </div>
  );
}
