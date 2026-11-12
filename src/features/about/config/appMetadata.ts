/**
 * Nano Route — Application Metadata & Support Configuration
 * File: src/features/about/config/appMetadata.ts
 *
 * Single authoritative source of truth for product identity, versioning,
 * architecture, open-source notices, and official contact channels.
 */

export interface AppMetadata {
  name: string;
  version: string;
  buildChannel: string;
  environment: string;
  tagline: string;
  description: string;
  copyright: string;
  author: string;
  license: string;
  platform: string;
  architecture: string;
  coreRuntime: string;
  storageEngine: string;
  vaultEngine: string;
  slmInferenceEngine: string;
}

export const APP_METADATA: AppMetadata = {
  name: "Nano Route",
  version: "0.1.0",
  buildChannel: "Alpha Development",
  environment: "Local-First Desktop Core",
  tagline: "Intelligent Local SLM Routing • Multi-Provider Dispatch • Windows-First Desktop AI Architecture",
  description:
    "Nano Route is a high-performance, local-first Windows desktop AI orchestration application. It uses a lightweight, locally executed Small Language Model (SLM) router to analyze user prompts and tasks, classify requirements, and intelligently dispatch them to configured frontier AI providers (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, Mistral, and local endpoints) while preserving local telemetry and credential protection.",
  copyright: "Copyright (c) 2026 Nano Route Engineering",
  author: "Nano Route Engineering",
  license: "MIT License",
  platform: "Windows Desktop (x86_64, Windows 10 / 11)",
  architecture: "Tauri v2 + Rust Native Core + React 18 / TypeScript",
  coreRuntime: "Rust Native Core (Tokio Async)",
  storageEngine: "Embedded SQLite 3 (WAL Mode, Zero Arbitrary SQL)",
  vaultEngine: "Windows DPAPI (CryptProtectData OS-Level Encryption)",
  slmInferenceEngine: "ONNX Runtime (DirectML / CPU Local Execution)",
};

export interface OpenSourceNotice {
  name: string;
  version: string;
  license: string;
  purpose: string;
  url?: string;
}

export const OPEN_SOURCE_NOTICES: OpenSourceNotice[] = [
  {
    name: "Tauri v2",
    version: "2.1",
    license: "MIT / Apache-2.0",
    purpose: "Native Windows desktop host, system tray, window lifecycle & secure IPC boundary",
  },
  {
    name: "React 18",
    version: "18.3",
    license: "MIT",
    purpose: "Component-driven declarative desktop presentation layer & accessible state rendering",
  },
  {
    name: "TypeScript",
    version: "5.6",
    license: "Apache-2.0",
    purpose: "Strict compile-time type safety across domain models, DTOs, and component contracts",
  },
  {
    name: "Tokio",
    version: "1.x",
    license: "MIT",
    purpose: "Multi-threaded native asynchronous runtime, streaming channels, and cancellation hierarchy",
  },
  {
    name: "Rusqlite & SQLite 3",
    version: "0.31 / 3.x",
    license: "MIT / Public Domain",
    purpose: "Embedded ACID persistence for chat history, sessions, FTS5 search, and local telemetry",
  },
  {
    name: "ONNX Runtime",
    version: "1.x",
    license: "MIT",
    purpose: "Local Small Language Model (SLM) neural inference engine for intent routing and classification",
  },
  {
    name: "Lucide React",
    version: "1.x",
    license: "ISC",
    purpose: "Clean, consistent, accessible desktop iconography",
  },
  {
    name: "Vite",
    version: "5.4",
    license: "MIT",
    purpose: "Frontend bundling, Hot Module Replacement (HMR), and optimized production builds",
  },
];

export interface ImplementationBreakdownItem {
  category: "implemented" | "planned";
  title: string;
  description: string;
}

