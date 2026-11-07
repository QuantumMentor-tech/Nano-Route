import React, { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string | number;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "500px",
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
  style,
}) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus restoration & Escape handling (Section 20, 48, 49)
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

      // Move focus into the first focusable element or dialog container
      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === "Escape") {
          e.stopPropagation();
          onClose();
          return;
        }

        // Focus trap
        if (e.key === "Tab" && dialogRef.current) {
          const focusable = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );

          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus();
      previouslyFocusedElement.current = null;
    }
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--nr-z-modal, 500)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`nr-dialog ${className}`}
        style={{
          width: "100%",
          maxWidth,
          backgroundColor: "var(--nr-bg-surface-elevated)",
          border: "1px solid var(--nr-border-strong)",
          borderRadius: "var(--nr-radius-lg)",
          boxShadow: "var(--nr-shadow-lg)",
          color: "var(--nr-text-primary)",
          fontFamily: "var(--nr-font-sans)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 4rem)",
          outline: "none",
          overflow: "hidden",
          ...style,
        }}
      >
        {/* Header */}
        {(title || description) && (
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--nr-border-subtle)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div>
              {title && (
                <h3
                  id={titleId}
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "var(--nr-text-primary)",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </h3>
              )}
              {description && (
                <p
                  id={descId}
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--nr-text-secondary)",
                    margin: "0.25rem 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--nr-text-muted)",
                cursor: "pointer",
                padding: "0.25rem",
                borderRadius: "var(--nr-radius-sm)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "color var(--nr-transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--nr-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--nr-text-muted)";
              }}
            >
              <X style={{ width: "18px", height: "18px" }} />
            </button>
          </div>
        )}

        {/* Content Body (Scrollable if content overflows) */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            overflowY: "auto",
            flex: 1,
            lineHeight: 1.5,
            fontSize: "0.875rem",
            color: "var(--nr-text-secondary)",
          }}
        >
          {children}
        </div>

        {/* Footer Actions */}
        {footer && (
          <div
            style={{
              padding: "1rem 1.5rem",
              borderTop: "1px solid var(--nr-border-subtle)",
              backgroundColor: "var(--nr-bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Dialog.displayName = "Dialog";

