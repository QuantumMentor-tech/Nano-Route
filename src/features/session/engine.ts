/**
 * Nano Route — Workspace Session Continuity & Validation Engine
 * File: src/features/session/engine.ts
 *
 * Implements Step 68 route allowlisting, query sanitization, snapshot
 * serialization/deserialization, crash marker resolution, and startup precedence.
 */

import {
  type WorkspaceSessionSnapshot,
  type SessionExitStatus,
  SESSION_SCHEMA_FORMAT,
  SESSION_SCHEMA_VERSION,
  MAX_SESSION_PAYLOAD_BYTES,
} from "./types.ts";

export const SAFE_DEFAULT_ROUTE = "/";

export const ROUTE_ALLOWLIST: readonly string[] = Object.freeze([
  "/",
  "/chat",
  "/history",
  "/settings",
  "/license",
  "/about",
  "/contact",
  "/diagnostics",
  "/help",
]);

export const SETTINGS_TAB_ALLOWLIST: readonly string[] = Object.freeze([
  "general",
  "appearance",
  "chat",
  "notifications",
  "profiles",
  "providers",
  "models",
  "privacy",
  "export",
  "import",
  "integrity",
  "maintenance",
  "security",
  "reset",
]);

/**
 * Validates and sanitizes a route string against the application allowlist.
 * Prevents arbitrary URL navigation, JavaScript URLs, and deep link injection.
 */
