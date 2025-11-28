import { DialogNode } from "../types/dialog";
import { Connection } from "../types/editor";
import { ProjectType } from "../types/project";
import { toast } from "react-hot-toast";
import { safeStorage } from "./safeStorage";

export const DIALOG_FLOW_STORAGE_KEY = "dialog-flow-state";

interface DialogFlowState {
  nodes: DialogNode[];
  connections: Connection[];
  projectType: ProjectType;
}

let saveTimeout: number | null = null;
let lastSavedData: string | null = null;
const SAVE_DEBOUNCE_TIME = 500;
const STORAGE_ERROR_COOLDOWN_MS = 5000;
let lastStorageErrorAt: number | null = null;

export const saveDialogFlow = (
  nodes: DialogNode[],
  connections: Connection[],
  projectType: ProjectType
): void => {
  try {
    const dialogFlow: DialogFlowState = { nodes, connections, projectType };
    const jsonData = JSON.stringify(dialogFlow);

    if (jsonData === lastSavedData) {
      return;
    }

    if (saveTimeout !== null) {
      window.clearTimeout(saveTimeout);
    }

    saveTimeout = window.setTimeout(() => {
      try {
        const ok = safeStorage.set(DIALOG_FLOW_STORAGE_KEY, jsonData);
        if (ok) {
          lastSavedData = jsonData;
        } else {
          throw new Error("storage unavailable");
        }
      } catch (error) {
        const now = Date.now();
        if (!lastStorageErrorAt || now - lastStorageErrorAt > STORAGE_ERROR_COOLDOWN_MS) {
          toast.error("Dialog not saved: storage is full. Please export or clear old projects.");
          lastStorageErrorAt = now;
        }
        // Preserve the timeout state so we don't keep scheduling writes
        console.error("Failed to save dialog flow to localStorage", error);
      } finally {
        saveTimeout = null;
      }
    }, SAVE_DEBOUNCE_TIME);
  } catch {
  }
};

export const loadDialogFlow = (): DialogFlowState | null => {
  try {
    const savedData = safeStorage.get(DIALOG_FLOW_STORAGE_KEY);
    if (!savedData) {
      return null;
    }

    lastSavedData = savedData;

    return JSON.parse(savedData) as DialogFlowState;
  } catch {
    return null;
  }
};

export const clearDialogFlow = (): void => {
  try {
    safeStorage.remove(DIALOG_FLOW_STORAGE_KEY);
    lastSavedData = null;
  } catch {
  }
};

export const hasStoredDialogFlow = (): boolean => {
  return !!safeStorage.get(DIALOG_FLOW_STORAGE_KEY);
};
