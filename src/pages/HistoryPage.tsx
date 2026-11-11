/**
//! Nano Route — History Route Page
//! File: src/pages/HistoryPage.tsx
//!
//! Hosts the Step 41 History Explorer, Search & Conversation Management workspace.
*/

import { HistoryExplorer } from "../features/history";

export function HistoryPage() {
  return (
    <div style={{ width: "100%", padding: "0.25rem 0.5rem 1.5rem" }}>
      <HistoryExplorer />
    </div>
  );
}
