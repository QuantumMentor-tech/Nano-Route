/**
 * Nano Route — Step 47 About, License & Contact Integration Tests
 * File: src/features/about/__tests__/aboutWorkspace.test.ts
 *
 * Validates application identity, license entitlements, contact configuration,
 * external link security validation, and local-first zero-leakage boundaries.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  APP_METADATA,
  OPEN_SOURCE_NOTICES,
  IMPLEMENTATION_BREAKDOWN,
  getContactConfig,
  setContactConfigForTesting,
  resetContactConfig,
} from "../config/appMetadata.ts";
import {
  validateExternalUrl,
  openExternalLink,
  copyToClipboard,
} from "../utils/externalLinks.ts";
import {
  getLicenseInfo,
  setMockLicenseInfo,
  resetMockLicenseInfo,
  DEFAULT_LICENSE_INFO,
} from "../../../services/ipc/license.ts";
import { ROUTE_PATHS } from "../../../routes/routePaths.ts";
import { NAVIGATION_SECTIONS } from "../../../routes/navigation.ts";

describe("Step 47 — License Management, Application About & Contact Workspace", () => {
  beforeEach(() => {
    resetContactConfig();
    resetMockLicenseInfo();
  });

  // ==========================================================================
  // 1. Authoritative Application Metadata Integrity
  // ==========================================================================
  describe("1. Authoritative Application Metadata Integrity", () => {
    it("reports canonical application name and version matching package metadata", () => {
      assert.equal(APP_METADATA.name, "Nano Route");
      assert.equal(APP_METADATA.version, "0.1.0");
      assert.equal(APP_METADATA.buildChannel, "Alpha Development");
      assert.equal(APP_METADATA.license, "MIT License");
    });

    it("reports authentic copyright and author ownership", () => {
      assert.equal(APP_METADATA.author, "Nano Route Engineering");
      assert.ok(APP_METADATA.copyright.includes("2026"));
      assert.ok(APP_METADATA.copyright.includes("Nano Route Engineering"));
    });

    it("verifies accurate technical architecture specification", () => {
      assert.ok(APP_METADATA.architecture.includes("Tauri v2"));
      assert.ok(APP_METADATA.architecture.includes("Rust"));
      assert.ok(APP_METADATA.architecture.includes("React 18"));
      assert.ok(APP_METADATA.platform.includes("Windows"));
    });

    it("strictly segregates implemented MVP capabilities from planned roadmap items", () => {
      const implemented = IMPLEMENTATION_BREAKDOWN.filter((i) => i.category === "implemented");
      const planned = IMPLEMENTATION_BREAKDOWN.filter((i) => i.category === "planned");

      assert.ok(implemented.length >= 8, "Expected at least 8 implemented MVP capabilities");
      assert.ok(planned.length >= 3, "Expected at least 3 planned roadmap items");

      // Verify implemented capabilities reflect actual completed steps
      const implementedTitles = implemented.map((i) => i.title);
      assert.ok(implementedTitles.some((t) => t.includes("DPAPI")));
      assert.ok(implementedTitles.some((t) => t.includes("Local SLM")));
      assert.ok(implementedTitles.some((t) => t.includes("Scoring")));
      assert.ok(implementedTitles.some((t) => t.includes("Streaming")));
      assert.ok(implementedTitles.some((t) => t.includes("SQLite History")));

      // Verify planned items are not claimed as implemented
      const plannedTitles = planned.map((i) => i.title);
      assert.ok(plannedTitles.some((t) => t.includes("llama.cpp") || t.includes("Local Model Runtimes")));
      assert.ok(plannedTitles.some((t) => t.includes("MSIX") || t.includes("Store Packaging")));
    });

    it("provides complete open-source foundation notices", () => {
      assert.ok(OPEN_SOURCE_NOTICES.length >= 7);
      const names = OPEN_SOURCE_NOTICES.map((n) => n.name);
      assert.ok(names.includes("Tauri v2"));
      assert.ok(names.includes("React 18"));
      assert.ok(names.includes("TypeScript"));
      assert.ok(names.includes("Tokio"));
      assert.ok(names.includes("Rusqlite & SQLite 3"));
      assert.ok(names.includes("ONNX Runtime"));
      assert.ok(names.includes("Lucide React"));
    });
  });

  // ==========================================================================
  // 2. License State Model & Entitlements
  // ==========================================================================
  describe("2. License State Model & Entitlements", () => {
    it("returns authoritative MIT License state via IPC bridge", async () => {
      const license = await getLicenseInfo();

      assert.equal(license.productName, "Nano Route");
      assert.equal(license.licenseType, "MIT License");
      assert.equal(license.status, "active");
      assert.equal(license.activationRequired, false);
      assert.equal(license.isCommercialAllowed, true);
      assert.equal(license.validUntil, null, "MIT license must have no artificial expiration");
      assert.ok(license.licenseNotice.includes("Permission is hereby granted, free of charge"));
      assert.ok(license.licenseNotice.includes("Copyright (c) 2026 Nano Route Engineering"));
    });

    it("strictly prohibits fabricated commercial tiers", async () => {
      const license = await getLicenseInfo();
      const forbiddenTiers = ["Pro", "Premium", "Enterprise", "Lifetime", "Trial"];

      for (const tier of forbiddenTiers) {
        assert.notEqual(license.edition, tier);
      }
    });

    it("authorizes all local orchestration entitlements", async () => {
      const license = await getLicenseInfo();
      assert.ok(license.entitlements.length >= 5);
      assert.ok(license.entitlements.some((e) => e.includes("Local SLM")));
      assert.ok(license.entitlements.some((e) => e.includes("Routing & Scoring")));
      assert.ok(license.entitlements.some((e) => e.includes("Windows DPAPI")));
      assert.ok(license.entitlements.some((e) => e.includes("SQLite Chat History")));
    });

    it("supports mock license overrides for test resilience", async () => {
      setMockLicenseInfo({
        ...DEFAULT_LICENSE_INFO,
        edition: "Test Build Edition",
      });

      const overridden = await getLicenseInfo();
      assert.equal(overridden.edition, "Test Build Edition");

      resetMockLicenseInfo();
      const restored = await getLicenseInfo();
      assert.equal(restored.edition, "Community Edition (Open Source)");
    });
  });

  // ==========================================================================
  // 3. Authoritative Contact Configuration
  // ==========================================================================
  describe("3. Authoritative Contact Configuration", () => {
    it("contains all 4 canonical channels required by product specification", () => {
      const config = getContactConfig();
      assert.ok(config.channels.email, "Email channel must exist");
      assert.ok(config.channels.whatsapp, "WhatsApp channel must exist");
      assert.ok(config.channels.website, "Website channel must exist");
      assert.ok(config.channels.youtube, "YouTube channel must exist");
    });

    it("safely marks unconfigured channels without inventing fake destinations", () => {
      const config = getContactConfig();

      // Per Section 90 & 94 of Step 47 prompt: destinations not present in project must be null / unconfigured
      assert.equal(config.channels.email.destination, null);
      assert.equal(config.channels.email.isConfigured, false);
      assert.ok(config.channels.email.unconfiguredMessage.length > 0);

      assert.equal(config.channels.whatsapp.destination, null);
      assert.equal(config.channels.whatsapp.isConfigured, false);

      assert.equal(config.channels.website.destination, null);
      assert.equal(config.channels.website.isConfigured, false);

      assert.equal(config.channels.youtube.destination, null);
      assert.equal(config.channels.youtube.isConfigured, false);
    });

    it("allows dynamic configuration update for test verification", () => {
      setContactConfigForTesting({
        channels: {
          ...getContactConfig().channels,
          email: {
            ...getContactConfig().channels.email,
            destination: "mailto:support@example.com",
            isConfigured: true,
          },
        },
      });

      const updated = getContactConfig();
      assert.equal(updated.channels.email.destination, "mailto:support@example.com");
      assert.equal(updated.channels.email.isConfigured, true);

      resetContactConfig();
      assert.equal(getContactConfig().channels.email.isConfigured, false);
    });
  });

  // ==========================================================================
  // 4. External Link Security Validation
  // ==========================================================================
  describe("4. External Link Security Validation", () => {
    it("accepts valid HTTPS URLs", () => {
      const res = validateExternalUrl("https://example.com/support");
      assert.equal(res.isValid, true);
      assert.equal(res.scheme, "https:");
    });

    it("accepts valid mailto URLs with well-formed email addresses", () => {
      const res = validateExternalUrl("mailto:support@example.com");
      assert.equal(res.isValid, true);
      assert.equal(res.scheme, "mailto:");
    });

    it("accepts valid whatsapp URLs", () => {
      const res = validateExternalUrl("whatsapp://send?phone=1234567890");
      assert.equal(res.isValid, true);
      assert.equal(res.scheme, "whatsapp:");
    });

    it("strictly rejects dangerous or unsupported protocols", () => {
      const dangerous = [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///C:/Windows/System32/cmd.exe",
        "vbscript:msgbox(1)",
        "about:blank",
      ];

      for (const url of dangerous) {
        const res = validateExternalUrl(url);
        assert.equal(res.isValid, false, `Expected ${url} to be rejected`);
        assert.ok(res.error);
      }
    });

    it("rejects malformed email addresses in mailto scheme", () => {
      const res = validateExternalUrl("mailto:not-a-valid-email");
      assert.equal(res.isValid, false);
      assert.ok(res.error?.includes("Malformed email"));
    });

    it("rejects empty or whitespace-only inputs", () => {
      assert.equal(validateExternalUrl("").isValid, false);
      assert.equal(validateExternalUrl("   ").isValid, false);
    });
  });

  // ==========================================================================
  // 5. External Link Opener & Clipboard Handling
  // ==========================================================================
  describe("5. External Link Opener & Clipboard Handling", () => {
    it("rejects invalid URLs before attempting execution", async () => {
      const res = await openExternalLink("javascript:alert(1)");
      assert.equal(res.success, false);
      assert.ok(res.error);
    });

    it("handles clipboard copying with fallback gracefully", async () => {
      // In Node.js environment without window/document, copyToClipboard returns false safely without throwing
      const res = await copyToClipboard("test-copy-string");
      assert.equal(typeof res, "boolean");
    });
  });

  // ==========================================================================
  // 6. Navigation Routes & Shell Integration
  // ==========================================================================
  describe("6. Navigation Routes & Shell Integration", () => {
    it("defines canonical route paths for License, About, and Contact", () => {
      assert.equal(ROUTE_PATHS.LICENSE, "/license");
      assert.equal(ROUTE_PATHS.ABOUT, "/about");
      assert.equal(ROUTE_PATHS.CONTACT, "/contact");
    });

    it("exposes all three pages in sidebar application navigation section", () => {
      const appSection = NAVIGATION_SECTIONS.find((s) => s.id === "application");
      assert.ok(appSection, "Application section must exist in sidebar");

      const itemIds = appSection.items.map((i) => i.id);
      assert.ok(itemIds.includes("settings"));
      assert.ok(itemIds.includes("license"));
      assert.ok(itemIds.includes("about"));
      assert.ok(itemIds.includes("contact"));
    });
  });
});

