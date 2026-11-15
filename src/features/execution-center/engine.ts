/**
 * Nano Route — Active Request Center & Task Lifecycle Engine
 * File: src/features/execution-center/engine.ts
 *
 * Implements Step 85:
 * - Authoritative in-memory registry for active and recent execution tasks
 * - Validates lifecycle state transitions and prevents terminal state escape
 * - Enforces separation of Logical Request IDs from Physical Attempt IDs
 * - Cooperative cancellation coordination with Step 35 IPC
 * - Stale task detection, restart recovery without automatic resubmission
 * - Bounded retention (max 50 recent tasks) to eliminate memory leaks
 */

import { cancelChatExecution } from "../../services/ipc/chat.ts";
import type {
  ExecutionTask,
  ExecutionState,
  RegisterTaskParams,
  UpdateTaskStateParams,
  ExecutionCenterFilter,
  ExecutionStats,
} from "./types.ts";

const MAX_RECENT_TASKS = 50;

// Active running tasks: taskId -> ExecutionTask
const activeTasks = new Map<string, ExecutionTask>();

// Bounded recent completed/failed/cancelled tasks
let recentTasks: ExecutionTask[] = [];

// Reactive listeners for zero-polling UI updates
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener exceptions
    }
  });
}

/**
 * Subscribes to real-time execution state updates.
 */
export function subscribeToExecutionTasks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const TERMINAL_STATES: ReadonlySet<ExecutionState> = new Set([
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "TIMED_OUT",
  "INTERRUPTED",
]);

/**
 * Registers a new active task in the registry.
 */
export function registerExecutionTask(params: RegisterTaskParams = {}): ExecutionTask {
  const now = Date.now();
  const taskId = `task_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const logicalRequestId =
    params.logicalRequestId || `req_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const physicalAttemptId = `att_${now}_1`;

  const task: ExecutionTask = {
    taskId,
    logicalRequestId,
    physicalAttemptId,
    category: params.category || "REQUEST",
    state: "STARTING",
    sessionId: params.sessionId || null,
    sessionTitle: params.sessionTitle || null,
    branchId: params.branchId || null,
    providerId: null,
    modelId: null,
    displayName: null,
    promptSnippet: params.promptSnippet ? params.promptSnippet.substring(0, 100) : "",
    createdAtMs: now,
    startedAtMs: now,
    updatedAtMs: now,
    completedAtMs: null,
    cancellable: params.cancellable ?? true,
    isCancelling: false,
    progress: {
      step: "Initializing request...",
    },
    attemptCount: 1,
    error: null,
  };

  activeTasks.set(taskId, task);
  notifyListeners();
  return { ...task };
}

/**
 * Updates the lifecycle state and operational metadata of an existing task.
 */
export function updateExecutionTaskState(
  taskId: string,
  state: ExecutionState,
  meta?: Partial<UpdateTaskStateParams>
): ExecutionTask | null {
  const task = activeTasks.get(taskId);
  if (!task) {
    // Check if it already transitioned to recent tasks
    const recent = recentTasks.find((t) => t.taskId === taskId);
    return recent ? { ...recent } : null;
  }

  // Prevent transitions out of terminal states (idempotency rule)
  if (TERMINAL_STATES.has(task.state)) {
    return { ...task };
  }

  const now = Date.now();
  task.state = state;
  task.updatedAtMs = now;

  if (meta?.providerId !== undefined) task.providerId = meta.providerId;
  if (meta?.modelId !== undefined) task.modelId = meta.modelId;
  if (meta?.displayName !== undefined) task.displayName = meta.displayName;

  if (meta?.progressStep) {
    task.progress.step = meta.progressStep;
  }
  if (meta?.outputTokens !== undefined) {
    task.progress.outputTokens = meta.outputTokens;
  }
  task.progress.elapsedMs = now - (task.startedAtMs || task.createdAtMs);

  if (meta?.error !== undefined) {
    task.error = meta.error;
  }

  // Handle terminal state transition
  if (TERMINAL_STATES.has(state)) {
    task.completedAtMs = now;
    task.isCancelling = false;
    activeTasks.delete(taskId);

    // Add to bounded recent tasks (newest first)
    recentTasks.unshift({ ...task });
    if (recentTasks.length > MAX_RECENT_TASKS) {
      recentTasks = recentTasks.slice(0, MAX_RECENT_TASKS);
    }
  }

  notifyListeners();
  return { ...task };
}

/**
 * Records a new physical attempt for an existing logical request (retry or failover).
 */
