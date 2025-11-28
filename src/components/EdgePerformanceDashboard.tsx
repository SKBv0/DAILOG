import React, { useState, useEffect } from 'react';
import { useEdgePathCache } from '../utils/edgePathCache';
import { useEdgePreloader } from '../utils/edgePreloader';
import { edgePerformanceTracker } from '../hooks/useEdgePerformance';
import { isFeatureEnabled } from '../config/features';

interface EdgePerformanceDashboardProps {
  isVisible?: boolean;
  onToggle?: () => void;
}

const EdgePerformanceDashboard: React.FC<EdgePerformanceDashboardProps> = ({
  isVisible = false,
  onToggle,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  
  const edgeCache = useEdgePathCache();
  const preloader = useEdgePreloader();

  useEffect(() => {
    if (!isVisible || !isFeatureEnabled('PERFORMANCE_TOOLS')) return;

    const updateStats = () => {
      const cacheStats = edgeCache.getStats();
      const preloaderStats = preloader.getStats();
      const trackerStats = edgePerformanceTracker.getGlobalStats();
      
      setStats({
        cache: cacheStats,
        preloader: preloaderStats,
        performance: trackerStats,
        memoryUsage: edgeCache.getMemoryUsage(),
      });
    };

    updateStats();
    const interval = setInterval(updateStats, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isVisible, refreshInterval, edgeCache, preloader]);

  if (!isFeatureEnabled('PERFORMANCE_TOOLS') || !isVisible || !stats) {
    return null;
  }

  const handleClearCache = () => {
    edgeCache.clear();
    preloader.clear();
    edgePerformanceTracker.clear();
  };

  const handleExportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      cache: stats.cache,
      preloader: stats.preloader,
      performance: stats.performance,
      detailedReport: edgePerformanceTracker.generateReport(),
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edge-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-white min-w-96">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold">🚀 Edge Performance</h3>
        <div className="flex gap-2">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1"
          >
            <option value={500}>0.5s</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
          </select>
          <button
            onClick={handleClearCache}
            className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
            title="Clear all caches"
          >
            Clear
          </button>
          <button
            onClick={handleExportReport}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
            title="Export performance report"
          >
            Export
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-4 text-xs max-h-80 overflow-y-auto">
        <div>
          <h4 className="text-yellow-400 font-medium mb-2">📦 Cache Performance</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400">Enabled:</span>
              <span className={`ml-2 ${stats.cache.enabled ? 'text-green-400' : 'text-red-400'}`}>
                {stats.cache.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Memory:</span>
              <span className="ml-2 text-blue-400">{stats.memoryUsage}</span>
            </div>
            <div>
              <span className="text-gray-400">Hit Rate:</span>
              <span className={`ml-2 ${stats.cache.hitRate > 80 ? 'text-green-400' : 
                stats.cache.hitRate > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.cache.hitRate.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Cache Size:</span>
              <span className="ml-2 text-purple-400">
                {stats.cache.cache.size}/{stats.cache.cache.maxSize}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Hits:</span>
              <span className="ml-2 text-green-400">{stats.cache.hitCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Misses:</span>
              <span className="ml-2 text-red-400">{stats.cache.missCount}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-green-400 font-medium mb-2">⚡ Render Performance</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400">Total Edges:</span>
              <span className="ml-2 text-blue-400">{stats.performance.totalEdges}</span>
            </div>
            <div>
              <span className="text-gray-400">Total Renders:</span>
              <span className="ml-2 text-purple-400">{stats.performance.totalRenders}</span>
            </div>
            <div>
              <span className="text-gray-400">Avg Time:</span>
              <span className={`ml-2 ${stats.performance.averageRenderTime < 2 ? 'text-green-400' : 
                stats.performance.averageRenderTime < 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.performance.averageRenderTime.toFixed(2)}ms
              </span>
            </div>
            <div>
              <span className="text-gray-400">Max Time:</span>
              <span className="ml-2 text-orange-400">{stats.performance.maxRenderTime.toFixed(2)}ms</span>
            </div>
            <div>
              <span className="text-gray-400">Performance:</span>
              <span className={`ml-2 ${stats.performance.performanceScore > 80 ? 'text-green-400' : 
                stats.performance.performanceScore > 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.performance.performanceScore}/100
              </span>
            </div>
            <div>
              <span className="text-gray-400">Saved:</span>
              <span className="ml-2 text-green-400">{stats.cache.performance.computationsSaved}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-purple-400 font-medium mb-2">🔄 Preloader</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400">Active:</span>
              <span className={`ml-2 ${stats.preloader.isPreloading ? 'text-yellow-400' : 'text-gray-500'}`}>
                {stats.preloader.isPreloading ? 'Loading...' : 'Idle'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Preloaded:</span>
              <span className="ml-2 text-blue-400">{stats.preloader.preloadedCount}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-orange-400 font-medium mb-2">💾 Memory Efficiency</h4>
          <div className="text-xs">
            <div>
              <span className="text-gray-400">Avg Access:</span>
              <span className="ml-2 text-green-400">
                {stats.cache.cache.averageAccess.toFixed(1)}x
              </span>
            </div>
            <div>
              <span className="text-gray-400">Total Access:</span>
              <span className="ml-2 text-blue-400">{stats.cache.cache.totalAccess}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EdgePerformanceDashboard;