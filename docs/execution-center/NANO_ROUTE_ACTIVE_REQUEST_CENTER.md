# Nano Route — Active Request Center Architecture

## 1. Architectural Philosophy
The Active Request Center delivers operational glass-cockpit transparency into all background operations and prompt executions occurring in Nano Route. Designed for power users, developers, and safety-conscious operators, it surfaces precise execution stages without adding overhead or polluting system state.

## 2. Component Structure
- **Execution Engine (`src/features/execution-center/engine.ts`)**:
  - Central reactive registry holding active task records in memory.
  - Subscriptions allow instant UI re-renders on task state updates without polling loops.
  - Automatic bounded history eviction (`MAX_RECENT_TASKS = 50`).
- **Modal View (`src/features/execution-center/components/ActiveRequestCenterModal.tsx`)**:
  - Full-screen modal with tabbed views: All, Active, Failed, Cancelled, Interrupted, and Background tasks.
  - Displays elapsed time, token throughput, session badges, and step progress.
  - Exposes cooperative cancellation triggers and session deep-linking.
- **Header Indicator (`src/features/execution-center/components/ActiveRequestIndicator.tsx`)**:
  - Compact button in dashboard header.
  - Displays animated pulse and count badge when tasks are active.
  - One-click trigger to open the Active Request Center.
- **Chat Studio Hook Integration (`src/features/chat/useChatStudio.ts`)**:
  - Registers task on prompt submit.
  - Updates progress through preflight, routing, streaming, and finalization.
  - Marks completed or captures errors/cancellations upon completion.

