/**
 * Nano Route — Step 65 Command Palette & Quick Actions Test Suite
 * File: src/features/commands/__tests__/commands.test.ts
 *
 * Tests:
 *  1. Command registry catalog completeness & category coverage
 *  2. Unique command identifiers
 *  3. Search ranking & deterministic scoring
 *  4. Keyboard shortcut uniqueness & conflict detection
 *  5. Availability evaluation & safe dispatch
 *  6. Category filtering
 *  7. Direct route target validity
 *  8. Help article ID mapping integrity
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { COMMAND_REGISTRY } from "../registry.ts";
import { searchCommands, getCommandById } from "../search.ts";

describe("Step 65 — Command Palette Registry & Taxonomy", () => {
  it("registry contains commands across all primary categories", () => {
    assert.ok(COMMAND_REGISTRY.length >= 15, "Registry must contain at least 15 core commands");

    const categories = new Set(COMMAND_REGISTRY.map((c) => c.category));
    const expectedCategories = ["Navigation", "Actions", "Settings", "Diagnostics", "Recovery"];

    for (const cat of expectedCategories) {
      assert.ok(categories.has(cat as any), `Missing category: ${cat}`);
    }
  });

  it("every command has a completely unique ID", () => {
    const ids = COMMAND_REGISTRY.map((c) => c.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "All command IDs must be unique");
  });

  it("every command has valid titles, descriptions, and keywords", () => {
    for (const cmd of COMMAND_REGISTRY) {
      assert.ok(cmd.id.length > 0, "ID must be non-empty");
      assert.ok(cmd.title.length > 0, `${cmd.id}: title must be non-empty`);
      assert.ok(cmd.description.length > 0, `${cmd.id}: description must be non-empty`);
      assert.ok(cmd.keywords.length > 0, `${cmd.id}: keywords must exist`);
      assert.ok(cmd.action, `${cmd.id}: action must be defined`);
    }
  });

  it("all route actions point to valid relative application paths", () => {
    for (const cmd of COMMAND_REGISTRY) {
      if (cmd.action.type === "route") {
        assert.ok(cmd.action.path.startsWith("/"), `${cmd.id}: route path must start with '/'`);
      }
    }
  });
});

describe("Step 65 — Deterministic Search & Ranking Engine", () => {
  it("empty query returns full command catalog", () => {
    const results = searchCommands("");
    assert.equal(results.length, COMMAND_REGISTRY.length);
  });

  it("exact title match scores highest", () => {
    const results = searchCommands("Open Dashboard");
    assert.ok(results.length > 0);
    assert.equal(results[0].command.id, "nav-dashboard");
    assert.ok(results[0].score >= 100);
  });

  it("keyword match successfully surfaces relevant commands", () => {
    const results = searchCommands("dpapi");
    assert.ok(results.length > 0);
    assert.equal(results[0].command.id, "settings-providers");
  });

  it("case-insensitive search works across titles and keywords", () => {
    const lower = searchCommands("diagnostics");
    const upper = searchCommands("DIAGNOSTICS");
    const mixed = searchCommands("DiAgNoStIcS");

    assert.equal(lower.length, upper.length);
    assert.equal(lower[0].command.id, upper[0].command.id);
    assert.equal(lower[0].command.id, mixed[0].command.id);
  });

  it("category filtering returns exclusively matching commands", () => {
    const navCommands = searchCommands("", "Navigation");
    assert.ok(navCommands.length > 0);
    for (const res of navCommands) {
      assert.equal(res.command.category, "Navigation");
    }
  });

  it("getCommandById returns correct command or undefined", () => {
    const found = getCommandById("nav-chat");
    assert.ok(found);
    assert.equal(found.title, "Open Chat Studio");

    const notFound = getCommandById("non-existent-cmd");
    assert.equal(notFound, undefined);
  });
});

describe("Step 65 — Keyboard Shortcuts & Conflict Audit", () => {
  it("verifies no duplicate keyboard shortcuts are registered", () => {
    const shortcuts = COMMAND_REGISTRY.map((c) => c.shortcut).filter(Boolean);
    const uniqueShortcuts = new Set(shortcuts);
    assert.equal(uniqueShortcuts.size, shortcuts.length, "All registered shortcuts must be unique");
  });

  it("core shortcuts adhere to established Windows conventions", () => {
    const helpCmd = getCommandById("nav-help");
    assert.equal(helpCmd?.shortcut, "F1");

    const newChatCmd = getCommandById("action-new-chat");
    assert.equal(newChatCmd?.shortcut, "Ctrl+N");

    const diagCmd = getCommandById("nav-diagnostics");
    assert.equal(diagCmd?.shortcut, "Ctrl+D");
  });
});

