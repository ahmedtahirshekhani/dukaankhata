import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DateTimePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | Date;
  onChange?: (date: string) => void;
}

const DateTimePicker = React.forwardRef<HTMLInputElement, DateTimePickerProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [date, setDate] = React.useState<Date>(() => {
      if (!value) return new Date();
      return typeof value === "string" ? new Date(value) : value;
    });

    const [hours, setHours] = React.useState(() => {
      const h = date.getHours();
      return h === 0 ? 12 : h > 12 ? h - 12 : h;
    });
    const [minutes, setMinutes] = React.useState(date.getMinutes());
    const [ampm, setAmpm] = React.useState(date.getHours() >= 12 ? "PM" : "AM");

    React.useEffect(() => {
      if (value) {
        const newDate = typeof value === "string" ? new Date(value) : value;
        setDate(newDate);
        const h = newDate.getHours();
        setHours(h === 0 ? 12 : h > 12 ? h - 12 : h);
        setMinutes(newDate.getMinutes());
        setAmpm(newDate.getHours() >= 12 ? "PM" : "AM");
      }
    }, [value]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = new Date(e.target.value);
      if (!isNaN(newDate.getTime())) {
        setDate(newDate);
      }
    };

    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newHours = parseInt(e.target.value) || 0;
      if (newHours < 1) newHours = 0;
      if (newHours > 12) newHours = 12;
      setHours(newHours);
    };

    const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newMinutes = parseInt(e.target.value) || 0;
      if (newMinutes < 0) newMinutes = 0;
      if (newMinutes > 59) newMinutes = 59;
      setMinutes(newMinutes);
    };

    const handleAmpmChange = (newAmpm: "AM" | "PM") => {
      setAmpm(newAmpm);
    };

    const handleApply = () => {
      // Convert 12-hour format to 24-hour format
      let newHours24 = hours;
      if (ampm === "PM" && hours !== 12) {
        newHours24 = hours + 12;
      } else if (ampm === "AM" && hours === 12) {
        newHours24 = 0;
      }

      const newDate = new Date(date);
      newDate.setHours(newHours24, minutes, 0, 0);

      // Check if date is in the future
      if (newDate > new Date()) {
        alert("Cannot select future date/time");
        return;
      }

      onChange?.(newDate.toISOString());
      setIsOpen(false);
    };

    const getDateString = () => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const getMaxDate = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          value={formatDateTime12Hour(date)}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-input rounded-md shadow-lg p-4 w-80">
            <div className="space-y-3">
              {/* Date Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-700">Date</label>
                <input
                  type="date"
                  value={getDateString()}
                  onChange={handleDateChange}
                  max={getMaxDate()}
                  className="w-full h-9 rounded-md border border-input px-3 py-1 text-sm"
                />
              </div>

              {/* Time Picker (12-hour format) */}
              <div>
                <label className="text-xs font-semibold text-gray-700">Time (12-hour format)</label>
                <div className="flex gap-2 items-center">
                  {/* Hours */}
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={String(hours).padStart(2, "0")}
                      onChange={handleHoursChange}
                      className="w-full h-9 rounded-md border border-input px-2 py-1 text-sm text-center font-mono"
                      placeholder="HH"
                    />
                  </div>

                  {/* Separator */}
                  <span className="text-lg font-bold">:</span>

                  {/* Minutes */}
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(minutes).padStart(2, "0")}
                      onChange={handleMinutesChange}
                      className="w-full h-9 rounded-md border border-input px-2 py-1 text-sm text-center font-mono"
                      placeholder="MM"
                    />
                  </div>

                  {/* AM/PM Toggle */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAmpmChange("AM")}
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-semibold transition-colors",
                        ampm === "AM"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      AM
                    </button>
                    <button
                      onClick={() => handleAmpmChange("PM")}
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-semibold transition-colors",
                        ampm === "PM"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 h-9 rounded-md bg-blue-500 text-white px-3 py-1 text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
DateTimePicker.displayName = "DateTimePicker";

/**
 * Format date to 12-hour format string (e.g., "Dec 7, 2025, 2:30 PM")
 */
export function formatDateTime12Hour(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  return dateObj.toLocaleString("en-US", options);
}

export { DateTimePicker };
