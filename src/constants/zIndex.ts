/**
 * Z-Index Token System
 *
 * Provides consistent layering hierarchy to prevent z-index conflicts
 * and ensure proper stacking order throughout the application
 */

// Base z-index values
const Z_INDEX_BASE = {
  // Background layers (negative values for backgrounds)
  BACKGROUND: -1,
  CANVAS_BACKGROUND: 0,

  // Content layers (1-99)
  CANVAS_CONTENT: 1,
  NODE_CONNECTIONS: 5,
  NODE_CONTENT: 10,
  NODE_SELECTED: 15,
  DRAG_PREVIEW: 20,

  // UI layers (100-999)
  TOOLBAR: 100,
  PANELS: 200,
  PANEL_HEADERS: 210,
  CONTROLS: 300,
  FLOATING_ELEMENTS: 400,
  TOOLTIPS: 500,
  NOTIFICATIONS: 600,

  // Overlay layers (1000-9999)
  OVERLAY: 1000,
  MODAL_BACKDROP: 2000,
  MODAL_CONTENT: 2100,
  DROPDOWN: 3000,
  CONTEXT_MENU: 4000,

  // Critical layers (10000+)
  LOADING_OVERLAY: 10000,
  ERROR_OVERLAY: 11000,
  DEBUG_OVERLAY: 12000,
} as const;

export const Z_INDEX = {
  // Canvas and viewport
  VIEWPORT_BACKGROUND: Z_INDEX_BASE.CANVAS_BACKGROUND,
  VIEWPORT_GRID: Z_INDEX_BASE.CANVAS_BACKGROUND + 1,
  VIEWPORT_MINIMAP: Z_INDEX_BASE.CONTROLS + 50,

  // Nodes and connections
  CONNECTION_DEFAULT: Z_INDEX_BASE.NODE_CONNECTIONS,
  CONNECTION_SELECTED: Z_INDEX_BASE.NODE_CONNECTIONS + 5,
  CONNECTION_HIGHLIGHTED: Z_INDEX_BASE.NODE_CONNECTIONS + 3,
  CONNECTION_BUNDLED: Z_INDEX_BASE.NODE_CONNECTIONS + 2,
  CONNECTION_ANIMATED: Z_INDEX_BASE.NODE_CONNECTIONS + 4,

  NODE_DEFAULT: Z_INDEX_BASE.NODE_CONTENT,
  NODE_SELECTED: Z_INDEX_BASE.NODE_SELECTED,
  NODE_HOVERED: Z_INDEX_BASE.NODE_CONTENT + 5,
  NODE_DRAGGING: Z_INDEX_BASE.DRAG_PREVIEW,
  NODE_OUTLINE: Z_INDEX_BASE.NODE_CONTENT - 1,
  NODE_PROCESSING: Z_INDEX_BASE.NODE_CONTENT + 8,

  // Node internals
  NODE_HANDLE: Z_INDEX_BASE.NODE_CONTENT + 10,
  NODE_TOOLBAR: Z_INDEX_BASE.NODE_CONTENT + 20,
  NODE_RESIZER: Z_INDEX_BASE.NODE_CONTENT + 15,
  NODE_LABEL: Z_INDEX_BASE.NODE_CONTENT + 5,

  // UI Panels
  LEFT_PANEL: Z_INDEX_BASE.PANELS,
  RIGHT_PANEL: Z_INDEX_BASE.PANELS,
  BOTTOM_PANEL: Z_INDEX_BASE.PANELS,
  PANEL_HEADER: Z_INDEX_BASE.PANEL_HEADERS,
  PANEL_CONTENT: Z_INDEX_BASE.PANELS + 10,
  PANEL_SCROLL: Z_INDEX_BASE.PANELS + 5,

  // Toolbar and controls
  MAIN_TOOLBAR: Z_INDEX_BASE.TOOLBAR,
  TOOLBAR_BUTTON: Z_INDEX_BASE.TOOLBAR + 10,
  TOOLBAR_DROPDOWN: Z_INDEX_BASE.TOOLBAR + 20,
  SEARCH_BAR: Z_INDEX_BASE.TOOLBAR + 30,

  VIEWPORT_CONTROLS: Z_INDEX_BASE.CONTROLS,
  ZOOM_CONTROLS: Z_INDEX_BASE.CONTROLS + 10,
  LAYOUT_CONTROLS: Z_INDEX_BASE.CONTROLS + 5,

  // Floating UI elements
  FLOATING_BUTTON: Z_INDEX_BASE.FLOATING_ELEMENTS,
  FLOATING_PANEL: Z_INDEX_BASE.FLOATING_ELEMENTS + 10,
  NODE_SELECTOR: Z_INDEX_BASE.FLOATING_ELEMENTS + 20,
  CONNECTION_MENU: Z_INDEX_BASE.FLOATING_ELEMENTS + 30,

  // Interactive overlays
  TOOLTIP: Z_INDEX_BASE.TOOLTIPS,
  TOOLTIP_ARROW: Z_INDEX_BASE.TOOLTIPS + 1,
  POPOVER: Z_INDEX_BASE.TOOLTIPS + 10,

  TOAST_NOTIFICATION: Z_INDEX_BASE.NOTIFICATIONS,
  STATUS_INDICATOR: Z_INDEX_BASE.NOTIFICATIONS + 10,
  PROGRESS_BAR: Z_INDEX_BASE.NOTIFICATIONS + 5,

  // Dropdowns and menus
  DROPDOWN_MENU: Z_INDEX_BASE.DROPDOWN,
  DROPDOWN_ITEM: Z_INDEX_BASE.DROPDOWN + 1,
  CONTEXT_MENU: Z_INDEX_BASE.CONTEXT_MENU,
  CONTEXT_MENU_ITEM: Z_INDEX_BASE.CONTEXT_MENU + 1,

  // Modal system
  MODAL_BACKDROP: Z_INDEX_BASE.MODAL_BACKDROP,
  MODAL_CONTAINER: Z_INDEX_BASE.MODAL_CONTENT,
  MODAL_HEADER: Z_INDEX_BASE.MODAL_CONTENT + 10,
  MODAL_BODY: Z_INDEX_BASE.MODAL_CONTENT + 5,
  MODAL_FOOTER: Z_INDEX_BASE.MODAL_CONTENT + 8,
  MODAL_CLOSE_BUTTON: Z_INDEX_BASE.MODAL_CONTENT + 15,

  // Settings and configuration
  SETTINGS_MODAL: Z_INDEX_BASE.MODAL_CONTENT + 100,
  TAG_MANAGER: Z_INDEX_BASE.MODAL_CONTENT + 50,

  // Development and debugging
  PERFORMANCE_DASHBOARD: Z_INDEX_BASE.DEBUG_OVERLAY,
  ERROR_BOUNDARY: Z_INDEX_BASE.ERROR_OVERLAY,
  LOADING_SCREEN: Z_INDEX_BASE.LOADING_OVERLAY,
  DEVELOPMENT_TOOLS: Z_INDEX_BASE.DEBUG_OVERLAY + 100,
} as const;

