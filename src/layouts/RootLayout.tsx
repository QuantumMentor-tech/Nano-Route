import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { DesktopShell } from "./DesktopShell";
import { Sidebar } from "../components/navigation";
import { usePreferences } from "../features/settings";
import { useSessionContinuity } from "../features/session";

export const RootLayout: React.FC = () => {
  let userSettings: any = null;
  try {
    const pref = usePreferences();
    userSettings = pref.settings;
  } catch {
    userSettings = null;
  }

  let sessionContext: any = null;
  try {
    sessionContext = useSessionContinuity();
  } catch {
    sessionContext = null;
  }

  const navigate = useNavigate();
  const location = useLocation();
  const hasRestoredRouteRef = useRef(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return Boolean(userSettings?.sidebarCollapsed);
  });

  // Sync initial sidebar state from session or settings once loaded
  useEffect(() => {
    if (sessionContext?.restoreResult?.sidebarCollapsed !== undefined) {
      setIsCollapsed(sessionContext.restoreResult.sidebarCollapsed);
    } else if (userSettings?.sidebarCollapsed !== undefined) {
      setIsCollapsed(userSettings.sidebarCollapsed);
    }
  }, [sessionContext?.restoreResult?.sidebarCollapsed, userSettings?.sidebarCollapsed]);

  // Handle safe startup destination / restored session route on initial mount
  useEffect(() => {
    if (hasRestoredRouteRef.current) return;

    if (sessionContext?.isRestored) {
      hasRestoredRouteRef.current = true;
      const targetRoute = sessionContext.restoreResult?.route;

      if (location.pathname === "/" && targetRoute && targetRoute !== "/") {
        navigate(targetRoute, { replace: true });
      } else if (location.pathname === "/" && userSettings?.startupRoute === "chat") {
        navigate("/chat", { replace: true });
      }
    }
  }, [sessionContext?.isRestored, sessionContext?.restoreResult?.route, location.pathname, userSettings?.startupRoute, navigate]);

  // Continuously record safe route and sidebar state
  useEffect(() => {
    if (sessionContext?.saveSessionState && sessionContext.isRestored) {
      const fullRoute = `${location.pathname}${location.search}`;
      sessionContext.saveSessionState({
        route: fullRoute,
        sidebarCollapsed: isCollapsed,
      });
    }
  }, [location.pathname, location.search, isCollapsed, sessionContext]);

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

