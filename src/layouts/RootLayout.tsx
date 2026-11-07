import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { DesktopShell } from "./DesktopShell";
import { Sidebar } from "../components/navigation";

const STORAGE_KEY_SIDEBAR_COLLAPSED = "nr_sidebar_collapsed";

export const RootLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(isCollapsed));
    } catch {
      // Ignore storage write errors in restricted desktop environments
    }
  }, [isCollapsed]);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <DesktopShell
      navigation={
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      }
    >
      <Outlet />
    </DesktopShell>
  );
};

RootLayout.displayName = "RootLayout";

