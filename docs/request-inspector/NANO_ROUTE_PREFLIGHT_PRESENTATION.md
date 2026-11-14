# Nano Route — Preflight Presentation & Synthesis

## 1. Unified Preflight Metrics
The Request Inspector synthesizes multi-engine preflight data into an intuitive summary:
- **Total Required Tokens:** Sum of estimated input tokens + target completion tokens.
- **Context Window Utilization:** Visual percentage bar showing input footprint vs model capacity.
- **Available Headroom:** Exact token count remaining before reaching max context limits.
- **Estimated Request Cost:** Approximated USD cost based on model pricing tables.
- **Monthly Spend Posture:** Current recorded period spend against configured budget guardrails.

## 2. Severity Classification
- **READY (Green):** All preflight evaluations passed cleanly with zero warnings.
- **WARNING (Amber):** Request is submissible, but non-blocking notices exist (e.g. approaching context limits, budget threshold reached, or private notes included).
- **BLOCKED (Red):** Request violates authoritative guardrails (context limit exceeded, hard budget cap, or unreadable attachments). Submission button is disabled with explanatory tooltips.

