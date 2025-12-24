import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo } from "react";
import getStroke from "perfect-freehand";
import {
  Image as ImageIcon,
  Type,
  Move,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Keyboard,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Clipboard,
  PenTool,
  Eraser,
  Highlighter,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  FilePlus,
  Crop,
  Check,
} from "lucide-react";

// Context menu types
type ContextMenuTarget = 'canvas' | 'image' | 'text';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  canvasX: number; // Position relative to canvas for scroll-following
  canvasY: number;
  targetElement: string | null; // ID of element if right-clicked on an element
  targetType: ContextMenuTarget; // Type of target for contextual menu
}

// Keyboard shortcuts configuration
const KEYBOARD_SHORTCUTS = {
  undo: ['z'],
  redo: ['y', 'Z'], // Z with shift
  delete: ['Delete', 'Backspace'],
  escape: ['Escape'],
  selectAll: ['a'],
  pen: ['p', '1'],
  pencil: ['2'],
  highlighter: ['h', '3'],
  eraser: ['e', '4'],
  select: ['v', '5'],
  text: ['t', '6'],
  addPage: [']'],
  prevPage: ['['],
  zoomIn: ['=', '+'],
  zoomOut: ['-', '_'],
  fitToScreen: ['0'],
};

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
  pageId: number;
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
  pageId: number;
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
  pageId: number;
  // Crop properties (relative to original image, 0-1 range)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

// Crop state interface
interface CropState {
  isActive: boolean;
  elementId: string | null;
  // Crop rectangle in FULL IMAGE coordinates (when expanded to show full image)
  x: number;
  y: number;
  width: number;
  height: number;
  // Full image dimensions (for the crop UI overlay)
  fullImageWidth: number;
  fullImageHeight: number;
  // Original element position before entering crop mode
  originalElementX: number;
  originalElementY: number;
  originalElementWidth: number;
  originalElementHeight: number;
  // Initial crop position when entering crop mode (used to keep element position fixed)
  initialCropX: number;
  initialCropY: number;
  // Which handle is being dragged
  draggingHandle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' | null;
  startX: number;
  startY: number;
  startCrop: { x: number; y: number; width: number; height: number };
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
  // Page navigation
  goToPage: (pageNum: number) => void;
  addPage: () => void;
  getTotalPages: () => number;
  getCurrentPage: () => number;
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

    // Helper to migrate old data that doesn't have pageId
    const migrateStrokes = (strokes: Stroke[]): Stroke[] => {
      return strokes.map(stroke => ({
        ...stroke,
        pageId: stroke.pageId ?? 1,
      }));
    };

    const migrateElements = (elements: CanvasElement[]): CanvasElement[] => {
      return elements.map(element => ({
        ...element,
        pageId: element.pageId ?? 1,
      }));
    };

    const [strokes, setStrokes] = useState<Stroke[]>(migrateStrokes(initialState?.strokes || []));
    const [elements, setElements] = useState<CanvasElement[]>(migrateElements(initialState?.elements || []));
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<{ strokes: Stroke[]; elements: CanvasElement[] }[]>([
      { strokes: initialState?.strokes || [], elements: initialState?.elements || [] }
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    // Virtual canvas size - consistent across all devices
    // Using portrait orientation (A4-like ratio) for better mobile compatibility
    // A4 ratio is approximately 1:1.414, we use 816x1056 (similar to US Letter at 96 DPI)
    const VIRTUAL_CANVAS_WIDTH = 816;
    const VIRTUAL_CANVAS_HEIGHT = 1056;
    const PAGE_GAP = 60; // Gap between pages in pixels (visible separation)

    // Multi-page state
    const [totalPages, setTotalPages] = useState(initialState?.totalPages || 1);
    const [currentPage, setCurrentPage] = useState(initialState?.currentPage || 1);

    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const [isReady, setIsReady] = useState(false);
    const [initialFitApplied, setInitialFitApplied] = useState(false);

    // Use virtual canvas size for drawing, container size for display
    // Total height = (page height * number of pages) + (gap * (number of pages - 1))
    const dimensions = useMemo(() => ({
      width: VIRTUAL_CANVAS_WIDTH,
      height: VIRTUAL_CANVAS_HEIGHT * totalPages + PAGE_GAP * (totalPages - 1)
    }), [totalPages]);

    // Helper function to get which page a Y coordinate belongs to
    const getPageFromY = useCallback((y: number): number => {
      const pageWithGap = VIRTUAL_CANVAS_HEIGHT + PAGE_GAP;
      return Math.floor(y / pageWithGap) + 1;
    }, []);

    // Helper function to get the Y offset for a specific page
    const getPageYOffset = useCallback((pageNum: number): number => {
      return (pageNum - 1) * (VIRTUAL_CANVAS_HEIGHT + PAGE_GAP);
    }, []);

    // Helper to check if a Y coordinate is in the gap between pages
    const isInPageGap = useCallback((y: number): boolean => {
      const pageWithGap = VIRTUAL_CANVAS_HEIGHT + PAGE_GAP;
      const positionInPage = y % pageWithGap;
      return positionInPage > VIRTUAL_CANVAS_HEIGHT;
    }, []);

    // Helper to snap a Y coordinate to the nearest page edge if in gap
    const snapToPage = useCallback((y: number): number => {
      const pageWithGap = VIRTUAL_CANVAS_HEIGHT + PAGE_GAP;
      const pageNum = Math.floor(y / pageWithGap) + 1;
      const positionInPage = y % pageWithGap;

      if (positionInPage > VIRTUAL_CANVAS_HEIGHT) {
        // In the gap - snap to nearest edge
        const distToCurrentPageBottom = positionInPage - VIRTUAL_CANVAS_HEIGHT;
        const distToNextPageTop = PAGE_GAP - distToCurrentPageBottom;

        if (distToCurrentPageBottom < distToNextPageTop) {
          // Snap to bottom of current page
          return (pageNum - 1) * pageWithGap + VIRTUAL_CANVAS_HEIGHT - 5;
        } else {
          // Snap to top of next page
          return pageNum * pageWithGap + 5;
        }
      }
      return y;
    }, []);

    // Helper to check if we need to add a new page (when drawing near bottom of last page)
    const checkAndAddPage = useCallback((y: number) => {
      const lastPageBottom = totalPages * VIRTUAL_CANVAS_HEIGHT + (totalPages - 1) * PAGE_GAP;
      const threshold = 100; // Add new page when within 100px of bottom

      if (y > lastPageBottom - threshold) {
        setTotalPages(prev => prev + 1);
      }
    }, [totalPages]);

    // Helper to clamp element position within canvas bounds (staying within pages, not gaps)
    const clampElementPosition = useCallback((x: number, y: number, width: number, height: number): { x: number; y: number } => {
      // Clamp X to canvas width
      const clampedX = Math.max(0, Math.min(x, VIRTUAL_CANVAS_WIDTH - width));

      // Clamp Y to stay within pages (not in gaps)
      let clampedY = Math.max(0, y);

      // Find which page the element would be on
      const pageWithGap = VIRTUAL_CANVAS_HEIGHT + PAGE_GAP;
      const pageNum = Math.floor(clampedY / pageWithGap) + 1;
      const effectivePageNum = Math.min(pageNum, totalPages);

      // Calculate page boundaries
      const pageTop = (effectivePageNum - 1) * pageWithGap;
      const pageBottom = pageTop + VIRTUAL_CANVAS_HEIGHT;

      // Ensure element stays within the page
      if (clampedY < pageTop) {
        clampedY = pageTop;
      }
      if (clampedY + height > pageBottom) {
        // If element is too tall, at least keep top within page
        clampedY = Math.max(pageTop, pageBottom - height);
      }

      // Make sure we don't go beyond the last page
      const maxY = (totalPages - 1) * pageWithGap + VIRTUAL_CANVAS_HEIGHT - height;
      clampedY = Math.min(clampedY, Math.max(0, maxY));

      return { x: clampedX, y: clampedY };
    }, [totalPages]);
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

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
      isOpen: false,
      x: 0,
      y: 0,
      canvasX: 0,
      canvasY: 0,
      targetElement: null,
      targetType: 'canvas',
    });