export const ZIndexUtils = {
  getLayer: (layer: keyof typeof Z_INDEX, offset: number = 0): number => {
    return Z_INDEX[layer] + offset;
  },

  createStack: (baseLayer: keyof typeof Z_INDEX, count: number): number[] => {
    const base = Z_INDEX[baseLayer];
    return Array.from({ length: count }, (_, i) => base + i);
  },

  getHighestInCategory: (category: "CONTENT" | "UI" | "OVERLAY" | "CRITICAL"): number => {
    switch (category) {
      case "CONTENT":
        return 99;
      case "UI":
        return 999;
      case "OVERLAY":
        return 9999;
      case "CRITICAL":
        return 99999;
      default:
        return 0;
    }
  },

  validateZIndex: (zIndex: number, expectedCategory: keyof typeof Z_INDEX): boolean => {
    const value = Z_INDEX[expectedCategory];
    const tolerance = 100; // Allow some flexibility within category
    return Math.abs(zIndex - value) <= tolerance;
  },

  toCSSCustomProperties: (): Record<string, string> => {
    const cssProps: Record<string, string> = {};

    for (const [key, value] of Object.entries(Z_INDEX)) {
      const cssVarName = `--z-${key.toLowerCase().replace(/_/g, "-")}`;
      cssProps[cssVarName] = value.toString();
    }

    return cssProps;
  },

  toTailwindUtilities: (): Record<string, string> => {
    const utilities: Record<string, string> = {};

    for (const [key, value] of Object.entries(Z_INDEX)) {
      const utilityName = key.toLowerCase().replace(/_/g, "-");
      utilities[`z-${utilityName}`] = `z-[${value}]`;
    }

    return utilities;
  },

  getInteractiveState: (
    baseLayer: keyof typeof Z_INDEX,
    state: "default" | "hover" | "active" | "focus"
  ): number => {
    const base = Z_INDEX[baseLayer];

    switch (state) {
      case "hover":
        return base + 1;
      case "active":
        return base + 2;
      case "focus":
        return base + 1;
      default:
        return base;
    }
  },
};

export const zIndexStyles = {
  layer: (layer: keyof typeof Z_INDEX, offset: number = 0) => ({
    zIndex: Z_INDEX[layer] + offset,
  }),

  stack: (baseLayer: keyof typeof Z_INDEX, index: number) => ({
    zIndex: Z_INDEX[baseLayer] + index,
  }),

  interactive: (baseLayer: keyof typeof Z_INDEX) => ({
    zIndex: Z_INDEX[baseLayer],
    "&:hover": {
      zIndex: Z_INDEX[baseLayer] + 1,
    },
    "&:active": {
      zIndex: Z_INDEX[baseLayer] + 2,
    },
    "&:focus-visible": {
      zIndex: Z_INDEX[baseLayer] + 1,
    },
  }),
};

export type ZIndexToken = keyof typeof Z_INDEX;

export default Z_INDEX;
