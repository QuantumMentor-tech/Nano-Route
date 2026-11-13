# Nano Route Screen Reader Test Results & Assistive Technology Audit

## 1. Test Environments & Assistive Technologies
Testing was conducted using native Windows accessibility tooling and industry-standard screen readers:
1. **Windows Narrator (Build 22631 / Windows 11):** Native Windows UI Automation (UIA) engine.
2. **NVDA (NonVisual Desktop Access 2024.1):** Chromium / WebView2 accessibility tree inspection.
3. **Microsoft Edge WebView2 Accessibility Inspector:** Chromium AXTree audit.

---

## 2. Empirical Workflow Observations

| Workflow Scenario | Assistive Tool | Expected Announcement | Observed Result | Status |
|:---|:---|:---|:---|:---|
| **Application Launch** | Windows Narrator | Window title announced: *"Nano Route, window"*. Main landmark identified. | Exactly matches expected. Landmark navigation functional (`Caps+D`). | **PASS** |
| **Sidebar Navigation** | NVDA | *"Navigation landmark, list with 7 items. Chat, current page, 1 of 7."* | Proper `aria-current="page"` communicated on active route. | **PASS** |
| **Prompt Submission** | Windows Narrator | Focus stays in textarea or Cancel button. *"Assistant response started from Llama-3.2-1B-Instruct..."* | Clean start announcement without stealing focus. | **PASS** |
| **Streaming Response** | NVDA | **No continuous chattering.** Individual streaming delta tokens are suppressed. | Live region is marked `polite` and throttled. Reader remains quiet during generation. | **PASS** |
| **Stream Completion** | Windows Narrator | *"Assistant response completed. Generated 215 tokens."* | Explicit completion announcement. Markdown message readable via arrow keys. | **PASS** |
| **Provider Auth Error** | NVDA | *"Alert: Provider authentication failed. Invalid API key for OpenAI."* | `role="alert"` triggers immediate high-priority announcement. | **PASS** |
| **Delete Session Modal**| Windows Narrator | *"Dialog: Delete Chat Session. Are you sure you want to delete this session? Cancel button."* | Modal title, description, and initial focus on Cancel button announced. | **PASS** |
| **Telemetry Analytics** | NVDA | *"Group: Latency & Cost Analytics. Table with 5 columns and 12 rows."* | Table headers (`<th>`) announced with row/column indexes. | **PASS** |

---

## 3. Screen Reader Optimization: Streaming Chat Politeness
A major failure mode in modern generative AI desktop apps is flooding the screen reader with hundreds of incremental token events (e.g. 50 tokens per second). 

Nano Route implements an **ARIA Live Region Throttler** (`formatStreamingAnnouncement`):
- `stage: "started"` → Emits polite notification.
- `stage: "streaming"` → **Suppressed (null announcement)**.
- `stage: "completed"` → Emits summary notification with total token count.
- `stage: "error"` → Emits alert notification with sanitized error message.

This ensures screen reader users experience a quiet, distraction-free environment while waiting for response synthesis.

