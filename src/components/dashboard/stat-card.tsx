"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode | React.ElementType;
  isPrivacy?: boolean;
  currency?: string;
  isExpense?: boolean;
  noIconBg?: boolean;
  isLoading?: boolean;
  subValue?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  isPrivacy = false,
  currency,
  isExpense,
  noIconBg,
  isLoading,
  subValue,
  className,
}: StatCardProps) {
  const bgColor = noIconBg
    ? ""
    : isExpense
      ? "bg-red-500/10 text-red-500"
      : "bg-blue-500/10 text-blue-500";

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as React.ElementType;
      return <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />;
    }
    return icon as React.ReactNode;
  };

  return (
    <Card className={cn("flex flex-col p-2.5 sm:p-3 gap-1.5 h-full justify-between", className)}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] sm:text-xs font-medium leading-tight line-clamp-3 text-muted-foreground">
          {title}
        </p>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center",
            !noIconBg && `p-1 rounded-md ${bgColor}`
          )}
        >
          {renderIcon()}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1 font-bold text-sm sm:text-base leading-tight">
          {isLoading ? (
            <Skeleton className="h-5 w-24 rounded" />
          ) : isPrivacy ? (
            <span className="text-muted-foreground">***</span>
          ) : (
            <>
              {currency && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {currency}{" "}
                </span>
              )}
              {typeof value === "number" ? Math.floor(value).toLocaleString() : value}
            </>
          )}
        </div>
        {subValue && !isLoading && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
            {subValue}
          </p>
        )}
      </div>
    </Card>
  );
}
