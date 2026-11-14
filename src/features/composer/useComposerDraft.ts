/**
 * Nano Route — Composer Draft Hook with Autosave and Undo/Redo
 * File: src/features/composer/useComposerDraft.ts
 *
 * Implements Step 78:
 * - Controlled text input with debounced persistence (500ms default)
 * - Safe dirty-state tracking and draft status indicators
 * - Multi-level in-memory Undo/Redo stack with keyboard shortcut support
 * - Session-switching preservation (persists previous session draft, loads next)
 * - Explicit draft clearing on prompt submit or user discard
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { DraftSaveStatus, ComposerDraft } from "./types.ts";
import {
  getComposerDraft,
  saveComposerDraft,
  clearComposerDraft,
} from "./engine.ts";

export interface UseComposerDraftOptions {
  sessionId: string | null;
  initialContent?: string;
  debounceMs?: number;
  maxHistoryStack?: number;
  onRecoveredDraftFound?: (draft: ComposerDraft) => void;
}

export function useComposerDraft({
  sessionId,
  initialContent = "",
  debounceMs = 500,
  maxHistoryStack = 50,
  onRecoveredDraftFound,
}: UseComposerDraftOptions) {
  const [content, setContent] = useState<string>(initialContent);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("IDLE");
  const [lastSavedDraft, setLastSavedDraft] = useState<ComposerDraft | null>(null);

  // Undo / Redo history stacks
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoActionRef = useRef<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionIdRef = useRef<string | null>(sessionId);
  const contentRef = useRef<string>(content);

  contentRef.current = content;

  // Track session switching: save current draft before loading new session draft
  useEffect(() => {
    const prevSessionId = currentSessionIdRef.current;
    if (prevSessionId !== sessionId) {
      // Flush draft for previous session if dirty
      if (contentRef.current.trim().length > 0) {
        void saveComposerDraft({
          sessionId: prevSessionId,
          content: contentRef.current,
        });
      }

      currentSessionIdRef.current = sessionId;
      undoStackRef.current = [];
      redoStackRef.current = [];

      // Load draft for newly activated session
      let isMounted = true;
      void getComposerDraft(sessionId).then((existing) => {
        if (!isMounted) return;
        if (existing && existing.content.trim().length > 0) {
          setContent(existing.content);
          setLastSavedDraft(existing);
          setSaveStatus(existing.isRecovered ? "RECOVERED" : "SAVED");
          if (existing.isRecovered && onRecoveredDraftFound) {
            onRecoveredDraftFound(existing);
          }
        } else {
          setContent(initialContent || "");
          setLastSavedDraft(null);
          setSaveStatus("IDLE");
        }
      });

      return () => {
        isMounted = false;
      };
    }
  }, [sessionId, initialContent, onRecoveredDraftFound]);

  // Initial mount recovery check
  useEffect(() => {
    let isMounted = true;
    void getComposerDraft(sessionId).then((existing) => {
      if (!isMounted) return;
      if (existing && existing.content.trim().length > 0) {
        setContent(existing.content);
        setLastSavedDraft(existing);
        setSaveStatus(existing.isRecovered ? "RECOVERED" : "SAVED");
        if (existing.isRecovered && onRecoveredDraftFound) {
          onRecoveredDraftFound(existing);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced Autosave Trigger
  const triggerAutosave = useCallback(
    (newText: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setSaveStatus("DIRTY");

      debounceTimerRef.current = setTimeout(async () => {
        try {
          setSaveStatus("SAVING");
          const saved = await saveComposerDraft({
            sessionId: currentSessionIdRef.current,
            content: newText,
          });
          setLastSavedDraft(saved);
          setSaveStatus(newText.trim().length === 0 ? "IDLE" : "SAVED");
        } catch {
          setSaveStatus("ERROR");
        }
      }, debounceMs);
    },
    [debounceMs]
  );

  // Content updater with Undo/Redo history tracking
  const updateContent = useCallback(
    (newText: string) => {
      if (!isUndoRedoActionRef.current) {
        if (contentRef.current !== newText) {
          undoStackRef.current.push(contentRef.current);
          if (undoStackRef.current.length > maxHistoryStack) {
            undoStackRef.current.shift();
          }
          // Any new typing clears redo stack
          redoStackRef.current = [];
        }
      }
      isUndoRedoActionRef.current = false;
      setContent(newText);
      triggerAutosave(newText);
    },
    [maxHistoryStack, triggerAutosave]
  );

  // Undo Action (Ctrl+Z)
  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(contentRef.current);
    isUndoRedoActionRef.current = true;
    setContent(prev);
    triggerAutosave(prev);
  }, [triggerAutosave]);

  // Redo Action (Ctrl+Y / Ctrl+Shift+Z)
  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(contentRef.current);
    isUndoRedoActionRef.current = true;
    setContent(next);
    triggerAutosave(next);
  }, [triggerAutosave]);

  // Explicit Draft Clear (after prompt send or explicit Discard)
  const clearDraft = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setContent("");
    undoStackRef.current = [];
    redoStackRef.current = [];
    await clearComposerDraft(currentSessionIdRef.current);
    setLastSavedDraft(null);
    setSaveStatus("IDLE");
  }, []);

  // Restore recovered draft
  const acceptRecoveredDraft = useCallback(async () => {
    setSaveStatus("SAVED");
  }, []);

  return {
    content,
    setContent: updateContent,
    saveStatus,
    lastSavedDraft,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clearDraft,
    acceptRecoveredDraft,
  };
}
