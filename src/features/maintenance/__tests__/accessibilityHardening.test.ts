/**
 * Step 60 — Accessibility Hardening, Focus Management & Screen Reader Test Suite
 * File: src/features/maintenance/__tests__/accessibilityHardening.test.ts
 *
 * Validates WCAG 2.1 AA contrast calculations, ARIA streaming announcement throttling,
 * modal focus trapping, color independence, reduced motion adaptation, and documentation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateContrastRatio,
  evaluateWcagAaContrast,
  formatStreamingAnnouncement,
  getNextTrappedFocusIndex,
  validateColorIndependence,
  getAccessibleTransitionStyles,
} from "../accessibilityHardening.ts";

describe("Step 60 Accessibility Hardening & Inclusive Desktop Validation", () => {
  // ==========================================================================
  // 1. WCAG 2.1 AA CONTRAST RATIO AUDITS
  // ==========================================================================
  describe("1. WCAG 2.1 AA Contrast Ratio Audits", () => {
    const obsidianBackground = "#0B0D13";
    const panelBackground = "#131620";
    const primaryWhiteText = "#F3F4F6";
    const secondaryZincText = "#9CA3AF";
    const focusPurpleAccent = "#8B5CF6";

    it("verifies primary text against dark background exceeds 4.5:1 ratio", () => {
      const ratio = calculateContrastRatio(primaryWhiteText, obsidianBackground);
      const evalResult = evaluateWcagAaContrast(ratio, false);
      assert.ok(ratio > 10.0, `Primary contrast ${ratio} should be well above 10:1`);
      assert.equal(evalResult.passes, true);
    });

    it("verifies secondary text against dark background exceeds 4.5:1 ratio", () => {
      const ratio = calculateContrastRatio(secondaryZincText, obsidianBackground);
      const evalResult = evaluateWcagAaContrast(ratio, false);
      assert.ok(ratio >= 4.5, `Secondary contrast ${ratio} must meet or exceed 4.5:1`);
      assert.equal(evalResult.passes, true);
    });

    it("verifies focus indicator against panel surface exceeds 3.0:1 UI requirement", () => {
      const ratio = calculateContrastRatio(focusPurpleAccent, panelBackground);
      const evalResult = evaluateWcagAaContrast(ratio, true);
      assert.ok(ratio >= 3.0, `Focus ring contrast ${ratio} must meet 3.0:1 UI requirement`);
      assert.equal(evalResult.passes, true);
    });

    it("correctly identifies failing low-contrast combinations", () => {
      const failingDarkGrey = "#2A2D3A";
      const ratio = calculateContrastRatio(failingDarkGrey, obsidianBackground);
      const evalResult = evaluateWcagAaContrast(ratio, false);
      assert.equal(evalResult.passes, false);
      assert.ok(ratio < 4.5);
    });
  });

  // ==========================================================================
  // 2. SCREEN READER STREAMING ANNOUNCEMENT THROTTLING
  // ==========================================================================
  describe("2. Screen Reader Streaming Announcement Throttling", () => {
    it("announces the start of generation with model name", () => {
      const announcement = formatStreamingAnnouncement({
        stage: "started",
        modelName: "Llama-3.2-1B-Instruct",
      });
      assert.equal(announcement, "Assistant response started from Llama-3.2-1B-Instruct...");
    });

    it("suppresses incremental streaming tokens to prevent assistive tech flood", () => {
      const announcement = formatStreamingAnnouncement({
        stage: "streaming",
        tokenCount: 45,
      });
      assert.equal(announcement, null);
    });

    it("announces response completion with final token count", () => {
      const announcement = formatStreamingAnnouncement({
        stage: "completed",
        tokenCount: 182,
      });
      assert.equal(announcement, "Assistant response completed. Generated 182 tokens.");
    });

    it("announces error state with sanitized message", () => {
      const announcement = formatStreamingAnnouncement({
        stage: "error",
        errorMessage: "Provider rate limit reached (HTTP 429).",
      });
      assert.equal(announcement, "Assistant response failed: Provider rate limit reached (HTTP 429).");
    });
  });

  // ==========================================================================
  // 3. MODAL FOCUS TRAP CYCLING
  // ==========================================================================
  describe("3. Modal Focus Trap Cycling", () => {
    it("advances forward through focusable items and wraps around from last to first", () => {
      const count = 4;
      assert.equal(getNextTrappedFocusIndex(0, count, false), 1);
      assert.equal(getNextTrappedFocusIndex(1, count, false), 2);
      assert.equal(getNextTrappedFocusIndex(2, count, false), 3);
      // Last item wraps to 0
      assert.equal(getNextTrappedFocusIndex(3, count, false), 0);
    });

    it("reverses backward through focusable items and wraps around from first to last", () => {
      const count = 4;
      assert.equal(getNextTrappedFocusIndex(2, count, true), 1);
      assert.equal(getNextTrappedFocusIndex(1, count, true), 0);
      // First item wraps to 3 (last)
      assert.equal(getNextTrappedFocusIndex(0, count, true), 3);
    });

    it("handles zero focusable count gracefully", () => {
      assert.equal(getNextTrappedFocusIndex(0, 0, false), -1);
    });
  });

  // ==========================================================================
  // 4. COLOR INDEPENDENCE VALIDATION
  // ==========================================================================
  describe("4. Color Independence & Multi-Attribute Indicators", () => {
    it("validates status descriptor containing both text label and icon", () => {
      const result = validateColorIndependence({
        status: "online",
        colorHex: "#10B981",
        accessibleLabel: "Provider Connected",
        iconName: "CheckCircle",
      });
      assert.equal(result.isColorIndependent, true);
      assert.equal(result.accessibleText, "Status: Provider Connected (online)");
    });

    it("rejects status descriptor that omits text label or icon", () => {
      const resultNoLabel = validateColorIndependence({
        status: "error",
        colorHex: "#EF4444",
        accessibleLabel: "",
        iconName: "AlertTriangle",
      });
      assert.equal(resultNoLabel.isColorIndependent, false);

      const resultNoIcon = validateColorIndependence({
        status: "warning",
        colorHex: "#F59E0B",
        accessibleLabel: "Rate Limited",
        iconName: "",
      });
      assert.equal(resultNoIcon.isColorIndependent, false);
    });
  });

  // ==========================================================================
  // 5. REDUCED MOTION TRANSITIONS
  // ==========================================================================
  describe("5. Reduced Motion Transitions", () => {
    it("disables transitions and transforms when user prefers reduced motion", () => {
      const styles = getAccessibleTransitionStyles(true);
      assert.equal(styles.transition, "none");
      assert.equal(styles.transform, "none");
    });

    it("provides smooth standard transition when reduced motion is not requested", () => {
      const styles = getAccessibleTransitionStyles(false);
      assert.ok(styles.transition.includes("150ms"));
      assert.equal(styles.transform, "translateY(0)");
    });
  });

  // ==========================================================================
  // 6. ACCESSIBILITY DOCUMENTATION CONSISTENCY
  // ==========================================================================
  describe("6. Accessibility Documentation Consistency", () => {
    const expectedDocs = [
      "NANO_ROUTE_STEP_60_BASELINE.md",
      "NANO_ROUTE_ACCESSIBILITY_TEST_MATRIX.md",
      "NANO_ROUTE_KEYBOARD_NAVIGATION.md",
      "NANO_ROUTE_SCREEN_READER_RESULTS.md",
      "NANO_ROUTE_FOCUS_MANAGEMENT.md",
      "NANO_ROUTE_ACCESSIBILITY_DEFECTS.md",
      "NANO_ROUTE_STEP_60_COMPLETION_REPORT.md",
    ];

    it("ensures all 7 authoritative accessibility documents exist in docs/accessibility/", () => {
      const a11yDir = path.resolve(process.cwd(), "docs/accessibility");
      assert.ok(fs.existsSync(a11yDir), "docs/accessibility/ directory must exist");

      for (const doc of expectedDocs) {
        const filePath = path.join(a11yDir, doc);
        assert.ok(fs.existsSync(filePath), `Document ${doc} must exist in docs/accessibility/`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.length > 200, `Document ${doc} must contain meaningful content`);
      }
    });
  });
});

