# Nano Route — Safe Context Reduction Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Context Engine, Chat Studio, History Store  

---

## 1. Absolute Preservation Invariant

**Context reduction operations NEVER delete, alter, or summarize SQLite chat history.**

A message omitted from an outbound request remains fully intact and searchable in the conversation timeline. The user is explicitly informed about the exact number of messages sent and omitted.

---

## 2. Reduction Modes Specification

| Mode | What Is Sent | What Remains In History | System Instructions Protected? | Current Prompt Protected? |
| :--- | :--- | :--- | :---: | :---: |
| **`FULL_HISTORY`** | All historical turns + system prompt + current prompt. | All messages | Yes | Yes |
| **`RECENT_WINDOW`** | The last $N$ turns (e.g. 5, 10, 20) + system prompt + current prompt. | All messages (omitted turns preserved) | Yes | Yes |
| **`PROTECTED_ONLY`** | Only system prompt + current prompt. Zero past turns sent. | All messages (all past turns preserved) | Yes | Yes |

---

## 3. Transparency & User Guidance

When context is reduced, the UI surfaces a transparent explanation:
> *"Sending the most recent 10 messages. 24 earlier messages remain safely in History but will not be sent for this request."*

This prevents false assumptions about whether the model saw previous conversational context.

