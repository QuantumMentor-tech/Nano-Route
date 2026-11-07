import type {
  ApplicationState,
  ApplicationAction,
  Environment,
} from "./applicationTypes";

const APP_NAME = "Nano Route";
const APP_VERSION = "0.1.0";

export function getInitialEnvironment(): Environment {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env.MODE === "test") return "test";
    if (import.meta.env.PROD) return "production";
    return "development";
  }
  return "development";
}

export const initialApplicationState: ApplicationState = {
  lifecycle: "initializing",
  nativeCoreStatus: "checking",
  environment: getInitialEnvironment(),
  appName: APP_NAME,
  appVersion: APP_VERSION,
  isNative: false,
  nativeMessage: "Checking native core status...",
  initializedAt: null,
  lastError: null,
};

export function applicationReducer(
  state: ApplicationState,
  action: ApplicationAction
): ApplicationState {
  switch (action.type) {
    case "INITIALIZATION_STARTED":
      return {
        ...state,
        lifecycle: "initializing",
        nativeCoreStatus: "checking",
        nativeMessage: "Checking native core status...",
        lastError: null,
      };

    case "INITIALIZATION_SUCCEEDED":
      return {
        ...state,
        lifecycle: "ready",
        nativeCoreStatus: "ready",
        isNative: action.payload.isNative,
        nativeMessage: action.payload.message,
        initializedAt: new Date().toISOString(),
        lastError: null,
      };

    case "INITIALIZATION_DEGRADED":
      return {
        ...state,
        lifecycle: "degraded",
        nativeCoreStatus: "unavailable",
        isNative: false,
        nativeMessage: action.payload.message,
        initializedAt: new Date().toISOString(),
        lastError: action.payload.error ?? null,
      };

    case "INITIALIZATION_FAILED":
      return {
        ...state,
        lifecycle: "failed",
        nativeCoreStatus: "error",
        isNative: false,
        nativeMessage: "Native application initialization failed",
        lastError: action.payload.error,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        lastError: null,
      };

    default:
      return state;
  }
}

