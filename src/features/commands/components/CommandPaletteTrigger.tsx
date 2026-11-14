/**
 * Nano Route — Header Command Palette Trigger Button
 * File: src/features/commands/components/CommandPaletteTrigger.tsx
 *
 * Renders a compact desktop search bar / trigger button displaying "Ctrl+K"
 * in top navigation bars or headers.
 */

import React from "react";
import { Search } from "lucide-react";
import { useCommandPalette } from "../CommandPaletteContext.tsx";

export const CommandPaletteTrigger: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { openPalette } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Open Command Palette (Ctrl+K)"
      className={`nr-command-palette-trigger ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 10px",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "6px",
        color: "#94a3b8",
        fontSize: "12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.4)";
        e.currentTarget.style.color = "#f1f5f9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
        e.currentTarget.style.color = "#94a3b8";
      }}
    >
      <Search size={14} aria-hidden="true" />
      <span style={{ fontSize: "12px" }}>Search commands...</span>
      <kbd
        style={{
          padding: "1px 5px",
          borderRadius: "4px",
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#cbd5e1",
          fontSize: "10px",
          fontFamily: "inherit",
        }}
      >
        Ctrl+K
      </kbd>
    </button>
  );
};

