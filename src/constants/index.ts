// Timing constants (in milliseconds)
export const TIMING = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  ANIMATION_DURATION: 150,
  TOAST_DURATION: 3000,
  API_TIMEOUT: 30000,
  AUTO_SAVE_DELAY: 1000,
  PROCESSING_CHECK_INTERVAL: 100,
} as const;

// Size limits
export const LIMITS = {
  MAX_DIALOG_LENGTH: 5000,
  MAX_TAG_LABEL_LENGTH: 100,
  MAX_TAG_CONTENT_LENGTH: 1000,
  MAX_NODES: 500,
  MAX_CONNECTIONS: 1000,
  MAX_UNDO_HISTORY: 50,
  MAX_AI_HISTORY: 100,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Viewport settings
export const VIEWPORT = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 2,
  DEFAULT_ZOOM: 1,
  ZOOM_STEP: 0.1,
  PAN_SPEED: 1,
  GRID_SIZE: 20,
  SNAP_THRESHOLD: 10,
} as const;

// Node settings
export const NODE = {
  DEFAULT_WIDTH: 200,
  DEFAULT_HEIGHT: 100,
  MIN_WIDTH: 150,
  MAX_WIDTH: 400,
  HANDLE_SIZE: 10,
  PADDING: 16,
  BORDER_WIDTH: 2,
  SELECTION_BORDER_WIDTH: 3,
} as const;

// Colors (for non-theme colors like status indicators)
export const STATUS_COLORS = {
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
  INFO: '#3B82F6',
  PROCESSING: '#8B5CF6',
} as const;

// Tag importance levels
export const TAG_IMPORTANCE = {
  MIN: 1,
  LOW: 2,
  NORMAL: 3,
  HIGH: 4,
  CRITICAL: 5,
} as const;

// API endpoints
export const API = {
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_GENERATE: '/api/generate',
  OLLAMA_MODELS: '/api/tags',
  OLLAMA_PULL: '/api/pull',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  PROJECT_DATA: 'dialogFlow',
  SETTINGS: 'dialogSettings',
  HISTORY: 'dialogHistory',
  AI_HISTORY: 'aiHistory',
  TAGS: 'projectTags',
  THEME: 'appTheme',
  LAST_PROJECT_TYPE: 'lastProjectType',
} as const;

// Keyboard shortcuts
export const SHORTCUTS = {
  SAVE: 'Ctrl+S',
  UNDO: 'Ctrl+Z',
  REDO: 'Ctrl+Y',
  DELETE: 'Delete',
  SELECT_ALL: 'Ctrl+A',
  COPY: 'Ctrl+C',
  PASTE: 'Ctrl+V',
  CUT: 'Ctrl+X',
  ZOOM_IN: 'Ctrl+=',
  ZOOM_OUT: 'Ctrl+-',
  ZOOM_RESET: 'Ctrl+0',
} as const;

// Animation durations (CSS)
export const ANIMATION = {
  FADE_IN: '0.15s ease-in',
  FADE_OUT: '0.15s ease-out',
  SLIDE_IN: '0.2s ease-out',
  BOUNCE: '0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  PULSE: '1.5s infinite ease-in-out',
} as const;