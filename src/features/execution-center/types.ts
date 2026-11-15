/**
 * Nano Route — Active Request Center & Task Lifecycle Types
 * File: src/features/execution-center/types.ts
 *
 * Implements Step 85:
 * - Bounded execution state machine (Queued -> Starting -> Routing -> Streaming -> Terminal)
 * - Strict distinction between Logical Request ID and Physical Attempt ID
 * - Task categories (Request, Attachment, Diagnostics, Maintenance, Recovery)
 * - Progress tracking, cancellation states, and error encapsulation
 * - Bounded retention and filter definitions
 */

export type ExecutionState =
  | "QUEUED"
  | "STARTING"
  | "ROUTING"
  | "PREPARING"
  | "CONNECTING"
  | "STREAMING"
  | "FINALIZING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "BLOCKED"
  | "TIMED_OUT"
  | "INTERRUPTED";

export type TaskCategory =
  | "REQUEST"
  | "ATTACHMENT_PREPARATION"
  | "DIAGNOSTICS"
  | "MAINTENANCE"
  | "RECOVERY";

export type ExecutionCenterFilter =
  | "ALL"
  | "ACTIVE"
  | "FAILED"
  | "CANCELLED"
  | "BACKGROUND"
  | "INTERRUPTED";

export interface TaskProgress {
  step: string;
  outputTokens?: number;
  elapsedMs?: number;
  message?: string | null;
}

export interface TaskExecutionError {
  code: string;
  message: string;
  providerId?: string | null;
  recoverable: boolean;
}

/**
 * Authoritative record of an application task or prompt request.
 */
export interface ExecutionTask {
  taskId: string;
  logicalRequestId: string;
  physicalAttemptId: string;
  category: TaskCategory;
  state: ExecutionState;
  sessionId: string | null;
  sessionTitle: string | null;
  branchId: string | null;
  providerId: string | null;
  modelId: string | null;
  displayName: string | null;
  promptSnippet: string;
  createdAtMs: number;
  startedAtMs: number | null;
  updatedAtMs: number;
  completedAtMs: number | null;
  cancellable: boolean;
  isCancelling: boolean;
  progress: TaskProgress;
  attemptCount: number;
  error: TaskExecutionError | null;
}

export interface RegisterTaskParams {
  category?: TaskCategory;
  logicalRequestId?: string;
  sessionId?: string | null;
  sessionTitle?: string | null;
  branchId?: string | null;
  promptSnippet?: string;
  cancellable?: boolean;
}

export interface UpdateTaskStateParams {
  state: ExecutionState;
  providerId?: string | null;
  modelId?: string | null;
  displayName?: string | null;
  progressStep?: string;
  outputTokens?: number;
  error?: TaskExecutionError | null;
}

export interface ExecutionStats {
  activeCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  interruptedCount: number;
  totalTracked: number;
}

