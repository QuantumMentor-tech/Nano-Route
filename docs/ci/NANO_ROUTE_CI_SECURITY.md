# Nano Route CI/CD Security & Least-Privilege Architecture (Step 57)

## 1. Secrets Isolation Policy

The CI/CD pipeline enforces strict credential isolation:

1. **No Ambient Signing Keys**:
   - Windows code signing certificates (`.pfx`) and credentials are never stored in repository files or exposed to standard PR builds.
   - Production signing occurs exclusively on dedicated, authenticated release runners.
2. **Zero Provider Secrets in CI**:
   - Continuous integration test suites operate 100% against mock in-memory stores and deterministic fixtures.
   - No real OpenAI, Anthropic, or Gemini API keys are configured in CI secrets.
3. **Workflow Token Permissions**:
   - Standard GitHub Actions workflows specify `permissions: contents: read` to prevent unprivileged token escalation or unauthorized repository modifications.

