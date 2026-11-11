/**
//! Nano Route — Chat Page
//! File: src/pages/ChatPage.tsx
//!
//! Hosts the Chat Studio conversational workspace within the desktop application shell.
*/

import { useSearchParams } from "react-router-dom";
import { ChatStudio } from "../features/chat";

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get("sessionId");
  const focusMessageId = searchParams.get("focusMessageId");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        height: "calc(100vh - 84px)",
        minHeight: "560px",
        width: "100%",
      }}
    >
      <ChatStudio
        initialSessionId={initialSessionId}
        focusMessageId={focusMessageId}
      />
    </div>
  );
}
