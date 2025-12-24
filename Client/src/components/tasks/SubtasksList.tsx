/**
 * Subtasks List Component
 *
 * A checklist component for managing subtasks within a task:
 * - Add/edit/delete subtasks
 * - Toggle completion
 * - Drag to reorder
 * - Progress indicator
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Check,
  X,
  GripVertical,
  Trash2,
  Circle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Subtask, Task, TaskUpdate } from "@/types/tasks";
import { useSubtasks } from "@/hooks/useEnhancedTasks";

// ============================================
// Types
// ============================================

interface SubtasksListProps {
  task: Task;
  onUpdate: (updates: TaskUpdate) => Promise<Task | null>;
  compact?: boolean;
  className?: string;
}

interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (title: string) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

// ============================================
// Subtask Item Component
// ============================================

function SubtaskItem({
  subtask,
  onToggle,
  onDelete,
  onUpdate,
  isDragging,
  dragHandleProps,
}: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdate(trimmed);
    } else {
      setEditValue(subtask.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(subtask.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 py-2 px-2 rounded-lg transition-colors",
        "hover:bg-muted/50",
        isDragging && "bg-muted shadow-lg",
        subtask.completed && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <div
        {...dragHandleProps}
        className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="shrink-0 transition-transform active:scale-90"
      >
        {subtask.completed ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
        )}
      </button>

      {/* Title */}
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span
          className={cn(
            "flex-1 text-sm cursor-pointer",
            subtask.completed && "line-through text-muted-foreground"
          )}
          onClick={() => !subtask.completed && setIsEditing(true)}
        >
          {subtask.title}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && !subtask.completed && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Subtasks List Component
// ============================================

export function SubtasksList({
  task,
  onUpdate,
  compact = false,
  className,
}: SubtasksListProps) {
  const {
    subtasks,
    progress,
    addSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
  } = useSubtasks(task, onUpdate);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Handle add subtask
  const handleAdd = useCallback(async () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }

    await addSubtask(trimmed);
    setNewSubtaskTitle("");
    // Keep adding mode open for quick entry
  }, [newSubtaskTitle, addSubtask]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    } else if (e.key === "Escape") {
      setNewSubtaskTitle("");
      setIsAdding(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    reorderSubtasks(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // Compact view - just show progress
  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "flex items-center gap-2 w-full p-2 rounded-lg",
          "hover:bg-muted/50 transition-colors",
          className
        )}
      >
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 flex items-center gap-2">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground">
            {subtasks.filter((s) => s.completed).length}/{subtasks.length}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Subtasks ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {subtasks.length > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 w-16" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          )}
          {compact && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Subtasks List */}
      {subtasks.length > 0 && (
        <div className="space-y-0.5 border rounded-lg p-1">
          {subtasks
            .sort((a, b) => a.order - b.order)
            .map((subtask, index) => (
              <div
                key={subtask.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <SubtaskItem
                  subtask={subtask}
                  onToggle={() => toggleSubtask(subtask.id)}
                  onDelete={() => deleteSubtask(subtask.id)}
                  onUpdate={(title) => updateSubtask(subtask.id, { title })}
                  isDragging={dragIndex === index}
                  dragHandleProps={{
                    onMouseDown: (e) => e.stopPropagation(),
                  }}
                />
              </div>
            ))}
        </div>
      )}

      {/* Add Subtask */}
      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter subtask..."
            className="h-9 flex-1"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newSubtaskTitle.trim()}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNewSubtaskTitle("");
              setIsAdding(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-dashed"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4" />
          Add Subtask
        </Button>
      )}
    </div>
  );
}

// ============================================
// Inline Subtask Progress (for task cards)
// ============================================

interface SubtaskProgressProps {
  subtasks: Subtask[];
  onClick?: () => void;
  className?: string;
}

export function SubtaskProgress({ subtasks, onClick, className }: SubtaskProgressProps) {
  if (!subtasks || subtasks.length === 0) return null;

  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
        "bg-muted/50 hover:bg-muted transition-colors",
        className
      )}
    >
      <ListChecks className="h-3 w-3 text-muted-foreground" />
      <span className={cn(completed === total && "text-emerald-600 dark:text-emerald-400")}>
        {completed}/{total}
      </span>
      {progress === 100 && <Check className="h-3 w-3 text-emerald-500" />}
    </button>
  );
}

export default SubtasksList;
