/**
 * Nano Route — External Link & URL Security Utilities
 * File: src/features/about/utils/externalLinks.ts
 *
 * Strict scheme validation, zero arbitrary protocol execution,
 * and graceful fallback handling for external browser and email openers.
 */

export interface UrlValidationResult {
  isValid: boolean;
  scheme?: string;
  error?: string;
}

export interface LinkOpenResult {
  success: boolean;
  error?: string;
}

/** Allowed protocols for desktop external link interactions */
const ALLOWED_SCHEMES = new Set(["https:", "mailto:", "whatsapp:"]);

/** Dangerous or blocked schemes that must never be executed */
const DISALLOWED_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
]);

/**
 * Validates an external URL for security before navigation or execution.
 */
export function validateExternalUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isValid: false, error: "URL is empty or invalid" };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: "URL cannot be blank" };
  }

  // Reject CRLF and control characters to prevent header injection or URI spoofing
  if (/[\r\n\x00-\x1F\x7F]/.test(trimmed)) {
    return {
      isValid: false,
      error: "URL contains prohibited control characters or line breaks",
    };
  }

  // Pre-check for raw malicious prefixes
  const lower = trimmed.toLowerCase();
  for (const dangerous of DISALLOWED_SCHEMES) {
    if (lower.startsWith(dangerous)) {
      return {
        isValid: false,
        error: `Disallowed URL protocol: ${dangerous}`,
      };
    }
  }

  // Handle mailto: scheme
  if (lower.startsWith("mailto:")) {
    const emailPart = trimmed.slice(7).split("?")[0].trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailPart)) {
      return {
        isValid: false,
        scheme: "mailto:",
        error: "Malformed email destination address",
      };
    }
    return { isValid: true, scheme: "mailto:" };
  }

  // Handle whatsapp: scheme
  if (lower.startsWith("whatsapp:")) {
    return { isValid: true, scheme: "whatsapp:" };
  }

  // Standard web URL validation
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (!ALLOWED_SCHEMES.has(protocol)) {
      return {
        isValid: false,
        scheme: protocol,
        error: `Unsupported URL protocol: ${protocol}. Only HTTPS, mailto, and whatsapp are permitted.`,
      };
    }

    if (protocol === "https:" && !parsed.hostname) {
      return {
        isValid: false,
        scheme: protocol,
        error: "Malformed HTTPS URL: Missing hostname",
      };
    }

    return { isValid: true, scheme: protocol };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: `Malformed URL: ${err instanceof Error ? err.message : "Parse error"}`,
    };
  }
}

/**
 * Opens an external link safely through the user's browser or default mail client.
 */
export async function openExternalLink(url: string): Promise<LinkOpenResult> {
  const validation = validateExternalUrl(url);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || "The destination URL failed security validation.",
    };
  }

  try {
    if (typeof window === "undefined") {
      return { success: false, error: "Window context unavailable" };
    }

    const trimmed = url.trim();

    if (trimmed.toLowerCase().startsWith("mailto:")) {
      // Use window.location for mailto client triggering
      window.location.href = trimmed;
      return { success: true };
    }

    // Open https and whatsapp URLs in an external window/tab with noopener & noreferrer
    const newWindow = window.open(trimmed, "_blank", "noopener,noreferrer");
    if (!newWindow) {
      return {
        success: false,
        error: "The selected link could not be opened. Please use the displayed address manually.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        "The selected link could not be opened. Please use the displayed address manually.",
    };
  }
}

/**
 * Copies plain text to the clipboard with fallback for restricted desktop contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to document.execCommand if clipboard API is restricted
  }

  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
}

