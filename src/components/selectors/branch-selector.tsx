"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import CreatableSelect from "react-select/creatable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface BranchSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const defaultBranches = [
  "Main",
];

export function BranchSelector({ value, onChange }: BranchSelectorProps) {
  const [branches, setBranches] = useState<{ value: string; label: string }[]>(
    defaultBranches.map((branch) => ({ value: branch, label: branch }))
  );
  const [selectedBranch, setSelectedBranch] = useState<{ value: string; label: string } | null>(
    null
  );

  useEffect(() => {
    // Fetch branches from database
    const fetchBranches = async () => {
      try {
        const response = await fetch("/api/branches");
        if (response.ok) {
          const data = await response.json();
          const dbBranches = data.map((branch: any) => ({
            value: branch.name,
            label: branch.name,
          }));
          // Merge default branches with database branches, removing duplicates
          const merged = Array.from(
            new Map([
              ...defaultBranches.map((branch) => [branch, { value: branch, label: branch }]),
              ...dbBranches.map((branch: any) => [branch.value, branch]),
            ]).values()
          ) as { value: string; label: string }[];
          setBranches(merged);
        }
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
  }, [branches]);

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
      backgroundColor: state.isSelected ? "#3b82f6" : state.isFocused ? "#f3f4f6" : "white",
      color: state.isSelected ? "white" : "black",
      cursor: "pointer",
    }),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="branch" className="">
          Branch
        </Label>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Info className="w-3 h-3 text-gray-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Branch or warehouse where item is stored
          </TooltipContent>
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
        placeholder="Select or create a branch"
        styles={customStyles}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
      />
    </div>
  );
}
