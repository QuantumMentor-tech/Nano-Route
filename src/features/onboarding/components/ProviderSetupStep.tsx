import React, { useState } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { ProviderDescriptorDto, ProviderCredentialStatus } from "../../../services/ipc";
import { saveProviderCredential } from "../../../services/ipc/credentials";

export interface ProviderSetupStepProps {
  providers: ProviderDescriptorDto[];
  credentialStatuses: ProviderCredentialStatus[];
  onCredentialsUpdated: () => Promise<void>;
}

export const ProviderSetupStep: React.FC<ProviderSetupStepProps> = ({
  providers,
  credentialStatuses,
  onCredentialsUpdated,
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<string>("openai");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Filter for providers requiring credentials (skip local)
  const cloudProviders = providers.filter((p) => p.credentialRequired);

  const getStatusForProvider = (providerId: string) => {
    return credentialStatuses.find((s) => s.providerId === providerId);
  };

  const handleSaveCredential = async () => {
    if (!apiKeyInput.trim()) {
      setSaveMessage({ text: "Please enter a valid API key.", isError: true });
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage(null);
      await saveProviderCredential({
        providerId: selectedProviderId,
        apiKey: apiKeyInput.trim(),
      });
      setApiKeyInput(""); // Clear plaintext key immediately after encryption
      await onCredentialsUpdated();
      setSaveMessage({ text: "API key securely encrypted and saved via Windows DPAPI.", isError: false });
    } catch (err: unknown) {
      setSaveMessage({
        text: `Failed to save credential: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3
          id="onboarding-step-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--nr-text-primary)",
          }}
        >
          Frontier Provider Credentials (Optional)
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          To allow Nano Route to escalate complex prompts to frontier models (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral), enter an API key. Credentials are encrypted immediately via Windows DPAPI. You can also skip this and configure providers anytime in Settings.
        </p>
      </div>

      {/* Provider Selector Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {cloudProviders.map((provider) => {
          const status = getStatusForProvider(provider.providerId);
          const isConfigured = status?.isConfigured;
          const isSelected = selectedProviderId === provider.providerId;

          return (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => {
                setSelectedProviderId(provider.providerId);
                setSaveMessage(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "var(--nr-radius-md)",
                border: isSelected
                  ? "1px solid var(--nr-accent-purple)"
                  : "1px solid var(--nr-border-default)",
                backgroundColor: isSelected
                  ? "rgba(139, 92, 246, 0.15)"
                  : "rgba(255, 255, 255, 0.02)",
                color: "var(--nr-text-primary)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 600 }}>{provider.displayName}</span>
              {isConfigured ? (
                <CheckCircle2 size={13} style={{ color: "var(--nr-status-success)" }} />
              ) : (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--nr-text-disabled)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Credential Entry Form */}
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            htmlFor="onboarding-api-key"
            style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}
          >
            {providers.find((p) => p.providerId === selectedProviderId)?.displayName} API Key
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--nr-accent-blue)" }}>
            <ShieldCheck size={14} />
            <span>DPAPI Encrypted</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              id="onboarding-api-key"
              type={showKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste provider API key (e.g. sk-...)"
              style={{
                width: "100%",
                padding: "0.5rem 2.25rem 0.5rem 0.75rem",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--nr-border-default)",
                borderRadius: "var(--nr-radius-md)",
                color: "var(--nr-text-primary)",
                fontFamily: "var(--nr-font-mono)",
                fontSize: "0.8125rem",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--nr-text-secondary)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveCredential}
            disabled={isSaving || !apiKeyInput.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--nr-accent-purple)",
              border: "none",
              borderRadius: "var(--nr-radius-md)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.8125rem",
              cursor: isSaving || !apiKeyInput.trim() ? "not-allowed" : "pointer",
              opacity: isSaving || !apiKeyInput.trim() ? 0.6 : 1,
            }}
          >
            {isSaving ? "Encrypting..." : "Save Key"}
          </button>
        </div>

        {saveMessage && (
          <div
            role="status"
            style={{
              fontSize: "0.8125rem",
              color: saveMessage.isError ? "var(--nr-status-error)" : "var(--nr-status-success)",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            {saveMessage.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{saveMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
