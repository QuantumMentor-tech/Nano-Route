// ============================================================================
// Nano Route - Provider & Model Registry IPC Service
// File: src/services/ipc/registry.ts
// ============================================================================
// Authoritative frontend client for querying static provider and model
// descriptors and resolving effective configurations. Plaintext credentials NEVER enter.
// ============================================================================

import { safeInvoke, isTauriContext } from "./client.ts";
import {
  IPC_COMMANDS,
  type EffectiveProviderDto,
  type HistoricalModelDto,
  type ModelDescriptorDto,
  type ProviderDescriptorDto,
} from "./types.ts";
import { IpcError } from "./errors.ts";

// --- Built-in Mock Registry for Browser & Testing Environments ---

const BUILTIN_MOCK_PROVIDERS: ProviderDescriptorDto[] = [
  {
    providerId: "openai",
    displayName: "OpenAI",
    description: "Pioneer in frontier large language models, reasoning, and multimodal systems.",
    defaultBaseUrl: "https://api.openai.com/v1",
    documentationUrl: "https://platform.openai.com/docs",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "vision",
        "image_input",
        "tool_calling",
        "structured_output",
        "large_context",
        "code_generation",
        "reasoning",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "gpt-4o",
    credentialRequired: true,
  },
  {
    providerId: "anthropic",
    displayName: "Anthropic",
    description: "Creators of the Claude model family, known for steering, safety, and nuanced coding.",
    defaultBaseUrl: "https://api.anthropic.com",
    documentationUrl: "https://docs.anthropic.com",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "vision",
        "image_input",
        "tool_calling",
        "structured_output",
        "large_context",
        "code_generation",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "claude-3-5-sonnet-20241022",
    credentialRequired: true,
  },
  {
    providerId: "gemini",
    displayName: "Google Gemini",
    description: "Google DeepMind's native multimodal frontier models with up to 2M token context.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    documentationUrl: "https://ai.google.dev/docs",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "vision",
        "image_input",
        "audio_input",
        "tool_calling",
        "structured_output",
        "large_context",
        "code_generation",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "gemini-1.5-pro",
    credentialRequired: true,
  },
  {
    providerId: "deepseek",
    displayName: "DeepSeek",
    description: "High-performance open weights and API models specialized in math, code, and reasoning.",
    defaultBaseUrl: "https://api.deepseek.com",
    documentationUrl: "https://api-docs.deepseek.com",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "tool_calling",
        "structured_output",
        "code_generation",
        "large_context",
        "reasoning",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "deepseek-chat",
    credentialRequired: true,
  },
  {
    providerId: "groq",
    displayName: "Groq",
    description: "Hardware-accelerated LPU inference offering industry-leading tokens-per-second streaming.",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    documentationUrl: "https://console.groq.com/docs",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "tool_calling",
        "structured_output",
        "code_generation",
        "large_context",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "llama-3.3-70b-versatile",
    credentialRequired: true,
  },
  {
    providerId: "mistral",
    displayName: "Mistral AI",
    description: "European AI champion providing open and proprietary high-efficiency language models.",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    documentationUrl: "https://docs.mistral.ai",
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "tool_calling",
        "structured_output",
        "code_generation",
        "large_context",
      ],
    },
    implementationState: "implemented",
    lifecycleState: "active",
    defaultModelId: "mistral-large-latest",
    credentialRequired: true,
  },
  {
    providerId: "local",
    displayName: "Local SLM / Ollama",
    description: "Local privacy-preserving inference executed natively on CPU/GPU via Ollama or ONNX.",
    defaultBaseUrl: "http://localhost:11434",
    documentationUrl: "https://ollama.ai",
    capabilities: {
      capabilities: ["text_generation", "streaming", "system_messages", "code_generation"],
    },
    implementationState: "planned",
    lifecycleState: "active",
    defaultModelId: "llama3.2:3b",
    credentialRequired: false,
  },
  {
    providerId: "custom",
    displayName: "Custom Endpoint",
    description: "Generic OpenAI-compatible API endpoint (e.g. vLLM, LM Studio, self-hosted gateways).",
    defaultBaseUrl: "http://localhost:8000/v1",
    capabilities: {
      capabilities: ["text_generation", "streaming", "tool_calling", "structured_output"],
    },
    implementationState: "planned",
    lifecycleState: "active",
    credentialRequired: false,
  },
];

