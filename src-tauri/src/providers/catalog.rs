// ============================================================================
// Nano Route - Built-in Canonical Provider & Model Catalog
// File: src-tauri/src/providers/catalog.rs
// ============================================================================
// Authoritative, immutable compile-time catalog defining built-in providers
// and factual model descriptors. Contains no routing heuristics or secrets.
// ============================================================================

use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::descriptor::{
    ProviderDescriptor, ProviderImplementationState, ProviderLifecycleState,
};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};

/// Produces the complete catalog of built-in providers and models.
pub fn builtin_catalog() -> (Vec<ProviderDescriptor>, Vec<ProviderModel>) {
    let mut providers = Vec::new();
    let mut models = Vec::new();

    // ------------------------------------------------------------------------
    // 1. OpenAI
    // ------------------------------------------------------------------------
    let openai_id = ProviderId::new(ProviderId::OPENAI).unwrap();
    let openai_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::Vision)
        .with_capability(ProviderCapability::ImageInput)
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::LargeContext)
        .with_capability(ProviderCapability::CodeGeneration)
        .with_capability(ProviderCapability::Reasoning);

    let openai_desc = ProviderDescriptor::new(
        openai_id.clone(),
        "OpenAI",
        "Pioneer in frontier large language models, reasoning, and multimodal systems.",
        "https://api.openai.com/v1",
        openai_caps,
    )
    .with_documentation_url("https://platform.openai.com/docs")
    .with_default_model("gpt-4o")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(openai_desc);

    models.push(
        ProviderModel::new(
            openai_id.clone(),
            "gpt-4o",
            "GPT-4o",
            128_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Omni-model supporting text, image, and high-speed execution.")
        .with_pricing(ModelPricing::usd(2.50, 10.00))
        .with_max_output_tokens(4096)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            openai_id.clone(),
            "gpt-4o-mini",
            "GPT-4o mini",
            128_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Lightweight, cost-efficient model for fast, high-volume tasks.")
        .with_pricing(ModelPricing::usd(0.15, 0.60))
        .with_max_output_tokens(16384),
    );

    models.push(
        ProviderModel::new(
            openai_id.clone(),
            "o1",
            "o1 Reasoning",
            200_000,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::Reasoning,
                ProviderCapability::StructuredOutput,
                ProviderCapability::SystemMessages,
                ProviderCapability::CodeGeneration,
                ProviderCapability::LargeContext,
            ]),
        )
        .with_description("Advanced reasoning model for complex STEM, logic, and multi-step reasoning.")
        .with_pricing(ModelPricing::usd(15.00, 60.00))
        .with_max_output_tokens(100_000),
    );

    models.push(
        ProviderModel::new(
            openai_id.clone(),
            "o3-mini",
            "o3-mini",
            200_000,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::Reasoning,
                ProviderCapability::StructuredOutput,
                ProviderCapability::SystemMessages,
                ProviderCapability::CodeGeneration,
                ProviderCapability::LargeContext,
            ]),
        )
        .with_description("Fast, cost-effective reasoning model optimized for coding and math.")
        .with_pricing(ModelPricing::usd(1.10, 4.40))
        .with_max_output_tokens(100_000),
    );

    // ------------------------------------------------------------------------
    // 2. Anthropic
    // ------------------------------------------------------------------------
    let anthropic_id = ProviderId::new(ProviderId::ANTHROPIC).unwrap();
    let anthropic_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::Vision)
        .with_capability(ProviderCapability::ImageInput)
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::LargeContext)
        .with_capability(ProviderCapability::CodeGeneration);

    let anthropic_desc = ProviderDescriptor::new(
        anthropic_id.clone(),
        "Anthropic",
        "Creators of the Claude model family, known for steering, safety, and nuanced coding.",
        "https://api.anthropic.com",
        anthropic_caps,
    )
    .with_documentation_url("https://docs.anthropic.com")
    .with_default_model("claude-3-5-sonnet-20241022")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(anthropic_desc);

    models.push(
        ProviderModel::new(
            anthropic_id.clone(),
            "claude-3-5-sonnet-20241022",
            "Claude 3.5 Sonnet",
            200_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("State-of-the-art model for complex analysis, software engineering, and vision.")
        .with_pricing(ModelPricing::usd(3.00, 15.00))
        .with_max_output_tokens(8192)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            anthropic_id.clone(),
            "claude-3-5-haiku-20241022",
            "Claude 3.5 Haiku",
            200_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Fast, lightweight model with high intelligence and near-instant responsiveness.")
        .with_pricing(ModelPricing::usd(0.80, 4.00))
        .with_max_output_tokens(8192),
    );

    models.push(
        ProviderModel::new(
            anthropic_id.clone(),
            "claude-3-opus-20240229",
            "Claude 3 Opus",
            200_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext),
        )
        .with_description("High-capability foundational model for deep research and writing.")
        .with_pricing(ModelPricing::usd(15.00, 75.00))
        .with_max_output_tokens(4096),
    );

    // ------------------------------------------------------------------------
    // 3. Google Gemini
    // ------------------------------------------------------------------------
    let gemini_id = ProviderId::new(ProviderId::GEMINI).unwrap();
    let gemini_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::Vision)
        .with_capability(ProviderCapability::ImageInput)
        .with_capability(ProviderCapability::AudioInput)
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::LargeContext)
        .with_capability(ProviderCapability::CodeGeneration);

    let gemini_desc = ProviderDescriptor::new(
        gemini_id.clone(),
        "Google Gemini",
        "Google DeepMind's native multimodal frontier models with up to 2M token context.",
        "https://generativelanguage.googleapis.com",
        gemini_caps,
    )
    .with_documentation_url("https://ai.google.dev/docs")
    .with_default_model("gemini-1.5-pro")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(gemini_desc);

    models.push(
        ProviderModel::new(
            gemini_id.clone(),
            "gemini-1.5-pro",
            "Gemini 1.5 Pro",
            2_000_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::AudioInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Massive 2M token context window for large codebases, video, and audio.")
        .with_pricing(ModelPricing::usd(1.25, 5.00))
        .with_max_output_tokens(8192)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            gemini_id.clone(),
            "gemini-1.5-flash",
            "Gemini 1.5 Flash",
            1_000_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::AudioInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Ultra-fast multimodal model built for low latency and high frequency tasks.")
        .with_pricing(ModelPricing::usd(0.075, 0.30))
        .with_max_output_tokens(8192),
    );

    models.push(
        ProviderModel::new(
            gemini_id.clone(),
            "gemini-2.0-flash-exp",
            "Gemini 2.0 Flash (Experimental)",
            1_000_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::Vision)
                .with_capability(ProviderCapability::ImageInput)
                .with_capability(ProviderCapability::LargeContext)
                .with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Next-generation multimodal model with enhanced speed and native tool use.")
        .with_pricing(ModelPricing::usd(0.10, 0.40))
        .with_max_output_tokens(8192)
        .with_availability(ModelAvailability::Preview),
    );

    // ------------------------------------------------------------------------
    // 4. DeepSeek
    // ------------------------------------------------------------------------
    let deepseek_id = ProviderId::new(ProviderId::DEEPSEEK).unwrap();
    let deepseek_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::CodeGeneration)
        .with_capability(ProviderCapability::LargeContext)
        .with_capability(ProviderCapability::Reasoning);

    let deepseek_desc = ProviderDescriptor::new(
        deepseek_id.clone(),
        "DeepSeek",
        "High-performance open weights and API models specialized in math, code, and reasoning.",
        "https://api.deepseek.com",
        deepseek_caps,
    )
    .with_documentation_url("https://api-docs.deepseek.com")
    .with_default_model("deepseek-chat")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(deepseek_desc);

    models.push(
        ProviderModel::new(
            deepseek_id.clone(),
            "deepseek-chat",
            "DeepSeek-V3",
            64_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::CodeGeneration)
                .with_capability(ProviderCapability::LargeContext),
        )
        .with_description("General chat and programming model with strong multi-task performance.")
        .with_pricing(ModelPricing::usd(0.27, 1.10))
        .with_max_output_tokens(8192)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            deepseek_id.clone(),
            "deepseek-reasoner",
            "DeepSeek-R1",
            64_000,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::Reasoning,
                ProviderCapability::StructuredOutput,
                ProviderCapability::SystemMessages,
                ProviderCapability::CodeGeneration,
            ]),
        )
        .with_description("Open reasoning model with transparent chain-of-thought tokens.")
        .with_pricing(ModelPricing::usd(0.55, 2.19))
        .with_max_output_tokens(8192),
    );

    // ------------------------------------------------------------------------
    // 5. Groq
    // ------------------------------------------------------------------------
    let groq_id = ProviderId::new(ProviderId::GROQ).unwrap();
    let groq_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::CodeGeneration)
        .with_capability(ProviderCapability::LargeContext);

    let groq_desc = ProviderDescriptor::new(
        groq_id.clone(),
        "Groq",
        "Hardware-accelerated LPU inference offering industry-leading tokens-per-second streaming.",
        "https://api.groq.com/openai/v1",
        groq_caps,
    )
    .with_documentation_url("https://console.groq.com/docs")
    .with_default_model("llama-3.3-70b-versatile")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(groq_desc);

    models.push(
        ProviderModel::new(
            groq_id.clone(),
            "llama-3.3-70b-versatile",
            "Llama 3.3 70B (Groq LPU)",
            128_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::CodeGeneration)
                .with_capability(ProviderCapability::LargeContext),
        )
        .with_description("Flagship Llama 3.3 executed with extreme speed on Groq LPUs.")
        .with_pricing(ModelPricing::usd(0.59, 0.79))
        .with_max_output_tokens(32768)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            groq_id.clone(),
            "llama-3.1-8b-instant",
            "Llama 3.1 8B (Groq LPU)",
            128_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::CodeGeneration)
                .with_capability(ProviderCapability::LargeContext),
        )
        .with_description("Ultra-low-latency 8B model for rapid routing and sub-second generation.")
        .with_pricing(ModelPricing::usd(0.05, 0.08))
        .with_max_output_tokens(8192),
    );

    // ------------------------------------------------------------------------
    // 6. Mistral AI
    // ------------------------------------------------------------------------
    let mistral_id = ProviderId::new(ProviderId::MISTRAL).unwrap();
    let mistral_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput)
        .with_capability(ProviderCapability::CodeGeneration)
        .with_capability(ProviderCapability::LargeContext);

    let mistral_desc = ProviderDescriptor::new(
        mistral_id.clone(),
        "Mistral AI",
        "European AI champion providing open and proprietary high-efficiency language models.",
        "https://api.mistral.ai/v1",
        mistral_caps,
    )
    .with_documentation_url("https://docs.mistral.ai")
    .with_default_model("mistral-large-latest")
    .with_implementation_state(ProviderImplementationState::Implemented);
    providers.push(mistral_desc);

    models.push(
        ProviderModel::new(
            mistral_id.clone(),
            "mistral-large-latest",
            "Mistral Large",
            128_000,
            ProviderCapabilities::standard_chat()
                .with_capability(ProviderCapability::CodeGeneration)
                .with_capability(ProviderCapability::LargeContext),
        )
        .with_description("Top-tier reasoning and coding model with multilingual mastery.")
        .with_pricing(ModelPricing::usd(2.00, 6.00))
        .with_max_output_tokens(8192)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            mistral_id.clone(),
            "mistral-small-latest",
            "Mistral Small",
            32_000,
            ProviderCapabilities::standard_chat().with_capability(ProviderCapability::CodeGeneration),
        )
        .with_description("Fast, lightweight model for everyday coding and conversational tasks.")
        .with_pricing(ModelPricing::usd(0.20, 0.60))
        .with_max_output_tokens(8192),
    );

    models.push(
        ProviderModel::new(
            mistral_id.clone(),
            "codestral-latest",
            "Codestral",
            256_000,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::CodeGeneration,
                ProviderCapability::SystemMessages,
                ProviderCapability::LargeContext,
            ]),
        )
        .with_description("Specialized code generation model with a 256k token context window.")
        .with_pricing(ModelPricing::usd(0.20, 0.60))
        .with_max_output_tokens(8192),
    );

    // ------------------------------------------------------------------------
    // 7. Local SLM / Ollama
    // ------------------------------------------------------------------------
    let local_id = ProviderId::new(ProviderId::LOCAL).unwrap();
    let local_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::CodeGeneration);

    let local_desc = ProviderDescriptor::new(
        local_id.clone(),
        "Local SLM / Ollama",
        "Local privacy-preserving inference executed natively on CPU/GPU via Ollama or ONNX.",
        "http://localhost:11434",
        local_caps,
    )
    .with_documentation_url("https://ollama.ai")
    .with_default_model("llama3.2:3b")
    .with_implementation_state(ProviderImplementationState::Planned)
    .with_credential_required(false); // No DPAPI API key needed for local execution
    providers.push(local_desc);

    models.push(
        ProviderModel::new(
            local_id.clone(),
            "llama3.2:3b",
            "Llama 3.2 3B (Local)",
            8192,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::SystemMessages,
            ]),
        )
        .with_description("Lightweight local SLM for zero-cost routing and private inference.")
        .with_pricing(ModelPricing::usd(0.00, 0.00))
        .with_max_output_tokens(4096)
        .with_default(true),
    );

    models.push(
        ProviderModel::new(
            local_id.clone(),
            "qwen2.5-coder:7b",
            "Qwen 2.5 Coder 7B (Local)",
            32768,
            ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::CodeGeneration,
                ProviderCapability::SystemMessages,
            ]),
        )
        .with_description("Capable local programming model with 32k context.")
        .with_pricing(ModelPricing::usd(0.00, 0.00))
        .with_max_output_tokens(8192),
    );

    // ------------------------------------------------------------------------
    // 8. Custom Endpoint (OpenAI-compatible)
    // ------------------------------------------------------------------------
    let custom_id = ProviderId::new(ProviderId::CUSTOM).unwrap();
    let custom_caps = ProviderCapabilities::standard_chat()
        .with_capability(ProviderCapability::ToolCalling)
        .with_capability(ProviderCapability::StructuredOutput);

    let custom_desc = ProviderDescriptor::new(
        custom_id.clone(),
        "Custom Endpoint",
        "Generic OpenAI-compatible API endpoint (e.g. vLLM, LM Studio, self-hosted gateways).",
        "http://localhost:8000/v1",
        custom_caps,
    )
    .with_implementation_state(ProviderImplementationState::Planned)
    .with_credential_required(false);
    providers.push(custom_desc);

    (providers, models)
}

