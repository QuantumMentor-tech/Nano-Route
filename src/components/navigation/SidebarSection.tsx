import React from "react";
import { SidebarItem } from "./SidebarItem";
import type { NavigationSection } from "../../routes/navigation";

export interface SidebarSectionProps {
  section: NavigationSection;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  section,
  isCollapsed,
  onNavigate,
}) => {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {!isCollapsed ? (
        <div
          style={{
            padding: "0 0.875rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--nr-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            userSelect: "none",
          }}
        >
          {section.label}
        </div>
      ) : (
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--nr-border-subtle)",
            margin: "0.5rem 0.75rem 0.75rem",
          }}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label={section.label}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          padding: isCollapsed ? "0 0.5rem" : "0 0.5rem",
        }}
      >
        {section.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
};

SidebarSection.displayName = "SidebarSection";