export function recordTaskAttempt(
  taskId: string,
  physicalAttemptId: string,
  providerId?: string,
  modelId?: string,
  displayName?: string
): ExecutionTask | null {
  const task = activeTasks.get(taskId);
  if (!task || TERMINAL_STATES.has(task.state)) {
    return null;
  }

  task.attemptCount += 1;
  task.physicalAttemptId = physicalAttemptId;
  if (providerId) task.providerId = providerId;
  if (modelId) task.modelId = modelId;
  if (displayName) task.displayName = displayName;
  task.updatedAtMs = Date.now();
  task.progress.step = `Attempt ${task.attemptCount}: routing to ${displayName || providerId || "model"}...`;

  notifyListeners();
  return { ...task };
}

/**
 * Initiates cooperative cancellation for an active task.
 */
export async function requestTaskCancellation(
  taskId: string,
  reason: string = "user_cancelled"
): Promise<boolean> {
  const task = activeTasks.get(taskId);
  if (!task || !task.cancellable || task.isCancelling || TERMINAL_STATES.has(task.state)) {
    return false;
  }

  task.isCancelling = true;
  task.updatedAtMs = Date.now();
  task.progress.step = "Cancellation requested...";
  notifyListeners();

  try {
    await cancelChatExecution(taskId, reason as any);
  } catch (err) {
    console.warn(`[ExecutionCenter] Native cancellation signal error for ${taskId}:`, err);
  }

  // Update task to terminal CANCELLED state
  updateExecutionTaskState(taskId, "CANCELLED", {
    progressStep: "Execution cancelled by user.",
  });

  return true;
}

/**
 * Returns all currently active, non-terminal tasks.
 */
export function getActiveTasks(): ExecutionTask[] {
  return Array.from(activeTasks.values()).map((t) => ({ ...t }));
}

/**
 * Returns bounded recent terminal tasks.
 */
export function getRecentTasks(limit: number = 20): ExecutionTask[] {
  return recentTasks.slice(0, limit).map((t) => ({ ...t }));
}

/**
 * Lists tasks matching an optional filter.
 */
export function listExecutionTasks(filter: ExecutionCenterFilter = "ALL"): ExecutionTask[] {
  const active = getActiveTasks();
  const recent = getRecentTasks();

  switch (filter) {
    case "ACTIVE":
      return active;
    case "FAILED":
      return recent.filter((t) => t.state === "FAILED" || t.state === "BLOCKED");
    case "CANCELLED":
      return recent.filter((t) => t.state === "CANCELLED");
    case "INTERRUPTED":
      return recent.filter((t) => t.state === "INTERRUPTED" || t.state === "TIMED_OUT");
    case "BACKGROUND":
      return [...active, ...recent].filter((t) => t.category !== "REQUEST");
    case "ALL":
    default:
      return [...active, ...recent];
  }
}

/**
 * Computes high-level execution statistics.
 */
export function getExecutionStats(): ExecutionStats {
  const active = activeTasks.size;
  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  let interrupted = 0;

  for (const t of recentTasks) {
    if (t.state === "COMPLETED") completed++;
    else if (t.state === "FAILED" || t.state === "BLOCKED") failed++;
    else if (t.state === "CANCELLED") cancelled++;
    else if (t.state === "INTERRUPTED" || t.state === "TIMED_OUT") interrupted++;
  }

  return {
    activeCount: active,
    completedCount: completed,
    failedCount: failed,
    cancelledCount: cancelled,
    interruptedCount: interrupted,
    totalTracked: active + recentTasks.length,
  };
}

/**
 * Detects and marks any stale active tasks (e.g. from previous run/crash).
 * Enforces strict non-goal: ZERO automatic resubmission of interrupted requests!
 */
export function detectAndMarkStaleTasks(): number {
  let markedCount = 0;
  const now = Date.now();

  for (const [id, task] of Array.from(activeTasks.entries())) {
    task.state = "INTERRUPTED";
    task.completedAtMs = now;
    task.updatedAtMs = now;
    task.isCancelling = false;
    task.error = {
      code: "TASK_INTERRUPTED",
      message: "Execution was interrupted by application shutdown, restart, or connection loss.",
      recoverable: true,
    };
    task.progress.step = "Interrupted prior to completion.";

    activeTasks.delete(id);
    recentTasks.unshift({ ...task });
    markedCount++;
  }

  if (markedCount > 0) {
    if (recentTasks.length > MAX_RECENT_TASKS) {
      recentTasks = recentTasks.slice(0, MAX_RECENT_TASKS);
    }
    notifyListeners();
  }

  return markedCount;
}

/**
 * Clears terminal tasks from recent history cache.
 */
export function clearTerminalTasks(): void {
  recentTasks = [];
  notifyListeners();
}

/**
 * Resets stores for test isolation.
 */
export function resetExecutionCenterStore(): void {
  activeTasks.clear();
  recentTasks = [];
  listeners.clear();
}

