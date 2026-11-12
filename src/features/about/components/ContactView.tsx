/**
 * Nano Route — Contact & Support View
 * File: src/features/about/components/ContactView.tsx
 *
 * Authoritative presentation of communication channels (Email, WhatsApp, Website, YouTube),
 * safe external link validation, and graceful unconfigured states.
 */

import React, { useState } from "react";
import {
  Mail,
  MessageCircle,
  Globe,
  SquarePlay,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card, Badge, Button, Tooltip } from "../../../components/ui";
import { useToast } from "../../../components/feedback/ToastContext";
import {
  getContactConfig,
  type ContactChannel,
  type ContactChannelId,
} from "../config/appMetadata";
import {
  openExternalLink,
  copyToClipboard,
} from "../utils/externalLinks";

export const ContactView: React.FC = () => {
  const { toast } = useToast();
  const contactConfig = getContactConfig();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);

  const channelsList: ContactChannel[] = [
    contactConfig.channels.email,
    contactConfig.channels.whatsapp,
    contactConfig.channels.website,
    contactConfig.channels.youtube,
  ];

  const handleOpenChannel = async (channel: ContactChannel) => {
    setLastActionError(null);
    if (!channel.isConfigured || !channel.destination) {
      toast.info(channel.unconfiguredMessage);
      return;
    }

    const res = await openExternalLink(channel.destination);
    if (!res.success) {
      const errMsg =
        res.error ||
        "The selected link could not be opened. Please use the displayed address manually.";
      setLastActionError(errMsg);
      toast.error(errMsg);
    }
  };

  const handleCopy = async (channel: ContactChannel) => {
    if (!channel.destination) return;
    const ok = await copyToClipboard(channel.destination);
    if (ok) {
      setCopiedId(channel.id);
      toast.success(`${channel.label} destination copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2500);
    } else {
      toast.error("Failed to copy address");
    }
  };

  const renderIcon = (id: ContactChannelId) => {
    const style = { width: "22px", height: "22px" };
    switch (id) {
      case "email":
        return <Mail style={{ ...style, color: "var(--nr-accent-purple)" }} />;
      case "whatsapp":
        return <MessageCircle style={{ ...style, color: "var(--nr-status-success)" }} />;
      case "website":
        return <Globe style={{ ...style, color: "var(--nr-accent-blue)" }} />;
      case "youtube":
        return <SquarePlay style={{ ...style, color: "var(--nr-status-error)" }} />;
    }
  };

  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "920px", paddingBottom: "3rem" }}>
      {/* 1. Header */}
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--nr-radius-md)",
              backgroundColor: "var(--nr-accent-purple-subtle)",
              border: "1px solid var(--nr-accent-purple-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--nr-text-primary)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Contact & Support
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", margin: 0 }}>
              Official communication channels, community links, and technical support resources.
            </p>
          </div>
        </div>
      </header>

      {/* 2. Global Error Warning if an opener fails */}
      {lastActionError && (
        <div
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "var(--nr-radius-md)",
            backgroundColor: "var(--nr-status-error-bg)",
            border: "1px solid var(--nr-status-error-border)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <AlertCircle style={{ width: "18px", height: "18px", color: "var(--nr-status-error)", flexShrink: 0 }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--nr-status-error)", lineHeight: 1.4 }}>
            {lastActionError}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* 3. Support Expectations Overview */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <HelpCircle style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Support & Communication Guidelines
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.5 }}>
                {contactConfig.supportExpectations}
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Four Canonical Contact Channels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1rem" }}>
          {channelsList.map((channel) => {
            const isCopying = copiedId === channel.id;

            return (
              <Card key={channel.id} variant="elevated" padding="lg">
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <div>
                    {/* Channel Card Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "var(--nr-radius-md)",
                            backgroundColor: "var(--nr-bg-surface-elevated)",
                            border: "1px solid var(--nr-border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {renderIcon(channel.id)}
                        </div>
                        <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
                          {channel.label}
                        </h2>
                      </div>

                      {channel.isConfigured ? (
                        <Badge variant="success">Configured</Badge>
                      ) : (
                        <Badge variant="default">Not Configured</Badge>
                      )}
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4, margin: "0 0 1rem" }}>
                      {channel.description}
                    </p>

                    {/* Destination or Unconfigured Note */}
                    <div
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: "var(--nr-radius-md)",
                        backgroundColor: "var(--nr-bg-surface-elevated)",
                        border: "1px solid var(--nr-border-subtle)",
                        marginBottom: "1rem",
                      }}
                    >
                      <div style={{ fontSize: "0.6875rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                        Destination
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          color: channel.isConfigured ? "var(--nr-text-primary)" : "var(--nr-text-muted)",
                          marginTop: "0.125rem",
                          wordBreak: "break-all",
                          fontFamily: channel.isConfigured ? "monospace" : "inherit",
                        }}
                      >
                        {channel.destination || channel.unconfiguredMessage}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginTop: "0.5rem" }}>
                    {channel.isConfigured ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<ExternalLink style={{ width: "14px", height: "14px" }} />}
                          onClick={() => handleOpenChannel(channel)}
                        >
                          {channel.actionLabel}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={isCopying ? <Check style={{ width: "14px", height: "14px", color: "var(--nr-status-success)" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
                          onClick={() => handleCopy(channel)}
                        >
                          {isCopying ? "Copied" : "Copy"}
                        </Button>
                      </>
                    ) : (
                      <Tooltip content={channel.unconfiguredMessage} position="top">
                        <div>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            leftIcon={<ExternalLink style={{ width: "14px", height: "14px" }} />}
                          >
                            {channel.actionLabel}
                          </Button>
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* 5. Privacy & Security Note */}
        <div
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "var(--nr-radius-md)",
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-border-subtle)",
            fontSize: "0.75rem",
            color: "var(--nr-text-muted)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--nr-text-secondary)" }}>Privacy Boundary:</strong> Contacting support or opening external links will open your default browser or mail client. Nano Route never transmits your local conversation history, API credentials, or prompt telemetry through support channels.
        </div>
      </div>
    </div>
  );
};
