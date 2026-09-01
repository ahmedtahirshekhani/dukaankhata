"use client";

import React, { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toHTMLDateString, safeDate } from "@/lib/date-utils";
import { CalendarIcon } from "lucide-react";

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value?: string | Date; // Can accept either a string (ISO) or Date object
  onChange?: (dateString: string, dateObj: Date) => void;
  containerClassName?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, containerClassName, value, onChange, disabled, ...props }, ref) => {
    
    // Normalize value to HTML date format (YYYY-MM-DD)
    const formattedValue = value ? (typeof value === "string" && value.length === 10 && value.includes("-") 
      ? value 
      : toHTMLDateString(safeDate(value))) : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (onChange) {
        onChange(val, safeDate(val));
      }
    };

    return (
      <div className={cn("relative w-full", containerClassName)}>
        <Input
          type="date"
          ref={ref}
          value={formattedValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "w-full pl-10 block bg-background",
            // Make the native calendar picker icon invisible so we can use our own custom icon
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          {...props}
        />
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
