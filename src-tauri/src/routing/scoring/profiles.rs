// ============================================================================
// Nano Route - Model Routing Profiles
// File: src-tauri/src/routing/scoring/profiles.rs
// ============================================================================
// Factual routing profiles defining tier, domain affinities, complexity
// affinities, and qualitative strengths for canonical catalog models.
// Provides structured heuristics without hardcoding provider logic in calculator.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::analysis::types::{TaskComplexity, TaskDomain};
use crate::classification::types::UserIntent;

/// Operational tier classification for candidate models.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelTier {
    Lightweight,
    Standard,
    Frontier,
    ReasoningSpecialist,
    CodeSpecialist,
}

impl ModelTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Lightweight => "lightweight",
            Self::Standard => "standard",
            Self::Frontier => "frontier",
            Self::ReasoningSpecialist => "reasoning_specialist",
            Self::CodeSpecialist => "code_specialist",
        }
    }
}

/// Structured routing profile for a model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelRoutingProfile {
    pub model_id: String,
    pub tier: ModelTier,
    pub primary_strengths: Vec<String>,
    pub domain_affinities: HashMap<String, f64>,
    pub complexity_affinities: HashMap<String, f64>,
    pub intent_affinities: HashMap<String, f64>,
    pub relative_cost_tier: u8,    // 1 (lowest) to 5 (highest)
    pub relative_latency_tier: u8, // 1 (fastest) to 5 (slowest)
    pub base_suitability: f64,
}

impl ModelRoutingProfile {
    /// Returns domain affinity score [0.0, 1.0], defaulting to neutral 0.5.
    pub fn get_domain_affinity(&self, domain: TaskDomain) -> f64 {
        self.domain_affinities
            .get(domain.as_str())
            .copied()
            .unwrap_or(0.5)
    }

    /// Returns complexity affinity score [0.0, 1.0], defaulting to neutral 0.5.
    pub fn get_complexity_affinity(&self, complexity: TaskComplexity) -> f64 {
        self.complexity_affinities
            .get(complexity.as_str())
            .copied()
            .unwrap_or(0.5)
    }

    /// Returns intent affinity score [0.0, 1.0], defaulting to neutral 0.5.
    pub fn get_intent_affinity(&self, intent: UserIntent) -> f64 {
        self.intent_affinities
            .get(intent.as_str())
            .copied()
            .unwrap_or(0.5)
    }
}

/// Registry of built-in routing profiles for canonical models.
pub struct BuiltinRoutingProfiles;

impl BuiltinRoutingProfiles {
    pub fn get_profile(model_id: &str) -> ModelRoutingProfile {
        match model_id.trim().to_lowercase().as_str() {
            // --- OpenAI ---
            "gpt-4o" => Self::gpt_4o(),
            "gpt-4o-mini" => Self::gpt_4o_mini(),
            "o1" | "o1-preview" => Self::o1(),

            // --- Anthropic ---
            m if m.starts_with("claude-3-5-sonnet") || m.contains("claude-3-5-sonnet") => {
                Self::claude_3_5_sonnet()
            }
            m if m.starts_with("claude-3-5-haiku") || m.contains("claude-3-5-haiku") => {
                Self::claude_3_5_haiku()
            }
            m if m.starts_with("claude-3-opus") || m.contains("claude-3-opus") => {
                Self::claude_3_opus()
            }

            // --- Google Gemini ---
            m if m.starts_with("gemini-1.5-pro") => Self::gemini_1_5_pro(),
            m if m.starts_with("gemini-1.5-flash") => Self::gemini_1_5_flash(),

            // --- DeepSeek ---
            "deepseek-chat" => Self::deepseek_chat(),
            "deepseek-reasoner" => Self::deepseek_reasoner(),

            // --- Groq ---
            m if m.contains("llama-3.3-70b") || m.contains("llama-3-70b") => {
                Self::groq_llama_3_3_70b()
            }

            // --- Mistral ---
            m if m.contains("mistral-large") => Self::mistral_large(),

            // Default fallback profile
            other => Self::default_profile(other),
        }
    }

