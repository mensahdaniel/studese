/**
 * Focus Timer Component (Pomodoro)
 *
 * A beautiful, fully-featured Pomodoro timer with:
 * - Work/Break session types
 * - Visual progress ring
 * - Task association
 * - Session statistics
 * - Keyboard shortcuts
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Coffee,
  Brain,
  Target,
  Timer,
  Settings,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTimer } from "@/hooks/useEnhancedTasks";
import type { Task } from "@/types/tasks";

// ============================================
// Types
// ============================================

interface FocusTimerProps {
  task?: Task;
  tasks?: Task[];
  compact?: boolean;
  onClose?: () => void;
  className?: string;
}

// ============================================
// Focus Timer Component
// ============================================

export function FocusTimer({
  task,
  tasks = [],
  compact = false,
  onClose,
  className,
}: FocusTimerProps) {
  const {
    isRunning,
    isPaused,
    sessionType,
    timeRemaining,
    totalTime,
    sessionNumber,
    taskId,
    taskTitle,
    formattedTime,
    progress,
    start,
    pause,
    resume,
    reset,
    skip,
    switchTo,
    setTask,
    settings,
  } = useFocusTimer();

  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(task?.id || null);

  // Set initial task
  useEffect(() => {
    if (task) {
      setSelectedTaskId(task.id);
      setTask(task.id, task.title);
    }
  }, [task, setTask]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          if (isRunning) pause();
          else if (isPaused) resume();
          else start(selectedTaskId || undefined, taskTitle || undefined);
          break;
        case "r":
          if (e.ctrlKey || e.metaKey) return;
          reset();
          break;
        case "s":
          if (e.ctrlKey || e.metaKey) return;
          skip();
          break;
        case "escape":
          if (onClose) onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isPaused, start, pause, resume, reset, skip, selectedTaskId, taskTitle, onClose]);

  // Handle task selection
  const handleTaskSelect = (value: string) => {
    const selected = tasks.find((t) => t.id === value);
    if (selected) {
      setSelectedTaskId(selected.id);
      setTask(selected.id, selected.title);
    } else {
      setSelectedTaskId(null);
      setTask(null, null);
    }
  };

  // Handle primary action
  const handlePrimaryAction = () => {
    if (isRunning) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      start(selectedTaskId || undefined, taskTitle || undefined);
    }
  };

  // Get session info
  const getSessionInfo = () => {
    switch (sessionType) {
      case "work":
        return {
          label: "Focus Time",
          icon: Brain,
          color: "text-primary",
          bg: "bg-primary/10",
          ring: "stroke-primary",
        };
      case "short_break":
        return {
          label: "Short Break",
          icon: Coffee,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          ring: "stroke-emerald-500",
        };
      case "long_break":
        return {
          label: "Long Break",
          icon: Coffee,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
          ring: "stroke-blue-500",
        };
    }
  };

  const sessionInfo = getSessionInfo();
  const SessionIcon = sessionInfo.icon;

  // Calculate ring progress
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Compact view for inline display
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="3"
              className="stroke-muted"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 20}
              strokeDashoffset={(2 * Math.PI * 20) - (progress / 100) * (2 * Math.PI * 20)}
              strokeLinecap="round"
              className={sessionInfo.ring}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <SessionIcon className={cn("h-4 w-4", sessionInfo.color)} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{formattedTime}</p>
          <p className="text-xs text-muted-foreground truncate">
            {sessionInfo.label}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handlePrimaryAction}
        >
          {isRunning ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Full view
  return (
    <Card className={cn("border-0 shadow-lg", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5 text-primary" />
            Focus Timer
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Session Type Tabs */}
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant={sessionType === "work" ? "default" : "outline"}
            onClick={() => !isRunning && switchTo("work")}
            disabled={isRunning || isPaused}
            className="gap-1.5"
          >
            <Brain className="h-4 w-4" />
            Focus
          </Button>
          <Button
            size="sm"
            variant={sessionType === "short_break" ? "default" : "outline"}
            onClick={() => !isRunning && switchTo("short_break")}
            disabled={isRunning || isPaused}
            className="gap-1.5"
          >
            <Coffee className="h-4 w-4" />
            Short Break
          </Button>
          <Button
            size="sm"
            variant={sessionType === "long_break" ? "default" : "outline"}
            onClick={() => !isRunning && switchTo("long_break")}
            disabled={isRunning || isPaused}
            className="gap-1.5"
          >
            <Coffee className="h-4 w-4" />
            Long Break
          </Button>
        </div>

        {/* Timer Display */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Progress Ring */}
            <svg className="w-64 h-64 -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={cn(sessionInfo.ring, "transition-all duration-1000")}
              />
            </svg>

            {/* Timer Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tracking-tight">
                {formattedTime}
              </span>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className={cn("gap-1", sessionInfo.bg)}>
                  <SessionIcon className={cn("h-3 w-3", sessionInfo.color)} />
                  {sessionInfo.label}
                </Badge>
              </div>
              {sessionType === "work" && (
                <p className="text-sm text-muted-foreground mt-2">
                  Session {sessionNumber} of {settings.sessionsBeforeLongBreak}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Task Selection */}
        {tasks.length > 0 && !isRunning && !isPaused && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Working on:</label>
            <Select value={selectedTaskId || ""} onValueChange={handleTaskSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific task</SelectItem>
                {tasks
                  .filter((t) => !t.completed)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <Target className="h-3 w-3" />
                        {t.title}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Current Task Display */}
        {(isRunning || isPaused) && taskTitle && (
          <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{taskTitle}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            size="icon"
            variant="outline"
            className="h-12 w-12 rounded-full"
            onClick={reset}
            disabled={!isRunning && !isPaused}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>

          <Button
            size="icon"
            className={cn(
              "h-16 w-16 rounded-full shadow-lg",
              isRunning && "bg-amber-500 hover:bg-amber-600"
            )}
            onClick={handlePrimaryAction}
          >
            {isRunning ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-1" />
            )}
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="h-12 w-12 rounded-full"
            onClick={skip}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Keyboard Hints */}
        {expanded && (
          <div className="flex flex-wrap justify-center gap-2 pt-4 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Space</kbd>
              Start/Pause
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">R</kbd>
              Reset
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">S</kbd>
              Skip
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Focus Timer Dialog
// ============================================

interface FocusTimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  tasks?: Task[];
}

export function FocusTimerDialog({
  open,
  onOpenChange,
  task,
  tasks = [],
}: FocusTimerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Focus Timer</DialogTitle>
        <FocusTimer
          task={task}
          tasks={tasks}
          onClose={() => onOpenChange(false)}
          className="border-0 shadow-none"
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Mini Focus Timer (for sidebar/floating)
// ============================================

export function MiniFocusTimer({ className }: { className?: string }) {
  const {
    isRunning,
    isPaused,
    sessionType,
    formattedTime,
    progress,
    start,
    pause,
    resume,
  } = useFocusTimer();

  const [showFull, setShowFull] = useState(false);

  // Handle click on the timer display (opens dialog)
  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFull(true);
  };

  // Handle click on the play/pause button
  const handlePlayPauseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRunning && !isPaused) {
      // Not started yet - open dialog to configure
      setShowFull(true);
    } else if (isRunning) {
      pause();
    } else {
      resume();
    }
  };

  const getColor = () => {
    switch (sessionType) {
      case "work":
        return "bg-primary";
      case "short_break":
        return "bg-emerald-500";
      case "long_break":
        return "bg-blue-500";
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg transition-all",
          "hover:bg-muted/50",
          className
        )}
      >
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPauseClick}
          className={cn(
            "relative w-8 h-8 rounded-full transition-all",
            "hover:bg-muted active:scale-95",
            isRunning && "animate-pulse"
          )}
        >
          <svg className="w-8 h-8 -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              strokeWidth="2"
              className="stroke-muted"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              strokeWidth="2"
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={(2 * Math.PI * 14) - (progress / 100) * (2 * Math.PI * 14)}
              strokeLinecap="round"
              className={getColor().replace("bg-", "stroke-")}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {isRunning ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3 ml-0.5" />
            )}
          </div>
        </button>

        {/* Timer Display - Click to open full dialog */}
        <button
          onClick={handleTimerClick}
          className="px-2 py-1 rounded hover:bg-muted active:scale-95 transition-all"
        >
          <span className="text-sm font-mono">{formattedTime}</span>
        </button>
      </div>

      <FocusTimerDialog open={showFull} onOpenChange={setShowFull} />
    </>
  );
}

export default FocusTimer;
