"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, FilePenIcon, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";

export interface TableRowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
  hidden?: boolean;
}

interface TableRowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  extraActions?: TableRowActionItem[];
}

export function TableRowActions({
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  extraActions = [],
}: TableRowActionsProps) {
  const t = useTranslations("common");
  
  const visibleExtraActions = extraActions.filter((action) => !action.hidden);

  return (
    <div className="flex items-center gap-1 justify-end">
      {visibleExtraActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            {visibleExtraActions.map((action, index) => (
              <DropdownMenuItem key={index} onClick={action.onClick} className={`flex items-center gap-2 cursor-pointer ${action.className || ""}`}>
                {action.icon && <span className="flex-shrink-0 text-muted-foreground">{action.icon}</span>}
                <span className="truncate">{action.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canEdit && onEdit && (
        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary hover:bg-primary/10" onClick={onEdit} title={t("edit") || "Edit"}>
          <FilePenIcon className="w-4 h-4" />
          <span className="sr-only">{t("edit") || "Edit"}</span>
        </Button>
      )}

      {canDelete && onDelete && (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={onDelete} title={t("delete") || "Delete"}>
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">{t("delete") || "Delete"}</span>
        </Button>
      )}
    </div>
  );
}
