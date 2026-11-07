import React from "react";
import { useToast } from "./ToastContext";
import { Toast } from "./Toast";

export interface ToastContainerProps {
  position?: "bottom-right" | "top-right" | "bottom-left" | "top-left";
  className?: string;
  style?: React.CSSProperties;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = "bottom-right",
  className = "",
  style,
}) => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case "top-right":
        return { top: "1.5rem", right: "1.5rem" };
      case "top-left":
        return { top: "1.5rem", left: "1.5rem" };
      case "bottom-left":
        return { bottom: "1.5rem", left: "1.5rem" };
      case "bottom-right":
      default:
        return { bottom: "1.5rem", right: "1.5rem" };
    }
  };

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className={`nr-toast-container ${className}`}
      style={{
        position: "fixed",
        zIndex: "var(--nr-z-toast, 1000)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "none",
        ...getPositionStyles(),
        ...style,
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
};

ToastContainer.displayName = "ToastContainer";

