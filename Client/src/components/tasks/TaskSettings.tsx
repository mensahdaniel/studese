/**
 * Task Settings Component
 *
 * Comprehensive settings panel for task management:
 * - Quiet Hours / Do Not Disturb
 * - Pomodoro timer settings
 * - Notification preferences
 * - Default reminder settings
 * - UI preferences
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Moon,
  Sun,
  Bell,
  BellOff,
  Timer,
  Coffee,
  Brain,
  Volume2,
  VolumeX,
  Vibrate,
  Clock,
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { taskPreferencesService } from "@/services/taskPreferencesService";
import type { UserPreferences, UserPreferencesUpdate } from "@/types/tasks";
import { WEEKDAYS, PRE_REMINDER_OPTIONS } from "@/types/tasks";

// ============================================
// Types
// ============================================

interface TaskSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

// ============================================
// Settings Section Component
// ============================================

function SettingsSection({
  title,
  description,
  icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-muted rounded-lg shrink-0">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}

// ============================================
// Time Input Component
// ============================================

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

function TimeInput({ value, onChange, label, disabled }: TimeInputProps) {
  // Convert "HH:MM:SS" to "HH:MM" for input
  const inputValue = value ? value.slice(0, 5) : "00:00";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert "HH:MM" back to "HH:MM:SS"
    onChange(e.target.value + ":00");
  };

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Input
        type="time"
        value={inputValue}
        onChange={handleChange}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

// ============================================
// Day Selector Component
// ============================================

interface DaySelectorProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

function DaySelector({ value, onChange, disabled }: DaySelectorProps) {
  const toggleDay = (day: number) => {
    if (disabled) return;

    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex gap-1.5">
      {WEEKDAYS.map((day) => (
        <button
          key={day.value}
          type="button"
          onClick={() => toggleDay(day.value)}
          disabled={disabled}
          className={cn(
            "w-8 h-8 rounded-full text-xs font-medium transition-colors",
            "flex items-center justify-center",
            value.includes(day.value)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={day.fullLabel}
        >
          {day.label.charAt(0)}
        </button>
      ))}
    </div>
  );
}

// ============================================
// Main Task Settings Component
// ============================================

export function TaskSettings({ open, onOpenChange }: TaskSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      setLoading(true);
      await taskPreferencesService.initialize();
      const prefs = taskPreferencesService.getPreferences();
      setPreferences(prefs);
      setLoading(false);
    };

    if (open) {
      loadPrefs();
    }
  }, [open]);

  // Update a preference field
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
    setHasChanges(true);
  };

  // Save all changes
  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      const updates: UserPreferencesUpdate = {
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start,
        quiet_hours_end: preferences.quiet_hours_end,
        quiet_hours_days: preferences.quiet_hours_days,
        default_reminder_minutes: preferences.default_reminder_minutes,
        pomodoro_work_minutes: preferences.pomodoro_work_minutes,
        pomodoro_short_break_minutes: preferences.pomodoro_short_break_minutes,
        pomodoro_long_break_minutes: preferences.pomodoro_long_break_minutes,
        pomodoro_sessions_before_long_break: preferences.pomodoro_sessions_before_long_break,
        notification_sound_enabled: preferences.notification_sound_enabled,
        notification_vibration_enabled: preferences.notification_vibration_enabled,
        batch_notifications: preferences.batch_notifications,
        default_task_view: preferences.default_task_view,
        show_completed_tasks: preferences.show_completed_tasks,
      };

      await taskPreferencesService.updatePreferences(updates);

      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated.",
      });

      setHasChanges(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00:00",
      quiet_hours_end: "07:00:00",
      quiet_hours_days: [0, 1, 2, 3, 4, 5, 6],
      default_reminder_minutes: [15],
      pomodoro_work_minutes: 25,
      pomodoro_short_break_minutes: 5,
      pomodoro_long_break_minutes: 15,
      pomodoro_sessions_before_long_break: 4,
      notification_sound_enabled: true,
      notification_vibration_enabled: true,
      batch_notifications: false,
      default_task_view: "list",
      show_completed_tasks: true,
    });
    setHasChanges(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Task Settings
          </DialogTitle>
          <DialogDescription>
            Customize your task management experience.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : preferences ? (
          <div className="flex-1 overflow-y-auto py-4 space-y-8">
            {/* Quiet Hours Section */}
            <SettingsSection
              title="Quiet Hours"
              description="Silence notifications during specific times"
              icon={<Moon className="h-5 w-5 text-indigo-500" />}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Quiet Hours</p>
                    <p className="text-xs text-muted-foreground">
                      No notifications during quiet hours
                    </p>
                  </div>
                  <Switch
                    checked={preferences.quiet_hours_enabled}
                    onCheckedChange={(checked) =>
                      updatePreference("quiet_hours_enabled", checked)
                    }
                  />
                </div>

                {preferences.quiet_hours_enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <TimeInput
                        label="Start time"
                        value={preferences.quiet_hours_start}
                        onChange={(val) => updatePreference("quiet_hours_start", val)}
                      />
                      <TimeInput
                        label="End time"
                        value={preferences.quiet_hours_end}
                        onChange={(val) => updatePreference("quiet_hours_end", val)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Active on days
                      </Label>
                      <DaySelector
                        value={preferences.quiet_hours_days}
                        onChange={(days) => updatePreference("quiet_hours_days", days)}
                      />
                    </div>

                    {/* Quiet Hours Status */}
                    <div
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg text-sm",
                        taskPreferencesService.isInQuietHours()
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                          : "bg-muted"
                      )}
                    >
                      {taskPreferencesService.isInQuietHours() ? (
                        <>
                          <BellOff className="h-4 w-4" />
                          Quiet hours are currently active
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4" />
                          Notifications are enabled
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </SettingsSection>

            <Separator />

            {/* Pomodoro Settings */}
            <SettingsSection
              title="Focus Timer (Pomodoro)"
              description="Customize your focus session durations"
              icon={<Timer className="h-5 w-5 text-primary" />}
            >
              <div className="space-y-6">
                {/* Work Duration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <Label>Focus duration</Label>
                    </div>
                    <Badge variant="secondary">
                      {preferences.pomodoro_work_minutes} min
                    </Badge>
                  </div>
                  <Slider
                    value={[preferences.pomodoro_work_minutes]}
                    onValueChange={([val]) =>
                      updatePreference("pomodoro_work_minutes", val)
                    }
                    min={5}
                    max={60}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Short Break */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-emerald-500" />
                      <Label>Short break</Label>
                    </div>
                    <Badge variant="secondary">
                      {preferences.pomodoro_short_break_minutes} min
                    </Badge>
                  </div>
                  <Slider
                    value={[preferences.pomodoro_short_break_minutes]}
                    onValueChange={([val]) =>
                      updatePreference("pomodoro_short_break_minutes", val)
                    }
                    min={1}
                    max={15}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Long Break */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-blue-500" />
                      <Label>Long break</Label>
                    </div>
                    <Badge variant="secondary">
                      {preferences.pomodoro_long_break_minutes} min
                    </Badge>
                  </div>
                  <Slider
                    value={[preferences.pomodoro_long_break_minutes]}
                    onValueChange={([val]) =>
                      updatePreference("pomodoro_long_break_minutes", val)
                    }
                    min={5}
                    max={30}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Sessions before long break */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Sessions before long break</Label>
                    <Badge variant="secondary">
                      {preferences.pomodoro_sessions_before_long_break}
                    </Badge>
                  </div>
                  <Slider
                    value={[preferences.pomodoro_sessions_before_long_break]}
                    onValueChange={([val]) =>
                      updatePreference("pomodoro_sessions_before_long_break", val)
                    }
                    min={2}
                    max={8}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </SettingsSection>

            <Separator />

            {/* Notification Preferences */}
            <SettingsSection
              title="Notifications"
              description="Control how you receive reminders"
              icon={<Bell className="h-5 w-5 text-amber-500" />}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Sound</p>
                      <p className="text-xs text-muted-foreground">
                        Play sound for reminders
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.notification_sound_enabled}
                    onCheckedChange={(checked) =>
                      updatePreference("notification_sound_enabled", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vibrate className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Vibration</p>
                      <p className="text-xs text-muted-foreground">
                        Vibrate on mobile devices
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.notification_vibration_enabled}
                    onCheckedChange={(checked) =>
                      updatePreference("notification_vibration_enabled", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Batch notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Group multiple notifications together
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.batch_notifications}
                    onCheckedChange={(checked) =>
                      updatePreference("batch_notifications", checked)
                    }
                  />
                </div>
              </div>
            </SettingsSection>

            <Separator />

            {/* Default Reminders */}
            <SettingsSection
              title="Default Reminders"
              description="Set default reminder times for new tasks"
              icon={<Clock className="h-5 w-5 text-teal-500" />}
            >
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Remind me before task is due
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PRE_REMINDER_OPTIONS.map((option) => (
                    <Button
                      key={option.minutes}
                      type="button"
                      variant={
                        preferences.default_reminder_minutes.includes(option.minutes)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        const current = preferences.default_reminder_minutes;
                        if (current.includes(option.minutes)) {
                          if (current.length > 1) {
                            updatePreference(
                              "default_reminder_minutes",
                              current.filter((m) => m !== option.minutes)
                            );
                          }
                        } else {
                          updatePreference(
                            "default_reminder_minutes",
                            [...current, option.minutes].sort((a, b) => b - a)
                          );
                        }
                      }}
                    >
                      {option.label.replace(" before", "")}
                    </Button>
                  ))}
                </div>
              </div>
            </SettingsSection>

            <Separator />

            {/* Display Preferences */}
            <SettingsSection
              title="Display"
              description="Customize how tasks are shown"
              icon={<Sun className="h-5 w-5 text-yellow-500" />}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Default view</p>
                    <p className="text-xs text-muted-foreground">
                      How tasks are displayed
                    </p>
                  </div>
                  <Select
                    value={preferences.default_task_view}
                    onValueChange={(val: "list" | "grid" | "kanban") =>
                      updatePreference("default_task_view", val)
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="kanban">Kanban</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Show completed tasks</p>
                    <p className="text-xs text-muted-foreground">
                      Display finished tasks in lists
                    </p>
                  </div>
                  <Switch
                    checked={preferences.show_completed_tasks}
                    onCheckedChange={(checked) =>
                      updatePreference("show_completed_tasks", checked)
                    }
                  />
                </div>
              </div>
            </SettingsSection>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Failed to load settings. Please try again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}

        {preferences && (
          <DialogFooter className="border-t pt-4 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Settings Button (for triggering the dialog)
// ============================================

interface TaskSettingsButtonProps {
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export function TaskSettingsButton({
  className,
  variant = "ghost",
  size = "icon",
}: TaskSettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Settings className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">Settings</span>}
      </Button>
      <TaskSettings open={open} onOpenChange={setOpen} />
    </>
  );
}

export default TaskSettings;