export function validateSafeRoute(rawRoute: unknown): string {
  if (!rawRoute || typeof rawRoute !== "string") {
    return SAFE_DEFAULT_ROUTE;
  }

  const trimmed = rawRoute.trim();
  if (trimmed.length === 0 || trimmed.length > 256) {
    return SAFE_DEFAULT_ROUTE;
  }

  // Reject malicious schemes immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:") ||
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("<script") ||
    lower.includes("</script") ||
    lower.includes("eval(")
  ) {
    return SAFE_DEFAULT_ROUTE;
  }

  // Split into pathname and query string
  const [pathname, search] = trimmed.split("?");

  if (!ROUTE_ALLOWLIST.includes(pathname)) {
    return SAFE_DEFAULT_ROUTE;
  }

  // If no query string, path is completely safe
  if (!search) {
    return pathname;
  }

  // If search contains HTML brackets or script injection, discard search and return clean pathname
  if (search.includes("<") || search.includes(">") || search.includes('"') || search.includes("'")) {
    return pathname;
  }

  // Parse and sanitize query params based on route
  try {
    const params = new URLSearchParams(search);
    const safeParams = new URLSearchParams();

    if (pathname === "/settings") {
      const tab = params.get("tab")?.toLowerCase();
      if (tab && SETTINGS_TAB_ALLOWLIST.includes(tab)) {
        safeParams.set("tab", tab);
      }
    } else if (pathname === "/help") {
      const article = params.get("article");
      if (article && /^[a-z0-9_-]{1,64}$/i.test(article)) {
        safeParams.set("article", article);
      }
      const q = params.get("q");
      if (q && q.length <= 64) {
        safeParams.set("q", q.replace(/[<>'"&`]/g, "").trim());
      }
    } else if (pathname === "/chat") {
      const session = params.get("session");
      if (session && /^[a-zA-Z0-9_-]{1,64}$/.test(session)) {
        safeParams.set("session", session);
      }
    } else if (pathname === "/history") {
      const q = params.get("q");
      if (q && q.length <= 64) {
        safeParams.set("q", q.replace(/[<>'"&`]/g, "").trim());
      }
    }

    const safeSearchStr = safeParams.toString();
    return safeSearchStr ? `${pathname}?${safeSearchStr}` : pathname;
  } catch {
    return pathname;
  }
}

/**
 * Serializes a workspace session snapshot into an allowlisted JSON payload.
 * Enforces strict 8KB ceiling and excludes credentials or runtime objects.
 */
export function serializeSessionSnapshot(snapshot: Partial<WorkspaceSessionSnapshot>): string {
  const safeRoute = validateSafeRoute(snapshot.route);

  const cleanSnapshot: WorkspaceSessionSnapshot = {
    format: SESSION_SCHEMA_FORMAT,
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: Date.now(),
    route: safeRoute,
    activeProfileId: snapshot.activeProfileId ? String(snapshot.activeProfileId).slice(0, 64) : undefined,
    sidebarCollapsed: typeof snapshot.sidebarCollapsed === "boolean" ? snapshot.sidebarCollapsed : undefined,
    activeChatSessionId: snapshot.activeChatSessionId ? String(snapshot.activeChatSessionId).slice(0, 64) : undefined,
    settingsTab: snapshot.settingsTab && SETTINGS_TAB_ALLOWLIST.includes(snapshot.settingsTab) ? snapshot.settingsTab : undefined,
    historyFilter: snapshot.historyFilter ? String(snapshot.historyFilter) : undefined,
    helpArticleId: snapshot.helpArticleId ? String(snapshot.helpArticleId).slice(0, 64) : undefined,
    windowState: snapshot.windowState && typeof snapshot.windowState === "object" ? {
      isMaximized: Boolean(snapshot.windowState.isMaximized),
      width: typeof snapshot.windowState.width === "number" && snapshot.windowState.width > 200 ? snapshot.windowState.width : undefined,
      height: typeof snapshot.windowState.height === "number" && snapshot.windowState.height > 200 ? snapshot.windowState.height : undefined,
      x: typeof snapshot.windowState.x === "number" ? snapshot.windowState.x : undefined,
      y: typeof snapshot.windowState.y === "number" ? snapshot.windowState.y : undefined,
    } : undefined,
  };

  const jsonStr = JSON.stringify(cleanSnapshot);
  if (jsonStr.length > MAX_SESSION_PAYLOAD_BYTES) {
    throw new Error(`Serialized session snapshot exceeds limit of ${MAX_SESSION_PAYLOAD_BYTES} bytes`);
  }

  return jsonStr;
}

/**
 * Parses and validates an untrusted session state JSON string.
 * Gracefully falls back if corrupted, malformed, or declaring an unsupported version.
 */
export function parseAndValidateSessionSnapshot(
  jsonString: unknown
): { snapshot: WorkspaceSessionSnapshot | null; isValid: boolean; error?: string } {
  if (!jsonString || typeof jsonString !== "string") {
    return { snapshot: null, isValid: false, error: "Empty session state payload" };
  }

  if (jsonString.length > MAX_SESSION_PAYLOAD_BYTES) {
    return { snapshot: null, isValid: false, error: "Session payload exceeds maximum allowed size" };
  }

  if (jsonString.trim().length === 0) {
    return { snapshot: null, isValid: false, error: "Empty session state payload" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    return {
      snapshot: null,
      isValid: false,
      error: `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { snapshot: null, isValid: false, error: "Root session payload must be an object" };
  }

  const raw = parsed as Partial<WorkspaceSessionSnapshot>;

  if (raw.format !== SESSION_SCHEMA_FORMAT) {
    return { snapshot: null, isValid: false, error: `Unsupported format envelope '${String(raw.format)}'` };
  }

  if (raw.schemaVersion !== undefined && typeof raw.schemaVersion === "number") {
    if (raw.schemaVersion > SESSION_SCHEMA_VERSION) {
      return {
        snapshot: null,
        isValid: false,
        error: `Unsupported future schema version ${raw.schemaVersion} (supported: ${SESSION_SCHEMA_VERSION})`,
      };
    }
  }

  const safeRoute = validateSafeRoute(raw.route);

  const cleanSnapshot: WorkspaceSessionSnapshot = {
    format: SESSION_SCHEMA_FORMAT,
    schemaVersion: SESSION_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === "number" && raw.savedAt > 0 ? raw.savedAt : Date.now(),
    route: safeRoute,
    activeProfileId: raw.activeProfileId ? String(raw.activeProfileId).slice(0, 64) : undefined,
    sidebarCollapsed: typeof raw.sidebarCollapsed === "boolean" ? raw.sidebarCollapsed : undefined,
    activeChatSessionId: raw.activeChatSessionId ? String(raw.activeChatSessionId).slice(0, 64) : undefined,
    settingsTab: raw.settingsTab && SETTINGS_TAB_ALLOWLIST.includes(raw.settingsTab) ? raw.settingsTab : undefined,
    historyFilter: raw.historyFilter ? String(raw.historyFilter).slice(0, 64) : undefined,
    helpArticleId: raw.helpArticleId ? String(raw.helpArticleId).slice(0, 64) : undefined,
    windowState: raw.windowState,
  };

  return { snapshot: cleanSnapshot, isValid: true };
}

/**
 * Resolves startup route based on strict Step 68 Section 25 precedence:
 * 1. Critical recovery / update recovery active -> Handled by outer supervisor
 * 2. Mandatory onboarding -> "/" with onboarding modal
 * 3. User opt-out of session restore -> user preference startup route ("overview" -> "/", "chat" -> "/chat")
 * 4. Crash recovery with broken route -> Fallback route "/"
 * 5. Safe valid session snapshot route -> restored route
 * 6. Fallback default -> "/"
 */
export function resolveStartupRoute(options: {
  isOnboardingMandatory?: boolean;
  restorePreviousSession?: boolean;
  userStartupPreference?: "overview" | "chat" | string;
  sessionSnapshot?: WorkspaceSessionSnapshot | null;
  lastExitStatus?: SessionExitStatus;
}): { targetRoute: string; reason: string } {
  const {
    isOnboardingMandatory = false,
    restorePreviousSession = true,
    userStartupPreference = "overview",
    sessionSnapshot = null,
    lastExitStatus = "clean_exit",
  } = options;

  // 1. Mandatory onboarding overrides everything
  if (isOnboardingMandatory) {
    return { targetRoute: SAFE_DEFAULT_ROUTE, reason: "Onboarding is mandatory for first-run" };
  }

  // 2. User explicitly disabled session restoration
  if (!restorePreviousSession) {
    const route = userStartupPreference === "chat" ? "/chat" : SAFE_DEFAULT_ROUTE;
    return { targetRoute: route, reason: "Session restoration disabled by user preference" };
  }

  // 3. Unexpected exit / crash handling
  if (lastExitStatus === "unexpected_exit" || lastExitStatus === "startup_recovery") {
    // If crash occurred while on settings or diagnostics, fall back to safe default to avoid crash loops
    if (sessionSnapshot && sessionSnapshot.route.startsWith("/settings")) {
      return { targetRoute: SAFE_DEFAULT_ROUTE, reason: "Recovered from unexpected exit; safe fallback applied" };
    }
  }

  // 4. Valid session snapshot route restoration
  if (sessionSnapshot && sessionSnapshot.route) {
    const safeRoute = validateSafeRoute(sessionSnapshot.route);
    return { targetRoute: safeRoute, reason: "Restored from previous session snapshot" };
  }

  // 5. Fall back to user startup preference or default
  const defaultRoute = userStartupPreference === "chat" ? "/chat" : SAFE_DEFAULT_ROUTE;
  return { targetRoute: defaultRoute, reason: "Default startup route applied" };
}
