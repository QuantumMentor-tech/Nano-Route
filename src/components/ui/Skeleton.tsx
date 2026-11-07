import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "1rem",
  borderRadius = "var(--nr-radius-sm)",
  className = "",
  style,
  ...props
}) => {
  return (
    <div
      aria-hidden="true"
      className={`nr-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "var(--nr-bg-surface-elevated)",
        backgroundImage: "linear-gradient(90deg, var(--nr-bg-surface-elevated) 0%, var(--nr-bg-surface-hover) 50%, var(--nr-bg-surface-elevated) 100%)",
        backgroundSize: "200% 100%",
        animation: "nr-skeleton-shimmer 1.5s infinite",
        ...style,
      }}
      {...props}
    >
      <style>{`
        @keyframes nr-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nr-skeleton {
            animation: none !important;
            background-image: none !important;
          }
        }
      `}</style>
    </div>
  );
};