const BUILTIN_MOCK_MODELS: ModelDescriptorDto[] = [
  {
    providerId: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    description: "Omni-model supporting text, image, and high-speed execution.",
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    capabilities: {
      capabilities: ["text_generation", "streaming", "vision", "image_input", "large_context", "code_generation"],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    description: "Lightweight, cost-efficient model for fast, high-volume tasks.",
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    capabilities: {
      capabilities: ["text_generation", "streaming", "vision", "image_input", "large_context", "code_generation"],
    },
    availability: "Available",
    isDefault: false,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    description: "State-of-the-art model for complex analysis, software engineering, and vision.",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    capabilities: {
      capabilities: ["text_generation", "streaming", "vision", "image_input", "large_context", "code_generation"],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "gemini",
    modelId: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    description: "Massive 2M token context window for large codebases, video, and audio.",
    contextWindow: 2_000_000,
    maxOutputTokens: 8192,
    capabilities: {
      capabilities: [
        "text_generation",
        "streaming",
        "vision",
        "image_input",
        "audio_input",
        "large_context",
        "code_generation",
      ],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "deepseek",
    modelId: "deepseek-chat",
    displayName: "DeepSeek-V3",
    description: "General chat and programming model with strong multi-task performance.",
    contextWindow: 64_000,
    maxOutputTokens: 8192,
    capabilities: {
      capabilities: ["text_generation", "streaming", "code_generation", "large_context"],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "groq",
    modelId: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B (Groq LPU)",
    description: "Flagship Llama 3.3 executed with extreme speed on Groq LPUs.",
    contextWindow: 128_000,
    maxOutputTokens: 32768,
    capabilities: {
      capabilities: ["text_generation", "streaming", "code_generation", "large_context"],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "mistral",
    modelId: "mistral-large-latest",
    displayName: "Mistral Large",
    description: "Top-tier reasoning and coding model with multilingual mastery.",
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    capabilities: {
      capabilities: ["text_generation", "streaming", "code_generation", "large_context"],
    },
    availability: "Available",
    isDefault: true,
  },
  {
    providerId: "local",
    modelId: "llama3.2:3b",
    displayName: "Llama 3.2 3B (Local)",
    description: "Lightweight local SLM for zero-cost routing and private inference.",
    contextWindow: 8192,
    maxOutputTokens: 4096,
    capabilities: {
      capabilities: ["text_generation", "streaming", "system_messages"],
    },
    availability: "Available",
    isDefault: true,
  },
];

let mockProviders = [...BUILTIN_MOCK_PROVIDERS];
let mockModels = [...BUILTIN_MOCK_MODELS];

/**
 * Resets the in-memory mock registry to default built-in descriptors.
 */
export function resetMockRegistry(): void {
  mockProviders = [...BUILTIN_MOCK_PROVIDERS];
  mockModels = [...BUILTIN_MOCK_MODELS];
}

// --- Provider & Model Registry Client API ---

/**
 * Lists all registered provider descriptors in canonical catalog order.
 */
export async function listRegisteredProviders(): Promise<ProviderDescriptorDto[]> {
  if (!isTauriContext()) {
    return [...mockProviders];
  }
  return safeInvoke<ProviderDescriptorDto[]>(IPC_COMMANDS.LIST_REGISTERED_PROVIDERS);
}

/**
 * Retrieves a specific registered provider descriptor by its canonical ID.
 */
export async function getRegisteredProvider(providerId: string): Promise<ProviderDescriptorDto | null> {
  const trimmed = providerId.trim().toLowerCase();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Provider ID cannot be empty",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!isTauriContext()) {
    return mockProviders.find((p) => p.providerId === trimmed) ?? null;
  }

  return safeInvoke<ProviderDescriptorDto | null>(IPC_COMMANDS.GET_REGISTERED_PROVIDER, {
    providerId: trimmed,
  });
}

/**
 * Lists models registered under a specific provider, or all models if providerId is omitted.
 */
export async function listRegisteredModels(providerId?: string): Promise<ModelDescriptorDto[]> {
  if (!isTauriContext()) {
    if (providerId) {
      const trimmed = providerId.trim().toLowerCase();
      return mockModels.filter((m) => m.providerId === trimmed);
    }
    return [...mockModels];
  }

  return safeInvoke<ModelDescriptorDto[]>(IPC_COMMANDS.LIST_REGISTERED_MODELS, {
    providerId: providerId ? providerId.trim().toLowerCase() : undefined,
  });
}

/**
 * Retrieves a specific model descriptor by provider ID and model ID.
 */
export async function getRegisteredModel(
  providerId: string,
  modelId: string
): Promise<ModelDescriptorDto | null> {
  const trimmedProvider = providerId.trim().toLowerCase();
  const trimmedModel = modelId.trim();

  if (!trimmedProvider || !trimmedModel) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Provider ID and Model ID cannot be empty",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!isTauriContext()) {
    return (
      mockModels.find((m) => m.providerId === trimmedProvider && m.modelId === trimmedModel) ?? null
    );
  }

  return safeInvoke<ModelDescriptorDto | null>(IPC_COMMANDS.GET_REGISTERED_MODEL, {
    providerId: trimmedProvider,
    modelId: trimmedModel,
  });
}

/**
 * Resolves effective configurations for all registered providers, combining static
 * catalog facts with persisted user preferences and credential status.
 */
export async function resolveEffectiveProviders(): Promise<EffectiveProviderDto[]> {
  if (!isTauriContext()) {
    return mockProviders.map((p) => ({
      providerId: p.providerId,
      displayName: p.displayName,
      description: p.description,
      defaultBaseUrl: p.defaultBaseUrl,
      effectiveBaseUrl: p.defaultBaseUrl,
      documentationUrl: p.documentationUrl,
      isActive: true,
      priorityWeight: 5,
      monthlyBudgetLimit: null,
      currentMonthSpend: 0,
      isCredentialConfigured: false,
      credentialRequired: p.credentialRequired,
      implementationState: p.implementationState,
      lifecycleState: p.lifecycleState,
      defaultModelId: p.defaultModelId,
      models: mockModels.filter((m) => m.providerId === p.providerId),
    }));
  }

  return safeInvoke<EffectiveProviderDto[]>(IPC_COMMANDS.RESOLVE_EFFECTIVE_PROVIDERS);
}

/**
 * Resolves a historical model reference safely.
 * If the model is absent from the current active catalog, gracefully falls back
 * to displaying the raw model ID without crashing.
 */
export async function resolveHistoricalModel(
  providerId: string,
  modelId: string
): Promise<HistoricalModelDto> {
  const trimmedProvider = providerId.trim().toLowerCase();
  const trimmedModel = modelId.trim();

  if (!isTauriContext()) {
    const known = mockModels.find(
      (m) => m.providerId === trimmedProvider && m.modelId === trimmedModel
    );
    if (known) {
      return {
        providerId: trimmedProvider,
        modelId: trimmedModel,
        displayName: known.displayName,
        isKnownInActiveRegistry: true,
      };
    }
    return {
      providerId: trimmedProvider,
      modelId: trimmedModel,
      displayName: trimmedModel,
      isKnownInActiveRegistry: false,
    };
  }

  return safeInvoke<HistoricalModelDto>(IPC_COMMANDS.RESOLVE_HISTORICAL_MODEL, {
    providerId: trimmedProvider,
    modelId: trimmedModel,
  });
}
