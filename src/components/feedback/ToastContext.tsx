import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: {
    (options: ToastOptions | string): string;
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    warning: (message: string, title?: string) => string;
    info: (message: string, title?: string) => string;
  };
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 4000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback((options: ToastOptions | string): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const normalized: ToastItem =
      typeof options === "string"
        ? {
            id,
            message: options,
            variant: "info",
            durationMs: DEFAULT_DURATION_MS,
            createdAt: Date.now(),
          }
        : {
            id,
            title: options.title,
            message: options.message,
            variant: options.variant || "info",
            durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
            createdAt: Date.now(),
          };

    setToasts((prev) => {
      // Limit to MAX_TOASTS (Section 28 Toast Queue)
      const updated = [...prev, normalized];
      return updated.length > MAX_TOASTS ? updated.slice(updated.length - MAX_TOASTS) : updated;
    });

    return id;
  }, []);

  const toastMethods = useMemo(() => {
    const fn = (options: ToastOptions | string) => addToast(options);
    fn.success = (message: string, title?: string) =>
      addToast({ message, title, variant: "success" });
    fn.error = (message: string, title?: string) =>
      addToast({ message, title, variant: "error", durationMs: 6000 });
    fn.warning = (message: string, title?: string) =>
      addToast({ message, title, variant: "warning" });
    fn.info = (message: string, title?: string) =>
      addToast({ message, title, variant: "info" });
    return fn;
  }, [addToast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast: toastMethods,
      dismiss,
      clearAll,
    }),
    [toasts, toastMethods, dismiss, clearAll]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

ToastProvider.displayName = "ToastProvider";

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

