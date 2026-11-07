import React from "react";
import { NavigationRegion } from "./NavigationRegion";
import { MainContentRegion } from "./MainContentRegion";
import { ShellErrorBoundary } from "./ShellErrorBoundary";

export interface DesktopShellProps {
  children: React.ReactNode;
  navigation?: React.ReactNode;
  header?: React.ReactNode;
  contentMaxWidth?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const DesktopShell: React.FC<DesktopShellProps> = ({
  children,
  navigation,
  header,
  contentMaxWidth = "1100px",
  className = "",
  style,
}) => {
  return (
    <div
      className={`nr-desktop-shell-root ${className}`}
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "var(--nr-bg-app)",
        color: "var(--nr-text-primary)",
        fontFamily: "var(--nr-font-sans)",
        ...style,
      }}
    >
      {/* Accessible Skip Link (WCAG 2.4.1) */}
      <a href="#main-content" className="nr-skip-link">
        Skip to main content
      </a>

      {/* Optional Top Application Header / Status Bar */}
      {header && (
        <header
          role="banner"
          style={{
            flexShrink: 0,
            borderBottom: "1px solid var(--nr-border-default)",
            backgroundColor: "var(--nr-bg-surface)",
            zIndex: "var(--nr-z-sticky)",
          }}
        >
          {header}
        </header>
      )}

      {/* Main Shell Body: Navigation + Content */}
      <div
        className="nr-desktop-shell-body"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Navigation Region (Reserved Slot for Step 8 Sidebar) */}
        <NavigationRegion>{navigation}</NavigationRegion>

        {/* Main Content Region with Error Boundary */}
        <MainContentRegion contentMaxWidth={contentMaxWidth}>
          <ShellErrorBoundary>{children}</ShellErrorBoundary>
        </MainContentRegion>
      </div>
    </div>
  );
};

DesktopShell.displayName = "DesktopShell";

