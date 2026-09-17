"use client";

import React, { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { toHTMLDateString, safeDate, toPakistaniDateString } from "@/lib/date-utils";
import { CalendarIcon } from "lucide-react";

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value?: string | Date; // Accepts ISO string (YYYY-MM-DD), Pakistani string (DD-MM-YYYY), or Date
  onChange?: (dateString: string, dateObj: Date) => void;
  containerClassName?: string;
  placeholder?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, containerClassName, value, onChange, disabled, placeholder = "DD-MM-YYYY", ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Normalize value to HTML date format (YYYY-MM-DD) for native picker
    const dateObj = value ? safeDate(value) : null;
    const isoValue = dateObj && !isNaN(dateObj.getTime()) ? toHTMLDateString(dateObj) : "";
    const displayValue = dateObj && !isNaN(dateObj.getTime()) ? toPakistaniDateString(dateObj) : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value; // YYYY-MM-DD from native picker
      if (onChange) {
        onChange(val, safeDate(val));
      }
    };

    return (
      <div className={cn("relative flex items-center w-full", containerClassName)}>
        {/* Custom Visual Display showing Pakistani DD-MM-YYYY format */}
        <div
          className={cn(
            "flex h-9 w-full items-center rounded-md border border-input bg-background pl-8 pr-2.5 text-xs shadow-xs transition-colors",
            disabled ? "opacity-50 cursor-not-allowed bg-muted" : "cursor-pointer hover:bg-accent/40",
            className
          )}
        >
          <span className={cn("truncate font-medium", !displayValue && "text-muted-foreground")}>
            {displayValue || placeholder}
          </span>
        </div>

        <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

        {/* Native date input stretched over the container to capture clicks & open calendar picker */}
        <input
          type="date"
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          value={isoValue}
          onChange={handleChange}
          disabled={disabled}
          tabIndex={0}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          {...props}
        />
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
