/**
 * Centralized Route Paths for Nano Route Desktop Application
 * Step 8: Sidebar Navigation & Application Routing
 */

export const ROUTE_PATHS = {
  DASHBOARD: "/",
  CHAT: "/chat",
  HISTORY: "/history",
  SETTINGS: "/settings",
  LICENSE: "/license",
  ABOUT: "/about",
  CONTACT: "/contact",
  DIAGNOSTICS: "/diagnostics",
} as const;

export type RoutePath = typeof ROUTE_PATHS[keyof typeof ROUTE_PATHS];

