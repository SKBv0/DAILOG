import { useEffect } from "react";
import { ReactFlowProvider } from "reactflow";
import AppContent from "./components/AppContent";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor } from "./components/PerformanceMonitor";
import { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";
import { useHistoryStore } from "./store/historyStore";
import { ThemeProvider } from "./theme/ThemeProvider";
import { performanceProfiler, usePerformanceTracker } from "./utils/performanceProfiler";
import logger from "./utils/logger";
import "./utils/performanceLogger"; // Initialize performance logger

const App = (): JSX.Element => {
  const perfTracker = usePerformanceTracker("App");

  usePerformanceMonitor({
    componentName: "App",
    trackRenders: true,
    trackMemory: true,
    reportInterval: 30000, // 30 seconds
  });

  useEffect(() => {
    perfTracker.startMeasurement("initialization");

    const historyStore = useHistoryStore.getState();
    historyStore.loadFromLocalStorage();

    const handleBeforeUnload = () => {
      const historyStore = useHistoryStore.getState();
      historyStore.saveToLocalStorage();
      const report = performanceProfiler.generateReport();
      logger.info("App Final Performance Report:", report);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    perfTracker.endMeasurement("initialization");

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [perfTracker]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReactFlowProvider>
          <PerformanceMonitor />
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </ReactFlowProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
