# Nano Route — Command Availability & Context Matrix
**Step 65: Context-Sensitive Action Availability**

## 1. Availability Evaluation Model

Commands in Nano Route can specify an `availability` requirement that determines whether the command is active, enabled, disabled, or visible based on application state:

```typescript
export type CommandAvailability = 
  | "always" 
  | "chat_active" 
  | "streaming_active" 
  | "diagnostics_ready" 
  | "recovery_mode";
```

### Context Rules

| Availability Key | Activation Condition | Behavior When Condition Unmet |
|---|---|---|
| `always` | Universal throughout application lifetime | Always visible and executable |
| `chat_active` | Active session has at least one message | Marked disabled with explanatory tooltip or hidden from default listing |
| `streaming_active` | LLM or SLM stream is currently in progress | Visible only during active generation (e.g. `Stop Generation`) |
| `diagnostics_ready` | Diagnostics subsystem initialized | Available; if busy, displays status indicator |
| `recovery_mode` | Application degraded or emergency recovery requested | Prioritized at top of search results |

---

## 2. Dynamic Guardrails
- **Action Verification**: Executing a context-constrained command checks the live state before invoking the handler to prevent stale closures or race conditions.
- **Graceful Feedback**: Attempting to execute an unavailable action produces an informational notification via the Unified Notification Center (`useNotificationStore`) rather than throwing an exception.