    fn gpt_4o() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("software_engineering".to_string(), 0.95);
        domain_affinities.insert("mathematics".to_string(), 0.90);
        domain_affinities.insert("research".to_string(), 0.90);
        domain_affinities.insert("business".to_string(), 0.92);
        domain_affinities.insert("data_analysis".to_string(), 0.95);
        domain_affinities.insert("long_form_writing".to_string(), 0.88);
        domain_affinities.insert("general".to_string(), 0.90);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.60);
        complexity_affinities.insert("low".to_string(), 0.75);
        complexity_affinities.insert("moderate".to_string(), 0.95);
        complexity_affinities.insert("high".to_string(), 0.95);
        complexity_affinities.insert("very_high".to_string(), 0.90);
        complexity_affinities.insert("unknown".to_string(), 0.70);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("code_generation".to_string(), 0.95);
        intent_affinities.insert("code_explanation".to_string(), 0.92);
        intent_affinities.insert("math_logic_reasoning".to_string(), 0.90);
        intent_affinities.insert("in_depth_analysis".to_string(), 0.94);
        intent_affinities.insert("structured_data_transform".to_string(), 0.96);

        ModelRoutingProfile {
            model_id: "gpt-4o".to_string(),
            tier: ModelTier::Frontier,
            primary_strengths: vec![
                "Multimodal vision and text".to_string(),
                "High code generation quality".to_string(),
                "Strong structured JSON output".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 3,
            relative_latency_tier: 2,
            base_suitability: 0.88,
        }
    }

    fn gpt_4o_mini() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("general".to_string(), 0.92);
        domain_affinities.insert("education".to_string(), 0.88);
        domain_affinities.insert("translation".to_string(), 0.88);
        domain_affinities.insert("software_engineering".to_string(), 0.78);
        domain_affinities.insert("mathematics".to_string(), 0.70);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.98);
        complexity_affinities.insert("low".to_string(), 0.95);
        complexity_affinities.insert("moderate".to_string(), 0.80);
        complexity_affinities.insert("high".to_string(), 0.45);
        complexity_affinities.insert("very_high".to_string(), 0.25);
        complexity_affinities.insert("unknown".to_string(), 0.75);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("factual_lookup".to_string(), 0.96);
        intent_affinities.insert("conversational_chat".to_string(), 0.95);
        intent_affinities.insert("document_summary".to_string(), 0.88);
        intent_affinities.insert("language_translation".to_string(), 0.90);

        ModelRoutingProfile {
            model_id: "gpt-4o-mini".to_string(),
            tier: ModelTier::Lightweight,
            primary_strengths: vec![
                "Extremely low cost".to_string(),
                "Fast response latency".to_string(),
                "Efficient lightweight summarization and lookup".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 1,
            relative_latency_tier: 1,
            base_suitability: 0.80,
        }
    }

    fn o1() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("mathematics".to_string(), 0.99);
        domain_affinities.insert("software_engineering".to_string(), 0.98);
        domain_affinities.insert("research".to_string(), 0.96);
        domain_affinities.insert("data_analysis".to_string(), 0.94);
        domain_affinities.insert("general".to_string(), 0.60);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.20);
        complexity_affinities.insert("low".to_string(), 0.35);
        complexity_affinities.insert("moderate".to_string(), 0.75);
        complexity_affinities.insert("high".to_string(), 0.98);
        complexity_affinities.insert("very_high".to_string(), 1.00);
        complexity_affinities.insert("unknown".to_string(), 0.60);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("math_logic_reasoning".to_string(), 1.00);
        intent_affinities.insert("code_generation".to_string(), 0.96);
        intent_affinities.insert("in_depth_analysis".to_string(), 0.98);

        ModelRoutingProfile {
            model_id: "o1".to_string(),
            tier: ModelTier::ReasoningSpecialist,
            primary_strengths: vec![
                "Deep chain-of-thought mathematical reasoning".to_string(),
                "Complex algorithmic proof and debugging".to_string(),
                "Multi-step STEM logical synthesis".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 5,
            relative_latency_tier: 5,
            base_suitability: 0.85,
        }
    }

    fn claude_3_5_sonnet() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("software_engineering".to_string(), 0.99);
        domain_affinities.insert("technical_documentation".to_string(), 0.98);
        domain_affinities.insert("long_form_writing".to_string(), 0.96);
        domain_affinities.insert("research".to_string(), 0.94);
        domain_affinities.insert("business".to_string(), 0.92);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.55);
        complexity_affinities.insert("low".to_string(), 0.70);
        complexity_affinities.insert("moderate".to_string(), 0.95);
        complexity_affinities.insert("high".to_string(), 0.99);
        complexity_affinities.insert("very_high".to_string(), 0.95);
        complexity_affinities.insert("unknown".to_string(), 0.70);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("code_generation".to_string(), 0.99);
        intent_affinities.insert("code_explanation".to_string(), 0.98);
        intent_affinities.insert("in_depth_analysis".to_string(), 0.96);
        intent_affinities.insert("creative_writing".to_string(), 0.92);

        ModelRoutingProfile {
            model_id: "claude-3-5-sonnet-20241022".to_string(),
            tier: ModelTier::Frontier,
            primary_strengths: vec![
                "Industry-leading code generation and architecture".to_string(),
                "Nuanced prose and technical documentation".to_string(),
                "Deep contextual understanding".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 3,
            relative_latency_tier: 2,
            base_suitability: 0.90,
        }
    }

    fn claude_3_5_haiku() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("software_engineering".to_string(), 0.85);
        domain_affinities.insert("general".to_string(), 0.90);
        domain_affinities.insert("translation".to_string(), 0.90);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.98);
        complexity_affinities.insert("low".to_string(), 0.95);
        complexity_affinities.insert("moderate".to_string(), 0.85);
        complexity_affinities.insert("high".to_string(), 0.50);
        complexity_affinities.insert("very_high".to_string(), 0.30);
        complexity_affinities.insert("unknown".to_string(), 0.75);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("factual_lookup".to_string(), 0.95);
        intent_affinities.insert("conversational_chat".to_string(), 0.94);
        intent_affinities.insert("document_summary".to_string(), 0.90);

        ModelRoutingProfile {
            model_id: "claude-3-5-haiku-20241022".to_string(),
            tier: ModelTier::Lightweight,
            primary_strengths: vec![
                "Sub-second latency with high precision".to_string(),
                "Cost-effective code and text processing".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 1,
            relative_latency_tier: 1,
            base_suitability: 0.82,
        }
    }

    fn claude_3_opus() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("research".to_string(), 0.98);
        domain_affinities.insert("long_form_writing".to_string(), 0.99);
        domain_affinities.insert("creative".to_string(), 0.98);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.30);
        complexity_affinities.insert("low".to_string(), 0.50);
        complexity_affinities.insert("moderate".to_string(), 0.85);
        complexity_affinities.insert("high".to_string(), 0.98);
        complexity_affinities.insert("very_high".to_string(), 0.98);
        complexity_affinities.insert("unknown".to_string(), 0.65);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("creative_writing".to_string(), 0.98);
        intent_affinities.insert("in_depth_analysis".to_string(), 0.98);

        ModelRoutingProfile {
            model_id: "claude-3-opus-20240229".to_string(),
            tier: ModelTier::Frontier,
            primary_strengths: vec![
                "Profound contextual depth".to_string(),
                "Creative synthesis and complex literary prose".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 5,
            relative_latency_tier: 4,
            base_suitability: 0.85,
        }
    }

    fn gemini_1_5_pro() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("research".to_string(), 0.98);
        domain_affinities.insert("data_analysis".to_string(), 0.96);
        domain_affinities.insert("technical_documentation".to_string(), 0.95);
        domain_affinities.insert("software_engineering".to_string(), 0.92);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.50);
        complexity_affinities.insert("low".to_string(), 0.70);
        complexity_affinities.insert("moderate".to_string(), 0.92);
        complexity_affinities.insert("high".to_string(), 0.97);
        complexity_affinities.insert("very_high".to_string(), 0.98);
        complexity_affinities.insert("unknown".to_string(), 0.70);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("in_depth_analysis".to_string(), 0.98);
        intent_affinities.insert("document_summary".to_string(), 0.98);

        ModelRoutingProfile {
            model_id: "gemini-1.5-pro-latest".to_string(),
            tier: ModelTier::Frontier,
            primary_strengths: vec![
                "2M token massive context window".to_string(),
                "Extensive document and repository ingestion".to_string(),
                "Multimodal video, audio, and visual reasoning".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 3,
            relative_latency_tier: 3,
            base_suitability: 0.88,
        }
    }

    fn gemini_1_5_flash() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("general".to_string(), 0.92);
        domain_affinities.insert("translation".to_string(), 0.92);
        domain_affinities.insert("education".to_string(), 0.88);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.98);
        complexity_affinities.insert("low".to_string(), 0.95);
        complexity_affinities.insert("moderate".to_string(), 0.82);
        complexity_affinities.insert("high".to_string(), 0.50);
        complexity_affinities.insert("very_high".to_string(), 0.30);
        complexity_affinities.insert("unknown".to_string(), 0.75);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("factual_lookup".to_string(), 0.96);
        intent_affinities.insert("document_summary".to_string(), 0.94);

        ModelRoutingProfile {
            model_id: "gemini-1.5-flash-latest".to_string(),
            tier: ModelTier::Lightweight,
            primary_strengths: vec![
                "High speed multimodal execution".to_string(),
                "1M token context at lightweight pricing".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 1,
            relative_latency_tier: 1,
            base_suitability: 0.82,
        }
    }

    fn deepseek_chat() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("software_engineering".to_string(), 0.94);
        domain_affinities.insert("mathematics".to_string(), 0.92);
        domain_affinities.insert("general".to_string(), 0.90);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.75);
        complexity_affinities.insert("low".to_string(), 0.85);
        complexity_affinities.insert("moderate".to_string(), 0.94);
        complexity_affinities.insert("high".to_string(), 0.92);
        complexity_affinities.insert("very_high".to_string(), 0.88);
        complexity_affinities.insert("unknown".to_string(), 0.75);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("code_generation".to_string(), 0.95);
        intent_affinities.insert("conversational_chat".to_string(), 0.92);

        ModelRoutingProfile {
            model_id: "deepseek-chat".to_string(),
            tier: ModelTier::Standard,
            primary_strengths: vec![
                "Remarkable reasoning-to-cost ratio".to_string(),
                "Strong coding and mathematical capability".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 1,
            relative_latency_tier: 2,
            base_suitability: 0.85,
        }
    }

    fn deepseek_reasoner() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("mathematics".to_string(), 0.98);
        domain_affinities.insert("software_engineering".to_string(), 0.96);
        domain_affinities.insert("research".to_string(), 0.95);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.25);
        complexity_affinities.insert("low".to_string(), 0.40);
        complexity_affinities.insert("moderate".to_string(), 0.80);
        complexity_affinities.insert("high".to_string(), 0.98);
        complexity_affinities.insert("very_high".to_string(), 1.00);
        complexity_affinities.insert("unknown".to_string(), 0.65);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("math_logic_reasoning".to_string(), 0.99);
        intent_affinities.insert("code_generation".to_string(), 0.95);

        ModelRoutingProfile {
            model_id: "deepseek-reasoner".to_string(),
            tier: ModelTier::ReasoningSpecialist,
            primary_strengths: vec![
                "Affordable deep reasoning and chain-of-thought".to_string(),
                "Math competition and logical problem solving".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 2,
            relative_latency_tier: 4,
            base_suitability: 0.85,
        }
    }

    fn groq_llama_3_3_70b() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("general".to_string(), 0.92);
        domain_affinities.insert("software_engineering".to_string(), 0.88);
        domain_affinities.insert("business".to_string(), 0.88);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.90);
        complexity_affinities.insert("low".to_string(), 0.92);
        complexity_affinities.insert("moderate".to_string(), 0.90);
        complexity_affinities.insert("high".to_string(), 0.80);
        complexity_affinities.insert("very_high".to_string(), 0.65);
        complexity_affinities.insert("unknown".to_string(), 0.75);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("conversational_chat".to_string(), 0.96);
        intent_affinities.insert("factual_lookup".to_string(), 0.94);

        ModelRoutingProfile {
            model_id: "llama-3.3-70b-versatile".to_string(),
            tier: ModelTier::Standard,
            primary_strengths: vec![
                "LPU hardware-accelerated ultra-low latency".to_string(),
                "Strong open-weights reasoning capability".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 2,
            relative_latency_tier: 1,
            base_suitability: 0.85,
        }
    }

    fn mistral_large() -> ModelRoutingProfile {
        let mut domain_affinities = HashMap::new();
        domain_affinities.insert("software_engineering".to_string(), 0.92);
        domain_affinities.insert("translation".to_string(), 0.96);
        domain_affinities.insert("business".to_string(), 0.90);
        domain_affinities.insert("technical_documentation".to_string(), 0.92);

        let mut complexity_affinities = HashMap::new();
        complexity_affinities.insert("trivial".to_string(), 0.55);
        complexity_affinities.insert("low".to_string(), 0.72);
        complexity_affinities.insert("moderate".to_string(), 0.92);
        complexity_affinities.insert("high".to_string(), 0.95);
        complexity_affinities.insert("very_high".to_string(), 0.90);
        complexity_affinities.insert("unknown".to_string(), 0.70);

        let mut intent_affinities = HashMap::new();
        intent_affinities.insert("language_translation".to_string(), 0.98);
        intent_affinities.insert("code_generation".to_string(), 0.92);

        ModelRoutingProfile {
            model_id: "mistral-large-latest".to_string(),
            tier: ModelTier::Frontier,
            primary_strengths: vec![
                "Frontier multilingual reasoning and European language mastery".to_string(),
                "Native JSON output and function calling".to_string(),
            ],
            domain_affinities,
            complexity_affinities,
            intent_affinities,
            relative_cost_tier: 3,
            relative_latency_tier: 3,
            base_suitability: 0.86,
        }
    }

    fn default_profile(model_id: &str) -> ModelRoutingProfile {
        ModelRoutingProfile {
            model_id: model_id.to_string(),
            tier: ModelTier::Standard,
            primary_strengths: vec!["General purpose text processing".to_string()],
            domain_affinities: HashMap::new(),
            complexity_affinities: HashMap::new(),
            intent_affinities: HashMap::new(),
            relative_cost_tier: 3,
            relative_latency_tier: 3,
            base_suitability: 0.75,
        }
    }
}

