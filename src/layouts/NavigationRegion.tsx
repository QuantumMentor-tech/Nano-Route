import React from "react";
import { Badge } from "../components/ui";

export interface NavigationRegionProps {
  children?: React.ReactNode;
  isCollapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const NavigationRegion: React.FC<NavigationRegionProps> = ({
  children,
  isCollapsed = false,
  className = "",
  style,
}) => {
  if (children) {
    return (
      <div
        className={`nr-navigation-region-slot ${className}`}
        style={{
          display: "flex",
          height: "100%",
          flexShrink: 0,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <aside
      role="navigation"
      aria-label="Main Navigation"
      className={`nr-navigation-region ${className}`}
      style={{
        width: isCollapsed ? "68px" : "260px",
        flexShrink: 0,
        backgroundColor: "var(--nr-bg-surface)",
        borderRight: "1px solid var(--nr-border-default)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
        zIndex: "var(--nr-z-sticky)",
        userSelect: "none",
        transition: "width var(--nr-duration-normal) var(--nr-ease-default)",
        ...style,
      }}
    >
      <div
        style={{
          padding: "1.25rem 1rem",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* Header Branding Slot */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--nr-radius-md)",
                backgroundColor: "var(--nr-accent-purple-subtle)",
                border: "1px solid var(--nr-accent-purple-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--nr-accent-purple)",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              NR
            </div>
            {!isCollapsed && (
              <div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--nr-text-primary)", letterSpacing: "-0.02em" }}>
                  Nano Route
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  AI Orchestrator
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Contract Placeholder */}
          {!isCollapsed && (
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "var(--nr-radius-md)",
                backgroundColor: "var(--nr-bg-surface-elevated)",
                border: "1px dashed var(--nr-border-strong)",
                textAlign: "center",
              }}
            >
              <Badge variant="purple" size="sm" style={{ marginBottom: "0.5rem" }}>
                Step 8 Active
              </Badge>
              <p style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", lineHeight: 1.4, margin: 0 }}>
                Navigation Region Sidebar Slot
              </p>
            </div>
          )}
        </div>

        {/* Footer Slot */}
        {!isCollapsed && (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--nr-border-subtle)", fontSize: "0.6875rem", color: "var(--nr-text-muted)" }}>
            <span>v0.1.0 • Desktop Shell</span>
          </div>
        )}
      </div>
    </aside>
  );
};

NavigationRegion.displayName = "NavigationRegion";
