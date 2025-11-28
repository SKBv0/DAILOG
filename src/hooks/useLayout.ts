import { useState, useCallback } from "react";
import type { ProjectType } from "../types/project";
import { safeStorage } from "../utils/safeStorage";

export function useLayout() {
  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<"flow" | "tree" | "read">("flow");
  const [viewMode, setViewMode] = useState<"grid" | "single">("grid");
  const [projectType, setProjectType] = useState<ProjectType>("game");
  const [detectTestContent, setDetectTestContent] = useState<boolean>(false);

  const handleProjectTypeChange = useCallback((newType: ProjectType) => {
    setProjectType(newType);

    safeStorage.set("current-project-type", newType);

    const existingMenu = document.getElementById("connection-menu-container");
    if (existingMenu) {
      existingMenu.remove();
    }

    window.dispatchEvent(new CustomEvent("projectTypeChanged", { detail: newType }));

    const closeFlowGeneratorModals = () => {
      const modals = document.querySelectorAll(".FlowGenerator");
      if (modals.length > 0) {
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      }
    };

    setTimeout(() => {
      closeFlowGeneratorModals();

      safeStorage.remove("flowgenerator-state");
    }, 0);

    safeStorage.set("last-project-type", newType);
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setShowLeftPanel((prev) => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((prev) => !prev);
  }, []);

  return {
    showLeftPanel,
    setShowLeftPanel,
    showRightPanel,
    setShowRightPanel,
    isSettingsOpen,
    setIsSettingsOpen,
    activeMode,
    setActiveMode,
    viewMode,
    setViewMode,
    projectType,
    setProjectType,
    detectTestContent,
    setDetectTestContent,
    handleProjectTypeChange,
    toggleLeftPanel,
    toggleRightPanel,
  };
}
