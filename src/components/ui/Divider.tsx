import React from "react";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  label?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  label,
  className = "",
  style,
  ...props
}) => {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`nr-divider nr-divider-vertical ${className}`}
        style={{
          width: "1px",
          height: "100%",
          minHeight: "1rem",
          backgroundColor: "var(--nr-border-subtle)",
          ...style,
        }}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={`nr-divider-with-label ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          margin: "0.75rem 0",
          ...style,
        }}
        {...props}
      >
        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--nr-border-subtle)" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--nr-border-subtle)" }} />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`nr-divider nr-divider-horizontal ${className}`}
      style={{
        width: "100%",
        height: "1px",
        backgroundColor: "var(--nr-border-subtle)",
        margin: "0.5rem 0",
        ...style,
      }}
      {...props}
    />
  );
};

