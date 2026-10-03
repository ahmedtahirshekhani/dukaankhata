import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  mobileActionsRows?: 1 | 2;
  backHref?: string;
  onBack?: () => void;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  mobileActionsRows = 1,
  backHref,
  onBack,
}: PageHeaderProps) {
  const hasBack = Boolean(backHref || onBack);

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", className)}>
      <div className={cn(hasBack && "flex items-start gap-2.5")}>
        {backHref && (
          <Button variant="ghost" size="icon" asChild className="h-7 w-7 rounded-full shrink-0 mt-0.5">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        )}
        {!backHref && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7 rounded-full shrink-0 mt-0.5">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
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
