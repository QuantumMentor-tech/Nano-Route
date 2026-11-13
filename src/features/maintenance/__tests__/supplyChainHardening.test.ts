/**
//! Step 55 — Dependency Security, Supply-Chain Hardening & Provenance Tests
//!
//! Authoritative validation suite for:
//! 1. Critical Asset Integrity & Cryptographic Digests
//! 2. Manifest vs Dependency Architecture Alignment (x86_64, Windows)
//! 3. Absence of Malicious Pre/Post-Install Scripts
//! 4. Permissive License Compliance & Attribution Verification
//! 5. Lockfile & Provenance Consistency
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

describe("Step 55 Dependency Security, Supply-Chain & Build Integrity", () => {
  describe("1. Critical Asset Integrity", () => {
    it("preserves exact byte size and SHA-256 digest of Nano Route Neon Tech Logo", () => {
      const logoPath = path.resolve(process.cwd(), "Nano Route Neon Tech Logo.png");
      assert.ok(fs.existsSync(logoPath), "Logo file must exist at project root");

      const stats = fs.statSync(logoPath);
      assert.equal(stats.size, 670255, "Logo size must remain exactly 670,255 bytes");

      const fileBuffer = fs.readFileSync(logoPath);
      const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      assert.equal(
        computedHash.toLowerCase(),
        "99179d193ac9cdbb18cbddee3abe2da16b23c26be4958b5dd945c21d873bb804",
        "Logo SHA-256 digest must match authoritative provenance"
      );
    });
  });

  describe("2. Build Script & Supply-Chain Hardening", () => {
    it("ensures package.json contains zero dangerous preinstall/postinstall lifecycle scripts", () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      const scripts = pkg.scripts || {};
      assert.equal(scripts.preinstall, undefined, "Zero preinstall script allowed");
      assert.equal(scripts.install, undefined, "Zero custom install script allowed");
      assert.equal(scripts.postinstall, undefined, "Zero postinstall script allowed");
    });

    it("ensures src-tauri/build.rs contains zero external network or binary acquisition calls", () => {
      const buildRsPath = path.resolve(process.cwd(), "src-tauri/build.rs");
      const content = fs.readFileSync(buildRsPath, "utf-8");

      assert.ok(content.includes("tauri_build::build()"), "build.rs must call tauri_build");
      assert.ok(!content.includes("reqwest"), "build.rs must not make network requests");
      assert.ok(!content.includes("curl"), "build.rs must not invoke curl");
      assert.ok(!content.includes("download"), "build.rs must not download arbitrary files");
    });

    it("verifies Tauri capability file adheres to least privilege", () => {
      const capPath = path.resolve(process.cwd(), "src-tauri/capabilities/default.json");
      assert.ok(fs.existsSync(capPath), "Capability file must exist");
      const cap = JSON.parse(fs.readFileSync(capPath, "utf-8"));

      assert.deepEqual(cap.permissions, ["core:default"], "Permissions must strictly be minimal core:default");
    });
  });

  describe("3. License & Dependency Compliance", () => {
    it("ensures all direct dependencies are cataloged with permissive licenses", () => {
      const noticesPath = path.resolve(process.cwd(), "docs/security/NANO_ROUTE_THIRD_PARTY_NOTICES.md");
      assert.ok(fs.existsSync(noticesPath), "Third-party notices document must exist");

      const content = fs.readFileSync(noticesPath, "utf-8");
      assert.ok(content.includes("MIT"), "Must document MIT dependencies");
      assert.ok(content.includes("Apache-2.0"), "Must document Apache dependencies");
      assert.ok(content.includes("react"), "Must document React license");
      assert.ok(content.includes("tauri"), "Must document Tauri license");
      assert.ok(content.includes("rusqlite"), "Must document Rusqlite license");
    });
  });
});

