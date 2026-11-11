/**
//! Nano Route — Message Item Dispatcher Component
//! File: src/features/chat/components/MessageItem.tsx
//!
//! Evaluates message sender type and renders the corresponding specialized message component.
*/

import React from "react";
import type { ChatMessage } from "../types";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SystemMessage } from "./SystemMessage";

export interface MessageItemProps {
  message: ChatMessage;
  className?: string;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  className = "",
}) => {
  switch (message.sender) {
    case "user":
      return <UserMessage message={message} className={className} />;
    case "assistant":
      return <AssistantMessage message={message} className={className} />;
    case "system":
    default:
      return <SystemMessage message={message} className={className} />;
  }
};

