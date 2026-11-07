import React from "react";

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
  style?: React.CSSProperties;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  badge,
  action,
  headingLevel: Heading = "h2",
  className = "",
  style,
}) => {
  return (
    <div
      className={`nr-section-header ${className}`}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "0.75rem",
        marginBottom: "1rem",
        ...style,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Heading
            style={{
              fontSize: Heading === "h2" ? "1.125rem" : "1rem",
              fontWeight: 600,
              color: "var(--nr-text-primary)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </Heading>
          {badge}
        </div>

        {description && (
          <p
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

      {action && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {action}
        </div>
      )}
    </div>
  );
};

SectionHeader.displayName = "SectionHeader";

