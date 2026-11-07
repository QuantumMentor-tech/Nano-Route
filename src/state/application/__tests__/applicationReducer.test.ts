import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applicationReducer,
  initialApplicationState,
} from "../applicationReducer.ts";

describe("Application Reducer State Transitions (Step 9)", () => {
  it("initial state starts in initializing", () => {
    assert.equal(initialApplicationState.lifecycle, "initializing");
    assert.equal(initialApplicationState.nativeCoreStatus, "checking");
    assert.equal(initialApplicationState.lastError, null);
  });

  it("INITIALIZATION_SUCCEEDED transitions to ready state", () => {
    const nextState = applicationReducer(initialApplicationState, {
      type: "INITIALIZATION_SUCCEEDED",
      payload: {
        isNative: true,
        message: "Native Core Operational",
      },
    });

    assert.equal(nextState.lifecycle, "ready");
    assert.equal(nextState.nativeCoreStatus, "ready");
    assert.equal(nextState.isNative, true);
    assert.equal(nextState.nativeMessage, "Native Core Operational");
    assert.notEqual(nextState.initializedAt, null);
    assert.equal(nextState.lastError, null);
  });

  it("INITIALIZATION_DEGRADED transitions to degraded state with safe fallback", () => {
    const nextState = applicationReducer(initialApplicationState, {
      type: "INITIALIZATION_DEGRADED",
      payload: {
        message: "Native core unreachable",
        error: "Failed to connect to IPC bridge",
      },
    });

    assert.equal(nextState.lifecycle, "degraded");
    assert.equal(nextState.nativeCoreStatus, "unavailable");
    assert.equal(nextState.isNative, false);
    assert.equal(nextState.nativeMessage, "Native core unreachable");
    assert.equal(nextState.lastError, "Failed to connect to IPC bridge");
  });

  it("INITIALIZATION_FAILED transitions to failed state", () => {
    const nextState = applicationReducer(initialApplicationState, {
      type: "INITIALIZATION_FAILED",
      payload: {
        error: "Critical native core panic",
      },
    });

    assert.equal(nextState.lifecycle, "failed");
    assert.equal(nextState.nativeCoreStatus, "error");
    assert.equal(nextState.isNative, false);
    assert.equal(nextState.lastError, "Critical native core panic");
  });

  it("INITIALIZATION_STARTED restarts check from failed state", () => {
    const failedState = applicationReducer(initialApplicationState, {
      type: "INITIALIZATION_FAILED",
      payload: { error: "Fatal error" },
    });

    const restartedState = applicationReducer(failedState, {
      type: "INITIALIZATION_STARTED",
    });

    assert.equal(restartedState.lifecycle, "initializing");
    assert.equal(restartedState.nativeCoreStatus, "checking");
    assert.equal(restartedState.lastError, null);
  });

  it("CLEAR_ERROR clears lastError without mutating lifecycle", () => {
    const failedState = applicationReducer(initialApplicationState, {
      type: "INITIALIZATION_FAILED",
      payload: { error: "Temporary error" },
    });

    const clearedState = applicationReducer(failedState, {
      type: "CLEAR_ERROR",
    });

    assert.equal(clearedState.lastError, null);
    assert.equal(clearedState.lifecycle, "failed");
  });
});

