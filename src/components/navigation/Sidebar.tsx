import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAVIGATION_SECTIONS } from "../../routes/navigation";
import { SidebarSection } from "./SidebarSection";
import { Tooltip } from "../ui/Tooltip";
import { IconButton } from "../ui/IconButton";

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  className = "",
  style,
}) => {
  return (
    <aside
      role="navigation"
      aria-label="Main Navigation"
      className={`nr-sidebar ${className}`}
      style={{
        width: isCollapsed ? "68px" : "260px",
        minWidth: isCollapsed ? "68px" : "260px",
        maxWidth: isCollapsed ? "68px" : "260px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--nr-bg-surface)",
        borderRight: "1px solid var(--nr-border-default)",
        transition: "width var(--nr-duration-normal) var(--nr-ease-default), min-width var(--nr-duration-normal) var(--nr-ease-default)",
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
        zIndex: "var(--nr-z-sticky)",
        ...style,
      }}
    >
      {/* 1. Fixed Header / Branding */}
      <div
        style={{
          padding: isCollapsed ? "1rem 0" : "1.25rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: "0.75rem",
          borderBottom: "1px solid var(--nr-border-subtle)",
          flexShrink: 0,
          minHeight: "64px",
        }}
      >
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "var(--nr-radius-md)",
            backgroundColor: "var(--nr-accent-purple-subtle)",
            border: "1px solid var(--nr-accent-purple-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--nr-accent-purple)",
            fontWeight: 700,
            fontSize: "14px",
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}
          aria-hidden="true"
        >
          NR
        </div>

        {!isCollapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "var(--nr-text-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Nano Route
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--nr-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: "0.125rem",
              }}
            >
              AI Orchestrator
            </div>
          </div>
        )}
      </div>

      {/* 2. Scrollable Navigation List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "1rem 0",
        }}
        className="nr-sidebar-scroll"
      >
        {NAVIGATION_SECTIONS.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            isCollapsed={isCollapsed}
          />
        ))}
      </div>

      {/* 3. Fixed Footer / Controls */}
      <div
        style={{
          borderTop: "1px solid var(--nr-border-subtle)",
          padding: isCollapsed ? "0.75rem 0" : "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          flexShrink: 0,
          backgroundColor: "var(--nr-bg-surface)",
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              fontSize: "0.6875rem",
              color: "var(--nr-text-muted)",
              letterSpacing: "0.02em",
            }}
          >
            v0.1.0 • Desktop Shell
          </div>
        )}

        {isCollapsed ? (
          <Tooltip content="Expand sidebar" position="right" delayMs={100}>
            <IconButton
              variant="ghost"
              size="sm"
              icon={<PanelLeftOpen style={{ width: "16px", height: "16px" }} />}
              aria-label="Expand sidebar"
              onClick={onToggleCollapse}
            />
          </Tooltip>
        ) : (
          <IconButton
            variant="ghost"
            size="sm"
            icon={<PanelLeftClose style={{ width: "16px", height: "16px" }} />}
            aria-label="Collapse sidebar"
            onClick={onToggleCollapse}
          />
        )}
      </div>
    </aside>
  );
};

Sidebar.displayName = "Sidebar";