export const IMPLEMENTATION_BREAKDOWN: ImplementationBreakdownItem[] = [
  // Implemented MVP Capabilities
  {
    category: "implemented",
    title: "Tauri v2 Desktop Shell & Dark Theme",
    description: "Multi-window responsive layout, accessible navigation, and high-contrast dark tokens.",
  },
  {
    category: "implemented",
    title: "Windows DPAPI Encrypted Key Vault",
    description: "OS-level encryption (CryptProtectData); zero plaintext keys in memory, logs, or UI.",
  },
  {
    category: "implemented",
    title: "Local SLM Intent & Task Analysis",
    description: "Client-side intent taxonomy, complexity scoring, and domain classification via ONNX Runtime.",
  },
  {
    category: "implemented",
    title: "11-Factor Dynamic Candidate Scoring",
    description: "Multidimensional provider ranking balancing accuracy, cost, latency, quota, and user bias.",
  },
  {
    category: "implemented",
    title: "Streaming Response Engine with Failover",
    description: "Monotonic SSE streaming, automatic failover upon 429/500, and single-write persistence.",
  },
  {
    category: "implemented",
    title: "Local SQLite History & FTS5 Search",
    description: "Full conversation search, token usage indexing, pinning, renaming, and export.",
  },
  {
    category: "implemented",
    title: "Operational Telemetry & Cost Analytics",
    description: "Local token burn analytics, latency benchmarking, and cumulative savings tracking.",
  },
  {
    category: "implemented",
    title: "Data Lifecycle & Privacy Deletion",
    description: "Configurable retention windows, table audits, safe repairs, and cryptographic full data wipe.",
  },
  {
    category: "implemented",
    title: "Provider Management & Manual Route Overrides",
    description: "Canonical provider controls (OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral) & preflight checks.",
  },

  // Planned Future Capabilities (Clearly Segregated)
  {
    category: "planned",
    title: "Additional Local Model Runtimes",
    description: "Exploration of embedded llama.cpp / GGUF engine support for custom local inference.",
  },
  {
    category: "planned",
    title: "Custom User Fine-Tuned Routing Weights",
    description: "Custom mathematical weighting formulas for specialized enterprise routing profiles.",
  },
  {
    category: "planned",
    title: "Community Plugin & Tool Integration",
    description: "Sandboxed third-party plugins for agentic tool use and custom document connectors.",
  },
  {
    category: "planned",
    title: "Production MSIX & Windows Store Packaging",
    description: "Official signed Microsoft Store distribution and background auto-update pipelines (Step 50).",
  },
];

// ============================================================================
// Authoritative Contact Configuration
// ============================================================================

export type ContactChannelId = "email" | "whatsapp" | "website" | "youtube";

export interface ContactChannel {
  id: ContactChannelId;
  label: string;
  description: string;
  scheme: "mailto" | "whatsapp" | "https";
  destination: string | null;
  isConfigured: boolean;
  actionLabel: string;
  unconfiguredMessage: string;
}

export interface ContactConfig {
  channels: Record<ContactChannelId, ContactChannel>;
  supportExpectations: string;
}

const DEFAULT_CONTACT_CONFIG: ContactConfig = {
  channels: {
    email: {
      id: "email",
      label: "Email Support",
      description: "Direct technical support, security disclosures, and architectural inquiries.",
      scheme: "mailto",
      destination: null,
      isConfigured: false,
      actionLabel: "Send Email",
      unconfiguredMessage: "Official support email address is not configured in this release.",
    },
    whatsapp: {
      id: "whatsapp",
      label: "WhatsApp Community",
      description: "Developer announcements, community discussion, and quick troubleshooting.",
      scheme: "whatsapp",
      destination: null,
      isConfigured: false,
      actionLabel: "Open WhatsApp",
      unconfiguredMessage: "Official WhatsApp channel is not configured in this release.",
    },
    website: {
      id: "website",
      label: "Official Website",
      description: "Project homepage, official documentation, releases, and changelog.",
      scheme: "https",
      destination: null,
      isConfigured: false,
      actionLabel: "Visit Website",
      unconfiguredMessage: "Official project website URL is not configured in this release.",
    },
    youtube: {
      id: "youtube",
      label: "YouTube Channel",
      description: "Architecture walkthroughs, feature demonstrations, and video tutorials.",
      scheme: "https",
      destination: null,
      isConfigured: false,
      actionLabel: "Watch on YouTube",
      unconfiguredMessage: "Official YouTube channel is not configured in this release.",
    },
  },
  supportExpectations:
    "For technical assistance, bug reports, and community updates, use the official communication channels above when configured. Nano Route is an open-source project maintained by Nano Route Engineering.",
};

let activeContactConfig: ContactConfig = { ...DEFAULT_CONTACT_CONFIG };

export function getContactConfig(): ContactConfig {
  return activeContactConfig;
}

export function setContactConfigForTesting(overrides: Partial<ContactConfig>): void {
  activeContactConfig = {
    ...activeContactConfig,
    ...overrides,
    channels: {
      ...activeContactConfig.channels,
      ...(overrides.channels || {}),
    },
  };
}

export function resetContactConfig(): void {
  activeContactConfig = { ...DEFAULT_CONTACT_CONFIG };
}

