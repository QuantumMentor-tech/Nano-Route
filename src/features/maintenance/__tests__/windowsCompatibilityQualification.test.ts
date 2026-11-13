/**
 * Step 59 — Windows Compatibility Qualification & Runtime Matrix Test Suite
 * File: src/features/maintenance/__tests__/windowsCompatibilityQualification.test.ts
 *
 * Validates Windows OS qualification, WebView2 runtime validation, High-DPI display scaling,
 * multi-monitor coordinate bounds clamping, filesystem path qualification, and power transitions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  evaluateWindowsOsCompatibility,
  validateWebView2Runtime,
  calculateEffectiveUiDimensions,
  sanitizeWindowPlacement,
  qualifyWindowsPath,
  evaluatePowerNetworkTransition,
  MIN_APP_WIDTH,
  MIN_APP_HEIGHT,
  MIN_WEBVIEW2_VERSION,
} from "../windowsCompatibility.ts";

describe("Step 59 Windows Compatibility & Runtime Matrix Qualification", () => {
  // ==========================================================================
  // 1. WINDOWS OS VERSION & ARCHITECTURE QUALIFICATION
  // ==========================================================================
  describe("1. Windows OS Version & Architecture Qualification", () => {
    it("qualifies Windows 11 x64 (Build 22631) as tier-1 SUPPORTED", () => {
      const evaluation = evaluateWindowsOsCompatibility({
        version: "Windows 11 Pro",
        buildNumber: 22631,
        architecture: "x64",
      });
      assert.equal(evaluation.status, "SUPPORTED");
      assert.ok(evaluation.reason.includes("Windows 11 x64 is a fully tier-1"));
    });

    it("qualifies Windows 10 x64 (Build 19045) as tier-1 SUPPORTED", () => {
      const evaluation = evaluateWindowsOsCompatibility({
        version: "Windows 10 Pro",
        buildNumber: 19045,
        architecture: "x64",
      });
      assert.equal(evaluation.status, "SUPPORTED");
      assert.ok(evaluation.reason.includes("Windows 10 x64"));
    });

    it("qualifies Windows 11 on ARM64 as SUPPORTED_WITH_LIMITATIONS", () => {
      const evaluation = evaluateWindowsOsCompatibility({
        version: "Windows 11 Pro on ARM",
        buildNumber: 22631,
        architecture: "arm64",
      });
      assert.equal(evaluation.status, "SUPPORTED_WITH_LIMITATIONS");
      assert.ok(evaluation.reason.includes("emulation"));
    });

    it("rejects 32-bit (x86 / ia32) Windows architectures as UNSUPPORTED", () => {
      const evaluation = evaluateWindowsOsCompatibility({
        version: "Windows 10 Home 32-bit",
        buildNumber: 19045,
        architecture: "ia32",
      });
      assert.equal(evaluation.status, "UNSUPPORTED");
      assert.ok(evaluation.reason.includes("32-bit"));
    });

    it("rejects legacy Windows 7 (Build 7601) as UNSUPPORTED", () => {
      const evaluation = evaluateWindowsOsCompatibility({
        version: "Windows 7 SP1",
        buildNumber: 7601,
        architecture: "x64",
      });
      assert.equal(evaluation.status, "UNSUPPORTED");
      assert.ok(evaluation.reason.includes("precedes Windows 10"));
    });
  });

  // ==========================================================================
  // 2. WEBVIEW2 RUNTIME VALIDATION
  // ==========================================================================
  describe("2. WebView2 Runtime Compliance", () => {
    it("accepts modern Evergreen WebView2 runtime (131.0.2903.86)", () => {
      const result = validateWebView2Runtime({
        installed: true,
        version: "131.0.2903.86",
        channel: "Evergreen",
      });
      assert.equal(result.valid, true);
      assert.equal(result.errorCode, undefined);
    });

    it("accepts minimum baseline WebView2 version exactly at boundary", () => {
      const result = validateWebView2Runtime({
        installed: true,
        version: MIN_WEBVIEW2_VERSION,
        channel: "Evergreen",
      });
      assert.equal(result.valid, true);
    });

    it("identifies missing WebView2 runtime and provides actionable code", () => {
      const result = validateWebView2Runtime({
        installed: false,
      });
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, "WEBVIEW2_NOT_INSTALLED");
      assert.ok(result.errorMessage?.includes("Microsoft Edge WebView2 Evergreen Runtime is not installed"));
    });

    it("rejects outdated WebView2 runtime older than minimum baseline", () => {
      const result = validateWebView2Runtime({
        installed: true,
        version: "105.0.1343.53",
      });
      assert.equal(result.valid, false);
      assert.equal(result.errorCode, "WEBVIEW2_VERSION_UNSUPPORTED");
      assert.ok(result.errorMessage?.includes("older than minimum required"));
    });
  });

  // ==========================================================================
  // 3. DISPLAY SCALING & HIGH-DPI CALCULATION
  // ==========================================================================
  describe("3. Display Scaling & High-DPI Adaptation", () => {
    it("calculates effective viewport correctly at 100% scaling (1080p)", () => {
      const ui = calculateEffectiveUiDimensions({
        width: 1920,
        height: 1080,
        dpiScale: 1.0,
      });
      assert.equal(ui.effectiveWidth, 1920);
      assert.equal(ui.effectiveHeight, 1080);
      assert.equal(ui.meetsMinimumRequirements, true);
      assert.equal(ui.scalePercentage, 100);
    });

    it("calculates effective viewport correctly at 125% scaling (1440p)", () => {
      const ui = calculateEffectiveUiDimensions({
        width: 2560,
        height: 1440,
        dpiScale: 1.25,
      });
      assert.equal(ui.effectiveWidth, 2048);
      assert.equal(ui.effectiveHeight, 1152);
      assert.equal(ui.meetsMinimumRequirements, true);
      assert.equal(ui.scalePercentage, 125);
    });

    it("calculates effective viewport correctly at 150% scaling on 4K display", () => {
      const ui = calculateEffectiveUiDimensions({
        width: 3840,
        height: 2160,
        dpiScale: 1.5,
      });
      assert.equal(ui.effectiveWidth, 2560);
      assert.equal(ui.effectiveHeight, 1440);
      assert.equal(ui.meetsMinimumRequirements, true);
    });

    it("identifies when scaling reduces effective height below minimum threshold", () => {
      // 1366x768 at 125% scaling gives ~614px height, which is < 650px min height
      const ui = calculateEffectiveUiDimensions({
        width: 1366,
        height: 768,
        dpiScale: 1.25,
      });
      assert.equal(ui.meetsMinimumRequirements, false);
      assert.ok(ui.effectiveHeight < MIN_APP_HEIGHT);
    });
  });

  // ==========================================================================
  // 4. MULTI-MONITOR BOUNDS CLAMPING
  // ==========================================================================
  describe("4. Multi-Monitor Coordinate Clamping", () => {
    it("clamps off-screen coordinates back into view when secondary display is disconnected", () => {
      const primaryDisplay = {
        width: 1920,
        height: 1080,
        dpiScale: 1.0,
        isPrimary: true,
      };

      // Window was saved at x=2500, y=300 on disconnected 2nd monitor
      const clamped = sanitizeWindowPlacement(
        { x: 2500, y: 300, width: 1440, height: 900 },
        [primaryDisplay]
      );

      assert.ok(clamped.x >= 0 && clamped.x < 1920);
      assert.equal(clamped.width, 1440);
      assert.equal(clamped.height, 900);
    });

    it("enforces minimum window dimensions during placement clamping", () => {
      const primaryDisplay = {
        width: 1920,
        height: 1080,
        dpiScale: 1.0,
        isPrimary: true,
      };

      const clamped = sanitizeWindowPlacement(
        { x: 100, y: 100, width: 500, height: 400 }, // too small
        [primaryDisplay]
      );

      assert.equal(clamped.width, MIN_APP_WIDTH);
      assert.equal(clamped.height, MIN_APP_HEIGHT);
    });
  });

  // ==========================================================================
  // 5. WINDOWS FILESYSTEM PATH QUALIFICATION
  // ==========================================================================
  describe("5. Filesystem Path Qualification", () => {
    it("qualifies paths containing spaces and standard characters", () => {
      const testPath = "C:\\Users\\John Doe\\AppData\\Local\\Nano Route\\nano_route.db";
      const q = qualifyWindowsPath(testPath);
      assert.equal(q.isValid, true);
      assert.equal(q.hasSpaces, true);
      assert.equal(q.exceedsStandardMaxPath, false);
    });

    it("qualifies paths with international Unicode usernames", () => {
      const testPath = "C:\\Users\\José García\\AppData\\Local\\Nano Route\\nano_route.db";
      const q = qualifyWindowsPath(testPath);
      assert.equal(q.isValid, true);
      assert.equal(q.hasUnicode, true);
    });

    it("flags path exceeding MAX_PATH 260 character boundary", () => {
      const longFolder = "a".repeat(240);
      const testPath = `C:\\Users\\User\\AppData\\Local\\Nano Route\\${longFolder}\\nano_route.db`;
      const q = qualifyWindowsPath(testPath);
      assert.equal(q.exceedsStandardMaxPath, true);
    });
  });

  // ==========================================================================
  // 6. POWER & NETWORK LIFECYCLE TRANSITIONS
  // ==========================================================================
  describe("6. Power & Network Lifecycle Transitions", () => {
    it("invalidates open provider streaming tasks when entering sleep/hibernate", () => {
      const result = evaluatePowerNetworkTransition({
        type: "SUSPEND",
        hasActiveStreamingTask: true,
        isLocalSlmOnly: false,
      });
      assert.equal(result.action, "INVALIDATE_STREAM");
      assert.ok(result.reason.includes("entering sleep/hibernate"));
    });

    it("preserves execution when sleeping without active network stream", () => {
      const result = evaluatePowerNetworkTransition({
        type: "SUSPEND",
        hasActiveStreamingTask: false,
        isLocalSlmOnly: true,
      });
      assert.equal(result.action, "CONTINUE");
    });

    it("gracefully degrades cloud routing to offline state when network disconnects", () => {
      const result = evaluatePowerNetworkTransition({
        type: "OFFLINE",
        hasActiveStreamingTask: false,
        isLocalSlmOnly: false,
      });
      assert.equal(result.action, "DEGRADE_TO_OFFLINE");
      assert.ok(result.reason.includes("Network interface disconnected"));
    });

    it("restores cloud routing candidates when network connectivity returns", () => {
      const result = evaluatePowerNetworkTransition({
        type: "ONLINE",
        hasActiveStreamingTask: false,
        isLocalSlmOnly: false,
      });
      assert.equal(result.action, "RESTORE_ONLINE");
      assert.ok(result.reason.includes("connectivity restored"));
    });
  });

  // ==========================================================================
  // 7. COMPATIBILITY DOCUMENTATION CONSISTENCY
  // ==========================================================================
  describe("7. Compatibility Documentation Consistency", () => {
    const expectedDocs = [
      "NANO_ROUTE_WINDOWS_COMPATIBILITY_MATRIX.md",
      "NANO_ROUTE_WEBVIEW2_COMPATIBILITY.md",
      "NANO_ROUTE_HIGH_DPI_GUIDE.md",
      "NANO_ROUTE_WINDOWS_RECOVERY_MATRIX.md",
      "NANO_ROUTE_ENVIRONMENT_SUPPORT_POLICY.md",
      "NANO_ROUTE_STEP_59_COMPLETION_REPORT.md",
    ];

    it("ensures all 6 authoritative compatibility documents exist in docs/compatibility/", () => {
      const compatDir = path.resolve(process.cwd(), "docs/compatibility");
      assert.ok(fs.existsSync(compatDir), "docs/compatibility/ directory must exist");

      for (const doc of expectedDocs) {
        const filePath = path.join(compatDir, doc);
        assert.ok(fs.existsSync(filePath), `Document ${doc} must exist in docs/compatibility/`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.length > 200, `Document ${doc} must contain meaningful content`);
      }
    });
  });
});

