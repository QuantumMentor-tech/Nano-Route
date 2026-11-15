/**
 * Nano Route — Connectivity Indicator Component
 * File: src/features/connectivity/components/ConnectivityIndicator.tsx
 *
 * Implements Step 86:
 * - Header-level visual indicator for application connectivity
 * - Textual and accessible status representation (not color-only)
 * - Clickable trigger opening ConnectivityCenterModal
 */

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import {
  getConnectivitySnapshot,
  subscribeToConnectivity,
} from "../engine.ts";
import type { LocalNetworkState } from "../types.ts";
import { ConnectivityCenterModal } from "./ConnectivityCenterModal.tsx";

export const ConnectivityIndicator: React.FC = () => {
  const [networkState, setNetworkState] = useState<LocalNetworkState>("ONLINE");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const snap = getConnectivitySnapshot();
      setNetworkState(snap.networkState);
    };

    update();
    const unsubscribe = subscribeToConnectivity(update);
    return () => unsubscribe();
  }, []);

  const getVisualConfig = () => {
    switch (networkState) {
      case "ONLINE":
        return {
          icon: <Wifi style={{ width: "13px", height: "13px", color: "#10b981" }} />,
          label: "Online",
          ariaLabel: "Network Status: Online. Remote AI providers and local SLM are accessible.",
          badgeBg: "rgba(16, 185, 129, 0.12)",
          badgeBorder: "#10b981",
          textColor: "#34d399",
        };
      case "OFFLINE":
        return {
          icon: <WifiOff style={{ width: "13px", height: "13px", color: "#ef4444" }} />,
          label: "Offline",
          ariaLabel: "Network Status: Offline. Local features and local SLM remain available, remote providers blocked.",
          badgeBg: "rgba(239, 68, 68, 0.15)",
          badgeBorder: "#ef4444",
          textColor: "#f87171",
        };
      case "DEGRADED":
        return {
          icon: <AlertTriangle style={{ width: "13px", height: "13px", color: "#f59e0b" }} />,
          label: "Degraded",
          ariaLabel: "Network Status: Degraded. Some remote providers may experience impaired connectivity.",
          badgeBg: "rgba(245, 158, 11, 0.15)",
          badgeBorder: "#f59e0b",
          textColor: "#fbbf24",
        };
      case "TRANSITIONING":
      case "UNKNOWN":
      default:
        return {
          icon: <RefreshCw style={{ width: "13px", height: "13px", color: "#a855f7", animation: "spin 2s linear infinite" }} />,
          label: "Checking",
          ariaLabel: "Network Status: Checking connection status.",
          badgeBg: "rgba(168, 85, 247, 0.12)",
          badgeBorder: "#a855f7",
          textColor: "#c084fc",
        };
    }
  };

  const config = getVisualConfig();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        aria-label={config.ariaLabel}
        title={config.ariaLabel}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.22rem 0.55rem",
          borderRadius: "14px",
          backgroundColor: config.badgeBg,
          border: `1px solid ${config.badgeBorder}`,
          color: config.textColor,
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s ease",
          outline: "none",
        }}
      >
        {config.icon}
        <span>{config.label}</span>
      </button>

      <ConnectivityCenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

