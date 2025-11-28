/**
 * Vitest test setup file
 */
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL for file handling tests
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Web Workers
class MockWorker {
  url: string;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (error: ErrorEvent) => void;

  constructor(url: string) {
    this.url = url;
  }

  postMessage(message: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: { success: true, project: message.data },
        } as MessageEvent);
      }
    }, 0);
  }

  terminate() {
    // Mock termination
  }
}

global.Worker = MockWorker as any;

// Mock console methods in tests to reduce noise
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args: any[]) => {
  // Only show warnings that aren't from React testing patterns
  if (
    !args.some((arg) =>
      typeof arg === 'string' &&
      (arg.includes('Warning: ReactDOM.render is no longer supported') ||
       arg.includes('Warning: validateDOMNesting'))
    )
  ) {
    originalConsoleWarn(...args);
  }
};

console.error = (...args: any[]) => {
  // Only show errors that aren't expected test errors
  if (
    !args.some((arg) =>
      typeof arg === 'string' &&
      (arg.includes('Error: Not implemented') ||
       arg.includes('Warning:'))
    )
  ) {
    originalConsoleError(...args);
  }
};

// Extend expect with custom matchers for our domain
expect.extend({
  toBeValidDialogProject(received: any) {
    const { isValid } = received;
    return {
      message: () =>
        isValid
          ? `Expected project to be invalid, but it was valid`
          : `Expected project to be valid, but it had ${received.errors?.length || 0} errors`,
      pass: isValid === true,
    };
  },

  toHaveValidNodeId(received: string, nodeType?: string) {
    const hasValidFormat = /^(npcDialog|playerResponse|choiceNode|narratorNode|branchingNode|enemyDialog|sceneDescription|sceneNode|customNode)_[a-zA-Z0-9]+$/.test(received);
    const matchesType = nodeType ? received.startsWith(nodeType + '_') : true;
    
    return {
      message: () =>
        hasValidFormat && matchesType
          ? `Expected ${received} to be invalid node ID`
          : `Expected ${received} to be valid node ID${nodeType ? ` for type ${nodeType}` : ''}`,
      pass: hasValidFormat && matchesType,
    };
  },

  toHaveUniqueIds(received: Array<{ id: string }>) {
    const ids = received.map(item => item.id);
    const uniqueIds = new Set(ids);
    const hasUniqueIds = ids.length === uniqueIds.size;
    
    return {
      message: () =>
        hasUniqueIds
          ? `Expected array to have duplicate IDs`
          : `Expected all IDs to be unique, but found duplicates: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(', ')}`,
      pass: hasUniqueIds,
    };
  },
});

// Declare custom matchers for TypeScript
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidDialogProject(): any;
      toHaveValidNodeId(nodeType?: string): any;
      toHaveUniqueIds(): any;
    }
  }
}

// Mock local storage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Zustand stores for testing
vi.mock('../store/historyStore', () => ({
  useHistoryStore: vi.fn(() => ({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    pushState: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

// Mock React Flow for testing
vi.mock('reactflow', () => ({
  ReactFlow: vi.fn(() => 'div'),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useReactFlow: vi.fn(() => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    fitView: vi.fn(),
    project: vi.fn(),
    screenToFlowPosition: vi.fn(),
  })),
  Background: vi.fn(() => 'div'),
  Controls: vi.fn(() => 'div'),
  MiniMap: vi.fn(() => 'div'),
  Handle: vi.fn(() => 'div'),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
}));

// Mock framer-motion for testing
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(() => 'div'),
    button: vi.fn(() => 'button'),
    span: vi.fn(() => 'span'),
  },
  AnimatePresence: vi.fn(() => null),
}));

// Mock toast notifications for testing
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: vi.fn(() => 'div'),
}));