let storageAvailable: boolean | null = null;

function canUseStorage(): boolean {
  if (storageAvailable !== null) {
    return storageAvailable;
  }

  try {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      storageAvailable = false;
      return storageAvailable;
    }

    const testKey = "__dialog_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);

    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }

  return storageAvailable;
}

export const safeStorage = {
  get(key: string): string | null {
    if (!canUseStorage()) return null;

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    if (!canUseStorage()) return false;

    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): boolean {
    if (!canUseStorage()) return false;

    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
