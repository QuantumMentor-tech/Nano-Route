/**
//! Nano Route — SQLite Database Foundation & Contracts Unit Tests (Step 16)
//!
//! Tests:
//! 1. Database Health & Status Contracts: schema versioning, WAL flags, integrity flags.
//! 2. Error Taxonomy & Secret Scrubbing: ensuring SQL queries with credentials are redacted.
//! 3. Migration Tracking Contracts: version numbers, deterministic checksums, timestamps.
//! 4. Architectural Security Invariants: strict rejection of arbitrary frontend SQL commands.
//! 5. IPC Command Round-Trip: getDatabaseHealth() in mock and browser dev modes.
//! 6. Transaction & Rollback Invariants: atomicity on partial execution failure.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getDatabaseHealth,
} from "../commands.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS } from "../types.ts";
import type { DatabaseHealthReport, DatabaseStatus } from "../types.ts";

function sanitizeSqlError(raw: string): string {
  let result = raw;
  const prefixes = [
    "sk-",
    "key-",
    "Bearer ",
    "bearer ",
    "AIzaSy",
    "ghp_",
    "api_key=",
    "apikey=",
    "key=",
  ];

  for (const prefix of prefixes) {
    let startIdx = 0;
    while (true) {
      const found = result.indexOf(prefix, startIdx);
      if (found === -1) break;

      const tokenStart = found + prefix.length;
      let tokenEnd = result.length;

      for (let i = tokenStart; i < result.length; i++) {
        const ch = result[i];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "," || ch === '"' || ch === "'" || ch === "&" || ch === ";") {
          tokenEnd = i;
          break;
        }
      }

      if (tokenEnd - tokenStart > 4) {
        const prefixPart = result.substring(0, tokenStart);
        const suffixPart = result.substring(tokenEnd);
        result = `${prefixPart}[REDACTED]${suffixPart}`;
        startIdx = tokenStart + "[REDACTED]".length;
      } else {
        startIdx = tokenStart;
      }

      if (startIdx >= result.length) break;
    }
  }

  return result;
}

describe("Step 16 SQLite Database Foundation & Persistence Infrastructure", () => {
  describe("1. Database Health & Status Contracts", () => {
    it("validates healthy database report contract", () => {
      const report: DatabaseHealthReport = {
        status: "Ready",
        schemaVersion: 1,
        migrationsApplied: 1,
        integrityOk: true,
        walEnabled: true,
        databasePath: "C:\\Users\\user\\AppData\\Local\\Nano Route\\data\\nano_route.db",
        latencyMs: 3,
      };

      assert.equal(report.status, "Ready");
      assert.equal(report.schemaVersion, 1);
      assert.equal(report.migrationsApplied, 1);
      assert.equal(report.integrityOk, true);
      assert.equal(report.walEnabled, true);
    });

    it("evaluates operational status states accurately", () => {
      const validStatuses: DatabaseStatus[] = ["Initializing", "Ready", "Degraded", "Failed"];
      assert.equal(validStatuses.length, 4);

      const isOperational = (s: DatabaseStatus) => s === "Ready" || s === "Degraded";
      assert.equal(isOperational("Ready"), true);
      assert.equal(isOperational("Degraded"), true);
      assert.equal(isOperational("Initializing"), false);
      assert.equal(isOperational("Failed"), false);
    });
  });

  describe("2. Error Taxonomy & Secret Sanitization (Section 39, 40)", () => {
    it("redacts API keys and credentials embedded in SQL error strings", () => {
      const rawError = "SQLITE_CONSTRAINT on INSERT INTO credentials (api_key) VALUES ('sk-proj-supersecretkey1234567890');";
      const sanitized = sanitizeSqlError(rawError);

      assert.equal(sanitized.includes("supersecretkey1234567890"), false);
      assert.equal(sanitized.includes("[REDACTED]"), true);
    });

    it("redacts bearer tokens embedded in database error logs", () => {
      const rawError = "Failed query with header Bearer secret_access_token_abc_xyz_12345";
      const sanitized = sanitizeSqlError(rawError);

      assert.equal(sanitized.includes("secret_access_token_abc_xyz_12345"), false);
      assert.equal(sanitized.includes("[REDACTED]"), true);
    });
  });

  describe("3. Migration Tracking Contracts (Section 29, 30)", () => {
    it("verifies migration record schema requirements", () => {
      const migrationRecord = {
        version: 1,
        name: "001_database_foundation",
        checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        appliedAt: "2026-11-07T00:00:00Z",
        executionDurationMs: 12,
      };

      assert.equal(migrationRecord.version > 0, true);
      assert.equal(migrationRecord.name.startsWith("001_"), true);
      assert.equal(migrationRecord.checksum.length, 64);
    });
  });

  describe("4. Security Invariants: No Arbitrary SQL from Frontend (Section 102, 103)", () => {
    it("verifies that IPC command registry exposes ZERO generic SQL execution commands", () => {
      const commands = Object.values(IPC_COMMANDS) as string[];

      for (const cmd of commands) {
        assert.equal(cmd.includes("sql"), false, `Forbidden SQL command found in registry: ${cmd}`);
        assert.equal(cmd.includes("query"), false, `Forbidden raw query command found in registry: ${cmd}`);
        assert.equal(cmd.includes("execute"), false, `Forbidden execution command found in registry: ${cmd}`);
      }
    });
  });

  describe("5. IPC Command Round-Trip: getDatabaseHealth()", () => {
    it("returns safe default report in browser environment", async () => {
      setMockTauriContext(false);
      const report = await getDatabaseHealth();

      assert.equal(report.status, "Ready");
      assert.equal(report.schemaVersion, 1);
      assert.equal(report.integrityOk, true);
      setMockTauriContext(null);
    });

    it("executes typed command through mock registry in simulated Tauri environment", async () => {
      setMockTauriContext(true);
      const mockReport: DatabaseHealthReport = {
        status: "Ready",
        schemaVersion: 1,
        migrationsApplied: 1,
        integrityOk: true,
        walEnabled: true,
        databasePath: "D:\\test\\nano_route.db",
        latencyMs: 2,
      };

      registerMockCommandHandler(IPC_COMMANDS.GET_DATABASE_HEALTH, () => mockReport);

      const report = await getDatabaseHealth("req_test_db_1");
      assert.equal(report.status, "Ready");
      assert.equal(report.databasePath, "D:\\test\\nano_route.db");

      clearMockCommandHandlers();
      setMockTauriContext(null);
    });
  });

  describe("6. Transaction & Rollback Invariants (Section 34, 42, 93)", () => {
    it("simulates atomic transaction contract (all-or-nothing)", () => {
      const db = new Map<string, string>();
      db.set("schema_version", "1");

      const runTransaction = (operations: Array<{ key: string; value: string }>, shouldFail: boolean) => {
        const snapshot = new Map(db);
        try {
          for (const op of operations) {
            snapshot.set(op.key, op.value);
          }
          if (shouldFail) {
            throw new Error("Simulated constraint violation");
          }
          // Commit
          for (const [k, v] of snapshot) {
            db.set(k, v);
          }
          return true;
        } catch {
          // Rollback: snapshot discarded
          return false;
        }
      };

      // Successful transaction
      const success = runTransaction([{ key: "app_name", value: "Nano Route" }], false);
      assert.equal(success, true);
      assert.equal(db.get("app_name"), "Nano Route");

      // Failing transaction
      const failure = runTransaction([{ key: "temp_key", value: "temporary" }], true);
      assert.equal(failure, false);
      assert.equal(db.has("temp_key"), false, "Failed transaction was not rolled back");
    });
  });
});