    // Crop state
    const [cropState, setCropState] = useState<CropState>({
      isActive: false,
      elementId: null,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fullImageWidth: 0,
      fullImageHeight: 0,
      originalElementX: 0,
      originalElementY: 0,
      originalElementWidth: 0,
      originalElementHeight: 0,
      initialCropX: 0,
      initialCropY: 0,
      draggingHandle: null,
      startX: 0,
      startY: 0,
      startCrop: { x: 0, y: 0, width: 100, height: 100 },
    });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [lastPinchCenter, setLastPinchCenter] = useState({ x: 0, y: 0 });
    const lastTapRef = useRef<{ id: string; time: number } | null>(null);
    const cropDragRef = useRef<{
      active: boolean;
      handle: CropState['draggingHandle'];
      elementId: string | null;
      fullImageWidth: number;
      fullImageHeight: number;
      startX: number;
      startY: number;
      startCrop: { x: number; y: number; width: number; height: number };
    }>({
      active: false,
      handle: null,
      elementId: null,
      fullImageWidth: 0,
      fullImageHeight: 0,
      startX: 0,
      startY: 0,
      startCrop: { x: 0, y: 0, width: 0, height: 0 },
    });

    // Global crop drag handlers - attached once and check ref for state (same pattern as resize)
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        // Only process if mouse button is actually pressed (buttons === 1 means left button)
        if (e.buttons !== 1) {
          if (cropDragRef.current.active) {
            cropDragRef.current.active = false;
            setCropState(prev => ({ ...prev, draggingHandle: null }));
          }
          return;
        }

        const info = cropDragRef.current;
        if (!info.active || !info.handle) return;

        const deltaX = (e.clientX - info.startX) / canvasZoom;
        const deltaY = (e.clientY - info.startY) / canvasZoom;

        let newX = info.startCrop.x;
        let newY = info.startCrop.y;
        let newWidth = info.startCrop.width;
        let newHeight = info.startCrop.height;
        const minSize = 20;

        switch (info.handle) {
          case 'move':
            newX = Math.max(0, Math.min(info.fullImageWidth - info.startCrop.width, info.startCrop.x + deltaX));
            newY = Math.max(0, Math.min(info.fullImageHeight - info.startCrop.height, info.startCrop.y + deltaY));
            break;
          case 'nw':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 'ne':
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 'sw':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'se':
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'n':
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 's':
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'e':
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            break;
          case 'w':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            break;
        }

