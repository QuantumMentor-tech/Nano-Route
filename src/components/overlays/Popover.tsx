import React, { useState, useRef, useEffect, useCallback, useId } from "react";

export interface PopoverProps {
  trigger: React.ReactElement;
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  position = "bottom",
  isOpen: controlledOpen,
  onOpenChange,
  className = "",
  style,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const popoverId = useId();
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (open: boolean) => {
      if (!isControlled) {
        setInternalOpen(open);
      }
      onOpenChange?.(open);
    },
    [isControlled, onOpenChange]
  );

  // Click outside to close (Section 50)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setOpen]);

  // Escape to close (Section 49)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setOpen]);

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case "top":
        return { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
      case "left":
        return { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "bottom":
      default:
        return { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
    }
  };

  return (
    <div
      style={{ position: "relative", display: "inline-block", ...style }}
      className={`nr-popover-container ${className}`}
    >
      {React.cloneElement(trigger, {
        ref: (el: HTMLElement | null) => {
          triggerRef.current = el;
          const originalRef = (trigger as React.RefAttributes<HTMLElement>).ref;
          if (typeof originalRef === "function") originalRef(el);
          else if (originalRef) (originalRef as React.MutableRefObject<HTMLElement | null>).current = el;
        },
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          setOpen(!isOpen);
        },
        "aria-haspopup": "dialog",
        "aria-expanded": isOpen,
        "aria-controls": isOpen ? popoverId : undefined,
      })}

      {isOpen && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          style={{
            position: "absolute",
            zIndex: "var(--nr-z-popover, 300)",
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-border-strong)",
            borderRadius: "var(--nr-radius-md)",
            boxShadow: "var(--nr-shadow-lg)",
            padding: "0.875rem",
            color: "var(--nr-text-primary)",
            minWidth: "220px",
            maxWidth: "360px",
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

Popover.displayName = "Popover";

