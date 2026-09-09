"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  isPrivacy: boolean;
  currency?: string;
  isExpense?: boolean;
  noIconBg?: boolean;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  isPrivacy,
  currency,
  isExpense,
  noIconBg,
  isLoading,
}: StatCardProps) {
  const bgColor = noIconBg
    ? ""
    : isExpense
      ? "bg-red-500/10"
      : "bg-blue-500/10";

  return (
    <Card className="flex flex-col p-2.5 sm:p-3 gap-1.5 h-full justify-between">
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
          {icon}
        </div>
      </div>
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
            {Math.floor(value).toLocaleString()}
          </>
        )}
      </div>
    </Card>
  );
}
