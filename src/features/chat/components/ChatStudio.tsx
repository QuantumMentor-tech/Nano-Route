/**
//! Nano Route — Chat Studio Workspace Component
//! File: src/features/chat/components/ChatStudio.tsx
//!
//! Root container for the dark-themed Chat Studio conversational workspace.
//! Assembles session navigation sidebar, active conversation header, message timeline,
//! composer, loading skeletons, and empty states.
*/

import React, { useState, useMemo } from "react";
import type { SubmitPromptIntent } from "../types";
import { useChatStudio } from "../useChatStudio";
import { ChatSessionSidebar } from "./ChatSessionSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageTimeline } from "./MessageTimeline";
import { Composer } from "./Composer";
import { EmptyChatState } from "./EmptyChatState";
import { EmptyNoSessionState } from "./EmptyNoSessionState";
import { ChatLoadingState } from "./ChatLoadingState";
import { ChatErrorState } from "./ChatErrorState";
import { ContextIndicator, ContextReviewModal, evaluateContextPreflight } from "../../context";
import { TemplateBrowserModal } from "../../templates";
import { ContextCollectionModal } from "../../context-collections";
import { RequestInspectorModal } from "../../request-inspector";

export interface ChatStudioProps {
  initialSessionId?: string | null;
  focusMessageId?: string | null;
  onSubmitPromptIntent?: (intent: SubmitPromptIntent) => void;
  className?: string;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  initialSessionId,
  focusMessageId,
  onSubmitPromptIntent,
  className = "",
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [composerSeed, setComposerSeed] = useState("");
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isTemplateBrowserOpen, setIsTemplateBrowserOpen] = useState(false);
  const [isCollectionBrowserOpen, setIsCollectionBrowserOpen] = useState(false);
  const [isRequestInspectorOpen, setIsRequestInspectorOpen] = useState(false);
  const [inspectPrompt, setInspectPrompt] = useState("");
  const [inspectAttachments, setInspectAttachments] = useState<any[]>([]);

  const {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isSubmitting,
    isCancelling,
    cancelCurrentExecution,
    error,
    clearError,
    selectSession,
    createSession,
    renameSession,
    togglePinSession,
    deleteSession,
    submitPrompt,
  } = useChatStudio({
    initialSessionId,
    onSubmitPromptIntent,
    autoSelectFirstSession: true,
  });

  const handleSelectSuggestion = (suggestion: string) => {
    setComposerSeed(suggestion);
  };

  const handleSubmit = async (prompt: string) => {
    setComposerSeed("");
    await submitPrompt(prompt);
  };

  // Compute live context evaluation based on active messages and current prompt draft
  const contextEval = useMemo(() => {
    return evaluateContextPreflight({
      providerId: "deepseek",
      modelId: "deepseek-chat",
      prompt: composerSeed,
      history: messages,
    });
  }, [messages, composerSeed]);

  return (
    <div
      className={`nr-chat-studio ${className}`}
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        minHeight: "600px",
        backgroundColor: "var(--nr-bg-app, #09090b)",
        color: "var(--nr-text-primary, #ffffff)",
        overflow: "hidden",
        position: "relative",
        borderRadius: "var(--nr-radius-lg, 8px)",
        border: "1px solid var(--nr-border-default, #27272a)",
      }}
    >
      {/* Session Navigation Sidebar */}
      {isSidebarOpen && (
        <ChatSessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isLoading={isLoadingSessions}
          onSelectSession={selectSession}
          onCreateSession={async () => {
            await createSession();
          }}
          onTogglePin={togglePinSession}
          onDeleteSession={deleteSession}
        />
      )}

      {/* Main Chat Workspace Area */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
          backgroundColor: "var(--nr-bg-app, #09090b)",
        }}
      >
        {/* Active Conversation Header */}
        <ChatHeader
          session={activeSession}
          onRename={renameSession}
          onTogglePin={togglePinSession}
          onDelete={deleteSession}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Global Error Banner */}
        {error && <ChatErrorState error={error} onDismiss={clearError} />}

        {/* Conversation Timeline Region */}
        {isLoadingMessages ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ChatLoadingState />
          </div>
        ) : !activeSession && sessions.length === 0 ? (
          <EmptyNoSessionState
            onCreateSession={async () => {
              await createSession();
            }}
          />
        ) : !activeSession ? (
          <EmptyNoSessionState
            onCreateSession={async () => {
              await createSession();
            }}
          />
        ) : (
          <MessageTimeline
            messages={messages}
            focusMessageId={focusMessageId}
            emptyState={
              <EmptyChatState onSelectSuggestion={handleSelectSuggestion} />
            }
          />
        )}

        {/* Input Composer Region */}
        <Composer
          onSubmit={handleSubmit}
          onCancel={cancelCurrentExecution}
          sessionId={activeSessionId}
          isSubmitting={isSubmitting}
          isCancelling={isCancelling}
          initialValue={composerSeed}
          onOpenTemplates={() => setIsTemplateBrowserOpen(true)}
          onOpenCollections={() => setIsCollectionBrowserOpen(true)}
          onInspectRequest={(prompt, attachments) => {
            setInspectPrompt(prompt);
            setInspectAttachments(attachments);
            setIsRequestInspectorOpen(true);
          }}
          contextIndicator={
            <ContextIndicator
              evaluation={contextEval}
              onOpenContextReview={() => setIsContextModalOpen(true)}
            />
          }
          placeholder={
            activeSession
              ? `Message in "${activeSession.title}"...`
              : "Message Nano Route (will start a new conversation)..."
          }
        />
      </main>

      {/* Template & Preset Browser Modal */}
      <TemplateBrowserModal
        isOpen={isTemplateBrowserOpen}
        onClose={() => setIsTemplateBrowserOpen(false)}
        onApplyPrompt={(prompt) => {
          setComposerSeed(prompt);
        }}
      />

      {/* Step 83: Context Collection & Reference Pack Modal */}
      <ContextCollectionModal
        isOpen={isCollectionBrowserOpen}
        onClose={() => setIsCollectionBrowserOpen(false)}
        onInsertContext={(formattedContext) => {
          setComposerSeed((prev) =>
            prev ? `${formattedContext}\n\n${prev}` : formattedContext
          );
        }}
        resolverContext={{
          messages: new Map(messages.map((m) => [m.id, m.content])),
        }}
      />

      {/* Context Review & Reduction Modal */}
      <ContextReviewModal
        isOpen={isContextModalOpen}
        evaluation={contextEval}
        historyMessages={messages}
        currentPrompt={composerSeed}
        onClose={() => setIsContextModalOpen(false)}
        onStartNewChat={async () => {
          setIsContextModalOpen(false);
          await createSession();
        }}
      />

      {/* Step 84: Request Inspector & Preflight Transparency Modal */}
      <RequestInspectorModal
        isOpen={isRequestInspectorOpen}
        onClose={() => setIsRequestInspectorOpen(false)}
        snapshotParams={{
          sessionId: activeSessionId,
          prompt: inspectPrompt || composerSeed,
          attachments: inspectAttachments,
          historyMessages: messages,
          providerId: "deepseek",
          modelId: "deepseek-chat",
        }}
        onConfirmSend={async (finalPrompt) => {
          setIsRequestInspectorOpen(false);
          await handleSubmit(finalPrompt);
        }}
        onRemoveAttachment={(attId) => {
          setInspectAttachments((prev) => prev.filter((a) => a.id !== attId));
        }}
      />
    </div>
  );
};

