/**
 * Nano Route — Application About & Architecture View
 * File: src/features/about/components/AboutView.tsx
 *
 * Factual application identity, versioning, technical architecture,
 * implementation breakdown, and open-source acknowledgements.
 */

import React, { useState, useEffect } from "react";
import {
  Info,
  Cpu,
  Sparkles,
  Layers,
  Copy,
  Check,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, Badge, Button } from "../../../components/ui";
import { useToast } from "../../../components/feedback/ToastContext";
import { getNativeAppInfo } from "../../../services/ipc/commands";
import { type NativeAppInfo } from "../../../services/ipc/types";
import {
  APP_METADATA,
  OPEN_SOURCE_NOTICES,
  IMPLEMENTATION_BREAKDOWN,
} from "../config/appMetadata";
import { copyToClipboard } from "../utils/externalLinks";

const LOGO_SRC = "/Nano Route Neon Tech Logo.png";

export const AboutView: React.FC = () => {
  const { toast } = useToast();
  const [nativeInfo, setNativeInfo] = useState<NativeAppInfo | null>(null);
  const [isVersionCopied, setIsVersionCopied] = useState<boolean>(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  useEffect(() => {
    getNativeAppInfo().then((info) => {
      if (info) {
        setNativeInfo(info);
      }
    });
  }, []);

  const displayVersion = nativeInfo?.version || APP_METADATA.version;
  const displayPlatform = nativeInfo
    ? `${nativeInfo.target_os} (${nativeInfo.arch})`
    : APP_METADATA.platform;
  const displayEnvironment = nativeInfo?.environment || APP_METADATA.environment;

  const handleCopyVersion = async () => {
    const textToCopy = `Nano Route v${displayVersion} (${APP_METADATA.buildChannel}) - ${displayPlatform}`;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setIsVersionCopied(true);
      toast.success("Version string copied to clipboard");
      setTimeout(() => setIsVersionCopied(false), 2500);
    } else {
      toast.error("Failed to copy version");
    }
  };

  const implementedFeatures = IMPLEMENTATION_BREAKDOWN.filter((i) => i.category === "implemented");
  const plannedFeatures = IMPLEMENTATION_BREAKDOWN.filter((i) => i.category === "planned");

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
            <Info style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
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
              About Nano Route
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", margin: 0 }}>
              System diagnostics, native architecture overview, and technology specifications.
            </p>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* 2. Hero Identity Card */}
        <Card variant="elevated" padding="lg">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              {!logoLoadFailed ? (
                <img
                  src={LOGO_SRC}
                  alt="Nano Route Logo"
                  onError={() => setLogoLoadFailed(true)}
                  style={{
                    width: "72px",
                    height: "72px",
                    objectFit: "contain",
                    borderRadius: "var(--nr-radius-md)",
                    border: "1px solid var(--nr-border-subtle)",
                    backgroundColor: "var(--nr-bg-surface-elevated)",
                    padding: "6px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "var(--nr-radius-md)",
                    backgroundColor: "var(--nr-accent-purple-subtle)",
                    border: "1px solid var(--nr-accent-purple-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--nr-accent-purple)",
                    fontWeight: 800,
                    fontSize: "26px",
                  }}
                >
                  NR
                </div>
              )}

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--nr-text-primary)", margin: 0 }}>
                    {APP_METADATA.name}
                  </h2>
                  <Badge variant="purple">v{displayVersion}</Badge>
                  <Badge variant="blue">{APP_METADATA.buildChannel}</Badge>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.375rem", margin: 0 }}>
                  {APP_METADATA.tagline}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={
                isVersionCopied ? (
                  <Check style={{ width: "14px", height: "14px", color: "var(--nr-status-success)" }} />
                ) : (
                  <Copy style={{ width: "14px", height: "14px" }} />
                )
              }
              onClick={handleCopyVersion}
            >
              {isVersionCopied ? "Copied" : "Copy Build Info"}
            </Button>
          </div>
        </Card>

        {/* 3. Native Runtime & Environment Architecture */}
        <Card variant="default" padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
            <Cpu style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Architecture & System Specifications
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.875rem",
            }}
          >
            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Target Platform</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {displayPlatform}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Build Environment</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {displayEnvironment}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Core Runtime</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {APP_METADATA.coreRuntime}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Local SLM Engine</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {APP_METADATA.slmInferenceEngine}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Persistence Engine</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {APP_METADATA.storageEngine}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Credential Encryption</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {APP_METADATA.vaultEngine}
              </div>
            </div>

            <div style={{ padding: "0.75rem", borderRadius: "var(--nr-radius-md)", backgroundColor: "var(--nr-bg-surface-elevated)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>Desktop Host</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                {APP_METADATA.architecture}
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Product Overview (Factual) */}
        <Card variant="default" padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
            <Layers style={{ width: "20px", height: "20px", color: "var(--nr-accent-blue)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Executive Overview
            </h2>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.6, margin: 0 }}>
            {APP_METADATA.description}
          </p>
        </Card>

        {/* 5. Implementation Status: Implemented MVP vs Planned Features */}
        <Card variant="elevated" padding="lg">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
            Roadmap & Implementation Status
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-muted)", marginBottom: "1.25rem" }}>
            Clear architectural separation between verified production-ready MVP capabilities and planned future milestones:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Active / Implemented */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <CheckCircle2 style={{ width: "16px", height: "16px", color: "var(--nr-status-success)" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-status-success)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Active MVP Capabilities (Implemented & Verified)
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.625rem" }}>
                {implementedFeatures.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--nr-radius-md)",
                      backgroundColor: "var(--nr-bg-surface-elevated)",
                      border: "1px solid var(--nr-border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Planned */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Clock style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Planned Future Roadmap
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.625rem" }}>
                {plannedFeatures.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--nr-radius-md)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px dashed var(--nr-border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-secondary)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 6. Open-Source Acknowledgements */}
        <Card variant="default" padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: "var(--nr-status-warning)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Open-Source Foundations & Acknowledgements
            </h2>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "1rem" }}>
            Nano Route is built upon respected open-source engineering primitives and standards:
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {OPEN_SOURCE_NOTICES.map((pkg, idx) => (
              <div
                key={idx}
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-bg-surface-elevated)",
                  border: "1px solid var(--nr-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {pkg.name}
                    </span>
                    <Badge variant="default" size="sm">{pkg.license}</Badge>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.375rem", lineHeight: 1.4 }}>
                    {pkg.purpose}
                  </div>
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--nr-text-muted)", marginTop: "0.5rem" }}>
                  v{pkg.version}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 7. Copyright & Ownership */}
        <div
          style={{
            textAlign: "center",
            padding: "1.5rem 0 0.5rem",
            fontSize: "0.8125rem",
            color: "var(--nr-text-muted)",
          }}
        >
          <div>{APP_METADATA.copyright}. All rights reserved.</div>
          <div style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
            Licensed under the {APP_METADATA.license}. Built with Windows-First Native Architecture.
          </div>
        </div>
      </div>
    </div>
  );
};
