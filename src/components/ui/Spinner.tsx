import React from "react";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 24,
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "",
  label = "Loading...",
  ...props
}) => {
  const pixelSize = sizeMap[size];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label={label}
      className={`nr-spinner ${className}`}
      style={{
        animation: "nr-spin 0.8s linear infinite",
      }}
      {...props}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`
        @keyframes nr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nr-spinner {
            animation-duration: 2s !important;
          }
        }
      `}</style>
    </svg>
  );
};

