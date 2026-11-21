import React, { forwardRef, useRef } from "react";
import { Input, InputProps } from "@/components/ui/input";

export interface NumericInputProps extends Omit<InputProps, "type" | "inputMode"> {
  allowDecimal?: boolean;
  allowNegative?: boolean;
  selectOnFocus?: boolean;
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ 
    allowDecimal = true, 
    allowNegative = false, 
    selectOnFocus = true,
    className, 
    onChange, 
    onKeyDown, 
    onFocus,
    onBlur,
    onMouseDown,
    onMouseUp,
    onClick,
    ...props 
  }, ref) => {
    const isFocusedRef = useRef(false);
    const isMouseDownRef = useRef(false);
    
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // If focus was triggered via keyboard (Tab) or programmatically (not mouse down)
      if (!isMouseDownRef.current) {
        isFocusedRef.current = true;
        if (selectOnFocus) {
          const target = e.currentTarget;
          setTimeout(() => {
            if (document.activeElement === target) {
              target.select();
            }
          }, 0);
        }
      }
      onFocus?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      isMouseDownRef.current = true;
      onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
      isMouseDownRef.current = false;
      // On first mouse click into the input, select all text like Chrome URL/search bar
      if (selectOnFocus && !isFocusedRef.current) {
        isFocusedRef.current = true;
        const target = e.currentTarget;
        target.select();
      }
      onMouseUp?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      // Fallback for touch devices or browsers
      if (selectOnFocus && !isFocusedRef.current) {
        isFocusedRef.current = true;
        e.currentTarget.select();
      }
      onClick?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      isMouseDownRef.current = false;
      onBlur?.(e);
    };

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
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        className={`text-right ${className || ""}`}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";
