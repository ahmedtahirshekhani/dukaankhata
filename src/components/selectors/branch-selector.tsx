"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Info, PlusCircle, SearchIcon, X, Loader2Icon, Trash2 } from "lucide-react";
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
import { useOfflineBranches } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

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

export function BranchSelector({
  value,
  onChange,
  translations,
}: BranchSelectorProps) {
  const t = useTranslations("products");
  const label = translations?.label ?? t("branch");
  const tooltip = translations?.tooltip ?? t("branchTooltip");
  const placeholder = translations?.placeholder ?? t("selectOrCreateBranch");

  const [searchTerm, setSearchTerm] = useState("");
  const branches = useOfflineBranches(searchTerm) || [];
  const [isOpen, setIsOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      setIsSaving(true);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const newBranch = { id: tempId, name: newBranchName };
      
      await db.branches.add(newBranch);
      await SyncEngine.queueOperation("branches", "POST", "/api/branches", { name: newBranchName }, tempId);
      
      onChange(newBranchName);
      setIsAddDialogOpen(false);
      setNewBranchName("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving branch:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBranch = async (e: React.MouseEvent, branch: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    const branchName = branch.name;
    const branchId = branch.id || branch._id;
    
    // Check if branch is used in products
    const productsUsingBranch = await db.products
      .filter((p) => p.branch === branchName && p.is_delete !== 1)
      .toArray();

    if (productsUsingBranch.length > 0) {
      setErrorMessage(t("branchInUseError"));
      setErrorDialogOpen(true);
      return;
    }

    try {
      await db.branches.delete(branchId);
      await SyncEngine.queueOperation("branches", "DELETE", `/api/branches/${branchId}`, null, branchId);
      if (value === branchName) {
        onChange("");
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
    }
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

      <Select value={value || undefined} onValueChange={onChange} open={isOpen} onOpenChange={setIsOpen}>
        <SelectTrigger id="branch">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={5} className="min-w-[280px] max-w-[90vw] p-0 overflow-hidden">
          <div className="sticky top-0 bg-popover z-10 border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchBranch")}
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
            {branches.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                {t("noBranchesFound")}
              </div>
            )}
            {branches.map((b: any) => (
              <div key={b.id || b.name} className="flex items-center justify-between group relative">
                <SelectItem value={b.name} className="flex-1 pr-16 cursor-pointer">
                  {b.name}
                </SelectItem>
                <button
                  type="button"
                  onClick={(e) => handleDeleteBranch(e, b)}
                  className="absolute right-8 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-all z-20 cursor-pointer"
                  title={t("delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="border-t mt-0 pt-1 sticky bottom-0 bg-popover" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
              onClick={() => {
                setIsOpen(false);
                setNewBranchName(searchTerm);
                setIsAddDialogOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" />
              {t("addNewBranch")}
            </Button>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("addNewBranch")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>{t("branchName")}</Label>
              <Input 
                value={newBranchName} 
                onChange={(e) => setNewBranchName(e.target.value)} 
                placeholder={t("branchPlaceholder")}
                autoFocus 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving}>{t("cancel")}</Button>
            <Button onClick={handleAddBranch} disabled={isSaving || !newBranchName.trim()}>
              {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("saveBranch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ErrorDialog 
        open={errorDialogOpen} 
        onOpenChange={setErrorDialogOpen} 
        message={errorMessage} 
      />
    </div>
  );
}
