import React, { forwardRef } from "react";
import { Input, InputProps } from "@/components/ui/input";

export interface NumericInputProps extends Omit<InputProps, "type" | "inputMode"> {
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ allowDecimal = true, allowNegative = false, className, onChange, onKeyDown, ...props }, ref) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      
      // Standardize comma to dot
      val = val.replace(/,/g, ".");

      if (val === "") {
        onChange?.(e);
        return;
      }

      // Strip invalid characters
      let sanitized = val.replace(allowDecimal ? /[^\d.-]/g : /[^\d-]/g, "");
      
      if (!allowNegative) {
        sanitized = sanitized.replace(/-/g, "");
      } else {
        // Ensure minus sign is only at the beginning
        const hasMinus = sanitized.startsWith("-");
        sanitized = sanitized.replace(/-/g, "");
        if (hasMinus) sanitized = "-" + sanitized;
      }
      
      if (allowDecimal) {
        // Ensure only one decimal point
        const parts = sanitized.split(".");
        if (parts.length > 2) {
          sanitized = parts[0] + "." + parts.slice(1).join("");
        }
      }

      e.target.value = sanitized;
      onChange?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent up/down arrow keys from changing value if we want to strictly mimic text behavior
      // but actually, some users like arrow keys to increment/decrement.
      // We will disable it to strictly match user request (prevent scroll/arrow unintended changes)
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
      
      if (onKeyDown) onKeyDown(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`text-right ${className || ""}`}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
