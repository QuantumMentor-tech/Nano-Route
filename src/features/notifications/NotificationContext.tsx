/**
 * Nano Route — Unified Notification Center State & Context
 * File: src/features/notifications/NotificationContext.tsx
 *
 * Provides application-wide notification queuing, deduplication,
 * persistent storage across navigation, resolution hooks, and action dispatching.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import type {
  AppNotification,
  NotificationSeverity,
  NotificationSource,
  NotificationDelivery,
  NotificationActionTarget,
  NotificationFilter,
} from "./types.ts";
import { sanitizeNotificationText, buildDedupeKey } from "./sanitizer.ts";
import { usePreferences } from "../settings/PreferencesContext.tsx";

const STORAGE_KEY_PERSISTENT_NOTIFICATIONS = "nr_persistent_notifications_v1";
const MAX_PERSISTENT_RECORDS = 50;
const TOAST_DEFAULT_DURATION_MS = 4000;
const TOAST_ERROR_DURATION_MS = 6000;

export interface PublishNotificationOptions {
  title: string;
  message: string;
  severity?: NotificationSeverity;
  source?: NotificationSource;
  delivery?: NotificationDelivery;
  technicalDetails?: string;
  durationMs?: number;
  actions?: NotificationActionTarget[];
  isNetworkAction?: boolean;
  dedupeIdentifier?: string;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  activeToasts: AppNotification[];
  unreadCount: number;
  isCenterOpen: boolean;
  setIsCenterOpen: (open: boolean) => void;
  publish: (options: PublishNotificationOptions) => string;
  dismissToast: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  resolveNotification: (dedupeKey: string) => void;
  clearAll: () => void;
  filteredNotifications: (filter: NotificationFilter) => AppNotification[];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read user preferences if available
  let userSettings: any = null;
  try {
    const pref = usePreferences();
    userSettings = pref.settings;
  } catch {
    // If mounted outside PreferencesProvider in isolated unit tests, fallback safely
    userSettings = null;
  }

  // Load persistent notifications from local storage on bootstrap
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PERSISTENT_NOTIFICATIONS);
      if (stored) {
        const parsed: AppNotification[] = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }
    return [];
  });

  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [isCenterOpen, setIsCenterOpen] = useState(false);

  // Sync persistent notifications to localStorage whenever changed
  useEffect(() => {
    try {
      // Only persist unread or unresolved persistent notices up to MAX_PERSISTENT_RECORDS
      const toStore = notifications
        .filter((n) => n.isPersistent)
        .slice(-MAX_PERSISTENT_RECORDS);
      localStorage.setItem(STORAGE_KEY_PERSISTENT_NOTIFICATIONS, JSON.stringify(toStore));
    } catch {
      // Ignore write errors
    }
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "dismissed" } : n))
    );
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && n.status === "unread" ? { ...n, status: "read" } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n))
    );
  }, []);

  const resolveNotification = useCallback((dedupeKey: string) => {
    const now = Date.now();
    setNotifications((prev) =>
      prev.map((n) =>
        n.dedupeKey === dedupeKey && n.status !== "resolved"
          ? { ...n, status: "resolved", resolvedAt: now }
          : n
      )
    );
    setActiveToasts((prev) => prev.filter((t) => t.dedupeKey !== dedupeKey));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setActiveToasts([]);
  }, []);

  const publish = useCallback((options: PublishNotificationOptions): string => {
    const severity = options.severity || "info";
    const source = options.source || "System";
    const delivery = options.delivery || (severity === "critical" ? "banner" : "toast");
    const sanitizedTitle = sanitizeNotificationText(options.title);
    const sanitizedMsg = sanitizeNotificationText(options.message);
    const sanitizedTech = options.technicalDetails
      ? sanitizeNotificationText(options.technicalDetails)
      : undefined;

    const dedupeKey = buildDedupeKey(source, severity, sanitizedTitle, options.dedupeIdentifier);
    const now = Date.now();
    const id = `notif_${now}_${Math.random().toString(36).substring(2, 7)}`;

    // Duration calculation: honor user preference if not explicitly specified
    let durationMs = options.durationMs;
    if (durationMs === undefined) {
      if (delivery === "toast") {
        const configuredDuration = userSettings?.notificationToastDurationMs ?? TOAST_DEFAULT_DURATION_MS;
        durationMs = severity === "error" ? Math.max(configuredDuration, TOAST_ERROR_DURATION_MS) : configuredDuration;
      }
    }

    const isPersistent =
      delivery === "persistent" ||
      delivery === "banner" ||
      severity === "warning" ||
      severity === "error" ||
      severity === "critical";

    const newNotification: AppNotification = {
      id,
      dedupeKey,
      severity,
      delivery,
      source,
      title: sanitizedTitle,
      message: sanitizedMsg,
      technicalDetails: sanitizedTech,
      createdAt: now,
      status: "unread",
      isPersistent,
      durationMs,
      actions: options.actions,
      isNetworkAction: options.isNetworkAction,
      occurrenceCount: 1,
    };

    // Coalesce / deduplicate in persistent notifications store
    setNotifications((prev) => {
      const existingIdx = prev.findIndex(
        (n) => n.dedupeKey === dedupeKey && n.status !== "resolved"
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          title: sanitizedTitle,
          message: sanitizedMsg,
          technicalDetails: sanitizedTech,
          createdAt: now,
          status: "unread", // Re-surface as unread on repeated occurrence
          occurrenceCount: existing.occurrenceCount + 1,
        };
        return updated;
      }
      return [newNotification, ...prev].slice(0, MAX_PERSISTENT_RECORDS);
    });

    // Check if non-critical toasts (info/success) should be suppressed
    const enableNonCritical = userSettings?.notificationEnableNonCriticalToasts ?? true;
    const isNonCriticalToast = delivery === "toast" && (severity === "info" || severity === "success");
    const shouldEnqueueToast = (delivery === "toast" || delivery === "banner") && !(isNonCriticalToast && !enableNonCritical);

    // Enqueue toast if delivery is toast or critical banner and not suppressed
    if (shouldEnqueueToast) {
      setActiveToasts((prev) => {
        // Coalesce if identical dedupeKey active
        const exists = prev.some((t) => t.dedupeKey === dedupeKey);
        if (exists) {
          return prev.map((t) =>
            t.dedupeKey === dedupeKey
              ? { ...t, occurrenceCount: t.occurrenceCount + 1, createdAt: now }
              : t
          );
        }
        return [...prev, newNotification].slice(-5); // Stack limit 5
      });
    }

    return id;
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === "unread").length;
  }, [notifications]);

  const filteredNotifications = useCallback(
    (filter: NotificationFilter) => {
      return notifications.filter((n) => {
        if (filter.severity && n.severity !== filter.severity) return false;
        if (filter.source && n.source !== filter.source) return false;
        if (filter.status === "unread" && n.status !== "unread") return false;
        if (filter.status === "active" && (n.status === "dismissed" || n.status === "resolved"))
          return false;
        return true;
      });
    },
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      activeToasts,
      unreadCount,
      isCenterOpen,
      setIsCenterOpen,
      publish,
      dismissToast,
      dismissNotification,
      markAsRead,
      markAllAsRead,
      resolveNotification,
      clearAll,
      filteredNotifications,
    }),
    [
      notifications,
      activeToasts,
      unreadCount,
      isCenterOpen,
      publish,
      dismissToast,
      dismissNotification,
      markAsRead,
      markAllAsRead,
      resolveNotification,
      clearAll,
      filteredNotifications,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}

