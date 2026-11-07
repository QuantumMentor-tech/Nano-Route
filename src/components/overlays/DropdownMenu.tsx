import React, { useState, useRef, useEffect, useCallback, useId } from "react";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
  onClick?: () => void;
}

export interface DropdownMenuProps {
  trigger: React.ReactElement;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = "left",
  className = "",
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const menuId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const enabledIndices = items
    .map((item, idx) => (item.disabled ? -1 : idx))
    .filter((idx) => idx !== -1);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    setIsOpen(true);
    setFocusedIndex(enabledIndices.length > 0 ? enabledIndices[0] : -1);
  }, [enabledIndices]);

  // Click outside listener (Section 50)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeMenu]);

  // Keyboard navigation (Section 24, 57)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;

      case "ArrowDown": {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        const nextPos = (currentPos + 1) % enabledIndices.length;
        setFocusedIndex(enabledIndices[nextPos]);
        break;
      }

      case "ArrowUp": {
        e.preventDefault();
        const currentPos = enabledIndices.indexOf(focusedIndex);
        const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
        setFocusedIndex(enabledIndices[prevPos]);
        break;
      }

      case "Home":
        e.preventDefault();
        if (enabledIndices.length > 0) {
          setFocusedIndex(enabledIndices[0]);
        }
        break;

      case "End":
        e.preventDefault();
        if (enabledIndices.length > 0) {
          setFocusedIndex(enabledIndices[enabledIndices.length - 1]);
        }
        break;

      case "Enter":
      case " ": {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          const item = items[focusedIndex];
          if (!item.disabled && item.onClick) {
            item.onClick();
            closeMenu();
          }
        }
        break;
      }
    }
  };

  return (
    <div
      style={{ position: "relative", display: "inline-block", ...style }}
      className={`nr-dropdown-menu-container ${className}`}
      onKeyDown={handleKeyDown}
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
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
        "aria-controls": isOpen ? menuId : undefined,
      })}

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [align === "right" ? "right" : "left"]: 0,
            zIndex: "var(--nr-z-dropdown, 200)",
            minWidth: "180px",
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-border-strong)",
            borderRadius: "var(--nr-radius-md)",
            boxShadow: "var(--nr-shadow-lg)",
            padding: "0.25rem 0",
            outline: "none",
            userSelect: "none",
          }}
        >
          {items.map((item, idx) => {
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={item.id}
                role="menuitem"
                tabIndex={item.disabled ? -1 : 0}
                aria-disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    closeMenu();
                  }
                }}
                onMouseEnter={() => {
                  if (!item.disabled) setFocusedIndex(idx);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.875rem",
                  fontSize: "0.8125rem",
                  fontFamily: "var(--nr-font-sans)",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  color: item.disabled
                    ? "var(--nr-text-disabled)"
                    : item.destructive
                    ? "var(--nr-status-error)"
                    : "var(--nr-text-primary)",
                  backgroundColor:
                    isFocused && !item.disabled
                      ? item.destructive
                        ? "var(--nr-status-error-bg)"
                        : "var(--nr-bg-surface-hover)"
                      : "transparent",
                  outline: "none",
                  transition: "background-color var(--nr-transition-fast)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {item.icon && (
                    <span
                      style={{
                        display: "inline-flex",
                        color: item.destructive
                          ? "var(--nr-status-error)"
                          : "var(--nr-text-muted)",
                      }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </div>

                {item.shortcut && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontFamily: "var(--nr-font-mono)",
                      color: "var(--nr-text-muted)",
                      marginLeft: "1rem",
                    }}
                  >
                    {item.shortcut}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

DropdownMenu.displayName = "DropdownMenu";

