"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { PlusCircle, SearchIcon, X, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ExpenseCategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  onAddCategory?: (category: string) => void;
}

export function ExpenseCategorySelector({
  value,
  onChange,
  categories,
  onAddCategory,
}: ExpenseCategorySelectorProps) {
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");

  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    return categories.filter((cat) =>
      cat.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );
  }, [categories, searchTerm]);

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    onAddCategory?.(trimmed);
    onChange(trimmed);
    setNewCategoryName("");
    setIsAddDialogOpen(false);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground flex items-center gap-1">
        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
        <span>{t("category")}</span>
      </Label>

      <Select
        value={value || undefined}
        onValueChange={onChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger className="h-10 text-xs bg-background">
          <SelectValue placeholder={t("selectOrCreateCategory") || "Select Category"} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={5}
          className="min-w-[240px] max-w-[90vw] p-0 overflow-hidden z-[70]"
        >
          <div className="sticky top-0 bg-popover z-10 border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={tCommon("search") || "Search..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="pl-8 pr-8 h-8 text-xs bg-background"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[180px] overflow-y-auto p-1">
            {filteredCategories.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {t("noExpenses") || "No categories found"}
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <SelectItem
                  key={cat}
                  value={cat}
                  className="text-xs cursor-pointer py-1.5"
                >
                  {cat}
                </SelectItem>
              ))
            )}
          </div>

          <div
            className="border-t pt-1 sticky bottom-0 bg-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary hover:bg-accent rounded-none justify-start"
              onClick={() => {
                setIsOpen(false);
                setNewCategoryName(searchTerm);
                setIsAddDialogOpen(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>{t("createCategory", { value: "" }).replace(/["“”]/g, "").trim() || "Add New Category"}</span>
            </Button>
          </div>
        </SelectContent>
      </Select>

      {/* Mini Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[380px] z-[80]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t("createCategory", { value: "" }).replace(/["“”]/g, "").trim() || "Add New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-medium">{t("category")}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Petrol, Rent, Electricity"
              className="h-9 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddDialogOpen(false)}
              className="h-8 text-xs"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="h-8 text-xs"
            >
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

