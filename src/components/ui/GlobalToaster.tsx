import React from "react";
import { Toaster, ToastBar, toast } from "react-hot-toast";

const iconByType: Record<string, React.ReactNode> = {
  success: (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
  ),
  error: (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-300">!</span>
  ),
  loading: (
    <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
  ),
  blank: (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-500/20 text-gray-300">•</span>
  ),
};

export const GlobalToaster: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder
      gutter={8}
      toastOptions={{
        duration: 2500,
        // Base container style (overridable by className)
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
        },
        className: "!p-0",
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ message }) => (
            <div
              className={`min-w-[260px] max-w-[360px] px-3 py-2 rounded-lg border shadow-lg backdrop-blur-md
                ${
                  t.type === "success"
                    ? "border-emerald-600/30 bg-[#0b1a12]/90"
                    : t.type === "error"
                    ? "border-rose-600/30 bg-[#1a0b0e]/90"
                    : t.type === "loading"
                    ? "border-blue-600/30 bg-[#0b121a]/90"
                    : "border-gray-600/30 bg-[#0b0b0c]/90"
                }
                text-gray-100 flex items-start gap-2 relative overflow-hidden`}
            >
              <div className="mt-0.5">{iconByType[t.type] || iconByType.blank}</div>
              <div className="text-sm leading-snug flex-1">{message as any}</div>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="ml-2 text-xs text-gray-400 hover:text-gray-200"
                aria-label="Dismiss"
              >
                ✕
              </button>

              <div
                className={`absolute left-0 right-0 bottom-0 h-0.5 
                  ${
                    t.type === "success"
                      ? "bg-emerald-500/60"
                      : t.type === "error"
                      ? "bg-rose-500/60"
                      : t.type === "loading"
                      ? "bg-blue-500/60"
                      : "bg-gray-500/50"
                  }
                `}
                style={{
                  transformOrigin: "left",
                  animation: "toast-progress linear",
                  animationDuration: `${Math.max(t.duration || 2500, 1200)}ms`,
                }}
              />
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
};

export default GlobalToaster;

// Inject keyframes once
if (typeof document !== "undefined") {
  const id = "global-toaster-keyframes";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      @keyframes toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    `;
    document.head.appendChild(style);
  }
}

// Stack limit (deduplicate same-type & same-message toasts)
// - Groups bursts within a short window
// - Updates a single toast with xN badge instead of spamming
// - Caps growth with MAX_STACK
if (typeof window !== "undefined" && !(window as any).__toastStackPatched) {
  (window as any).__toastStackPatched = true;

  type ToastType = "success" | "error" | "loading" | "blank";
  const STACK_WINDOW_MS = 2000;
  const MAX_STACK = 5;

  const stacks = new Map<string, { id: string; count: number; last: number; timeout?: any }>();

  const keyOf = (type: ToastType, message: any) => {
    const text = typeof message === "string" ? message : String(message);
    return `${type}|${text}`;
  };

  const renderMessage = (message: any, count: number) => (
    <span className="inline-flex items-center gap-1">
      <span>{message}</span>
      {count > 1 && (
        <span className="px-1 rounded bg-gray-700/60 text-gray-200 text-[10px] border border-gray-600/60">
          x{Math.min(count, MAX_STACK)}
        </span>
      )}
    </span>
  );

  const patch = (type: ToastType) => {
    const original: any = (toast as any)[type] || toast;
    (toast as any)[type] = (message: any, opts: any = {}) => {
      try {
        const now = Date.now();
        const key = keyOf(type, message);
        const existing = stacks.get(key);

        if (existing && now - existing.last < STACK_WINDOW_MS) {
          existing.count = Math.min(existing.count + 1, MAX_STACK);
          existing.last = now;
          clearTimeout(existing.timeout);
          existing.timeout = setTimeout(() => stacks.delete(key), (opts.duration ?? 2500) + 600);
          return original(renderMessage(message, existing.count), { id: existing.id, ...opts });
        }

        const id = `stack:${key}`;
        const record = { id, count: 1, last: now, timeout: undefined as any };
        record.timeout = setTimeout(() => stacks.delete(key), (opts.duration ?? 2500) + 600);
        stacks.set(key, record);
        return original(renderMessage(message, 1), { id, ...opts });
      } catch (e) {
        return original(message, opts);
      }
    };
  };

  ["success", "error", "loading", "blank"].forEach((t) => patch(t as ToastType));
}


