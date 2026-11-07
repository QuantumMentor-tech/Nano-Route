/**
//! Nano Route — Typed Event Subscription & Lifecycle Management
//!
//! Responsibility:
//! - Authoritative event subscription boundary.
//! - Enforces listener cleanup to prevent memory leaks and duplicate handlers.
//! - Provides React hook `useTauriEvent` with stale-closure protection.
//! - Provides headless test event emitter for unit testing.
*/

import { useEffect, useRef } from "react";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { isTauriContext } from "./client.ts";
import {
  IPC_EVENTS,
  type IpcEventName,
  type IpcEventPayloadMap,
  type UnlistenFn,
} from "./types.ts";

// --- Mock Event Emitter for Testing & Browser Mode ---

type GenericListener = (payload: unknown) => void;
const mockEventListeners = new Map<string, Set<GenericListener>>();

/**
 * Test utility: Emits a mock event to all registered frontend listeners.
 */
export function emitMockEvent<E extends IpcEventName>(
  event: E,
  payload: IpcEventPayloadMap[E]
): void {
  const listeners = mockEventListeners.get(event);
  if (listeners) {
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[Event Error] Error in listener for ${event}:`, err);
      }
    });
  }
}

/**
 * Test utility: Clears all registered mock event listeners.
 */
export function clearMockEventListeners(): void {
  mockEventListeners.clear();
}

/**
 * Subscribes to a typed Tauri event with guaranteed unlisten cleanup.
 */
export async function subscribeToEvent<E extends IpcEventName>(
  event: E,
  handler: (payload: IpcEventPayloadMap[E]) => void
): Promise<UnlistenFn> {
  if (!isTauriContext()) {
    // Browser / headless test mode: use mock listener registry
    if (!mockEventListeners.has(event)) {
      mockEventListeners.set(event, new Set());
    }
    const listenerSet = mockEventListeners.get(event)!;
    const genericHandler = handler as GenericListener;
    listenerSet.add(genericHandler);

    return () => {
      listenerSet.delete(genericHandler);
      if (listenerSet.size === 0) {
        mockEventListeners.delete(event);
      }
    };
  }

  // Tauri WebView native mode
  const unlisten = await tauriListen<IpcEventPayloadMap[E]>(event, (eventObj) => {
    handler(eventObj.payload);
  });

  return unlisten;
}

/**
 * Reusable React Hook for consuming typed Tauri events safely.
 *
 * Guarantees:
 * 1. Single subscription per component mount (no listener multiplication on re-render).
 * 2. Automatic cleanup on component unmount or when `event` changes.
 * 3. Fresh callback execution via `useRef` (prevents stale closure capture).
 * 4. Safe cancellation if component unmounts before async subscription resolves.
 */
export function useTauriEvent<E extends IpcEventName>(
  event: E,
  handler: (payload: IpcEventPayloadMap[E]) => void,
  enabled = true
): void {
  const handlerRef = useRef(handler);

  // Keep handler reference fresh on every render without resubscribing
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    let unlisten: UnlistenFn | null = null;
    let isActive = true;

    subscribeToEvent(event, (payload) => {
      if (isActive) {
        handlerRef.current(payload);
      }
    })
      .then((cleanupFn) => {
        if (isActive) {
          unlisten = cleanupFn;
        } else {
          // If already unmounted before subscription completed, clean up immediately
          cleanupFn();
        }
      })
      .catch((err) => {
        console.error(`[IPC Event] Failed to subscribe to ${event}:`, err);
      });

    return () => {
      isActive = false;
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  }, [event, enabled]);
}

export { IPC_EVENTS };
