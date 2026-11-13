/**
 * Nano Route — Accessibility & Inclusive UX Hardening Engine
 * File: src/features/maintenance/accessibilityHardening.ts
 *
 * Implements Step 60 accessibility audits: WCAG 2.1 AA contrast calculation,
 * screen reader streaming announcement throttling, focus trap simulation,
 * color-independence verification, and reduced-motion adaptation.
 */

export interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses a hex color string (#RGB, #RRGGBB) into RGB components.
 */
export function hexToRgb(hex: string): ColorRgb {
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Calculates the relative luminance of a color per WCAG 2.1 definition.
 */
export function calculateRelativeLuminance(color: ColorRgb): number {
  const transform = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const R = transform(color.r);
  const G = transform(color.g);
  const B = transform(color.b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates the contrast ratio between two colors per WCAG 2.1.
 * Ratio format: (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color.
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const lum1 = calculateRelativeLuminance(hexToRgb(hex1));
  const lum2 = calculateRelativeLuminance(hexToRgb(hex2));

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * Evaluates whether a contrast ratio satisfies WCAG 2.1 AA requirements.
 */
export function evaluateWcagAaContrast(
  ratio: number,
  isLargeTextOrUiComponent = false
): {
  passes: boolean;
  requiredMinimum: number;
} {
  const requiredMinimum = isLargeTextOrUiComponent ? 3.0 : 4.5;
  return {
    passes: ratio >= requiredMinimum,
    requiredMinimum,
  };
}

/**
 * Formats polite screen reader announcements for streaming chat,
 * ensuring incremental tokens do not overwhelm assistive technology.
 */
export interface StreamingAriaState {
  stage: "idle" | "started" | "streaming" | "completed" | "error";
  modelName?: string;
  tokenCount?: number;
  errorMessage?: string;
}

export function formatStreamingAnnouncement(state: StreamingAriaState): string | null {
  switch (state.stage) {
    case "started":
      return `Assistant response started${state.modelName ? ` from ${state.modelName}` : ""}...`;
    case "streaming":
      // Suppress announcing individual streaming delta chunks to prevent screen reader stutter
      return null;
    case "completed":
      return `Assistant response completed.${state.tokenCount !== undefined ? ` Generated ${state.tokenCount} tokens.` : ""}`;
    case "error":
      return `Assistant response failed: ${state.errorMessage ?? "An error occurred during generation."}`;
    case "idle":
    default:
      return null;
  }
}

/**
 * Simulates a focus trap tab order sequence within a modal or drawer container.
 */
export function getNextTrappedFocusIndex(
  currentIndex: number,
  focusableCount: number,
  isShiftTab: boolean
): number {
  if (focusableCount <= 0) return -1;
  if (isShiftTab) {
    return currentIndex <= 0 ? focusableCount - 1 : currentIndex - 1;
  } else {
    return currentIndex >= focusableCount - 1 ? 0 : currentIndex + 1;
  }
}

/**
 * Status indicator descriptor ensuring color-independent communication.
 */
export interface StatusDescriptor {
  status: "online" | "offline" | "routing" | "warning" | "error" | "busy";
  colorHex: string;
  accessibleLabel: string;
  iconName: string;
}

/**
 * Validates that a status indicator provides non-color semantics (icon and label).
 */
export function validateColorIndependence(descriptor: StatusDescriptor): {
  isColorIndependent: boolean;
  accessibleText: string;
} {
  const hasValidLabel =
    Boolean(descriptor.accessibleLabel) && descriptor.accessibleLabel.trim().length > 0;
  const hasValidIcon = Boolean(descriptor.iconName) && descriptor.iconName.trim().length > 0;

  return {
    isColorIndependent: hasValidLabel && hasValidIcon,
    accessibleText: `Status: ${descriptor.accessibleLabel} (${descriptor.status})`,
  };
}

/**
 * Generates transition styling adhering to Windows and browser reduced-motion preferences.
 */
export function getAccessibleTransitionStyles(prefersReducedMotion: boolean): {
  transition: string;
  transform: string;
} {
  if (prefersReducedMotion) {
    return {
      transition: "none",
      transform: "none",
    };
  }
  return {
    transition: "all 150ms cubic-bezier(0.16, 1, 0.3, 1)",
    transform: "translateY(0)",
  };
}

