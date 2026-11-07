import React from "react";
import { NavLink } from "react-router-dom";
import { Tooltip } from "../ui/Tooltip";
import type { NavigationItem } from "../../routes/navigation";

export interface SidebarItemProps {
  item: NavigationItem;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  item,
  isCollapsed,
  onNavigate,
}) => {
  const Icon = item.icon;

  const content = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      end={item.path === "/"}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? "0" : "0.75rem",
        padding: isCollapsed ? "0.625rem 0" : "0.625rem 0.875rem",
        borderRadius: "var(--nr-radius-md)",
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "var(--nr-text-primary)" : "var(--nr-text-secondary)",
        backgroundColor: isActive ? "var(--nr-accent-purple-subtle)" : "transparent",
        border: isActive
          ? "1px solid var(--nr-accent-purple-border)"
          : "1px solid transparent",
        transition: "all var(--nr-duration-fast) var(--nr-ease-default)",
        position: "relative",
        outline: "none",
        userSelect: "none",
      })}
      className="nr-sidebar-navlink"
      aria-label={item.label}
    >
      {({ isActive }) => (
        <>
          <Icon
            style={{
              width: "18px",
              height: "18px",
              flexShrink: 0,
              color: isActive ? "var(--nr-accent-purple)" : "inherit",
              transition: "color var(--nr-duration-fast) var(--nr-ease-default)",
            }}
          />

          {!isCollapsed && (
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>
          )}

          {!isCollapsed && item.badge && (
            <span
              style={{
                fontSize: "0.6875rem",
                padding: "0.125rem 0.375rem",
                borderRadius: "var(--nr-radius-sm)",
                backgroundColor: "var(--nr-bg-surface-overlay)",
                color: "var(--nr-text-muted)",
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={item.label} position="right" delayMs={100}>
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          {content}
        </div>
      </Tooltip>
    );
  }

  return content;
};

SidebarItem.displayName = "SidebarItem";

