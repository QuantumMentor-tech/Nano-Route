import {
  LayoutDashboard,
  MessageSquare,
  History,
  Settings,
  FileKey,
  Info,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { ROUTE_PATHS } from "./routePaths";

export type NavigationSectionId = "workspace" | "application";

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  section: NavigationSectionId;
  badge?: string;
  tooltip?: string;
}

export interface NavigationSection {
  id: NavigationSectionId;
  label: string;
  items: NavigationItem[];
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: ROUTE_PATHS.DASHBOARD,
        icon: LayoutDashboard,
        section: "workspace",
        tooltip: "Overview & System Status",
      },
      {
        id: "chat",
        label: "Chat Studio",
        path: ROUTE_PATHS.CHAT,
        icon: MessageSquare,
        section: "workspace",
        tooltip: "AI Orchestration Chat",
      },
      {
        id: "history",
        label: "History",
        path: ROUTE_PATHS.HISTORY,
        icon: History,
        section: "workspace",
        tooltip: "Execution Logs & Prompts",
      },
    ],
  },
  {
    id: "application",
    label: "Application",
    items: [
      {
        id: "settings",
        label: "Settings",
        path: ROUTE_PATHS.SETTINGS,
        icon: Settings,
        section: "application",
        tooltip: "Preferences & API Keys",
      },
      {
        id: "license",
        label: "License",
        path: ROUTE_PATHS.LICENSE,
        icon: FileKey,
        section: "application",
        tooltip: "License & Entitlements",
      },
      {
        id: "about",
        label: "About",
        path: ROUTE_PATHS.ABOUT,
        icon: Info,
        section: "application",
        tooltip: "Version & Architecture",
      },
      {
        id: "contact",
        label: "Contact",
        path: ROUTE_PATHS.CONTACT,
        icon: Mail,
        section: "application",
        tooltip: "Support & Feedback",
      },
    ],
  },
];

