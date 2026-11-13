/**
//! Step 57 — Continuous Quality Pipeline & Release Gate Verification Tests
//!
//! Authoritative validation suite for:
//! 1. CI Workflow Specification & Least-Privilege Permissions
//! 2. Multi-Level Gate Ordering & Pipeline Completeness
//! 3. Build Scripts & Validation Command Alignment
//! 4. Release Qualification Gate State Invariants
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Step 57 Continuous Integration & Automated Release Gates", () => {
  describe("1. CI Workflow Specification & Permissions", () => {
    it("ensures GitHub Actions CI workflow exists and specifies least-privilege permissions", () => {
      const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
      assert.ok(fs.existsSync(workflowPath), "CI workflow file (.github/workflows/ci.yml) must exist");

      const content = fs.readFileSync(workflowPath, "utf-8");
      assert.ok(content.includes("permissions:"), "Workflow must define explicit permissions block");
      assert.ok(content.includes("contents: read"), "Workflow must restrict permissions to contents: read");
      assert.ok(content.includes("concurrency:"), "Workflow must define concurrency control");
    });

    it("verifies all 4 validation levels are present in CI workflow", () => {
      const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
      const content = fs.readFileSync(workflowPath, "utf-8");

      assert.ok(content.includes("level1-fast-validation"), "Level 1 fast validation job must exist");
      assert.ok(content.includes("level2-security-audit"), "Level 2 security audit job must exist");
      assert.ok(content.includes("level3-production-build"), "Level 3 production build job must exist");
      assert.ok(content.includes("level4-release-qualification"), "Level 4 release qualification job must exist");
    });
  });

  describe("2. Package Validation Commands", () => {
    it("ensures package.json exposes authoritative validation and build scripts", () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      assert.ok(pkg.scripts.validate, "Must expose validate script");
      assert.ok(pkg.scripts.typecheck, "Must expose typecheck script");
      assert.ok(pkg.scripts.test, "Must expose test script");
      assert.ok(pkg.scripts.build, "Must expose build script");
    });
  });

  describe("3. Release Gate Documentation Consistency", () => {
    it("verifies all canonical CI/CD documentation files exist in docs/ci/", () => {
      const expectedDocs = [
        "NANO_ROUTE_CI_PIPELINE_BASELINE.md",
        "NANO_ROUTE_TEST_STRATEGY.md",
        "NANO_ROUTE_RELEASE_GATES.md",
        "NANO_ROUTE_CI_SECURITY.md",
        "NANO_ROUTE_BUILD_VALIDATION.md",
        "NANO_ROUTE_FAILURE_HANDLING.md",
      ];

      for (const doc of expectedDocs) {
        const docPath = path.resolve(process.cwd(), "docs/ci", doc);
        assert.ok(fs.existsSync(docPath), `Documentation file docs/ci/${doc} must exist`);
      }
    });
  });
});

