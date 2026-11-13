/**
 * Nano Route — Windows Environment Compatibility & Runtime Qualification Subsystem
 * File: src/features/maintenance/windowsCompatibility.ts
 *
 * Implements Step 59 Windows OS version qualification, WebView2 runtime validation,
 * display scaling & High-DPI coordinate calculations, path normalization, and
 * power/network transition state handling.
 */

export type WindowsSupportStatus =
  | "SUPPORTED"
  | "SUPPORTED_WITH_LIMITATIONS"
  | "UNSUPPORTED"
  | "NOT_YET_QUALIFIED";

export interface WindowsOsDescriptor {
  version: string;
  buildNumber: number;
  architecture: "x64" | "arm64" | "ia32" | string;
  isServerEdition?: boolean;
}

export interface WebView2RuntimeInfo {
  installed: boolean;
  version?: string;
  channel?: "Evergreen" | "FixedVersion" | "Beta" | "Dev" | "Canary";
}

export interface DisplayConfiguration {
  width: number;
  height: number;
  dpiScale: number; // e.g. 1.0, 1.25, 1.5, 1.75, 2.0
  isPrimary?: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_APP_WIDTH = 1000;
export const MIN_APP_HEIGHT = 650;
export const DEFAULT_APP_WIDTH = 1440;
export const DEFAULT_APP_HEIGHT = 900;
export const MIN_WEBVIEW2_VERSION = "109.0.1518.78";

/**
 * Evaluates Windows OS compatibility based on official support policies.
 */
export function evaluateWindowsOsCompatibility(os: WindowsOsDescriptor): {
  status: WindowsSupportStatus;
  reason: string;
} {
  // 32-bit architecture is strictly unsupported
  if (os.architecture === "ia32" || os.architecture === "x86") {
    return {
      status: "UNSUPPORTED",
      reason: "32-bit (x86) Windows architectures are not supported. 64-bit Windows is required.",
    };
  }

  // Legacy OS versions before Windows 10 (Build 19041+)
  if (os.buildNumber < 19041) {
    return {
      status: "UNSUPPORTED",
      reason: `Windows build ${os.buildNumber} precedes Windows 10 Build 19041 (20H1). Upgrade to Windows 10 (21H2+) or Windows 11.`,
    };
  }

  // Windows 11 (Build 22000+) on x64
  if (os.buildNumber >= 22000 && os.architecture === "x64") {
    return {
      status: "SUPPORTED",
      reason: "Windows 11 x64 is a fully tier-1 qualified production target.",
    };
  }

  // Windows 10 (Build 19041-21999) on x64
  if (os.buildNumber >= 19041 && os.architecture === "x64") {
    return {
      status: "SUPPORTED",
      reason: "Windows 10 x64 (20H1+) is a fully tier-1 qualified production target.",
    };
  }

  // ARM64 under Windows 11 (x64 translation)
  if (os.architecture === "arm64") {
    return {
      status: "SUPPORTED_WITH_LIMITATIONS",
      reason: "Windows 11 on ARM64 operates via x64 emulation. Local SLM inference may have CPU-only performance limitations.",
    };
  }

  return {
    status: "NOT_YET_QUALIFIED",
    reason: `Operating system configuration (${os.version}, build ${os.buildNumber}) has not been formally verified.`,
  };
}

/**
 * Validates whether the installed WebView2 runtime satisfies minimum application requirements.
 */
export function validateWebView2Runtime(info: WebView2RuntimeInfo): {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  if (!info.installed || !info.version) {
    return {
      valid: false,
      errorCode: "WEBVIEW2_NOT_INSTALLED",
      errorMessage: "Microsoft Edge WebView2 Evergreen Runtime is not installed. Download from Microsoft to run Nano Route.",
    };
  }

  const parseVersion = (v: string): number[] =>
    v.split(".").map((part) => parseInt(part, 10) || 0);

  const currentParts = parseVersion(info.version);
  const minParts = parseVersion(MIN_WEBVIEW2_VERSION);

  for (let i = 0; i < Math.max(currentParts.length, minParts.length); i++) {
    const cur = currentParts[i] ?? 0;
    const min = minParts[i] ?? 0;
    if (cur > min) break;
    if (cur < min) {
      return {
        valid: false,
        errorCode: "WEBVIEW2_VERSION_UNSUPPORTED",
        errorMessage: `Installed WebView2 version (${info.version}) is older than minimum required (${MIN_WEBVIEW2_VERSION}).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculates effective UI resolution and validates that elements fit within display constraints.
 */
export function calculateEffectiveUiDimensions(display: DisplayConfiguration): {
  effectiveWidth: number;
  effectiveHeight: number;
  meetsMinimumRequirements: boolean;
  scalePercentage: number;
} {
  const scale = display.dpiScale > 0 ? display.dpiScale : 1.0;
  const effectiveWidth = Math.floor(display.width / scale);
  const effectiveHeight = Math.floor(display.height / scale);

  const meetsMinimumRequirements =
    effectiveWidth >= MIN_APP_WIDTH && effectiveHeight >= MIN_APP_HEIGHT;

  return {
    effectiveWidth,
    effectiveHeight,
    meetsMinimumRequirements,
    scalePercentage: Math.round(scale * 100),
  };
}

/**
 * Clamps and positions a window to ensure it never renders off-screen or out-of-bounds,
 * particularly after multi-monitor disconnections or scaling adjustments.
 */
export function sanitizeWindowPlacement(
  savedBounds: WindowBounds,
  displays: DisplayConfiguration[]
): WindowBounds {
  // If displays list is empty, return safe default centered layout
  if (!displays || displays.length === 0) {
    return {
      x: 100,
      y: 100,
      width: Math.max(savedBounds.width, MIN_APP_WIDTH),
      height: Math.max(savedBounds.height, MIN_APP_HEIGHT),
    };
  }

  const primary = displays.find((d) => d.isPrimary) || displays[0];
  const width = Math.max(Math.min(savedBounds.width, primary.width), MIN_APP_WIDTH);
  const height = Math.max(Math.min(savedBounds.height, primary.height), MIN_APP_HEIGHT);

  // Ensure window is at least partially visible on primary screen
  let x = savedBounds.x;
  let y = savedBounds.y;

  if (x < 0 || x + 100 > primary.width) {
    x = Math.max(0, Math.floor((primary.width - width) / 2));
  }
  if (y < 0 || y + 100 > primary.height) {
    y = Math.max(0, Math.floor((primary.height - height) / 2));
  }

  return { x, y, width, height };
}

/**
 * Checks Windows filesystem path compatibility, testing for MAX_PATH boundaries,
 * spaces, and Unicode compliance.
 */
export function qualifyWindowsPath(targetPath: string): {
  isValid: boolean;
  hasSpaces: boolean;
  hasUnicode: boolean;
  exceedsStandardMaxPath: boolean;
  normalizedPath: string;
} {
  const normalizedPath = targetPath.replace(/\//g, "\\");
  const hasSpaces = /\s/.test(normalizedPath);
  // Detect non-ASCII / Unicode characters
  const hasUnicode = /[^\u0000-\u007F]/.test(normalizedPath);
  const exceedsStandardMaxPath = normalizedPath.length >= 260;

  // Basic check for valid drive root syntax: C:\...
  const isValid = /^[A-Za-z]:\\[^*?"<>|]*$/.test(normalizedPath);

  return {
    isValid,
    hasSpaces,
    hasUnicode,
    exceedsStandardMaxPath,
    normalizedPath,
  };
}

/**
 * Evaluates whether an active task should be paused or invalidated across
 * power and network state transitions.
 */
export function evaluatePowerNetworkTransition(event: {
  type: "SUSPEND" | "RESUME" | "OFFLINE" | "ONLINE";
  hasActiveStreamingTask: boolean;
  isLocalSlmOnly: boolean;
}): {
  action: "CONTINUE" | "INVALIDATE_STREAM" | "DEGRADE_TO_OFFLINE" | "RESTORE_ONLINE";
  reason: string;
} {
  switch (event.type) {
    case "SUSPEND":
      return {
        action: event.hasActiveStreamingTask ? "INVALIDATE_STREAM" : "CONTINUE",
        reason: "System entering sleep/hibernate; open HTTP provider streams must be aborted gracefully.",
      };
    case "RESUME":
      return {
        action: "CONTINUE",
        reason: "System resumed from sleep; re-verifying provider network socket states.",
      };
    case "OFFLINE":
      return {
        action: "DEGRADE_TO_OFFLINE",
        reason: "Network interface disconnected; local SLM and cached data remain operational.",
      };
    case "ONLINE":
      return {
        action: "RESTORE_ONLINE",
        reason: "Network connectivity restored; cloud frontier provider routes re-enabled.",
      };
  }
}

