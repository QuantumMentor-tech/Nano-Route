import React from "react";

export interface MainContentRegionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  contentMaxWidth?: string | number;
}

export const MainContentRegion: React.FC<MainContentRegionProps> = ({
  children,
  className = "",
  style,
  contentMaxWidth = "1100px",
}) => {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      className={`nr-main-content-region ${className}`}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "var(--nr-bg-app)",
        color: "var(--nr-text-primary)",
        outline: "none",
        position: "relative",
        ...style,
      }}
    >
      <div
        className="nr-main-content-inner"
        style={{
          width: "100%",
          maxWidth: contentMaxWidth,
          margin: "0 auto",
          padding: "var(--nr-space-6)",
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </main>
  );
};

MainContentRegion.displayName = "MainContentRegion";

