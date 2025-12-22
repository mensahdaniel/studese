import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo } from "react";
import getStroke from "perfect-freehand";
import { Image as ImageIcon, Type, Move, X, GripVertical } from "lucide-react";

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

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  aspectRatio: number;
  originalWidth: number;
  originalHeight: number;
}

export type CanvasElement = TextElement | ImageElement;

export type Tool = "pen" | "pencil" | "highlighter" | "eraser" | "select" | "text" | "image";

export type PaperTemplate = "blank" | "lined" | "grid" | "dotted" | "cornell";

export interface CanvasState {
  strokes: Stroke[];
  elements: CanvasElement[];
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
  addImage: (file: File) => void;
  addText: () => void;
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
  disabled?: boolean;
  onToolChange?: (tool: Tool) => void;
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

// Load image from file
const loadImageFromFile = (file: File): Promise<{ src: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({ src, width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
      disabled = false,
      onToolChange,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>(initialState?.strokes || []);
    const [elements, setElements] = useState<CanvasElement[]>(initialState?.elements || []);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<{ strokes: Stroke[]; elements: CanvasElement[] }[]>([
      { strokes: initialState?.strokes || [], elements: initialState?.elements || [] }
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    // Virtual canvas size - consistent across all devices
    const VIRTUAL_CANVAS_WIDTH = 1920;
    const VIRTUAL_CANVAS_HEIGHT = 1080;

    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const [isReady, setIsReady] = useState(false);
    const [initialFitApplied, setInitialFitApplied] = useState(false);

    // Use virtual canvas size for drawing, container size for display
    const dimensions = useMemo(() => ({ width: VIRTUAL_CANVAS_WIDTH, height: VIRTUAL_CANVAS_HEIGHT }), []);
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [isDraggingElement, setIsDraggingElement] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 });
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isPinching, setIsPinching] = useState(false);
    const [pinchStart, setPinchStart] = useState({ distance: 0, width: 0, height: 0 });

    // Canvas zoom and pan state
    const [canvasZoom, setCanvasZoom] = useState(1);
    const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [lastPinchCenter, setLastPinchCenter] = useState({ x: 0, y: 0 });
    const lastTapRef = useRef<{ id: string; time: number } | null>(null);

    // Simple resize state using refs to avoid closure issues
    const resizeInfoRef = useRef<{
      active: boolean;
      elementId: string;
      startWidth: number;
      startHeight: number;
      startX: number;
      startY: number;
      aspectRatio: number;
      isImage: boolean;
    } | null>(null);

    // Global resize handlers - attached once and check ref for state
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        // Only resize if mouse button is actually pressed (buttons === 1 means left button)
        if (e.buttons !== 1) {
          if (resizeInfoRef.current?.active) {
            resizeInfoRef.current.active = false;
            setIsResizing(false);
          }
          return;
        }

        const info = resizeInfoRef.current;
        if (!info || !info.active) return;

        e.preventDefault();
        const deltaX = e.clientX - info.startX;
        const deltaY = e.clientY - info.startY;

        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== info.elementId) return el;

            if (info.isImage) {
              const newWidth = Math.max(30, info.startWidth + deltaX);
              const newHeight = Math.max(30, newWidth / info.aspectRatio);
              return { ...el, width: newWidth, height: newHeight };
            } else {
              return {
                ...el,
                width: Math.max(30, info.startWidth + deltaX),
                height: Math.max(20, info.startHeight + deltaY),
              };
            }
          })
        );
      };

      const handleTouchMove = (e: TouchEvent) => {
        const info = resizeInfoRef.current;
        if (!info || !info.active) return;
        if (e.touches.length !== 1) return;

        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - info.startX;
        const deltaY = touch.clientY - info.startY;

        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== info.elementId) return el;

            if (info.isImage) {
              const newWidth = Math.max(30, info.startWidth + deltaX);
              const newHeight = Math.max(30, newWidth / info.aspectRatio);
              return { ...el, width: newWidth, height: newHeight };
            } else {
              return {
                ...el,
                width: Math.max(30, info.startWidth + deltaX),
                height: Math.max(20, info.startHeight + deltaY),
              };
            }
          })
        );
      };

      const handleEnd = () => {
        const info = resizeInfoRef.current;
        if (!info || !info.active) return;

        info.active = false;
        setIsResizing(false);

        // Update history
        setElements((currentElements) => {
          setHistory((prevHistory) => {
            const idx = prevHistory.length - 1;
            // Only add to history if elements actually changed
            const newHistory = [...prevHistory];
            newHistory.push({ strokes: prevHistory[idx]?.strokes || [], elements: currentElements });
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
          return currentElements;
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('touchcancel', handleEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);
      };
    }, []);

    // Start resize function - just sets the ref
    const startResize = useCallback((elementId: string, startX: number, startY: number) => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      resizeInfoRef.current = {
        active: true,
        elementId,
        startWidth: element.width,
        startHeight: element.height,
        startX,
        startY,
        aspectRatio: element.type === 'image' ? element.aspectRatio : 1,
        isImage: element.type === 'image',
      };

      setIsResizing(true);
      setSelectedElement(elementId);
    }, [elements]);

    // Pinch-to-zoom for mobile element resizing
    useEffect(() => {
      if (!selectedElement || disabled) return;

      const container = containerRef.current;
      if (!container) return;

      const getDistance = (touch1: Touch, touch2: Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2 && selectedElement) {
          e.preventDefault();
          const distance = getDistance(e.touches[0], e.touches[1]);
          const element = elements.find((el) => el.id === selectedElement);
          if (element) {
            setIsPinching(true);
            setPinchStart({
              distance,
              width: element.width,
              height: element.height,
            });
          }
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && isPinching && selectedElement) {
          e.preventDefault();
          const currentDistance = getDistance(e.touches[0], e.touches[1]);
          const scale = currentDistance / pinchStart.distance;

          setElements((prev) =>
            prev.map((el) => {
              if (el.id !== selectedElement) return el;

              if (el.type === 'image') {
                const newWidth = Math.max(30, pinchStart.width * scale);
                const newHeight = newWidth / el.aspectRatio;
                return { ...el, width: newWidth, height: Math.max(30, newHeight) };
              } else {
                return {
                  ...el,
                  width: Math.max(30, pinchStart.width * scale),
                  height: Math.max(20, pinchStart.height * scale),
                };
              }
            })
          );
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (isPinching && e.touches.length < 2) {
          setIsPinching(false);
          // Update history after pinch resize
          setHistory((prevHistory) => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push({ strokes, elements });
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
          onChange?.({
            strokes,
            elements,
            currentPage: 1,
            totalPages: 1,
            background,
            template,
          });
        }
      };

      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
      container.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      };
    }, [selectedElement, disabled, isPinching, pinchStart, elements, strokes, historyIndex, background, template, onChange]);

    // Canvas zoom and pan with two-finger gestures (when no element is selected)
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const getDistance = (touch1: Touch, touch2: Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      };

      const getCenter = (touch1: Touch, touch2: Touch) => {
        return {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
      };

      const handleTouchStart = (e: TouchEvent) => {
        // Only handle canvas zoom/pan when no element is selected
        if (selectedElement) return;

        if (e.touches.length === 2) {
          e.preventDefault();
          const distance = getDistance(e.touches[0], e.touches[1]);
          const center = getCenter(e.touches[0], e.touches[1]);

          setLastPinchDistance(distance);
          setLastPinchCenter(center);
          setIsPanning(true);
          setPanStart({
            x: center.x,
            y: center.y,
            panX: canvasPan.x,
            panY: canvasPan.y,
          });
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (selectedElement) return;

        if (e.touches.length === 2 && isPanning) {
          e.preventDefault();

          const currentDistance = getDistance(e.touches[0], e.touches[1]);
          const currentCenter = getCenter(e.touches[0], e.touches[1]);

          // Calculate zoom
          if (lastPinchDistance > 0) {
            const scale = currentDistance / lastPinchDistance;
            setCanvasZoom((prevZoom) => {
              const newZoom = prevZoom * scale;
              // Clamp zoom between 0.5x and 4x
              return Math.min(Math.max(newZoom, 0.5), 4);
            });
            setLastPinchDistance(currentDistance);
          }

          // Calculate pan
          const deltaX = currentCenter.x - lastPinchCenter.x;
          const deltaY = currentCenter.y - lastPinchCenter.y;

          setCanvasPan((prev) => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY,
          }));

          setLastPinchCenter(currentCenter);
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
          setIsPanning(false);
          setLastPinchDistance(0);
        }
      };

      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
      container.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      };
    }, [selectedElement, isPanning, lastPinchDistance, lastPinchCenter, canvasPan, canvasZoom]);

    // Wheel event for trackpad pinch-to-zoom on web (ctrl+wheel or pinch gesture)
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        // Trackpad pinch-to-zoom sends wheel events with ctrlKey
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();

          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // Calculate zoom
          const delta = -e.deltaY;
          const zoomFactor = delta > 0 ? 1.05 : 0.95;

          setCanvasZoom((prevZoom) => {
            const newZoom = prevZoom * zoomFactor;
            // Clamp zoom between 0.1x and 5x
            const clampedZoom = Math.min(Math.max(newZoom, 0.1), 5);

            // Adjust pan to zoom towards mouse position
            const zoomRatio = clampedZoom / prevZoom;
            setCanvasPan((prevPan) => ({
              x: mouseX - (mouseX - prevPan.x) * zoomRatio,
              y: mouseY - (mouseY - prevPan.y) * zoomRatio,
            }));

            return clampedZoom;
          });
        } else {
          // Regular scroll for panning (two-finger scroll on trackpad)
          e.preventDefault();
          setCanvasPan((prev) => ({
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY,
          }));
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }, []);

    // Initialize container size and fit canvas to screen
    useEffect(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setContainerSize({
              width: rect.width,
              height: rect.height,
            });

            // Auto-fit canvas to container on initial load
            if (!initialFitApplied) {
              const scaleX = rect.width / VIRTUAL_CANVAS_WIDTH;
              const scaleY = rect.height / VIRTUAL_CANVAS_HEIGHT;
              const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

              setCanvasZoom(fitScale);
              // Center the canvas
              const offsetX = (rect.width - VIRTUAL_CANVAS_WIDTH * fitScale) / 2;
              const offsetY = (rect.height - VIRTUAL_CANVAS_HEIGHT * fitScale) / 2;
              setCanvasPan({ x: Math.max(0, offsetX), y: Math.max(0, offsetY) });

              setInitialFitApplied(true);
            }

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
    }, [initialFitApplied]);

    // Add image to canvas
    const addImageToCanvas = useCallback(async (file: File) => {
      try {
        const { src, width, height } = await loadImageFromFile(file);

        // Scale image to fit within canvas while maintaining aspect ratio
        const maxWidth = dimensions.width * 0.6;
        const maxHeight = dimensions.height * 0.6;
        const aspectRatio = width / height;

        let newWidth = width;
        let newHeight = height;

        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * aspectRatio;
        }

        const newElement: ImageElement = {
          id: generateId(),
          type: 'image',
          x: (dimensions.width - newWidth) / 2,
          y: (dimensions.height - newHeight) / 2,
          width: newWidth,
          height: newHeight,
          src,
          aspectRatio,
          originalWidth: width,
          originalHeight: height,
        };

        setElements((prevElements) => {
          const newElements = [...prevElements, newElement];
          // Update history
          setHistory((prevHistory) => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);
            newHistory.push({ strokes, elements: newElements });
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
          // Notify parent
          onChange?.({
            strokes,
            elements: newElements,
            currentPage: 1,
            totalPages: 1,
            background,
            template,
          });
          return newElements;
        });
        setSelectedElement(newElement.id);

        // Switch to select tool
        onToolChange?.('select');
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    }, [dimensions, strokes, historyIndex, background, template, onChange, onToolChange]);

    // Handle paste events for clipboard images
    useEffect(() => {
      const handlePaste = async (e: ClipboardEvent) => {
        if (disabled) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              await addImageToCanvas(file);
            }
            return;
          }
        }
      };

      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
    }, [disabled, addImageToCanvas]);

    // Add text to canvas
    const addTextToCanvas = () => {
      const newElement: TextElement = {
        id: generateId(),
        type: 'text',
        x: dimensions.width / 2 - 100,
        y: dimensions.height / 2 - 20,
        width: 200,
        height: 40,
        content: 'Click to edit',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        color: color,
        bold: false,
        italic: false,
      };

      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement.id);
      setEditingTextId(newElement.id);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ strokes, elements: newElements });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Notify parent
      notifyChange(strokes, newElements);

      // Switch to select tool
      onToolChange?.('select');
    };

    // Notify parent of changes
    const notifyChange = (newStrokes: Stroke[], newElements: CanvasElement[]) => {
      onChange?.({
        strokes: newStrokes,
        elements: newElements,
        currentPage: 1,
        totalPages: 1,
        background,
        template,
      });
    };

    // Render canvas
    const renderCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !isReady) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

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

    // Get point from event (adjusted for zoom and pan)
    const getPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      // Adjust for zoom and pan
      const x = (e.clientX - rect.left - canvasPan.x) / canvasZoom;
      const y = (e.clientY - rect.top - canvasPan.y) / canvasZoom;
      return {
        x,
        y,
        pressure: 'pressure' in e ? (e as React.PointerEvent).pressure || 0.5 : 0.5,
      };
    };

    // Reset zoom and pan - fit to container
    const resetZoomPan = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scaleX = rect.width / VIRTUAL_CANVAS_WIDTH;
        const scaleY = rect.height / VIRTUAL_CANVAS_HEIGHT;
        const fitScale = Math.min(scaleX, scaleY, 1);

        setCanvasZoom(fitScale);
        const offsetX = (rect.width - VIRTUAL_CANVAS_WIDTH * fitScale) / 2;
        const offsetY = (rect.height - VIRTUAL_CANVAS_HEIGHT * fitScale) / 2;
        setCanvasPan({ x: Math.max(0, offsetX), y: Math.max(0, offsetY) });
      } else {
        setCanvasZoom(1);
        setCanvasPan({ x: 0, y: 0 });
      }
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

    // Check if point is inside element
    const getElementAtPoint = (point: Point): CanvasElement | null => {
      // Check in reverse order (top elements first)
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (
          point.x >= el.x &&
          point.x <= el.x + el.width &&
          point.y >= el.y &&
          point.y <= el.y + el.height
        ) {
          return el;
        }
      }
      return null;
    };

    // Pointer event handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.setPointerCapture(e.pointerId);
      }

      const point = getPointFromEvent(e);

      if (tool === "select") {
        const element = getElementAtPoint(point);
        if (element) {
          setSelectedElement(element.id);
          setIsDraggingElement(true);
          setDragOffset({ x: point.x - element.x, y: point.y - element.y });

          // Double-click to edit text
          if (element.type === 'text' && e.detail === 2) {
            setEditingTextId(element.id);
          }
        } else {
          setSelectedElement(null);
          setEditingTextId(null);
        }
        return;
      }

      if (tool === "text") {
        // Create new text at click position
        const newElement: TextElement = {
          id: generateId(),
          type: 'text',
          x: point.x - 50,
          y: point.y - 10,
          width: 200,
          height: 40,
          content: '',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          color: color,
          bold: false,
          italic: false,
        };

        const newElements = [...elements, newElement];
        setElements(newElements);
        setSelectedElement(newElement.id);
        setEditingTextId(newElement.id);

        // Update history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ strokes, elements: newElements });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        notifyChange(strokes, newElements);
        onToolChange?.('select');
        return;
      }

      if (tool === "image") {
        fileInputRef.current?.click();
        return;
      }

      setIsDrawing(true);

      if (tool === "eraser") {
        handleEraser(point);
      } else {
        setCurrentStroke([point]);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;

      const point = getPointFromEvent(e);

      if (isDraggingElement && selectedElement) {
        e.preventDefault();
        e.stopPropagation();

        setElements((prev) =>
          prev.map((el) =>
            el.id === selectedElement
              ? { ...el, x: point.x - dragOffset.x, y: point.y - dragOffset.y }
              : el
          )
        );
        return;
      }

      // Resizing is now handled by global mouse events
      if (isResizing) return;

      if (!isDrawing) return;

      e.preventDefault();
      e.stopPropagation();

      if (tool === "eraser") {
        handleEraser(point);
      } else {
        setCurrentStroke((prev) => [...prev, point]);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (isDraggingElement || isResizing) {
        setIsDraggingElement(false);
        setIsResizing(false);

        // Update history after moving/resizing
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ strokes, elements });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        notifyChange(strokes, elements);
        return;
      }

      if (!isDrawing) return;

      setIsDrawing(false);

      if (tool !== "eraser" && currentStroke.length > 1) {
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
        newHistory.push({ strokes: newStrokes, elements });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        notifyChange(newStrokes, elements);
      } else if (tool === "eraser") {
        // Update history after erasing
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ strokes: [...strokes], elements });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        notifyChange(strokes, elements);
      }

      setCurrentStroke([]);
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await addImageToCanvas(file);
          break; // Only add the first image
        }
      }
    };

    // Handle file input change
    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        await addImageToCanvas(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    };

    // Handle text change
    const handleTextChange = (id: string, content: string) => {
      setElements((prev) =>
        prev.map((el) =>
          el.id === id && el.type === 'text' ? { ...el, content } : el
        )
      );
    };

    // Handle text blur (save text)
    const handleTextBlur = (id: string) => {
      setEditingTextId(null);

      // Remove empty text elements
      const element = elements.find((el) => el.id === id);
      if (element && element.type === 'text' && !element.content.trim()) {
        const newElements = elements.filter((el) => el.id !== id);
        setElements(newElements);
        setSelectedElement(null);
        notifyChange(strokes, newElements);
        return;
      }

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ strokes, elements });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      notifyChange(strokes, elements);
    };

    // Delete selected element
    const deleteSelectedElement = useCallback(() => {
      if (!selectedElement) return;

      setElements((prevElements) => {
        const newElements = prevElements.filter((el) => el.id !== selectedElement);
        // Update history
        setHistory((prevHistory) => {
          const newHistory = prevHistory.slice(0, historyIndex + 1);
          newHistory.push({ strokes, elements: newElements });
          setHistoryIndex(newHistory.length - 1);
          return newHistory;
        });
        // Notify parent
        onChange?.({
          strokes,
          elements: newElements,
          currentPage: 1,
          totalPages: 1,
          background,
          template,
        });
        return newElements;
      });
      setSelectedElement(null);
      setEditingTextId(null);
    }, [selectedElement, strokes, historyIndex, background, template, onChange]);

    // Handle keyboard events for delete
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (disabled) return;
        if (selectedElement && !editingTextId && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          deleteSelectedElement();
        }
        if (e.key === 'Escape') {
          setSelectedElement(null);
          setEditingTextId(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElement, editingTextId, disabled, deleteSelectedElement]);

    // Start resize (mouse)
    const handleResizeStart = (e: React.MouseEvent, elementId: string) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(elementId, e.clientX, e.clientY);
    };

    // Start resize (touch)
    const handleResizeTouchStart = (e: React.TouchEvent, elementId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.touches.length !== 1) return;
      startResize(elementId, e.touches[0].clientX, e.touches[0].clientY);
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportAsImage: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";

        // Create a temporary canvas for export with elements
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return "";

        const dpr = window.devicePixelRatio || 1;
        exportCanvas.width = dimensions.width * dpr;
        exportCanvas.height = dimensions.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Draw the main canvas content
        ctx.drawImage(canvas, 0, 0, dimensions.width, dimensions.height);

        // Draw elements (images and text) on top
        for (const element of elements) {
          if (element.type === 'image') {
            const img = new Image();
            img.src = element.src;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            ctx.drawImage(img, element.x, element.y, element.width, element.height);
          } else if (element.type === 'text') {
            ctx.font = `${element.italic ? 'italic ' : ''}${element.bold ? 'bold ' : ''}${element.fontSize}px ${element.fontFamily}`;
            ctx.fillStyle = element.color;
            ctx.textBaseline = 'top';

            // Simple text wrapping
            const words = element.content.split(' ');
            let line = '';
            let y = element.y;

            for (const word of words) {
              const testLine = line + word + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > element.width && line !== '') {
                ctx.fillText(line.trim(), element.x, y);
                line = word + ' ';
                y += element.fontSize * 1.2;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line.trim(), element.x, y);
          }
        }

        return exportCanvas.toDataURL("image/png");
      },

      exportState: () => ({
        strokes,
        elements,
        currentPage: 1,
        totalPages: 1,
        background,
        template,
      }),

      importState: (state: CanvasState) => {
        setStrokes(state.strokes || []);
        setElements(state.elements || []);
        setHistory([{ strokes: state.strokes || [], elements: state.elements || [] }]);
        setHistoryIndex(0);
        setSelectedElement(null);
        setEditingTextId(null);
      },

      undo: () => {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setStrokes(history[newIndex]?.strokes || []);
          setElements(history[newIndex]?.elements || []);
          setSelectedElement(null);
          setEditingTextId(null);
          onChange?.({
            strokes: history[newIndex]?.strokes || [],
            elements: history[newIndex]?.elements || [],
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
          setStrokes(history[newIndex]?.strokes || []);
          setElements(history[newIndex]?.elements || []);
          setSelectedElement(null);
          setEditingTextId(null);
          onChange?.({
            strokes: history[newIndex]?.strokes || [],
            elements: history[newIndex]?.elements || [],
            currentPage: 1,
            totalPages: 1,
            background,
            template,
          });
        }
      },

      clear: () => {
        setStrokes([]);
        setElements([]);
        setSelectedElement(null);
        setEditingTextId(null);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ strokes: [], elements: [] });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onChange?.({
          strokes: [],
          elements: [],
          currentPage: 1,
          totalPages: 1,
          background,
          template,
        });
      },

      canUndo: () => historyIndex > 0,

      canRedo: () => historyIndex < history.length - 1,

      addImage: async (file: File) => {
        await addImageToCanvas(file);
      },

      addText: () => {
        addTextToCanvas();
      },
    }));

    // Get cursor style
    const getCursorStyle = () => {
      if (disabled) return "not-allowed";
      if (tool === "select") return isDraggingElement ? "grabbing" : "default";
      if (tool === "text") return "text";
      if (tool === "image") return "copy";
      return "crosshair";
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full ${className}`}
        style={{
          touchAction: "none",
          minHeight: "400px",
          overflow: "hidden",
          backgroundColor: background,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg p-6 shadow-lg text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-primary" />
              <p className="text-lg font-medium">Drop image here</p>
              <p className="text-sm text-muted-foreground">The image will be added to your canvas</p>
            </div>
          </div>
        )}

        {/* Zoomable/Pannable canvas container */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
            transformOrigin: 'top left',
            width: VIRTUAL_CANVAS_WIDTH,
            height: VIRTUAL_CANVAS_HEIGHT,
          }}
        >
          {/* Main canvas for drawing */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{
              touchAction: "none",
              cursor: getCursorStyle(),
              width: dimensions.width,
              height: dimensions.height,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* Overlay elements (images and text) - inside zoom container */}
          {elements.map((element) => (
            <div
              key={element.id}
              className={`absolute ${selectedElement === element.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                cursor: tool === "select" ? (isDraggingElement && selectedElement === element.id ? "grabbing" : "grab") : "default",
                pointerEvents: tool === "select" || tool === "text" ? "auto" : "none",
                touchAction: "none",
              }}
              onMouseDown={(e) => {
                if (tool !== "select" || disabled) return;
                e.stopPropagation();
                setSelectedElement(element.id);
                setIsDraggingElement(true);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                  setDragOffset({ x: point.x - element.x, y: point.y - element.y });
                }

                if (element.type === 'text' && e.detail === 2) {
                  setEditingTextId(element.id);
                  setIsDraggingElement(false);
                }
              }}
              onMouseMove={(e) => {
                if (!isDraggingElement || selectedElement !== element.id || disabled) return;
                e.stopPropagation();
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left - dragOffset.x;
                const y = e.clientY - rect.top - dragOffset.y;
                setElements((prev) =>
                  prev.map((el) =>
                    el.id === element.id ? { ...el, x, y } : el
                  )
                );
              }}
              onMouseUp={(e) => {
                if (disabled) return;
                e.stopPropagation();
                if (isDraggingElement) {
                  setIsDraggingElement(false);
                  const newHistory = history.slice(0, historyIndex + 1);
                  newHistory.push({ strokes, elements });
                  setHistory(newHistory);
                  setHistoryIndex(newHistory.length - 1);
                  notifyChange(strokes, elements);
                }
              }}
              // Touch events for mobile dragging
              onTouchStart={(e) => {
                if (tool !== "select" || disabled) return;
                // Only handle single touch for dragging (pinch is handled separately)
                if (e.touches.length !== 1) return;
                e.stopPropagation();
                setSelectedElement(element.id);
                setIsDraggingElement(true);
                const touch = e.touches[0];
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const point = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
                  setDragOffset({ x: point.x - element.x, y: point.y - element.y });
                }
              }}
              onTouchMove={(e) => {
                if (!isDraggingElement || selectedElement !== element.id || disabled) return;
                // Only handle single touch for dragging
                if (e.touches.length !== 1) return;
                e.stopPropagation();
                e.preventDefault();
                const touch = e.touches[0];
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = touch.clientX - rect.left - dragOffset.x;
                const y = touch.clientY - rect.top - dragOffset.y;
                setElements((prev) =>
                  prev.map((el) =>
                    el.id === element.id ? { ...el, x, y } : el
                  )
                );
              }}
              onTouchEnd={(e) => {
                if (disabled) return;
                e.stopPropagation();
                if (isDraggingElement) {
                  setIsDraggingElement(false);
                  const newHistory = history.slice(0, historyIndex + 1);
                  newHistory.push({ strokes, elements });
                  setHistory(newHistory);
                  setHistoryIndex(newHistory.length - 1);
                  notifyChange(strokes, elements);
                }

                // Handle double-tap to edit text
                if (element.type === 'text') {
                  const now = Date.now();
                  const lastTap = lastTapRef.current;
                  if (lastTap && lastTap.id === element.id && now - lastTap.time < 300) {
                    setEditingTextId(element.id);
                    setIsDraggingElement(false);
                    lastTapRef.current = null;
                  } else {
                    lastTapRef.current = { id: element.id, time: now };
                  }
                }
              }}
            >
              {element.type === 'image' ? (
                <img
                  src={element.src}
                  alt="Canvas element"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                editingTextId === element.id ? (
                  <textarea
                    autoFocus
                    className="w-full h-full bg-transparent border-none outline-none resize-none p-1"
                    style={{
                      fontSize: element.fontSize,
                      fontFamily: element.fontFamily,
                      color: element.color,
                      fontWeight: element.bold ? 'bold' : 'normal',
                      fontStyle: element.italic ? 'italic' : 'normal',
                    }}
                    value={element.content}
                    onChange={(e) => handleTextChange(element.id, e.target.value)}
                    onBlur={() => handleTextBlur(element.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleTextBlur(element.id);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="w-full h-full overflow-hidden p-1 whitespace-pre-wrap"
                    style={{
                      fontSize: element.fontSize,
                      fontFamily: element.fontFamily,
                      color: element.color,
                      fontWeight: element.bold ? 'bold' : 'normal',
                      fontStyle: element.italic ? 'italic' : 'normal',
                    }}
                  >
                    {element.content || (
                      <span className="text-muted-foreground italic">Click to edit...</span>
                    )}
                  </div>
                )
              )}

              {/* Selection controls */}
              {selectedElement === element.id && tool === "select" && !disabled && (
                <>
                  {/* Delete button */}
                  <button
                    className="absolute -top-3 -right-3 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSelectedElement();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>

                  {/* Drag handle */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-background border rounded flex items-center justify-center shadow-md cursor-move">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                  </div>

                  {/* Resize handle */}
                  <div
                    className="absolute -bottom-2 -right-2 w-7 h-7 bg-primary rounded-full cursor-se-resize shadow-md hover:scale-110 transition-transform flex items-center justify-center"
                    style={{ touchAction: 'none' }}
                    onMouseDown={(e) => handleResizeStart(e, element.id)}
                    onTouchStart={(e) => handleResizeTouchStart(e, element.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary-foreground">
                      <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Zoom indicator and reset button - outside zoom container */}
        <div className="absolute bottom-20 right-4 z-50 flex items-center gap-2">
          <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-md text-sm font-medium">
            {Math.round(canvasZoom * 100)}%
          </div>
          <button
            onClick={resetZoomPan}
            className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 shadow-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Fit
          </button>
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
