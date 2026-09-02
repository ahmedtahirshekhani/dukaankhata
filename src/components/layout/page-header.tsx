import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  mobileActionsRows?: 1 | 2;
}

export function PageHeader({ title, description, actions, className, mobileActionsRows = 1 }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && (
        <div className={cn(
          "gap-2 w-full sm:w-auto",
          mobileActionsRows === 2 ? "flex flex-col items-stretch sm:flex-row sm:items-center" : "flex flex-row items-center"
        )}>
          {actions}
        </div>
      )}
    </div>
  );
}
