/**
 * Recurrence Configuration Component
 *
 * A comprehensive component for configuring recurring tasks:
 * - Daily, Weekly, Monthly, Yearly patterns
 * - Custom intervals
 * - Day of week selection for weekly
 * - End date or count
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Repeat,
  Calendar as CalendarIcon,
  ChevronDown,
  X,
  Check,
  Infinity as InfinityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";
import type { RecurrenceType } from "@/types/tasks";
import { WEEKDAYS, RECURRENCE_OPTIONS } from "@/types/tasks";

// ============================================
// Types
// ============================================

export interface RecurrenceConfig {
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceDays: number[];
  recurrenceEndDate: string | null;
  recurrenceEndType: "never" | "date" | "count";
  recurrenceCount?: number;
}

interface RecurrenceConfigProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  startDate?: Date;
  compact?: boolean;
  className?: string;
}

interface RecurrencePreviewProps {
  config: RecurrenceConfig;
  startDate: Date;
  className?: string;
}

// ============================================
// Default Config
// ============================================

export const DEFAULT_RECURRENCE_CONFIG: RecurrenceConfig = {
  isRecurring: false,
  recurrenceType: "daily",
  recurrenceInterval: 1,
  recurrenceDays: [1, 2, 3, 4, 5], // Weekdays by default
  recurrenceEndDate: null,
  recurrenceEndType: "never",
  recurrenceCount: 10,
};

// ============================================
// Recurrence Preview Component
// ============================================

export function RecurrencePreview({
  config,
  startDate,
  className,
}: RecurrencePreviewProps) {
  if (!config.isRecurring) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Does not repeat
      </span>
    );
  }

  // Build description
  let description = "";
  const interval = config.recurrenceInterval;

  switch (config.recurrenceType) {
    case "daily":
      description = interval === 1 ? "Every day" : `Every ${interval} days`;
      break;
    case "weekly":
      if (config.recurrenceDays.length === 7) {
        description = interval === 1 ? "Every day" : `Every ${interval} weeks`;
      } else if (config.recurrenceDays.length === 5 &&
        config.recurrenceDays.every((d) => d >= 1 && d <= 5)) {
        description = "Every weekday";
      } else {
        const dayNames = config.recurrenceDays
          .sort((a, b) => a - b)
          .map((d) => WEEKDAYS.find((w) => w.value === d)?.label || "")
          .join(", ");
        description =
          interval === 1
            ? `Every ${dayNames}`
            : `Every ${interval} weeks on ${dayNames}`;
      }
      break;
    case "monthly":
      description =
        interval === 1 ? "Every month" : `Every ${interval} months`;
      break;
    case "yearly":
      description = interval === 1 ? "Every year" : `Every ${interval} years`;
      break;
    default:
      description = "Custom";
  }

  // Add end info
  if (config.recurrenceEndType === "date" && config.recurrenceEndDate) {
    description += ` until ${format(new Date(config.recurrenceEndDate), "MMM d, yyyy")}`;
  } else if (config.recurrenceEndType === "count" && config.recurrenceCount) {
    description += `, ${config.recurrenceCount} times`;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Repeat className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm">{description}</span>
    </div>
  );
}

// ============================================
// Weekday Selector Component
// ============================================

interface WeekdaySelectorProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

function WeekdaySelector({ value, onChange, disabled }: WeekdaySelectorProps) {
  const toggleDay = (day: number) => {
    if (disabled) return;

    if (value.includes(day)) {
      // Don't allow deselecting all days
      if (value.length > 1) {
        onChange(value.filter((d) => d !== day));
      }
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((day) => (
        <button
          key={day.value}
          type="button"
          onClick={() => toggleDay(day.value)}
          disabled={disabled}
          className={cn(
            "w-9 h-9 rounded-full text-xs font-medium transition-colors",
            "flex items-center justify-center",
            value.includes(day.value)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {day.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// Main Recurrence Config Component
// ============================================

export function RecurrenceConfigComponent({
  value,
  onChange,
  startDate = new Date(),
  compact = false,
  className,
}: RecurrenceConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Update a single field
  const updateConfig = (updates: Partial<RecurrenceConfig>) => {
    onChange({ ...value, ...updates });
  };

  // Get next occurrences for preview
  const getNextOccurrences = (count: number): Date[] => {
    if (!value.isRecurring) return [];

    const occurrences: Date[] = [];
    let current = startDate;

    for (let i = 0; i < count; i++) {
      switch (value.recurrenceType) {
        case "daily":
          current = addDays(current, value.recurrenceInterval);
          break;
        case "weekly":
          current = addWeeks(current, value.recurrenceInterval);
          break;
        case "monthly":
          current = addMonths(current, value.recurrenceInterval);
          break;
        case "yearly":
          current = addYears(current, value.recurrenceInterval);
          break;
      }

      // Check end conditions
      if (value.recurrenceEndType === "date" && value.recurrenceEndDate) {
        if (current > new Date(value.recurrenceEndDate)) break;
      }

      occurrences.push(current);
    }

    return occurrences;
  };

  // Compact toggle mode
  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Repeat
          </Label>
          <Switch
            checked={value.isRecurring}
            onCheckedChange={(checked) => updateConfig({ isRecurring: checked })}
          />
        </div>

        {value.isRecurring && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                size="sm"
              >
                <RecurrencePreview config={value} startDate={startDate} />
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <RecurrenceConfigForm
                value={value}
                onChange={onChange}
                startDate={startDate}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Full form mode
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-medium">
          <Repeat className="h-5 w-5 text-primary" />
          Recurring Task
        </Label>
        <Switch
          checked={value.isRecurring}
          onCheckedChange={(checked) => updateConfig({ isRecurring: checked })}
        />
      </div>

      {value.isRecurring && (
        <RecurrenceConfigForm
          value={value}
          onChange={onChange}
          startDate={startDate}
        />
      )}
    </div>
  );
}

// ============================================
// Recurrence Config Form
// ============================================

interface RecurrenceConfigFormProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  startDate: Date;
}

function RecurrenceConfigForm({
  value,
  onChange,
  startDate,
}: RecurrenceConfigFormProps) {
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const updateConfig = (updates: Partial<RecurrenceConfig>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className="space-y-4">
      {/* Frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Repeat every</Label>
          <Input
            type="number"
            min={1}
            max={99}
            value={value.recurrenceInterval}
            onChange={(e) =>
              updateConfig({ recurrenceInterval: parseInt(e.target.value) || 1 })
            }
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Frequency</Label>
          <Select
            value={value.recurrenceType}
            onValueChange={(val) =>
              updateConfig({ recurrenceType: val as RecurrenceType })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {value.recurrenceInterval === 1
                    ? opt.label.replace(/ly$/, "")
                    : opt.label.replace(/ly$/, "s")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day Selection for Weekly */}
      {value.recurrenceType === "weekly" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Repeat on</Label>
          <WeekdaySelector
            value={value.recurrenceDays}
            onChange={(days) => updateConfig({ recurrenceDays: days })}
          />
        </div>
      )}

      {/* End Options */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Ends</Label>

        <div className="space-y-2">
          {/* Never */}
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={value.recurrenceEndType === "never"}
              onChange={() => updateConfig({ recurrenceEndType: "never" })}
              className="h-4 w-4"
            />
            <div className="flex items-center gap-2">
              <InfinityIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Never</span>
            </div>
          </label>

          {/* On Date */}
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={value.recurrenceEndType === "date"}
              onChange={() => updateConfig({ recurrenceEndType: "date" })}
              className="h-4 w-4"
            />
            <div className="flex items-center gap-2 flex-1">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">On date</span>
              {value.recurrenceEndType === "date" && (
                <Popover open={showEndDatePicker} onOpenChange={setShowEndDatePicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                    >
                      {value.recurrenceEndDate
                        ? format(new Date(value.recurrenceEndDate), "MMM d, yyyy")
                        : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={
                        value.recurrenceEndDate
                          ? new Date(value.recurrenceEndDate)
                          : undefined
                      }
                      onSelect={(date) => {
                        updateConfig({
                          recurrenceEndDate: date?.toISOString() || null,
                        });
                        setShowEndDatePicker(false);
                      }}
                      disabled={(date) => date < startDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </label>

          {/* After X occurrences */}
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={value.recurrenceEndType === "count"}
              onChange={() => updateConfig({ recurrenceEndType: "count" })}
              className="h-4 w-4"
            />
            <div className="flex items-center gap-2 flex-1">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">After</span>
              {value.recurrenceEndType === "count" && (
                <div className="flex items-center gap-2 ml-auto">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={value.recurrenceCount || 10}
                    onChange={(e) =>
                      updateConfig({
                        recurrenceCount: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-16 h-7 text-xs"
                  />
                  <span className="text-sm text-muted-foreground">
                    occurrences
                  </span>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <RecurrencePreview
          config={value}
          startDate={startDate}
          className="text-sm"
        />
      </div>
    </div>
  );
}

// ============================================
// Quick Recurrence Selector (for inline use)
// ============================================

interface QuickRecurrenceSelectorProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  className?: string;
}

export function QuickRecurrenceSelector({
  value,
  onChange,
  className,
}: QuickRecurrenceSelectorProps) {
  const presets = [
    { label: "Once", config: { ...DEFAULT_RECURRENCE_CONFIG, isRecurring: false } },
    {
      label: "Daily",
      config: {
        ...DEFAULT_RECURRENCE_CONFIG,
        isRecurring: true,
        recurrenceType: "daily" as RecurrenceType,
        recurrenceInterval: 1,
      },
    },
    {
      label: "Weekdays",
      config: {
        ...DEFAULT_RECURRENCE_CONFIG,
        isRecurring: true,
        recurrenceType: "weekly" as RecurrenceType,
        recurrenceInterval: 1,
        recurrenceDays: [1, 2, 3, 4, 5],
      },
    },
    {
      label: "Weekly",
      config: {
        ...DEFAULT_RECURRENCE_CONFIG,
        isRecurring: true,
        recurrenceType: "weekly" as RecurrenceType,
        recurrenceInterval: 1,
        recurrenceDays: [new Date().getDay()],
      },
    },
    {
      label: "Monthly",
      config: {
        ...DEFAULT_RECURRENCE_CONFIG,
        isRecurring: true,
        recurrenceType: "monthly" as RecurrenceType,
        recurrenceInterval: 1,
      },
    },
  ];

  const isPresetSelected = (preset: typeof presets[0]) => {
    if (!preset.config.isRecurring && !value.isRecurring) return true;
    if (preset.config.isRecurring !== value.isRecurring) return false;
    if (preset.config.recurrenceType !== value.recurrenceType) return false;
    if (preset.config.recurrenceInterval !== value.recurrenceInterval) return false;
    if (
      preset.config.recurrenceType === "weekly" &&
      JSON.stringify(preset.config.recurrenceDays) !==
      JSON.stringify(value.recurrenceDays)
    ) {
      return false;
    }
    return true;
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant={isPresetSelected(preset) ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(preset.config)}
          className="gap-1.5"
        >
          {preset.label}
          {isPresetSelected(preset) && <Check className="h-3 w-3" />}
        </Button>
      ))}
    </div>
  );
}

export default RecurrenceConfigComponent;
