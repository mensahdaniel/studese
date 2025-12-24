/**
 * Snooze Menu Component
 *
 * A dropdown menu for snoozing task reminders:
 * - Preset snooze durations (5, 10, 15, 30 min, 1h, 2h)
 * - "Tomorrow at 9 AM" option
 * - Custom time picker
 * - Visual feedback on snooze status
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BellOff,
  Clock,
  Sun,
  Timer,
  AlarmClock,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSnooze } from "@/hooks/useEnhancedTasks";
import { SNOOZE_OPTIONS } from "@/types/tasks";
import type { Task } from "@/types/tasks";
import { format, addMinutes } from "date-fns";

// ============================================
// Types
// ============================================

interface SnoozeMenuProps {
  task: Task;
  reminderStage?: number;
  trigger?: React.ReactNode;
  onSnooze?: () => void;
  className?: string;
}

interface SnoozeOptionProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}

// ============================================
// Snooze Option Item
// ============================================

function SnoozeOption({ icon, label, description, onClick }: SnoozeOptionProps) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 cursor-pointer"
    >
      <div className="p-1.5 bg-muted rounded-lg shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </DropdownMenuItem>
  );
}

// ============================================
// Snooze Menu Component
// ============================================

export function SnoozeMenu({
  task,
  reminderStage = 0,
  trigger,
  onSnooze,
  className,
}: SnoozeMenuProps) {
  const { snooze, snoozeUntilTomorrow } = useSnooze();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [isSnoozing, setIsSnoozing] = useState(false);

  // Handle snooze action
  const handleSnooze = async (minutes: number) => {
    setIsSnoozing(true);
    const success = await snooze(task.id, minutes, reminderStage);
    setIsSnoozing(false);

    if (success) {
      setIsOpen(false);
      onSnooze?.();
    }
  };

  // Handle tomorrow snooze
  const handleSnoozeTomorrow = async () => {
    setIsSnoozing(true);
    const success = await snoozeUntilTomorrow(task.id, reminderStage);
    setIsSnoozing(false);

    if (success) {
      setIsOpen(false);
      onSnooze?.();
    }
  };

  // Handle custom snooze
  const handleCustomSnooze = async () => {
    if (customMinutes > 0) {
      await handleSnooze(customMinutes);
      setShowCustom(false);
    }
  };

  // Get time preview for a snooze duration
  const getTimePreview = (minutes: number): string => {
    const snoozeUntil = addMinutes(new Date(), minutes);
    return format(snoozeUntil, "h:mm a");
  };

  // Default trigger button
  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-2", className)}
      disabled={isSnoozing}
    >
      <BellOff className="h-4 w-4" />
      Snooze
    </Button>
  );

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-muted-foreground" />
            Snooze Reminder
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Quick Snooze Options */}
          <SnoozeOption
            icon={<Timer className="h-4 w-4 text-blue-500" />}
            label="5 minutes"
            description={`Until ${getTimePreview(5)}`}
            onClick={() => handleSnooze(5)}
          />

          <SnoozeOption
            icon={<Timer className="h-4 w-4 text-blue-500" />}
            label="15 minutes"
            description={`Until ${getTimePreview(15)}`}
            onClick={() => handleSnooze(15)}
          />

          <SnoozeOption
            icon={<Timer className="h-4 w-4 text-amber-500" />}
            label="30 minutes"
            description={`Until ${getTimePreview(30)}`}
            onClick={() => handleSnooze(30)}
          />

          <SnoozeOption
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="1 hour"
            description={`Until ${getTimePreview(60)}`}
            onClick={() => handleSnooze(60)}
          />

          <SnoozeOption
            icon={<Clock className="h-4 w-4 text-orange-500" />}
            label="2 hours"
            description={`Until ${getTimePreview(120)}`}
            onClick={() => handleSnooze(120)}
          />

          <DropdownMenuSeparator />

          {/* Tomorrow Option */}
          <SnoozeOption
            icon={<Sun className="h-4 w-4 text-yellow-500" />}
            label="Tomorrow at 9 AM"
            description="Start fresh tomorrow"
            onClick={handleSnoozeTomorrow}
          />

          <DropdownMenuSeparator />

          {/* Custom Time */}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setShowCustom(true);
              setIsOpen(false);
            }}
            className="flex items-center justify-between py-2.5 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-muted rounded-lg">
                <AlarmClock className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Custom time...</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Time Dialog */}
      <Dialog open={showCustom} onOpenChange={setShowCustom}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlarmClock className="h-5 w-5 text-primary" />
              Custom Snooze
            </DialogTitle>
            <DialogDescription>
              Choose how long to snooze this reminder.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minutes">Snooze for (minutes)</Label>
              <Input
                id="minutes"
                type="number"
                min={1}
                max={1440}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                className="text-lg text-center"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <Button
                  key={mins}
                  variant={customMinutes === mins ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCustomMinutes(mins)}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </Button>
              ))}
            </div>

            {/* Preview */}
            {customMinutes > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Reminder will appear at
                </p>
                <p className="text-lg font-semibold">
                  {getTimePreview(customMinutes)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCustom(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomSnooze}
              disabled={customMinutes <= 0 || isSnoozing}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Snooze Status Badge
// ============================================

interface SnoozeStatusProps {
  task: Task;
  className?: string;
}

export function SnoozeStatus({ task, className }: SnoozeStatusProps) {
  if (!task.snoozed_until) return null;

  const snoozeUntil = new Date(task.snoozed_until);
  const now = new Date();

  // If snooze has expired, don't show
  if (snoozeUntil <= now) return null;

  const timeRemaining = Math.floor((snoozeUntil.getTime() - now.getTime()) / 60000);

  let timeText: string;
  if (timeRemaining < 60) {
    timeText = `${timeRemaining}m`;
  } else if (timeRemaining < 1440) {
    timeText = `${Math.floor(timeRemaining / 60)}h`;
  } else {
    timeText = format(snoozeUntil, "MMM d");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        className
      )}
    >
      <BellOff className="h-3 w-3" />
      <span>Snoozed {timeText}</span>
    </div>
  );
}

// ============================================
// Snooze Button (Simple inline button)
// ============================================

interface SnoozeButtonProps {
  task: Task;
  reminderStage?: number;
  onSnooze?: () => void;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export function SnoozeButton({
  task,
  reminderStage,
  onSnooze,
  size = "sm",
  variant = "ghost",
  className,
}: SnoozeButtonProps) {
  return (
    <SnoozeMenu
      task={task}
      reminderStage={reminderStage}
      onSnooze={onSnooze}
      trigger={
        <Button variant={variant} size={size} className={cn("gap-1.5", className)}>
          <BellOff className="h-4 w-4" />
          Snooze
        </Button>
      }
    />
  );
}

export default SnoozeMenu;
