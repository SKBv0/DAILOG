import { useState, useEffect, useCallback } from 'react';
import { isFeatureEnabled } from '../config/features';
import logger from '../utils/logger';

export interface DevToolsState {
  isEdgePerformanceVisible: boolean;
  isPerformanceProfilerVisible: boolean;
  isTagManagerVisible: boolean;
}

export function useDevTools() {
  const [devToolsState, setDevToolsState] = useState<DevToolsState>({
    isEdgePerformanceVisible: false,
    isPerformanceProfilerVisible: false,
    isTagManagerVisible: false,
  });

  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setIsEnabled(
      import.meta.env.DEV && 
      isFeatureEnabled('PERFORMANCE_TOOLS')
    );
  }, []);

  const toggleEdgePerformance = useCallback(() => {
    if (!isEnabled) return;
    
    setDevToolsState(prev => ({
      ...prev,
      isEdgePerformanceVisible: !prev.isEdgePerformanceVisible,
    }));
  }, [isEnabled]);

  const togglePerformanceProfiler = useCallback(() => {
    if (!isEnabled) return;
    
    setDevToolsState(prev => ({
      ...prev,
      isPerformanceProfilerVisible: !prev.isPerformanceProfilerVisible,
    }));
  }, [isEnabled]);

  const toggleTagManager = useCallback(() => {
    if (!isEnabled) return;
    
    setDevToolsState(prev => ({
      ...prev,
      isTagManagerVisible: !prev.isTagManagerVisible,
    }));
  }, [isEnabled]);

  const hideAll = useCallback(() => {
    setDevToolsState({
      isEdgePerformanceVisible: false,
      isPerformanceProfilerVisible: false,
      isTagManagerVisible: false,
    });
  }, []);

  // Keyboard shortcuts for development
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only respond to shortcuts when Ctrl+Shift is held
      if (!event.ctrlKey || !event.shiftKey) return;

      switch (event.code) {
        case 'KeyE':
          event.preventDefault();
          toggleEdgePerformance();
          break;
        case 'KeyP':
          event.preventDefault();
          togglePerformanceProfiler();
          break;
        case 'KeyT':
          event.preventDefault();
          toggleTagManager();
          break;
        case 'KeyH':
          event.preventDefault();
          hideAll();
          break;
        case 'KeyD':
          event.preventDefault();
          logger.debug('🛠️ DevTools Shortcuts:', {
            'Ctrl+Shift+E': 'Toggle Edge Performance Dashboard',
            'Ctrl+Shift+P': 'Toggle Performance Profiler',
            'Ctrl+Shift+T': 'Toggle Tag Manager',
            'Ctrl+Shift+H': 'Hide All',
            'Ctrl+Shift+D': 'Show This Help',
          });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    if (isEnabled) {
      logger.debug('🛠️ Development Tools Enabled - Press Ctrl+Shift+D for keyboard shortcuts');
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isEnabled, toggleEdgePerformance, togglePerformanceProfiler, toggleTagManager, hideAll]);

  return {
    isEnabled,
    state: devToolsState,
    toggleEdgePerformance,
    togglePerformanceProfiler,
    toggleTagManager,
    hideAll,
  };
}

// Global development utilities
export const devUtils = {
  logEdgeCache: () => {
    if (import.meta.env.DEV && (window as any).__edgePathCache) {
      console.table((window as any).__edgePathCache.getStats());
    }
  },
  
  logEdgePreloader: () => {
    if (import.meta.env.DEV && (window as any).__edgePreloader) {
      console.table((window as any).__edgePreloader.getStats());
    }
  },
  
  logPerformanceProfiler: () => {
    if (import.meta.env.DEV && (window as any).__performanceProfiler) {
      logger.debug('Performance Profiler Report', (window as any).__performanceProfiler.generateReport());
    }
  },
  
  clearAllCaches: () => {
    if (import.meta.env.DEV) {
      if ((window as any).__edgePathCache) {
        (window as any).__edgePathCache.clear();
        logger.debug('🧹 Edge cache cleared');
      }
      if ((window as any).__edgePreloader) {
        (window as any).__edgePreloader.clear();
        logger.debug('🧹 Edge preloader cleared');
      }
      logger.debug('✨ All caches cleared');
    }
  },
};

// Make devUtils available globally in development
if (import.meta.env.DEV) {
  (window as any).__devUtils = devUtils;
}