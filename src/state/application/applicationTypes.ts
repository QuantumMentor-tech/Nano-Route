/**
 * Nano Route — Global Application Runtime State Types
 * Step 9: Dashboard Shell & Global Application States
 */

export type AppLifecycle = "initializing" | "ready" | "degraded" | "failed";

export type NativeCoreStatus =
  | "unknown"
  | "checking"
  | "ready"
  | "unavailable"
  | "error";

export type Environment = "development" | "production" | "test";

export interface ApplicationState {
  lifecycle: AppLifecycle;
  nativeCoreStatus: NativeCoreStatus;
  environment: Environment;
  appName: string;
  appVersion: string;
  isNative: boolean;
  nativeMessage: string;
  initializedAt: string | null;
  lastError: string | null;
}

export type ApplicationAction =
  | { type: "INITIALIZATION_STARTED" }
  | {
      type: "INITIALIZATION_SUCCEEDED";
      payload: { isNative: boolean; message: string };
    }
  | {
      type: "INITIALIZATION_DEGRADED";
      payload: { message: string; error?: string };
    }
  | {
      type: "INITIALIZATION_FAILED";
      payload: { error: string };
    }
  | { type: "CLEAR_ERROR" };

export interface ApplicationContextValue {
  state: ApplicationState;
  refreshHealth: () => Promise<void>;
}

