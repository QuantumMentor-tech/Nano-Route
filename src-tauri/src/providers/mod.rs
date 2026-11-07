//! Nano Route — AI Provider Abstraction & Adapters
//!
//! Responsibility:
//! - Standardized Provider trait defining streaming and completion contracts.
//! - Concrete provider adapters (Anthropic, OpenAI, Gemini, Groq, Local endpoints).
//! - Must NOT define global routing policy or choose between models.

