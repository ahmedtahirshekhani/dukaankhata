"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { PlusCircle, SearchIcon, X, FileText } from "lucide-react";
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

interface ExpenseItemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  items: string[];
  onAddItem?: (item: string) => void;
}

export function ExpenseItemSelector({
  value,
  onChange,
  items,
  onAddItem,
}: ExpenseItemSelectorProps) {
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");

  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter((item) =>
      item.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );
  }, [items, searchTerm]);

  const handleAddItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    onAddItem?.(trimmed);
    onChange(trimmed);
    setNewItemName("");
    setIsAddDialogOpen(false);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground flex items-center gap-1">
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <span>{t("itemName")}</span>
      </Label>

      <Select
        value={value || undefined}
        onValueChange={onChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger className="h-10 text-xs bg-background">
          <SelectValue placeholder={t("selectOrCreateItem") || "Select Item"} />
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
            {filteredItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {t("noExpenses") || "No items found"}
              </div>
            ) : (
              filteredItems.map((item) => (
                <SelectItem
                  key={item}
                  value={item}
                  className="text-xs cursor-pointer py-1.5"
                >
                  {item}
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
                setNewItemName(searchTerm);
                setIsAddDialogOpen(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>{t("createItem", { value: "" }).replace(/["“”]/g, "").trim() || "Add New Item"}</span>
            </Button>
          </div>
        </SelectContent>
      </Select>

      {/* Mini Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[380px] z-[80]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t("createItem", { value: "" }).replace(/["“”]/g, "").trim() || "Add New Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-medium">{t("itemName")}</Label>
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. Office Supplies, Maintenance, Petrol"
              className="h-9 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddItem();
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
              onClick={handleAddItem}
              disabled={!newItemName.trim()}
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

