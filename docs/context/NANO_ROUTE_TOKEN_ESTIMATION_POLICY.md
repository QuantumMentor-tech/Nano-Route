# Nano Route — Token Estimation Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Token Estimator, Cache Layer, Privacy Boundary  

---

## 1. Local Estimation Heuristic

To prevent latency penalties and protect user privacy, Nano Route implements an offline, bounded token estimation heuristic:

$$\text{Tokens}_{\text{text}} = \left\lceil \frac{\text{Length}(\text{chars})}{3.8} \right\rceil$$

### Framing Overhead
In conversational LLM APIs (OpenAI chat format, Anthropic messages, etc.), message roles and metadata incur structural delimiters. Nano Route attaches **+4 framing tokens** to every message turn and system instruction:

$$\text{Tokens}_{\text{message}} = \text{Tokens}_{\text{text}}(\text{content}) + 4$$

$$\text{Tokens}_{\text{input}} = \text{Tokens}_{\text{prompt}} + \text{Tokens}_{\text{system}} + \sum_{i=1}^{M} \text{Tokens}_{\text{history\_message}_i}$$

---

## 2. Confidence State Classification

| Confidence State | Semantics |
| :--- | :--- |
| **`EXACT`** | Counted using a native, local BPE tokenizer corresponding to the model. |
| **`HIGH_CONFIDENCE_ESTIMATE`** | Verified algorithmic approximation calibrated against the model family. |
| **`APPROXIMATE`** | Standard ~3.8 chars/token heuristic with protocol framing overhead. Preflight UI displays `~` prefix. |
| **`UNAVAILABLE`** | Content cannot be estimated; non-zero safe fallback applied. |

---

## 3. Immutable Token Cache Strategy

Token estimation on long conversation threads can be CPU-intensive if re-evaluated repeatedly. Nano Route maintains an immutable in-memory cache:
- **Cache Key**: `msg_<messageId>_<contentHash>` or `raw_<contentHash>`.
- **Capacity**: Bounded to 5,000 entries with LRU-style batch eviction.
- **Cache Invalidation**:
  - Editing an earlier message invalidates entries matching `msg_<messageId>_*`.
  - Clearing history clears the entire cache.
  - Model changes do not invalidate message character counts, only headroom evaluations.

