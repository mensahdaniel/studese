import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import getStroke from "perfect-freehand";

// Types
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  tool: Tool;
  opacity: number;
}

export type Tool = "pen" | "pencil" | "highlighter" | "eraser";

export type PaperTemplate = "blank" | "lined" | "grid" | "dotted" | "cornell";

export interface CanvasState {
  strokes: Stroke[];
  currentPage: number;
  totalPages: number;
  background: string;
  template: PaperTemplate;
}

export interface DrawingCanvasRef {
  exportAsImage: () => Promise<string>;
  exportState: () => CanvasState;
  importState: (state: CanvasState) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface DrawingCanvasProps {
  initialState?: CanvasState;
  onChange?: (state: CanvasState) => void;
  tool?: Tool;
  color?: string;
  size?: number;
  template?: PaperTemplate;
  background?: string;
  className?: string;
}

// Stroke options for different tools
const getStrokeOptions = (tool: Tool, size: number) => {
  const baseOptions = {
    size,
    smoothing: 0.5,
    thinning: 0.5,
    streamline: 0.5,
    easing: (t: number) => t,
    start: {
      taper: 0,
      cap: true,
    },
    end: {
      taper: 0,
      cap: true,
    },
  };

  switch (tool) {
    case "pen":
      return {
        ...baseOptions,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.4,
      };
    case "pencil":
      return {
        ...baseOptions,
        thinning: 0.3,
        smoothing: 0.7,
        streamline: 0.6,
        simulatePressure: true,
      };
    case "highlighter":
      return {
        ...baseOptions,
        size: size * 3,
        thinning: 0,
        smoothing: 0.8,
        streamline: 0.8,
      };
    case "eraser":
      return {
        ...baseOptions,
        size: size * 2,
        thinning: 0,
        smoothing: 0.5,
      };
    default:
      return baseOptions;
  }
};

// Convert stroke points to SVG path
const getSvgPathFromStroke = (points: number[][]) => {
  if (!points.length) return "";

  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Draw template on canvas
const drawTemplate = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: PaperTemplate,
  backgroundColor: string
) => {
  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const lineColor = "rgba(200, 210, 230, 0.5)";
  const spacing = 30;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;

  switch (template) {
    case "lined":
      for (let y = spacing * 3; y < height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width - 50, y);
        ctx.stroke();
      }
      // Left margin
      ctx.strokeStyle = "rgba(255, 100, 100, 0.3)";
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.lineTo(80, height);
      ctx.stroke();
      break;

    case "grid":
      for (let x = spacing; x < width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = spacing; y < height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      break;

    case "dotted":
      ctx.fillStyle = lineColor;
      for (let x = spacing; x < width; x += spacing) {
        for (let y = spacing; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case "cornell":
      // Main dividing line
      ctx.strokeStyle = "rgba(100, 100, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width * 0.3, 0);
      ctx.lineTo(width * 0.3, height * 0.7);
      ctx.stroke();
      // Bottom section
      ctx.beginPath();
      ctx.moveTo(0, height * 0.7);
      ctx.lineTo(width, height * 0.7);
      ctx.stroke();
      // Horizontal lines in main area
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      for (let y = 40; y < height * 0.7; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(width * 0.3 + 20, y);
        ctx.lineTo(width - 30, y);
        ctx.stroke();
      }
      break;

    case "blank":
    default:
      // Just the background color
      break;
  }
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (
    {
      initialState,
      onChange,
      tool = "pen",
      color = "#1a1a2e",
      size = 4,
      template = "blank",
      background = "#ffffff",
      className = "",
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>(initialState?.strokes || []);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<Stroke[][]>([initialState?.strokes || []]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [isReady, setIsReady] = useState(false);

    // Initialize canvas size
    useEffect(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({
              width: rect.width,
              height: rect.height,
            });
            setIsReady(true);
          }
        }
      };

      // Initial size update with a small delay to ensure DOM is ready
      updateSize();
      const timer = setTimeout(updateSize, 100);
      const timer2 = setTimeout(updateSize, 500);

      // Also update on resize
      window.addEventListener("resize", updateSize);

      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
        window.removeEventListener("resize", updateSize);
      };
    }, []);

    // Render canvas
    const renderCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !isReady) {
        console.log("Canvas not ready:", { canvas: !!canvas, isReady });
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      console.log("Rendering canvas:", { dimensions, dpr, strokesCount: strokes.length, currentStrokeLength: currentStroke.length });

      // Set canvas size
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;

      // Scale context for retina displays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw template/background
      drawTemplate(ctx, dimensions.width, dimensions.height, template, background);

      // Draw all completed strokes
      strokes.forEach((stroke) => {
        if (stroke.tool === "eraser") return;

        const strokePoints = stroke.points.map((p) => [p.x, p.y, p.pressure || 0.5]);
        const options = getStrokeOptions(stroke.tool, stroke.size);
        const outlinePoints = getStroke(strokePoints, options);

        if (outlinePoints.length === 0) return;

        const pathData = getSvgPathFromStroke(outlinePoints);

        if (stroke.tool === "highlighter") {
          ctx.globalAlpha = 0.4;
          ctx.globalCompositeOperation = "multiply";
        } else {
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        ctx.fillStyle = stroke.color;
        const path = new Path2D(pathData);
        ctx.fill(path);
      });

      // Reset composite operation
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Draw current stroke being drawn
      if (currentStroke.length > 1 && tool !== "eraser") {
        const strokePoints = currentStroke.map((p) => [p.x, p.y, p.pressure || 0.5]);
        const options = getStrokeOptions(tool, size);
        const outlinePoints = getStroke(strokePoints, options);

        if (outlinePoints.length > 0) {
          const pathData = getSvgPathFromStroke(outlinePoints);

          if (tool === "highlighter") {
            ctx.globalAlpha = 0.4;
            ctx.globalCompositeOperation = "multiply";
          } else {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
          }

          ctx.fillStyle = color;
          const path = new Path2D(pathData);
          ctx.fill(path);

          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }
    }, [strokes, currentStroke, template, background, tool, color, size, dimensions, isReady]);

    // Re-render when dependencies change
    useEffect(() => {
      renderCanvas();
    }, [renderCanvas]);

    // Get point from event
    const getPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure || 0.5,
      };
    };

    // Handle eraser
    const handleEraser = (point: Point) => {
      const eraserRadius = size * 3;
      setStrokes((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            return Math.sqrt(dx * dx + dy * dy) < eraserRadius;
          });
        })
      );
    };

    // Pointer event handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("Pointer down:", { tool, color, size, isReady, dimensions });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.setPointerCapture(e.pointerId);
      }

      const point = getPointFromEvent(e);
      console.log("Point:", point);
      setIsDrawing(true);

      if (tool === "eraser") {
        handleEraser(point);
      } else {
        setCurrentStroke([point]);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;

      e.preventDefault();
      e.stopPropagation();

      const point = getPointFromEvent(e);

      if (tool === "eraser") {
        handleEraser(point);
      } else {
        setCurrentStroke((prev) => {
          const newStroke = [...prev, point];
          console.log("Current stroke points:", newStroke.length);
          return newStroke;
        });
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;

      e.preventDefault();
      e.stopPropagation();

      console.log("Pointer up, stroke length:", currentStroke.length);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      setIsDrawing(false);

      if (tool !== "eraser" && currentStroke.length > 1) {
        console.log("Saving stroke with", currentStroke.length, "points");
        const newStroke: Stroke = {
          id: generateId(),
          points: [...currentStroke],
          color,
          size,
          tool,
          opacity: tool === "highlighter" ? 0.4 : 1,
        };

        const newStrokes = [...strokes, newStroke];
        setStrokes(newStrokes);

        // Update history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newStrokes);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        // Notify parent
        onChange?.({
          strokes: newStrokes,
          currentPage: 1,
          totalPages: 1,
          background,
          template,
        });
      } else if (tool === "eraser") {
        // Update history after erasing
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([...strokes]);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        onChange?.({
          strokes,
          currentPage: 1,
          totalPages: 1,
          background,
          template,
        });
      }

      setCurrentStroke([]);
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportAsImage: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        return canvas.toDataURL("image/png");
      },

      exportState: () => ({
        strokes,
        currentPage: 1,
        totalPages: 1,
        background,
        template,
      }),

      importState: (state: CanvasState) => {
        setStrokes(state.strokes || []);
        setHistory([state.strokes || []]);
        setHistoryIndex(0);
      },

      undo: () => {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setStrokes(history[newIndex] || []);
          onChange?.({
            strokes: history[newIndex] || [],
            currentPage: 1,
            totalPages: 1,
            background,
            template,
          });
        }
      },

      redo: () => {
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setStrokes(history[newIndex] || []);
          onChange?.({
            strokes: history[newIndex] || [],
            currentPage: 1,
            totalPages: 1,
            background,
            template,
          });
        }
      },

      clear: () => {
        setStrokes([]);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push([]);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onChange?.({
          strokes: [],
          currentPage: 1,
          totalPages: 1,
          background,
          template,
        });
      },

      canUndo: () => historyIndex > 0,

      canRedo: () => historyIndex < history.length - 1,
    }));

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full ${className}`}
        style={{
          touchAction: "none",
          minHeight: "400px",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            touchAction: "none",
            cursor: tool === "eraser" ? "crosshair" : "crosshair",
            width: dimensions.width,
            height: dimensions.height,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
