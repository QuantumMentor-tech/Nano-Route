/**
 * Nano Route — Global Command Palette Modal
 * File: src/features/commands/components/CommandPaletteModal.tsx
 *
 * Implements accessible desktop modal dialog, input search with auto-focus,
 * category filtering chips, arrow key traversal, Enter execution, and Escape dismissal.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  ArrowRight,
  Compass,
  MessageSquare,
  Settings,
  Activity,
  HelpCircle,
  RefreshCw,
  Command,
} from "lucide-react";
import { useCommandPalette } from "../CommandPaletteContext.tsx";
import { searchCommands } from "../search.ts";
import type { CommandCategory } from "../types.ts";
import { usePreferences } from "../../settings/PreferencesContext.tsx";

function getCategoryIcon(cat: CommandCategory, size = 16) {
  const props = { size, ariaHidden: "true", className: "flex-shrink-0" };
  switch (cat) {
    case "Navigation":
      return <Compass {...props} style={{ color: "#a78bfa" }} />;
    case "Actions":
      return <MessageSquare {...props} style={{ color: "#60a5fa" }} />;
    case "Settings":
      return <Settings {...props} style={{ color: "#94a3b8" }} />;
    case "Diagnostics":
      return <Activity {...props} style={{ color: "#f472b6" }} />;
    case "Help":
      return <HelpCircle {...props} style={{ color: "#34d399" }} />;
    case "Recovery":
      return <RefreshCw {...props} style={{ color: "#facc15" }} />;
    case "System":
    default:
      return <Command {...props} style={{ color: "#c084fc" }} />;
  }
}

const CATEGORIES: CommandCategory[] = [
  "Navigation",
  "Actions",
  "Settings",
  "Diagnostics",
  "Help",
  "Recovery",
];

export const CommandPaletteModal: React.FC = () => {
  const { isOpen, closePalette, executeCommand } = useCommandPalette();
  let showDescriptions = true;
  let showShortcuts = true;
  try {
    const { settings } = usePreferences();
    showDescriptions = settings.paletteShowDescriptions ?? true;
    showShortcuts = settings.paletteShowShortcuts ?? true;
  } catch {
    // Fallback safely if rendered outside PreferencesProvider
  }

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CommandCategory | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Search commands dynamically
  const matches = useMemo(() => {
    return searchCommands(query, selectedCategory);
  }, [query, selectedCategory]);

  // Reset index when query or matches change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedCategory(undefined);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation within the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
      return;
    }

    if (matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = matches[selectedIndex];
      if (selected) {
        executeCommand(selected.command);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
    >
      <div
        style={{
          width: "600px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "75vh",
          backgroundColor: "var(--nr-bg-surface, #0f172a)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#f8fafc",
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            gap: "12px",
          }}
        >
          <Search size={18} aria-hidden="true" style={{ color: "#a78bfa", flexShrink: 0 }} />
          <input
            ref={inputRef}
            id="command-palette-title"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-listbox"
            aria-activedescendant={matches[selectedIndex]?.command.id}
            placeholder="Type a command or search destinations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f8fafc",
              fontSize: "15px",
              fontFamily: "inherit",
            }}
          />
          <kbd
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#94a3b8",
              fontSize: "11px",
              fontFamily: "inherit",
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Category Filter Chips */}
        <div
          role="tablist"
          aria-label="Command categories"
          style={{
            display: "flex",
            gap: "6px",
            padding: "8px 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            overflowX: "auto",
            backgroundColor: "rgba(0, 0, 0, 0.15)",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === undefined}
            onClick={() => setSelectedCategory(undefined)}
            style={{
              padding: "3px 10px",
              borderRadius: "6px",
              border: "none",
              background: selectedCategory === undefined ? "rgba(167, 139, 250, 0.25)" : "transparent",
              color: selectedCategory === undefined ? "#c084fc" : "#94a3b8",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
              style={{
                padding: "3px 10px",
                borderRadius: "6px",
                border: "none",
                background: selectedCategory === cat ? "rgba(167, 139, 250, 0.25)" : "transparent",
                color: selectedCategory === cat ? "#c084fc" : "#94a3b8",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Command Listbox */}
        <div
          ref={listRef}
          id="command-listbox"
          role="listbox"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {matches.length === 0 ? (
            <div
              style={{
                padding: "2.5rem 1rem",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <Command size={28} aria-hidden="true" style={{ opacity: 0.3, marginBottom: "8px" }} />
              <p style={{ margin: "0 0 4px", fontSize: "14px" }}>No commands found</p>
              <p style={{ margin: 0, fontSize: "12px" }}>
                Try searching for <strong>dashboard</strong>, <strong>chat</strong>, <strong>diagnostics</strong>, or <strong>settings</strong>.
              </p>
            </div>
          ) : (
            matches.map(({ command }, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={command.id}
                  id={command.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => executeCommand(command)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    backgroundColor: isSelected ? "rgba(167, 139, 250, 0.15)" : "transparent",
                    border: isSelected ? "1px solid rgba(167, 139, 250, 0.3)" : "1px solid transparent",
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    {getCategoryIcon(command.category)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: isSelected ? "#f8fafc" : "#e2e8f0" }}>
                        {command.title}
                      </div>
                      {showDescriptions && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {command.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {showShortcuts && command.shortcut && (
                      <kbd
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.06)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#cbd5e1",
                          fontSize: "11px",
                          fontFamily: "inherit",
                        }}
                      >
                        {command.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ArrowRight size={14} aria-hidden="true" style={{ color: "#a78bfa" }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Keybind Hints */}
        <footer
          style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", gap: "14px" }}>
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Execute</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
          <div>
            <span>{matches.length} {matches.length === 1 ? "command" : "commands"}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
