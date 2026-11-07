import React, { useState, useEffect, useCallback, useId } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delayMs = 250,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    if (disabled || !content) return;
    const t = setTimeout(() => setIsVisible(true), delayMs);
    setTimer(t);
  }, [disabled, content, delayMs]);

  const hide = useCallback(() => {
    if (timer) clearTimeout(timer);
    setIsVisible(false);
  }, [timer]);

  // Escape key closes tooltip (Section 32, 49)
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, hide]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timer]);

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case "bottom":
        return { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
      case "left":
        return { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "top":
      default:
        return { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
    }
  };

  if (disabled || !content) {
    return children;
  }

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: "var(--nr-z-tooltip)",
            backgroundColor: "var(--nr-bg-surface-overlay)",
            color: "var(--nr-text-primary)",
            border: "1px solid var(--nr-border-strong)",
            borderRadius: "var(--nr-radius-sm)",
            padding: "0.25rem 0.5rem",
            fontSize: "0.75rem",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            boxShadow: "var(--nr-shadow-md)",
            pointerEvents: "none",
            userSelect: "none",
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

Tooltip.displayName = "Tooltip";
