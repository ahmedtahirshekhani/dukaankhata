"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Info, PlusCircle, SearchIcon, X, Loader2Icon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useOfflineCategories } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";

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

export function CategorySelector({
  value,
  onChange,
  translations,
}: CategorySelectorProps) {
  const t = useTranslations("products");
  const label = translations?.label ?? t("category");
  const tooltip = translations?.tooltip ?? t("categoryTooltip");
  const placeholder = translations?.placeholder ?? t("selectOrCreateCategory");

  const [searchTerm, setSearchTerm] = useState("");
  const categories = useOfflineCategories(searchTerm) || [];
  const [isOpen, setIsOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setIsSaving(true);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const newCategory = { id: tempId, name: newCategoryName, category_name: newCategoryName };
      
      await db.categories.add(newCategory);
      await SyncEngine.queueOperation("categories", "POST", "/api/categories", { name: newCategoryName }, tempId);
      
      onChange(newCategoryName);
      setIsAddDialogOpen(false);
      setNewCategoryName("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setIsSaving(false);
    }
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

      <Select value={value || undefined} onValueChange={onChange} open={isOpen} onOpenChange={setIsOpen}>
        <SelectTrigger id="category">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={5} className="min-w-[280px] max-w-[90vw] p-0 overflow-hidden">
          <div className="sticky top-0 bg-popover z-10 border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchCategory")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="pl-8 pr-8 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {categories.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                {t("noCategoriesFound")}
              </div>
            )}
            {categories.map((cat: any) => {
              const catName = cat.name || cat.category_name;
              return (
                <SelectItem key={cat.id || catName} value={catName}>
                  {catName}
                </SelectItem>
              );
            })}
          </div>
          
          <div className="border-t mt-0 pt-1 sticky bottom-0 bg-popover" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
              onClick={() => {
                setIsOpen(false);
                setNewCategoryName(searchTerm);
                setIsAddDialogOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" />
              {t("addNewCategory")}
            </Button>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("addNewCategory")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>{t("categoryName")}</Label>
              <Input 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                placeholder={t("categoryPlaceholder")}
                autoFocus 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving}>{t("cancel")}</Button>
            <Button onClick={handleAddCategory} disabled={isSaving || !newCategoryName.trim()}>
              {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("saveCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