        setCropState(prev => ({ ...prev, x: newX, y: newY, width: newWidth, height: newHeight }));
      };

      const handleTouchMove = (e: TouchEvent) => {
        const info = cropDragRef.current;
        if (!info.active || !info.handle) return;
        if (e.touches.length !== 1) return;

        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = (touch.clientX - info.startX) / canvasZoom;
        const deltaY = (touch.clientY - info.startY) / canvasZoom;

        let newX = info.startCrop.x;
        let newY = info.startCrop.y;
        let newWidth = info.startCrop.width;
        let newHeight = info.startCrop.height;
        const minSize = 20;

        switch (info.handle) {
          case 'move':
            newX = Math.max(0, Math.min(info.fullImageWidth - info.startCrop.width, info.startCrop.x + deltaX));
            newY = Math.max(0, Math.min(info.fullImageHeight - info.startCrop.height, info.startCrop.y + deltaY));
            break;
          case 'nw':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 'ne':
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 'sw':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'se':
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'n':
            newY = Math.max(0, Math.min(info.startCrop.y + info.startCrop.height - minSize, info.startCrop.y + deltaY));
            newHeight = info.startCrop.height - (newY - info.startCrop.y);
            break;
          case 's':
            newHeight = Math.max(minSize, Math.min(info.fullImageHeight - info.startCrop.y, info.startCrop.height + deltaY));
            break;
          case 'e':
            newWidth = Math.max(minSize, Math.min(info.fullImageWidth - info.startCrop.x, info.startCrop.width + deltaX));
            break;
          case 'w':
            newX = Math.max(0, Math.min(info.startCrop.x + info.startCrop.width - minSize, info.startCrop.x + deltaX));
            newWidth = info.startCrop.width - (newX - info.startCrop.x);
            break;
        }

        setCropState(prev => ({ ...prev, x: newX, y: newY, width: newWidth, height: newHeight }));
      };

      const handleEnd = () => {
        if (!cropDragRef.current.active) return;
        cropDragRef.current.active = false;
        cropDragRef.current.handle = null;
        setCropState(prev => ({ ...prev, draggingHandle: null }));
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
    }, [canvasZoom]);

    // Start crop drag function - just sets the ref
    const startCropDrag = useCallback((
      e: React.MouseEvent | React.TouchEvent,
      handle: CropState['draggingHandle']
    ) => {
      e.preventDefault();
      e.stopPropagation();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      cropDragRef.current = {
        active: true,
        handle,
        elementId: cropState.elementId,
        fullImageWidth: cropState.fullImageWidth,
        fullImageHeight: cropState.fullImageHeight,
        startX: clientX,
        startY: clientY,
        startCrop: { x: cropState.x, y: cropState.y, width: cropState.width, height: cropState.height },
      };

      setCropState(prev => ({ ...prev, draggingHandle: handle }));
    }, [cropState.elementId, cropState.fullImageWidth, cropState.fullImageHeight, cropState.x, cropState.y, cropState.width, cropState.height]);

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
        // Scale deltas by zoom to convert screen pixels to virtual canvas coordinates
        const deltaX = (e.clientX - info.startX) / canvasZoom;
        const deltaY = (e.clientY - info.startY) / canvasZoom;

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
        // Scale deltas by zoom to convert screen pixels to virtual canvas coordinates
        const deltaX = (touch.clientX - info.startX) / canvasZoom;
        const deltaY = (touch.clientY - info.startY) / canvasZoom;

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
    }, [canvasZoom]);

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

    // Track current page based on pan position
    useEffect(() => {
      // Calculate which page is currently most visible based on pan position
      const viewportCenterY = (-canvasPan.y / canvasZoom) + (containerSize.height / canvasZoom) / 2;
      const pageWithGap = VIRTUAL_CANVAS_HEIGHT + PAGE_GAP;
      const visiblePage = Math.max(1, Math.min(totalPages, Math.floor(viewportCenterY / pageWithGap) + 1));

      if (visiblePage !== currentPage) {
        setCurrentPage(visiblePage);
      }
    }, [canvasPan.y, canvasZoom, containerSize.height, totalPages, currentPage]);

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

            // Auto-fit canvas to container on initial load - fit to page width
            if (!initialFitApplied) {
              const padding = 40;
              const fitScale = Math.min((rect.width - padding) / VIRTUAL_CANVAS_WIDTH, 1); // Don't zoom in beyond 100%

              setCanvasZoom(fitScale);
              // Center horizontally, start at top with some padding
              const offsetX = (rect.width - VIRTUAL_CANVAS_WIDTH * fitScale) / 2;
              setCanvasPan({ x: Math.max(0, offsetX), y: padding / 2 });

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

        // Calculate Y position - center on current visible area
        const currentViewY = -canvasPan.y / canvasZoom;
        const viewCenterY = currentViewY + (containerSize.height / canvasZoom) / 2;

        const newElement: ImageElement = {
          id: generateId(),
          type: 'image',
          x: (VIRTUAL_CANVAS_WIDTH - newWidth) / 2,
          y: viewCenterY - newHeight / 2,
          width: newWidth,
          height: newHeight,
          src,
          aspectRatio,
          originalWidth: width,
          originalHeight: height,
          pageId: getPageFromY(viewCenterY),
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
    }, [dimensions, strokes, historyIndex, background, template, onChange, onToolChange, canvasPan.y, canvasZoom, containerSize.height, getPageFromY]);

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

    // Notify parent of changes
    const notifyChange = useCallback((newStrokes: Stroke[], newElements: CanvasElement[]) => {
      onChange?.({
        strokes: newStrokes,
        elements: newElements,
        currentPage,
        totalPages,
        background,
        template,
      });
    }, [onChange, currentPage, totalPages, background, template]);

    // Add text to canvas
    const addTextToCanvas = useCallback(() => {
      // Calculate Y position - center on current visible area
      const currentViewY = -canvasPan.y / canvasZoom;
      const viewCenterY = currentViewY + (containerSize.height / canvasZoom) / 2;

      const newElement: TextElement = {
        id: generateId(),
        type: 'text',
        x: VIRTUAL_CANVAS_WIDTH / 2 - 100,
        y: viewCenterY - 20,
        width: 200,
        height: 40,
        content: 'Click to edit',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        color: color,
        bold: false,
        italic: false,
        pageId: getPageFromY(viewCenterY),
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
    }, [canvasPan.y, canvasZoom, containerSize.height, getPageFromY, color, elements, strokes, history, historyIndex, onToolChange, notifyChange]);

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

      // Clear the entire canvas with gray background (gap color)
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw each page with template/background
      for (let page = 1; page <= totalPages; page++) {
        const pageYOffset = (page - 1) * (VIRTUAL_CANVAS_HEIGHT + PAGE_GAP);
        const cornerRadius = 8;

        // Draw page shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = background;
        ctx.beginPath();
        ctx.roundRect(0, pageYOffset, VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT, cornerRadius);
        ctx.fill();
        ctx.restore();

        // Draw page border
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(0, pageYOffset, VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT, cornerRadius);
        ctx.stroke();

        // Clip to page bounds with rounded corners and draw template
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, pageYOffset, VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT, cornerRadius);
        ctx.clip();

        // Translate to page origin
        ctx.translate(0, pageYOffset);

        // Draw template/background for this page
        drawTemplate(ctx, VIRTUAL_CANVAS_WIDTH, VIRTUAL_CANVAS_HEIGHT, template, background);

        // Restore context
        ctx.restore();
      }

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

      // Draw page number indicators in the gap between pages
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let page = 1; page <= totalPages; page++) {
        const pageYOffset = (page - 1) * (VIRTUAL_CANVAS_HEIGHT + PAGE_GAP);
        const gapCenterY = pageYOffset + VIRTUAL_CANVAS_HEIGHT + PAGE_GAP / 2;

        if (page < totalPages) {
          // Draw a subtle divider line
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(VIRTUAL_CANVAS_WIDTH * 0.2, gapCenterY);
          ctx.lineTo(VIRTUAL_CANVAS_WIDTH * 0.35, gapCenterY);
          ctx.moveTo(VIRTUAL_CANVAS_WIDTH * 0.65, gapCenterY);
          ctx.lineTo(VIRTUAL_CANVAS_WIDTH * 0.8, gapCenterY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw page indicator text
          ctx.font = '12px Inter, sans-serif';
          ctx.fillStyle = '#6b7280';
          ctx.fillText(`Page ${page} of ${totalPages}`, VIRTUAL_CANVAS_WIDTH / 2, gapCenterY);
        }
      }
    }, [strokes, currentStroke, template, background, tool, color, size, dimensions, isReady, totalPages]);

    // Re-render when dependencies change
    useEffect(() => {
      renderCanvas();
    }, [renderCanvas]);

    // Get point from event (adjusted for zoom and pan)
    const getPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      // getBoundingClientRect() already includes CSS transforms (pan/zoom) from the parent container,
      // so we only need to divide by zoom to convert screen pixels to virtual canvas coordinates
      const x = (e.clientX - rect.left) / canvasZoom;
      let y = (e.clientY - rect.top) / canvasZoom;

      // Snap Y to page edge if in the gap between pages
      y = snapToPage(y);

      return {
        x,
        y,
        pressure: 'pressure' in e ? (e as React.PointerEvent).pressure || 0.5 : 0.5,
      };
    };

    // Reset zoom and pan - fit page width to container
    const resetZoomPan = useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Fit to page width with some padding
        const padding = 40;
        const fitScale = Math.min((rect.width - padding) / VIRTUAL_CANVAS_WIDTH, 1);

        setCanvasZoom(fitScale);
        const offsetX = (rect.width - VIRTUAL_CANVAS_WIDTH * fitScale) / 2;
        // Start at top of first page
        setCanvasPan({ x: Math.max(0, offsetX), y: padding / 2 });
      } else {
        setCanvasZoom(1);
        setCanvasPan({ x: 0, y: 0 });
      }
    }, []);

    // Navigate to a specific page
    const goToPage = useCallback((pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages) return;

      setCurrentPage(pageNum);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 40;
        const fitScale = Math.min((rect.width - padding) / VIRTUAL_CANVAS_WIDTH, 1);
        const pageYOffset = (pageNum - 1) * (VIRTUAL_CANVAS_HEIGHT + PAGE_GAP);

        setCanvasZoom(fitScale);
        const offsetX = (rect.width - VIRTUAL_CANVAS_WIDTH * fitScale) / 2;
        // Pan to show the target page at the top
        setCanvasPan({ x: Math.max(0, offsetX), y: -pageYOffset * fitScale + padding / 2 });
      }
    }, [totalPages]);

    // Add a new page manually
    const addPage = useCallback(() => {
      setTotalPages(prev => prev + 1);
    }, []);

    // Close context menu
    const closeContextMenu = useCallback(() => {
      setContextMenu({ isOpen: false, x: 0, y: 0, canvasX: 0, canvasY: 0, targetElement: null, targetType: 'canvas' });
    }, []);

    // Handle context menu (right-click)
    const handleContextMenu = useCallback((e: React.MouseEvent, elementId?: string, elementType?: 'image' | 'text') => {
      e.preventDefault();
      e.stopPropagation();

      // Get canvas-relative coordinates for scroll-following behavior
      const containerRect = containerRef.current?.getBoundingClientRect();
      const canvasX = containerRect ? (e.clientX - containerRect.left - canvasPan.x) / canvasZoom : 0;
      const canvasY = containerRect ? (e.clientY - containerRect.top - canvasPan.y) / canvasZoom : 0;

      // Determine target type
      let targetType: ContextMenuTarget = 'canvas';
      if (elementId && elementType) {
        targetType = elementType;
      }

      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
        targetElement: elementId || null,
        targetType,
      });
    }, [canvasPan.x, canvasPan.y, canvasZoom]);

    // Context menu actions
    const contextMenuActions = useMemo(() => ({
      undo: () => {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setStrokes(history[newIndex]?.strokes || []);
          setElements(history[newIndex]?.elements || []);
          setSelectedElement(null);
        }
        closeContextMenu();
      },
      redo: () => {
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setStrokes(history[newIndex]?.strokes || []);
          setElements(history[newIndex]?.elements || []);
          setSelectedElement(null);
        }
        closeContextMenu();
      },
      delete: () => {
        if (contextMenu.targetElement || selectedElement) {
          const elementToDelete = contextMenu.targetElement || selectedElement;
          const newElements = elements.filter((el) => el.id !== elementToDelete);
          setElements(newElements);
          setSelectedElement(null);

          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ strokes, elements: newElements });
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          notifyChange(strokes, newElements);
        }
        closeContextMenu();
      },
      selectElement: () => {
        if (contextMenu.targetElement) {
          setSelectedElement(contextMenu.targetElement);
          onToolChange?.('select');
        }
        closeContextMenu();
      },
      addText: () => {
        addTextToCanvas();
        closeContextMenu();
      },
      addImage: () => {
        fileInputRef.current?.click();
        closeContextMenu();
      },
      pen: () => {
        onToolChange?.('pen');
        closeContextMenu();
      },
      eraser: () => {
        onToolChange?.('eraser');
        closeContextMenu();
      },
      highlighter: () => {
        onToolChange?.('highlighter');
        closeContextMenu();
      },
      select: () => {
        onToolChange?.('select');
        closeContextMenu();
      },
      zoomIn: () => {
        setCanvasZoom(prev => Math.min(prev * 1.2, 5));
        closeContextMenu();
      },
      zoomOut: () => {
        setCanvasZoom(prev => Math.max(prev / 1.2, 0.1));
        closeContextMenu();
      },
      fitToScreen: () => {
        resetZoomPan();
        closeContextMenu();
      },
      addPage: () => {
        setTotalPages(prev => prev + 1);
        closeContextMenu();
      },
      cropImage: () => {
        if (contextMenu.targetElement) {
          const element = elements.find(el => el.id === contextMenu.targetElement);
          if (element && element.type === 'image') {
            // Calculate the full image display size based on original aspect ratio
            // We'll show the full original image, with the current crop area highlighted
            const fullImageWidth = element.originalWidth;
            const fullImageHeight = element.originalHeight;

            // Scale to fit reasonably on screen (use original element width as base)
            const scale = Math.min(
              element.width / ((element.cropWidth || 1) * fullImageWidth),
              1 // Don't scale up beyond original
            );
            const displayFullWidth = fullImageWidth * scale;
            const displayFullHeight = fullImageHeight * scale;

            // Current crop in display coordinates
            const cropX = (element.cropX || 0) * displayFullWidth;
            const cropY = (element.cropY || 0) * displayFullHeight;
            const cropWidth = (element.cropWidth || 1) * displayFullWidth;
            const cropHeight = (element.cropHeight || 1) * displayFullHeight;

            setCropState({
              isActive: true,
              elementId: element.id,
              // The crop selection rectangle (in full image display coordinates)
              x: cropX,
              y: cropY,
              width: cropWidth,
              height: cropHeight,
              // Full image dimensions for the crop UI
              fullImageWidth: displayFullWidth,
              fullImageHeight: displayFullHeight,
              // Store original element state to restore on cancel
              originalElementX: element.x,
              originalElementY: element.y,
              originalElementWidth: element.width,
              originalElementHeight: element.height,
              // Store initial crop position to keep element fixed during dragging
              initialCropX: cropX,
              initialCropY: cropY,
              draggingHandle: null,
              startX: 0,
              startY: 0,
              startCrop: {
                x: cropX,
                y: cropY,
                width: cropWidth,
                height: cropHeight,
              },
            });
            setSelectedElement(element.id);
          }
        }
        closeContextMenu();
      },
    }), [historyIndex, history, contextMenu.targetElement, selectedElement, elements, strokes, notifyChange, onToolChange, addTextToCanvas, resetZoomPan, closeContextMenu]);

    // Apply crop to image
    const applyCrop = useCallback(() => {
      if (!cropState.isActive || !cropState.elementId) return;

      const element = elements.find(el => el.id === cropState.elementId);
      if (!element || element.type !== 'image') return;

      // The crop selection is in full image display coordinates
      // Convert to normalized coordinates (0-1) relative to the full image
      const cropX = Math.max(0, Math.min(1, cropState.x / cropState.fullImageWidth));
      const cropY = Math.max(0, Math.min(1, cropState.y / cropState.fullImageHeight));
      const cropWidth = Math.max(0.1, Math.min(1 - cropX, cropState.width / cropState.fullImageWidth));
      const cropHeight = Math.max(0.1, Math.min(1 - cropY, cropState.height / cropState.fullImageHeight));

      // The new element size is the crop selection size
      const newElementWidth = cropState.width;
      const newElementHeight = cropState.height;

      // The new element position accounts for the crop offset from the original position
      // Original element was positioned where the old crop started
      // New position = original position + offset of new crop relative to old crop start
      const oldCropX = (element.cropX || 0) * cropState.fullImageWidth;
      const oldCropY = (element.cropY || 0) * cropState.fullImageHeight;
      const newElementX = cropState.originalElementX + (cropState.x - oldCropX);
      const newElementY = cropState.originalElementY + (cropState.y - oldCropY);

      const newElements = elements.map(el => {
        if (el.id === cropState.elementId && el.type === 'image') {
          return {
            ...el,
            // Update element position and size to match the crop selection
            x: newElementX,
            y: newElementY,
            width: newElementWidth,
            height: newElementHeight,
            // Update the crop coordinates relative to original image (0-1 range)
            cropX,
            cropY,
            cropWidth,
            cropHeight,
          };
        }
        return el;
      });

      setElements(newElements);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ strokes, elements: newElements });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      notifyChange(strokes, newElements);

      // Reset crop state
      setCropState({
        isActive: false,
        elementId: null,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fullImageWidth: 0,
        fullImageHeight: 0,
        originalElementX: 0,
        originalElementY: 0,
        originalElementWidth: 0,
        originalElementHeight: 0,
        initialCropX: 0,
        initialCropY: 0,
        draggingHandle: null,
        startX: 0,
        startY: 0,
        startCrop: { x: 0, y: 0, width: 100, height: 100 },
      });
    }, [cropState, elements, history, historyIndex, strokes, notifyChange]);

    // Cancel crop
    const cancelCrop = useCallback(() => {
      setCropState({
        isActive: false,
        elementId: null,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fullImageWidth: 0,
        fullImageHeight: 0,
        originalElementX: 0,
        originalElementY: 0,
        originalElementWidth: 0,
        originalElementHeight: 0,
        initialCropX: 0,
        initialCropY: 0,
        draggingHandle: null,
        startX: 0,
        startY: 0,
        startCrop: { x: 0, y: 0, width: 100, height: 100 },
      });
    }, []);



    // Keyboard shortcuts handler
    useEffect(() => {
      if (disabled) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Handle crop mode keyboard shortcuts
        if (cropState.isActive) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelCrop();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            applyCrop();
            return;
          }
          // Don't process other shortcuts while cropping
          return;
        }

        // Don't handle shortcuts when typing in text elements
        if (editingTextId) {
          if (e.key === 'Escape') {
            setEditingTextId(null);
            setSelectedElement(null);
          }
          return;
        }

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        // Undo: Ctrl/Cmd + Z
        if (isCtrlOrCmd && !isShift && KEYBOARD_SHORTCUTS.undo.includes(e.key)) {
          e.preventDefault();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setStrokes(history[newIndex]?.strokes || []);
            setElements(history[newIndex]?.elements || []);
            setSelectedElement(null);
          }
          return;
        }

        // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
        if (isCtrlOrCmd && (KEYBOARD_SHORTCUTS.redo.includes(e.key) || (isShift && e.key === 'z'))) {
          e.preventDefault();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setStrokes(history[newIndex]?.strokes || []);
            setElements(history[newIndex]?.elements || []);
            setSelectedElement(null);
          }
          return;
        }

        // Delete selected element
        if (KEYBOARD_SHORTCUTS.delete.includes(e.key) && selectedElement) {
          e.preventDefault();
          const newElements = elements.filter((el) => el.id !== selectedElement);
          setElements(newElements);
          setSelectedElement(null);

          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ strokes, elements: newElements });
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
          notifyChange(strokes, newElements);
          return;
        }

        // Escape: deselect
        if (KEYBOARD_SHORTCUTS.escape.includes(e.key)) {
          setSelectedElement(null);
          setEditingTextId(null);
          return;
        }

        // Tool shortcuts (only when not holding Ctrl/Cmd)
        if (!isCtrlOrCmd) {
          if (KEYBOARD_SHORTCUTS.pen.includes(e.key)) {
            onToolChange?.('pen');
            return;
          }
          if (KEYBOARD_SHORTCUTS.pencil.includes(e.key)) {
            onToolChange?.('pencil');
            return;
          }
          if (KEYBOARD_SHORTCUTS.highlighter.includes(e.key)) {
            onToolChange?.('highlighter');
            return;
          }
          if (KEYBOARD_SHORTCUTS.eraser.includes(e.key)) {
            onToolChange?.('eraser');
            return;
          }
          if (KEYBOARD_SHORTCUTS.select.includes(e.key)) {
            onToolChange?.('select');
            return;
          }
          if (KEYBOARD_SHORTCUTS.text.includes(e.key)) {
            onToolChange?.('text');
            return;
          }

          // Page navigation
          if (KEYBOARD_SHORTCUTS.addPage.includes(e.key)) {
            setTotalPages(prev => prev + 1);
            return;
          }
          if (KEYBOARD_SHORTCUTS.prevPage.includes(e.key)) {
            goToPage(currentPage - 1);
            return;
          }
        }

        // Zoom shortcuts
        if (isCtrlOrCmd) {
          if (KEYBOARD_SHORTCUTS.zoomIn.includes(e.key)) {
            e.preventDefault();
            setCanvasZoom(prev => Math.min(prev * 1.2, 5));
            return;
          }
          if (KEYBOARD_SHORTCUTS.zoomOut.includes(e.key)) {
            e.preventDefault();
            setCanvasZoom(prev => Math.max(prev / 1.2, 0.1));
            return;
          }
          if (KEYBOARD_SHORTCUTS.fitToScreen.includes(e.key)) {
            e.preventDefault();
            resetZoomPan();
            return;
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, editingTextId, historyIndex, history, selectedElement, elements, strokes, notifyChange, onToolChange, currentPage, goToPage, resetZoomPan, cropState.isActive, cancelCrop, applyCrop]);

    // Close context menu when clicking elsewhere (but not on scroll - menu follows scroll)
    useEffect(() => {
      const handleClickOutside = () => {
        if (contextMenu.isOpen) {
          closeContextMenu();
        }
      };

      window.addEventListener('click', handleClickOutside);

      return () => {
        window.removeEventListener('click', handleClickOutside);
      };
    }, [contextMenu.isOpen, closeContextMenu]);

    // Calculate context menu screen position (follows canvas pan/zoom)
    const contextMenuScreenPosition = useMemo(() => {
      if (!contextMenu.isOpen || !containerRef.current) {
        return { x: 0, y: 0 };
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const screenX = containerRect.left + canvasPan.x + contextMenu.canvasX * canvasZoom;
      const screenY = containerRect.top + canvasPan.y + contextMenu.canvasY * canvasZoom;

      // Adjust for viewport bounds
      const menuWidth = 220;
      const menuHeight = contextMenu.targetType === 'canvas' ? 380 : contextMenu.targetType === 'image' ? 200 : 220;
      const padding = 10;

      let x = screenX;
      let y = screenY;

      if (x + menuWidth + padding > window.innerWidth) {
        x = window.innerWidth - menuWidth - padding;
      }
      if (y + menuHeight + padding > window.innerHeight) {
        y = window.innerHeight - menuHeight - padding;
      }

      x = Math.max(padding, x);
      y = Math.max(padding, y);

      return { x, y };
    }, [contextMenu.isOpen, contextMenu.canvasX, contextMenu.canvasY, contextMenu.targetType, canvasPan.x, canvasPan.y, canvasZoom]);

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
          pageId: getPageFromY(point.y),
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
        // Check if we need to add a new page
        checkAndAddPage(point.y);
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
              ? { ...el, ...clampElementPosition(point.x - dragOffset.x, point.y - dragOffset.y, el.width, el.height) }
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
        // Check if we need to add a new page while drawing
        checkAndAddPage(point.y);
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
          points: currentStroke,
          color,
          size,
          tool,
          opacity: tool === "highlighter" ? 0.4 : 1,
          pageId: getPageFromY(currentStroke[0]?.y || 0),
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
        currentPage,
        totalPages,
        background,
        template,
      }),

      importState: (state: CanvasState) => {
        setStrokes(migrateStrokes(state.strokes || []));
        setElements(migrateElements(state.elements || []));
        setTotalPages(state.totalPages || 1);
        setCurrentPage(state.currentPage || 1);
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
            currentPage,
            totalPages,
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
            currentPage,
            totalPages,
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
        setTotalPages(1);
        setCurrentPage(1);
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

      // Page navigation methods
      goToPage: (pageNum: number) => {
        goToPage(pageNum);
      },

      addPage: () => {
        addPage();
      },

      getTotalPages: () => totalPages,

      getCurrentPage: () => currentPage,
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
        className={`relative w-full h-full bg-gray-200 dark:bg-gray-800 ${className}`}
        style={{
          touchAction: "none",
          minHeight: "400px",
          overflow: "hidden",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => handleContextMenu(e, undefined, undefined)}
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
            width: dimensions.width,
            height: dimensions.height,
          }}
        >
          {/* Main canvas for drawing - renders page backgrounds with gaps internally */}
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
          {elements.map((element) => {
            // When in crop mode for this element, use full image dimensions and adjusted position
            const isBeingCropped = cropState.isActive && cropState.elementId === element.id;
            // Use initialCropX/Y (fixed) instead of cropState.x/y (changes during drag) to keep element position stable
            const displayX = isBeingCropped ? cropState.originalElementX - cropState.initialCropX : element.x;
            const displayY = isBeingCropped ? cropState.originalElementY - cropState.initialCropY : element.y;
            const displayWidth = isBeingCropped ? cropState.fullImageWidth : element.width;
            const displayHeight = isBeingCropped ? cropState.fullImageHeight : element.height;

            return (
              <div
                key={element.id}
                className={`absolute ${selectedElement === element.id && !isBeingCropped ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                style={{
                  left: displayX,
                  top: displayY,
                  width: displayWidth,
                  height: displayHeight,
                  cursor: tool === "select" ? (isDraggingElement && selectedElement === element.id ? "grabbing" : "grab") : "default",
                  pointerEvents: tool === "select" || tool === "text" ? "auto" : "none",
                  touchAction: "none",
                }}
                onContextMenu={(e) => handleContextMenu(e, element.id, element.type)}
                onMouseDown={(e) => {
                  if (tool !== "select" || disabled) return;
                  e.stopPropagation();
                  setSelectedElement(element.id);
                  setIsDraggingElement(true);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    // Convert screen coordinates to virtual canvas coordinates by dividing by zoom
                    const point = { x: (e.clientX - rect.left - canvasPan.x) / canvasZoom, y: (e.clientY - rect.top - canvasPan.y) / canvasZoom };
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
                  // Convert screen coordinates to virtual canvas coordinates by dividing by zoom
                  const rawX = (e.clientX - rect.left - canvasPan.x) / canvasZoom - dragOffset.x;
                  const rawY = (e.clientY - rect.top - canvasPan.y) / canvasZoom - dragOffset.y;
                  // Clamp position within canvas bounds
                  const { x, y } = clampElementPosition(rawX, rawY, element.width, element.height);
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
                    // Convert screen coordinates to virtual canvas coordinates by dividing by zoom
                    const point = { x: (touch.clientX - rect.left - canvasPan.x) / canvasZoom, y: (touch.clientY - rect.top - canvasPan.y) / canvasZoom };
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
                  // Convert screen coordinates to virtual canvas coordinates by dividing by zoom
                  const rawX = (touch.clientX - rect.left - canvasPan.x) / canvasZoom - dragOffset.x;
                  const rawY = (touch.clientY - rect.top - canvasPan.y) / canvasZoom - dragOffset.y;
                  // Clamp position within canvas bounds
                  const { x, y } = clampElementPosition(rawX, rawY, element.width, element.height);
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
                  /* When in crop mode, render a special crop UI container at full image size */
                  cropState.isActive && cropState.elementId === element.id ? (
                    <div
                      className="relative overflow-visible"
                      style={{
                        width: cropState.fullImageWidth,
                        height: cropState.fullImageHeight,
                      }}
                    >
                      {/* Full image displayed */}
                      <img
                        src={element.src}
                        alt="Canvas element"
                        className="pointer-events-none select-none"
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'fill',
                        }}
                      />

                      {/* Dark overlay outside crop area */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Top */}
                        <div
                          className="absolute bg-black/60"
                          style={{
                            top: 0,
                            left: 0,
                            right: 0,
                            height: cropState.y,
                          }}
                        />
                        {/* Bottom */}
                        <div
                          className="absolute bg-black/60"
                          style={{
                            top: cropState.y + cropState.height,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        />
                        {/* Left */}
                        <div
                          className="absolute bg-black/60"
                          style={{
                            top: cropState.y,
                            left: 0,
                            width: cropState.x,
                            height: cropState.height,
                          }}
                        />
                        {/* Right */}
                        <div
                          className="absolute bg-black/60"
                          style={{
                            top: cropState.y,
                            left: cropState.x + cropState.width,
                            right: 0,
                            height: cropState.height,
                          }}
                        />
                      </div>

                      {/* Crop area border */}
                      <div
                        className="absolute border-2 border-white shadow-lg cursor-move"
                        style={{
                          left: cropState.x,
                          top: cropState.y,
                          width: cropState.width,
                          height: cropState.height,
                        }}
                        onMouseDown={(e) => startCropDrag(e, 'move')}
                        onTouchStart={(e) => startCropDrag(e, 'move')}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50" />
                          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50" />
                          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/50" />
                          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/50" />
                        </div>

                        {/* Corner handles */}
                        <div
                          className="absolute -left-2 -top-2 w-4 h-4 bg-white border-2 border-primary rounded-sm cursor-nw-resize"
                          onMouseDown={(e) => startCropDrag(e, 'nw')}
                          onTouchStart={(e) => startCropDrag(e, 'nw')}
                        />
                        <div
                          className="absolute -right-2 -top-2 w-4 h-4 bg-white border-2 border-primary rounded-sm cursor-ne-resize"
                          onMouseDown={(e) => startCropDrag(e, 'ne')}
                          onTouchStart={(e) => startCropDrag(e, 'ne')}
                        />
                        <div
                          className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border-2 border-primary rounded-sm cursor-sw-resize"
                          onMouseDown={(e) => startCropDrag(e, 'sw')}
                          onTouchStart={(e) => startCropDrag(e, 'sw')}
                        />
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-primary rounded-sm cursor-se-resize"
                          onMouseDown={(e) => startCropDrag(e, 'se')}
                          onTouchStart={(e) => startCropDrag(e, 'se')}
                        />

                        {/* Edge handles */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 -top-2 w-8 h-4 bg-white border-2 border-primary rounded-sm cursor-n-resize"
                          onMouseDown={(e) => startCropDrag(e, 'n')}
                          onTouchStart={(e) => startCropDrag(e, 'n')}
                        />
                        <div
                          className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-8 h-4 bg-white border-2 border-primary rounded-sm cursor-s-resize"
                          onMouseDown={(e) => startCropDrag(e, 's')}
                          onTouchStart={(e) => startCropDrag(e, 's')}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-8 bg-white border-2 border-primary rounded-sm cursor-w-resize"
                          onMouseDown={(e) => startCropDrag(e, 'w')}
                          onTouchStart={(e) => startCropDrag(e, 'w')}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-8 bg-white border-2 border-primary rounded-sm cursor-e-resize"
                          onMouseDown={(e) => startCropDrag(e, 'e')}
                          onTouchStart={(e) => startCropDrag(e, 'e')}
                        />
                      </div>

                      {/* Crop action buttons */}
                      <div
                        className="absolute flex gap-2"
                        style={{
                          left: cropState.x + cropState.width / 2,
                          top: cropState.y + cropState.height + 12,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelCrop();
                          }}
                          className="px-3 py-1.5 bg-background border rounded-md shadow-md text-sm hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            applyCrop();
                          }}
                          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md shadow-md text-sm hover:bg-primary/90 transition-colors flex items-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-full overflow-hidden">
                      {/* Image with crop applied */}
                      <div
                        className="w-full h-full"
                        style={{
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={element.src}
                          alt="Canvas element"
                          className="pointer-events-none select-none"
                          draggable={false}
                          style={{
                            ...(element.cropWidth && element.cropHeight && (element.cropWidth < 1 || element.cropHeight < 1 || element.cropX || element.cropY) ? {
                              // If cropped, scale and position the image to show only cropped area
                              // The image is scaled up so that the cropped portion fills the container
                              // Then offset so the crop area aligns with the container
                              width: `${100 / element.cropWidth}%`,
                              height: `${100 / element.cropHeight}%`,
                              marginLeft: `-${(element.cropX || 0) / element.cropWidth * 100}%`,
                              marginTop: `-${(element.cropY || 0) / element.cropHeight * 100}%`,
                              maxWidth: 'none',
                              maxHeight: 'none',
                            } : {
                              width: '100%',
                              height: '100%',
                              objectFit: 'fill',
                            }),
                          }}
                        />
                      </div>
                    </div>
                  )

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

                {/* Selection controls - hide when in crop mode */}
                {selectedElement === element.id && tool === "select" && !disabled && !isBeingCropped && (
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
            );
          })}
        </div>

        {/* Page navigation - outside zoom container */}
        <div className="absolute bottom-20 left-4 z-50 flex items-center gap-2">
          <div className="bg-background/90 backdrop-blur-sm border rounded-lg shadow-md flex items-center overflow-hidden">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-2 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <div className="px-3 py-1.5 text-sm font-medium border-x">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={addPage}
            className="bg-background/90 backdrop-blur-sm border rounded-lg px-2 py-1.5 shadow-md hover:bg-muted transition-colors flex items-center gap-1"
            title="Add new page"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Page</span>
          </button>
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

        {/* Custom Context Menu */}
        {contextMenu.isOpen && (
          <div
            className="fixed z-[100] bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl py-1 min-w-[200px]"
            style={{
              left: contextMenuScreenPosition.x,
              top: contextMenuScreenPosition.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Element Context Menu */}
            {contextMenu.targetType === 'image' && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Image
                </div>
                <button
                  onClick={contextMenuActions.selectElement}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                  Select
                </button>
                <button
                  onClick={contextMenuActions.cropImage}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Crop className="h-4 w-4 text-muted-foreground" />
                  Crop Image
                </button>
                <button
                  onClick={contextMenuActions.delete}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                  <span className="ml-auto text-xs text-muted-foreground">Del</span>
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={contextMenuActions.undo}
                  disabled={historyIndex <= 0}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Undo2 className="h-4 w-4 text-muted-foreground" />
                  Undo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Z</span>
                </button>
                <button
                  onClick={contextMenuActions.redo}
                  disabled={historyIndex >= history.length - 1}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Redo2 className="h-4 w-4 text-muted-foreground" />
                  Redo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Y</span>
                </button>
              </>
            )}

            {/* Text Element Context Menu */}
            {contextMenu.targetType === 'text' && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Text
                </div>
                <button
                  onClick={contextMenuActions.selectElement}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                  Select
                </button>
                <button
                  onClick={() => {
                    if (contextMenu.targetElement) {
                      setSelectedElement(contextMenu.targetElement);
                      setEditingTextId(contextMenu.targetElement);
                      onToolChange?.('select');
                    }
                    closeContextMenu();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Type className="h-4 w-4 text-muted-foreground" />
                  Edit Text
                </button>
                <button
                  onClick={contextMenuActions.delete}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                  <span className="ml-auto text-xs text-muted-foreground">Del</span>
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={contextMenuActions.undo}
                  disabled={historyIndex <= 0}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Undo2 className="h-4 w-4 text-muted-foreground" />
                  Undo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Z</span>
                </button>
                <button
                  onClick={contextMenuActions.redo}
                  disabled={historyIndex >= history.length - 1}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Redo2 className="h-4 w-4 text-muted-foreground" />
                  Redo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Y</span>
                </button>
              </>
            )}

            {/* Canvas Context Menu (no element selected) */}
            {contextMenu.targetType === 'canvas' && (
              <>
                {/* Edit actions */}
                <button
                  onClick={contextMenuActions.undo}
                  disabled={historyIndex <= 0}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Undo2 className="h-4 w-4 text-muted-foreground" />
                  Undo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Z</span>
                </button>
                <button
                  onClick={contextMenuActions.redo}
                  disabled={historyIndex >= history.length - 1}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Redo2 className="h-4 w-4 text-muted-foreground" />
                  Redo
                  <span className="ml-auto text-xs text-muted-foreground">⌘Y</span>
                </button>

                <div className="border-t my-1" />

                {/* Tool actions */}
                <button
                  onClick={contextMenuActions.pen}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <PenTool className="h-4 w-4 text-muted-foreground" />
                  Pen Tool
                  <span className="ml-auto text-xs text-muted-foreground">P</span>
                </button>
                <button
                  onClick={contextMenuActions.highlighter}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Highlighter className="h-4 w-4 text-muted-foreground" />
                  Highlighter
                  <span className="ml-auto text-xs text-muted-foreground">H</span>
                </button>
                <button
                  onClick={contextMenuActions.eraser}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Eraser className="h-4 w-4 text-muted-foreground" />
                  Eraser
                  <span className="ml-auto text-xs text-muted-foreground">E</span>
                </button>
                <button
                  onClick={contextMenuActions.select}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                  Select Tool
                  <span className="ml-auto text-xs text-muted-foreground">V</span>
                </button>

                <div className="border-t my-1" />

                {/* Insert actions */}
                <button
                  onClick={contextMenuActions.addText}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Type className="h-4 w-4 text-muted-foreground" />
                  Add Text
                  <span className="ml-auto text-xs text-muted-foreground">T</span>
                </button>
                <button
                  onClick={contextMenuActions.addImage}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  Add Image
                </button>
                <button
                  onClick={contextMenuActions.addPage}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <FilePlus className="h-4 w-4 text-muted-foreground" />
                  Add Page
                  <span className="ml-auto text-xs text-muted-foreground">]</span>
                </button>

                <div className="border-t my-1" />

                {/* View actions */}
                <button
                  onClick={contextMenuActions.zoomIn}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                  Zoom In
                  <span className="ml-auto text-xs text-muted-foreground">⌘+</span>
                </button>
                <button
                  onClick={contextMenuActions.zoomOut}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <ZoomOut className="h-4 w-4 text-muted-foreground" />
                  Zoom Out
                  <span className="ml-auto text-xs text-muted-foreground">⌘-</span>
                </button>
                <button
                  onClick={contextMenuActions.fitToScreen}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
                >
                  <Maximize className="h-4 w-4 text-muted-foreground" />
                  Fit to Screen
                  <span className="ml-auto text-xs text-muted-foreground">⌘0</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Keyboard shortcuts help - outside zoom container */}
        <div className="absolute bottom-4 right-4 z-50 group">
          <button
            className="bg-background/90 backdrop-blur-sm border rounded-lg p-2 shadow-md hover:bg-muted transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4 text-muted-foreground" />
          </button>
          {/* Tooltip with shortcuts */}
          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 text-xs">
            <div className="font-semibold mb-2 text-sm">Keyboard Shortcuts</div>
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between"><span>Pen tool</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">P</kbd></div>
              <div className="flex justify-between"><span>Eraser</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">E</kbd></div>
              <div className="flex justify-between"><span>Highlighter</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">H</kbd></div>
              <div className="flex justify-between"><span>Select</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">V</kbd></div>
              <div className="flex justify-between"><span>Text</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">T</kbd></div>
              <div className="border-t my-2" />
              <div className="flex justify-between"><span>Undo</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘/Ctrl + Z</kbd></div>
              <div className="flex justify-between"><span>Redo</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘/Ctrl + Y</kbd></div>
              <div className="flex justify-between"><span>Delete</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Del</kbd></div>
              <div className="border-t my-2" />
              <div className="flex justify-between"><span>Zoom in</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘/Ctrl + =</kbd></div>
              <div className="flex justify-between"><span>Zoom out</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘/Ctrl + -</kbd></div>
              <div className="flex justify-between"><span>Fit to screen</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘/Ctrl + 0</kbd></div>
              <div className="border-t my-2" />
              <div className="flex justify-between"><span>Add page</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">]</kbd></div>
              <div className="flex justify-between"><span>Prev page</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">[</kbd></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
