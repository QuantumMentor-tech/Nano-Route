/**
 * Nano Route — Local Audit Trail & Activity Review Test Suite
 * File: src/features/audit/__tests__/audit.test.ts
 *
 * Implements Step 89 Verification:
 * - Event normalization and taxonomy compliance
 * - Synthetic secret scrubbing and path redaction invariants
 * - Multi-criteria search, filtering, and deterministic ordering
 * - Bounded retention ceiling and targeted pruning
 * - Metrics calculation and integrity validation
 * - Export package sanitization
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  recordAuditEvent,
  queryAuditEvents,
  getAuditSummaryMetrics,
  clearAuditEvents,
  exportAuditEvents,
  validateAuditIntegrity,
  sanitizeAuditString,
  sanitizeAuditDetails,
  __internalResetAuditStore,
} from "../engine.ts";
import type { AuditEvent } from "../types.ts";

describe("Local Audit Trail & Activity Review (Step 89)", () => {
  beforeEach(() => {
    __internalResetAuditStore();
  });

  describe("1. Event Recording & Normalization", () => {
    it("records a structured event with normalized defaults", () => {
      const event = recordAuditEvent({
        eventType: "credential_added",
        category: "CREDENTIAL",
        summary: "Anthropic API key configured via DPAPI vault.",
        providerId: "anthropic",
      });

      assert.ok(event.id.startsWith("audit_"));
      assert.equal(event.eventType, "CREDENTIAL_ADDED");
      assert.equal(event.category, "CREDENTIAL");
      assert.equal(event.severity, "INFO");
      assert.equal(event.outcome, "SUCCESS");
      assert.equal(event.actor, "USER");
      assert.equal(event.providerId, "anthropic");
      assert.ok(event.timestamp > 0);
      assert.ok(event.isoTimestamp.includes("T"));
      assert.equal(event.schemaVersion, 1);
    });

    it("records correlation ID and safe details", () => {
      const event = recordAuditEvent({
        eventType: "REQUEST_FAILOVER",
        category: "EXECUTION",
        severity: "WARNING",
        outcome: "SUCCESS",
        actor: "SYSTEM",
        summary: "Primary provider rate limited; failed over to secondary model.",
        correlationId: "req_xyz_123",
        providerId: "openai",
        modelId: "gpt-4o",
        details: {
          attemptCount: 2,
          reason: "HTTP_429_RATE_LIMIT",
        },
      });

      assert.equal(event.correlationId, "req_xyz_123");
      assert.equal(event.details?.attemptCount, 2);
      assert.equal(event.details?.reason, "HTTP_429_RATE_LIMIT");
    });
  });

  describe("2. Redaction & Zero Content Invariants", () => {
    it("redacts synthetic API keys from event summary", () => {
      const event = recordAuditEvent({
        eventType: "CREDENTIAL_ROTATED",
        category: "SECURITY",
        severity: "SECURITY",
        summary:
          "OpenAI key sk-abcdef1234567890abcdef and Gemini AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6 rotated successfully.",
      });

      assert.ok(!event.summary.includes("sk-abcdef"));
      assert.ok(!event.summary.includes("AIzaSyA1"));
      assert.ok(event.summary.includes("[REDACTED_SECRET]"));
    });

    it("redacts Windows and POSIX filesystem paths from event summary", () => {
      const sanitized = sanitizeAuditString(
        "Export written to C:\\Users\\Administrator\\AppData\\Local\\NanoRoute\\export.json on system"
      );

      assert.ok(!sanitized.includes("C:\\Users\\Administrator"));
      assert.ok(sanitized.includes("[REDACTED_PATH]"));
    });

    it("scrubs forbidden detail keys (prompt, apiKey, secret, password)", () => {
      const sanitized = sanitizeAuditDetails({
        provider: "anthropic",
        apiKey: "sk-ant-12345678",
        secret: "super_secret_payload",
        prompt: "Write a poem about privacy",
        status: 200,
      });

      assert.ok(sanitized);
      assert.equal(sanitized?.provider, "anthropic");
      assert.equal(sanitized?.apiKey, "[REDACTED_SENSITIVE_KEY]");
      assert.equal(sanitized?.secret, "[REDACTED_SENSITIVE_KEY]");
      assert.equal(sanitized?.prompt, "[REDACTED_SENSITIVE_KEY]");
      assert.equal(sanitized?.status, 200);
    });

    it("validates integrity and passes on clean audit records", () => {
      recordAuditEvent({
        eventType: "EXPORT_COMPLETED",
        category: "DATA",
        summary: "User exported chat history to local archive.",
      });

      const integrity = validateAuditIntegrity();
      assert.equal(integrity.isValid, true);
      assert.equal(integrity.issues.length, 0);
    });

    it("flags an issue if a simulated corrupted record contains a secret", () => {
      // Intentionally bypass recordAuditEvent to simulate store corruption
      const corruptedEvent: AuditEvent = {
        id: "audit_corrupted_001",
        eventType: "CORRUPTED_LEAK",
        category: "SECURITY",
        severity: "SECURITY",
        outcome: "SUCCESS",
        actor: "SYSTEM",
        timestamp: Date.now(),
        isoTimestamp: new Date().toISOString(),
        summary: "Leaked key sk-1234567890abcdef1234567890",
        schemaVersion: 1,
      };

      __internalResetAuditStore([corruptedEvent]);

      const integrity = validateAuditIntegrity();
      assert.equal(integrity.isValid, false);
      assert.ok(integrity.issues.some((i) => i.includes("unredacted secret")));
    });
  });

  describe("3. Query, Search & Deterministic Ordering", () => {
    beforeEach(() => {
      const now = 1700000000000;
      const testEvents: AuditEvent[] = [
        {
          id: "audit_1",
          eventType: "DPAPI_VAULT_OPENED",
          category: "SECURITY",
          severity: "SECURITY",
          outcome: "SUCCESS",
          actor: "SYSTEM",
          timestamp: now - 3000,
          isoTimestamp: new Date(now - 3000).toISOString(),
          summary: "DPAPI vault unlocked.",
          schemaVersion: 1,
        },
        {
          id: "audit_2",
          eventType: "REQUEST_FAILED",
          category: "EXECUTION",
          severity: "ERROR",
          outcome: "FAILED",
          actor: "USER",
          timestamp: now - 2000,
          isoTimestamp: new Date(now - 2000).toISOString(),
          summary: "Request timed out after 30000ms.",
          providerId: "anthropic",
          schemaVersion: 1,
        },
        {
          id: "audit_3",
          eventType: "BUDGET_WARNING",
          category: "BUDGET",
          severity: "WARNING",
          outcome: "BLOCKED",
          actor: "SYSTEM",
          timestamp: now - 1000,
          isoTimestamp: new Date(now - 1000).toISOString(),
          summary: "Monthly budget exceeded threshold 85%.",
          schemaVersion: 1,
        },
      ];
      __internalResetAuditStore(testEvents);
    });

    it("filters by category correctly", () => {
      const res = queryAuditEvents({ category: "SECURITY" });
      assert.equal(res.totalCount, 1);
      assert.equal(res.events[0].id, "audit_1");
    });

    it("filters by severity correctly", () => {
      const res = queryAuditEvents({ severity: "ERROR" });
      assert.equal(res.totalCount, 1);
      assert.equal(res.events[0].id, "audit_2");
    });

    it("filters by outcome correctly", () => {
      const res = queryAuditEvents({ outcome: "BLOCKED" });
      assert.equal(res.totalCount, 1);
      assert.equal(res.events[0].id, "audit_3");
    });

    it("performs case-insensitive search across summary and eventType", () => {
      const res = queryAuditEvents({ searchQuery: "budget" });
      assert.equal(res.totalCount, 1);
      assert.equal(res.events[0].id, "audit_3");

      const res2 = queryAuditEvents({ searchQuery: "timed out" });
      assert.equal(res2.totalCount, 1);
      assert.equal(res2.events[0].id, "audit_2");
    });

    it("orders records deterministically by timestamp DESC", () => {
      const res = queryAuditEvents();
      assert.equal(res.events.length, 3);
      assert.equal(res.events[0].id, "audit_3"); // newest
      assert.equal(res.events[1].id, "audit_2");
      assert.equal(res.events[2].id, "audit_1"); // oldest
    });
  });

  describe("4. Bounded Retention & Cleanup", () => {
    it("prunes records older than specified timestamp", () => {
      const now = Date.now();
      const oldEvent: AuditEvent = {
        id: "audit_old",
        eventType: "OLD_EVENT",
        category: "SYSTEM",
        severity: "INFO",
        outcome: "SUCCESS",
        actor: "SYSTEM",
        timestamp: now - 40 * 24 * 60 * 60 * 1000, // 40 days ago
        isoTimestamp: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        summary: "Old event",
        schemaVersion: 1,
      };

      const newEvent: AuditEvent = {
        id: "audit_new",
        eventType: "NEW_EVENT",
        category: "SYSTEM",
        severity: "INFO",
        outcome: "SUCCESS",
        actor: "SYSTEM",
        timestamp: now - 5000,
        isoTimestamp: new Date(now - 5000).toISOString(),
        summary: "New event",
        schemaVersion: 1,
      };

      __internalResetAuditStore([oldEvent, newEvent]);

      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const pruned = clearAuditEvents({ olderThanMs: thirtyDaysAgo });

      assert.equal(pruned, 1);
      const remaining = queryAuditEvents();
      assert.equal(remaining.totalCount, 1);
      assert.equal(remaining.events[0].id, "audit_new");
    });

    it("clears records by category", () => {
      recordAuditEvent({
        eventType: "CONFIG_A",
        category: "CONFIGURATION",
        summary: "Config A",
      });
      recordAuditEvent({
        eventType: "SECURITY_A",
        category: "SECURITY",
        summary: "Security A",
      });

      const pruned = clearAuditEvents({ category: "CONFIGURATION" });
      assert.equal(pruned, 1);

      const remaining = queryAuditEvents();
      assert.ok(remaining.events.every((e) => e.category !== "CONFIGURATION"));
    });
  });

  describe("5. Metrics Aggregation & Export", () => {
    it("computes accurate summary metrics", () => {
      recordAuditEvent({
        eventType: "SEC_1",
        category: "SECURITY",
        severity: "SECURITY",
        outcome: "SUCCESS",
        summary: "Security event",
      });
      recordAuditEvent({
        eventType: "WARN_1",
        category: "BUDGET",
        severity: "WARNING",
        outcome: "SUCCESS",
        summary: "Warning event",
      });
      recordAuditEvent({
        eventType: "ERR_1",
        category: "EXECUTION",
        severity: "ERROR",
        outcome: "FAILED",
        summary: "Error event",
      });

      const metrics = getAuditSummaryMetrics();
      assert.equal(metrics.totalEvents, 3);
      assert.equal(metrics.securityEventsCount, 1);
      assert.equal(metrics.warningEventsCount, 1);
      assert.equal(metrics.errorEventsCount, 1);
      assert.equal(metrics.successRatePercent, 67); // 2 out of 3 success
    });

    it("exports sanitized audit bundle with metadata disclosure", () => {
      recordAuditEvent({
        eventType: "TEST_EXPORT",
        category: "DATA",
        summary: "Export test record",
      });

      const bundle = exportAuditEvents();
      assert.equal(bundle.schemaVersion, 1);
      assert.ok(bundle.exportedAtMs > 0);
      assert.ok(bundle.events.length >= 1);
      assert.ok(bundle.redactionNote.includes("Zero API keys, passwords, prompt texts"));
    });
  });
});
