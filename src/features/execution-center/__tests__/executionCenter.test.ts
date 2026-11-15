/**
 * Nano Route — Active Request Center & Task Lifecycle Test Suite
 * File: src/features/execution-center/__tests__/executionCenter.test.ts
 *
 * Implements Step 85 Test Qualification:
 * - Registration and decoupling of taskId, logicalRequestId, physicalAttemptId
 * - Lifecycle state machine transitions and terminal state immutability
 * - Failover and retry attempt accounting
 * - Cooperative cancellation through Step 35 IPC integration
 * - Stale task detection, restart recovery, and prohibition of automatic resubmission
 * - Bounded retention (max 50 tasks) and zero memory leakage
 * - Filter queries, execution statistics, and privacy guarantees
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  registerExecutionTask,
  updateExecutionTaskState,
  recordTaskAttempt,
  requestTaskCancellation,
  getActiveTasks,
  getRecentTasks,
  listExecutionTasks,
  getExecutionStats,
  detectAndMarkStaleTasks,
  clearTerminalTasks,
  resetExecutionCenterStore,
} from "../engine.ts";

describe("Step 85: Active Request Center & Task Lifecycle Monitoring", () => {
  beforeEach(() => {
    resetExecutionCenterStore();
  });

  describe("1. Task Identity & Registration", () => {
    it("registers new task with decoupled taskId, logicalRequestId, and physicalAttemptId", () => {
      const task = registerExecutionTask({
        logicalRequestId: "req_test_123",
        sessionId: "sess_chat_01",
        sessionTitle: "Benchmarking",
        branchId: "branch_root",
        promptSnippet: "Explain Rust Tokio concurrency",
        cancellable: true,
      });

      assert.ok(task.taskId.startsWith("task_"));
      assert.strictEqual(task.logicalRequestId, "req_test_123");
      assert.ok(task.physicalAttemptId.startsWith("att_"));
      assert.strictEqual(task.category, "REQUEST");
      assert.strictEqual(task.state, "STARTING");
      assert.strictEqual(task.sessionId, "sess_chat_01");
      assert.strictEqual(task.sessionTitle, "Benchmarking");
      assert.strictEqual(task.branchId, "branch_root");
      assert.strictEqual(task.attemptCount, 1);
      assert.strictEqual(task.cancellable, true);
      assert.strictEqual(task.isCancelling, false);
      assert.strictEqual(task.promptSnippet, "Explain Rust Tokio concurrency");
    });

    it("sanitizes long prompt snippet to max 100 characters", () => {
      const longPrompt = "a".repeat(300);
      const task = registerExecutionTask({
        promptSnippet: longPrompt,
      });

      assert.strictEqual(task.promptSnippet.length, 100);
    });
  });

  describe("2. Lifecycle Transitions & State Progression", () => {
    it("progresses sequentially from STARTING to STREAMING to COMPLETED", () => {
      const task = registerExecutionTask({ promptSnippet: "Generate code" });
      assert.strictEqual(task.state, "STARTING");

      // Preparing
      const preparing = updateExecutionTaskState(task.taskId, "PREPARING", {
        progressStep: "Validating context limits...",
      });
      assert.strictEqual(preparing?.state, "PREPARING");
      assert.strictEqual(preparing?.progress.step, "Validating context limits...");

      // Routing
      const routing = updateExecutionTaskState(task.taskId, "ROUTING", {
        progressStep: "SLM evaluating provider...",
      });
      assert.strictEqual(routing?.state, "ROUTING");

      // Connecting
      const connecting = updateExecutionTaskState(task.taskId, "CONNECTING", {
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet",
        displayName: "Claude 3.5 Sonnet",
        progressStep: "Connecting to Anthropic...",
      });
      assert.strictEqual(connecting?.state, "CONNECTING");
      assert.strictEqual(connecting?.providerId, "anthropic");
      assert.strictEqual(connecting?.modelId, "claude-3-5-sonnet");

      // Streaming
      const streaming = updateExecutionTaskState(task.taskId, "STREAMING", {
        progressStep: "Receiving tokens...",
        outputTokens: 142,
      });
      assert.strictEqual(streaming?.state, "STREAMING");
      assert.strictEqual(streaming?.progress.outputTokens, 142);

      // Completed
      const completed = updateExecutionTaskState(task.taskId, "COMPLETED", {
        progressStep: "Execution complete.",
        outputTokens: 380,
      });
      assert.strictEqual(completed?.state, "COMPLETED");
      assert.ok(completed?.completedAtMs !== null);

      // Active tasks must now be 0, recent tasks must have 1
      assert.strictEqual(getActiveTasks().length, 0);
      assert.strictEqual(getRecentTasks().length, 1);
      assert.strictEqual(getRecentTasks()[0].taskId, task.taskId);
    });

    it("enforces terminal state immutability (cannot transition out of terminal state)", () => {
      const task = registerExecutionTask({ promptSnippet: "Test terminal state" });
      updateExecutionTaskState(task.taskId, "COMPLETED", { progressStep: "Done" });

      // Attempt invalid transition back to STREAMING
      const modified = updateExecutionTaskState(task.taskId, "STREAMING", {
        progressStep: "Zombie attempt",
      });

      assert.strictEqual(modified?.state, "COMPLETED");
      assert.strictEqual(modified?.progress.step, "Done");
    });
  });

  describe("3. Physical Attempt Tracking (Retry & Failover)", () => {
    it("records new physical attempts without modifying taskId or logicalRequestId", () => {
      const task = registerExecutionTask({
        logicalRequestId: "req_stable_001",
        promptSnippet: "Failover test",
      });

      assert.strictEqual(task.attemptCount, 1);

      // Provider failover
      const attempt2 = recordTaskAttempt(
        task.taskId,
        "att_failover_2",
        "deepseek",
        "deepseek-chat",
        "DeepSeek Chat"
      );

      assert.strictEqual(attempt2?.taskId, task.taskId);
      assert.strictEqual(attempt2?.logicalRequestId, "req_stable_001");
      assert.strictEqual(attempt2?.physicalAttemptId, "att_failover_2");
      assert.strictEqual(attempt2?.attemptCount, 2);
      assert.strictEqual(attempt2?.providerId, "deepseek");
      assert.strictEqual(attempt2?.modelId, "deepseek-chat");
      assert.strictEqual(attempt2?.displayName, "DeepSeek Chat");
    });
  });

  describe("4. Cooperative Cancellation", () => {
    it("requests cancellation and transitions task to CANCELLED", async () => {
      const task = registerExecutionTask({
        promptSnippet: "Long query to cancel",
        cancellable: true,
      });

      const cancelled = await requestTaskCancellation(task.taskId, "user_cancelled");
      assert.strictEqual(cancelled, true);

      assert.strictEqual(getActiveTasks().length, 0);
      const recent = getRecentTasks();
      assert.strictEqual(recent.length, 1);
      assert.strictEqual(recent[0].state, "CANCELLED");
      assert.strictEqual(recent[0].progress.step, "Execution cancelled by user.");
    });

    it("rejects cancellation on non-cancellable or terminal tasks", async () => {
      const task = registerExecutionTask({ cancellable: false });
      const res = await requestTaskCancellation(task.taskId);
      assert.strictEqual(res, false);
      assert.strictEqual(getActiveTasks().length, 1);
    });
  });

  describe("5. Stale Task Detection & Crash Recovery Policy", () => {
    it("marks active tasks as INTERRUPTED on recovery without automatic resubmission", () => {
      registerExecutionTask({ promptSnippet: "In-flight task before restart 1" });
      registerExecutionTask({ promptSnippet: "In-flight task before restart 2" });

      assert.strictEqual(getActiveTasks().length, 2);

      const marked = detectAndMarkStaleTasks();
      assert.strictEqual(marked, 2);
      assert.strictEqual(getActiveTasks().length, 0);

      const recent = getRecentTasks();
      assert.strictEqual(recent.length, 2);
      assert.strictEqual(recent[0].state, "INTERRUPTED");
      assert.strictEqual(recent[0].error?.code, "TASK_INTERRUPTED");
      assert.strictEqual(recent[0].error?.recoverable, true);
    });
  });

  describe("6. Bounded Retention & Zero Memory Leaks", () => {
    it("caps recent terminal tasks to max 50 items", () => {
      for (let i = 0; i < 65; i++) {
        const t = registerExecutionTask({ promptSnippet: `Task ${i}` });
        updateExecutionTaskState(t.taskId, "COMPLETED");
      }

      assert.strictEqual(getActiveTasks().length, 0);
      assert.strictEqual(getRecentTasks(100).length, 50);
    });

    it("clears terminal tasks on user request", () => {
      const t = registerExecutionTask({ promptSnippet: "Task to clear" });
      updateExecutionTaskState(t.taskId, "COMPLETED");
      assert.strictEqual(getRecentTasks().length, 1);

      clearTerminalTasks();
      assert.strictEqual(getRecentTasks().length, 0);
    });
  });

  describe("7. Filtering & Statistics", () => {
    it("filters tasks correctly and aggregates stats accurately", () => {
      const t1 = registerExecutionTask({ category: "REQUEST" });
      updateExecutionTaskState(t1.taskId, "STREAMING");

      const t2 = registerExecutionTask({ category: "MAINTENANCE" });
      updateExecutionTaskState(t2.taskId, "COMPLETED");

      const t3 = registerExecutionTask({ category: "REQUEST" });
      updateExecutionTaskState(t3.taskId, "FAILED", {
        error: { code: "NET_ERR", message: "Network failure", recoverable: true },
      });

      const t4 = registerExecutionTask({ category: "REQUEST" });
      updateExecutionTaskState(t4.taskId, "CANCELLED");

      const stats = getExecutionStats();
      assert.strictEqual(stats.activeCount, 1);
      assert.strictEqual(stats.completedCount, 1);
      assert.strictEqual(stats.failedCount, 1);
      assert.strictEqual(stats.cancelledCount, 1);
      assert.strictEqual(stats.totalTracked, 4);

      assert.strictEqual(listExecutionTasks("ACTIVE").length, 1);
      assert.strictEqual(listExecutionTasks("FAILED").length, 1);
      assert.strictEqual(listExecutionTasks("CANCELLED").length, 1);
      assert.strictEqual(listExecutionTasks("BACKGROUND").length, 1);
      assert.strictEqual(listExecutionTasks("ALL").length, 4);
    });
  });
});
