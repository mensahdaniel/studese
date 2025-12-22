import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Palette,
  Circle,
  Grid3X3,
  AlignJustify,
  MoreHorizontal,
  Minus,
} from "lucide-react";
import type { Tool, PaperTemplate } from "./DrawingCanvas";

// Preset colors inspired by GoodNotes
const COLORS = [
  { name: "Black", value: "#1a1a2e" },
  { name: "Dark Gray", value: "#4a4a5e" },
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#dc2626" },
  { name: "Green", value: "#16a34a" },
  { name: "Orange", value: "#ea580c" },
  { name: "Purple", value: "#9333ea" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#0d9488" },
  { name: "Yellow", value: "#ca8a04" },
];

// Highlighter colors (semi-transparent)
const HIGHLIGHTER_COLORS = [
  { name: "Yellow", value: "rgb(253, 224, 71)" },
  { name: "Green", value: "rgb(134, 239, 172)" },
  { name: "Blue", value: "rgb(147, 197, 253)" },
  { name: "Pink", value: "rgb(249, 168, 212)" },
  { name: "Orange", value: "rgb(253, 186, 116)" },
  { name: "Purple", value: "rgb(196, 181, 253)" },
];

// Paper templates
const TEMPLATES: { id: PaperTemplate; name: string; icon: React.ReactNode }[] = [
  { id: "blank", name: "Blank", icon: <div className="w-4 h-4 border rounded" /> },
  { id: "lined", name: "Lined", icon: <AlignJustify className="h-4 w-4" /> },
  { id: "grid", name: "Grid", icon: <Grid3X3 className="h-4 w-4" /> },
  { id: "dotted", name: "Dotted", icon: <MoreHorizontal className="h-4 w-4" /> },
  { id: "cornell", name: "Cornell", icon: <div className="w-4 h-4 border-l-2 border-b-2 border-primary" /> },
];

// Background colors
const BACKGROUNDS = [
  { name: "White", value: "#ffffff" },
  { name: "Cream", value: "#fef9e7" },
  { name: "Light Blue", value: "#e8f4f8" },
  { name: "Light Gray", value: "#f5f5f5" },
  { name: "Light Green", value: "#ecfdf5" },
  { name: "Dark", value: "#1f2937" },
];

interface CanvasToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  template: PaperTemplate;
  setTemplate: (template: PaperTemplate) => void;
  background: string;
  setBackground: (background: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  className?: string;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  template,
  setTemplate,
  background,
  setBackground,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  className,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools: { id: Tool; name: string; icon: React.ReactNode }[] = [
    { id: "pen", name: "Pen", icon: <Pen className="h-5 w-5" /> },
    { id: "pencil", name: "Pencil", icon: <Pencil className="h-5 w-5" /> },
    { id: "highlighter", name: "Highlighter", icon: <Highlighter className="h-5 w-5" /> },
    { id: "eraser", name: "Eraser", icon: <Eraser className="h-5 w-5" /> },
  ];

  const currentColors = tool === "highlighter" ? HIGHLIGHTER_COLORS : COLORS;

  return (
    <div
      className={cn(
        "flex items-center bg-background/95 backdrop-blur-sm border rounded-2xl shadow-lg p-1.5 sm:p-2",
        "max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none",
        className
      )}
    >
      {/* Drawing Tools - Primary actions first on mobile */}
      <div className="flex items-center gap-0.5 sm:gap-1 px-0.5 sm:px-1 shrink-0">
        {tools.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <Button
                variant={tool === t.id ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "h-9 w-9 sm:h-10 sm:w-10 rounded-xl transition-all shrink-0",
                  tool === t.id && "bg-primary/10 text-primary shadow-sm"
                )}
                onClick={() => setTool(t.id)}
              >
                {t.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6 sm:h-8 shrink-0" />

      {/* Color Picker */}
      {tool !== "eraser" && (
        <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0"
                >
                  <div
                    className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Color</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-3" align="center">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {tool === "highlighter" ? "Highlighter Color" : "Ink Color"}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {currentColors.map((c) => (
                  <Tooltip key={c.value}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition-all hover:scale-110",
                          color === c.value
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-white shadow"
                        )}
                        style={{ backgroundColor: c.value }}
                        onClick={() => {
                          setColor(c.value);
                          setShowColorPicker(false);
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{c.name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Size Slider */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0">
                <Circle
                  className="text-foreground"
                  style={{
                    width: Math.max(8, Math.min(20, size * 2)),
                    height: Math.max(8, Math.min(20, size * 2)),
                  }}
                  fill="currentColor"
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Size</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-48 p-4" align="center">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Stroke Size</p>
              <span className="text-sm text-muted-foreground">{size}px</span>
            </div>
            <div className="flex items-center gap-3">
              <Minus className="h-3 w-3 text-muted-foreground" />
              <Slider
                value={[size]}
                onValueChange={(v) => setSize(v[0])}
                min={1}
                max={20}
                step={1}
                className="flex-1"
              />
              <Circle className="h-4 w-4 text-muted-foreground" fill="currentColor" />
            </div>
            {/* Size presets */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {[2, 4, 8, 12, 16].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "rounded-full bg-foreground transition-all hover:scale-110",
                    size === s && "ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ width: s + 6, height: s + 6 }}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 sm:h-8 shrink-0" />

      {/* Paper Template */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0">
                <Grid3X3 className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Paper</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64 p-4" align="center">
          <div className="space-y-4">
            {/* Templates */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Paper Template</p>
              <div className="grid grid-cols-5 gap-2">
                {TEMPLATES.map((t) => (
                  <Tooltip key={t.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all",
                          template === t.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setTemplate(t.id)}
                      >
                        {t.icon}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t.name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Background Color */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Background</p>
              <div className="grid grid-cols-6 gap-2">
                {BACKGROUNDS.map((b) => (
                  <Tooltip key={b.value}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "h-8 w-8 rounded-lg border-2 transition-all",
                          background === b.value
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        )}
                        style={{ backgroundColor: b.value }}
                        onClick={() => setBackground(b.value)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{b.name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* More Options - Contains Undo/Redo/Clear on mobile, just Clear on desktop */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shrink-0 sm:hidden">
            <Palette className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="end">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
              Redo
            </Button>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
              Clear Canvas
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Desktop: Show Undo/Redo buttons inline */}
      <div className="hidden sm:flex items-center gap-1 px-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        {/* Desktop More Options */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <Palette className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
              Clear Canvas
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default CanvasToolbar;
