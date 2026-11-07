import React from "react";

export interface ScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "vertical" | "horizontal" | "both";
  maxHeight?: string | number;
  maxWidth?: string | number;
}

export const ScrollContainer = React.forwardRef<HTMLDivElement, ScrollContainerProps>(
  (
    {
      direction = "vertical",
      maxHeight,
      maxWidth,
      children,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const getOverflowStyles = (): React.CSSProperties => {
      switch (direction) {
        case "horizontal":
          return { overflowX: "auto", overflowY: "hidden" };
        case "both":
          return { overflowX: "auto", overflowY: "auto" };
        case "vertical":
        default:
          return { overflowY: "auto", overflowX: "hidden" };
      }
    };

    return (
      <div
        ref={ref}
        className={`nr-scroll-container ${className}`}
        style={{
          maxHeight,
          maxWidth,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--nr-border-strong) transparent",
          WebkitOverflowScrolling: "touch",
          ...getOverflowStyles(),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollContainer.displayName = "ScrollContainer";

