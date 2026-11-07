import React, { createContext, useContext, useState, useId } from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className = "",
  style,
}) => {
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue || ""
  );
  const baseId = useId();

  const isControlled = controlledValue !== undefined;
  const activeTab = isControlled ? controlledValue : internalValue;

  const setActiveTab = (tab: string) => {
    if (!isControlled) {
      setInternalValue(tab);
    }
    onValueChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={`nr-tabs ${className}`} style={{ width: "100%", ...style }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

Tabs.displayName = "Tabs";

export interface TabListProps {
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TabList: React.FC<TabListProps> = ({
  children,
  ariaLabel = "Tabs",
  className = "",
  style,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const triggers = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    const currentIndex = triggers.findIndex((btn) => btn === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = triggers.length - 1;
    }

    if (nextIndex !== currentIndex) {
      triggers[nextIndex].focus();
      triggers[nextIndex].click();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`nr-tablist ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        borderBottom: "1px solid var(--nr-border-default)",
        paddingBottom: "1px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

TabList.displayName = "TabList";

export interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({
  value,
  children,
  icon,
  disabled = false,
  className = "",
  style,
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabTrigger must be used within Tabs");

  const { activeTab, setActiveTab, baseId } = context;
  const isSelected = activeTab === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={`nr-tab-trigger ${isSelected ? "active" : ""} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 0.875rem",
        fontSize: "0.875rem",
        fontWeight: isSelected ? 600 : 500,
        fontFamily: "var(--nr-font-sans)",
        color: isSelected
          ? "var(--nr-accent-purple-light, #a78bfa)"
          : "var(--nr-text-secondary)",
        backgroundColor: isSelected ? "var(--nr-accent-purple-subtle)" : "transparent",
        border: "none",
        borderBottom: isSelected ? "2px solid var(--nr-accent-purple)" : "2px solid transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        outline: "none",
        transition: "all var(--nr-transition-fast)",
        userSelect: "none",
        ...style,
      }}
    >
      {icon && <span style={{ display: "inline-flex" }} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

TabTrigger.displayName = "TabTrigger";

export interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  value,
  children,
  className = "",
  style,
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabPanel must be used within Tabs");

  const { activeTab, baseId } = context;
  const isSelected = activeTab === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={`nr-tabpanel ${className}`}
      style={{
        paddingTop: "1rem",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

TabPanel.displayName = "TabPanel";

