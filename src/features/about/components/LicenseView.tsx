/**
 * Nano Route — License & Entitlements View
 * File: src/features/about/components/LicenseView.tsx
 *
 * Authoritative presentation of open-source license status, local entitlements,
 * and unmodified MIT legal notice.
 */

import React, { useState, useEffect } from "react";
import {
  FileKey,
  ShieldCheck,
  Scale,
  Lock,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Info,
} from "lucide-react";
import { Card, Badge, Button, IconButton, Tooltip } from "../../../components/ui";
import { useToast } from "../../../components/feedback/ToastContext";
import { getLicenseInfo } from "../../../services/ipc/license";
import { type LicenseInfoDto } from "../../../services/ipc/types";
import { copyToClipboard } from "../utils/externalLinks";

const LOGO_SRC = "/Nano Route Neon Tech Logo.png";

export const LicenseView: React.FC = () => {
  const { toast } = useToast();
  const [license, setLicense] = useState<LicenseInfoDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  const fetchLicense = async () => {
    setIsLoading(true);
    try {
      const data = await getLicenseInfo();
      setLicense(data);
    } catch {
      toast.error("Failed to load license metadata");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicense();
  }, []);

  const handleCopyNotice = async () => {
    if (!license) return;
    const ok = await copyToClipboard(license.licenseNotice);
    if (ok) {
      setIsCopied(true);
      toast.success("License text copied to clipboard");
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      toast.error("Failed to copy license text");
    }
  };

  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: "920px", paddingBottom: "3rem" }}>
      {/* 1. Page Header */}
      <header style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              <FileKey style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
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
                License & Entitlements
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", margin: 0 }}>
                Authoritative software license terms, local feature entitlements, and legal disclaimers.
              </p>
            </div>
          </div>

          <Tooltip content="Refresh license status" position="left">
            <IconButton
              variant="outline"
              size="sm"
              icon={<RefreshCw style={{ width: "16px", height: "16px", animation: isLoading ? "spin 1s linear infinite" : "none" }} />}
              aria-label="Refresh license metadata"
              onClick={fetchLicense}
              disabled={isLoading}
            />
          </Tooltip>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* 2. Product Identity & Status Banner */}
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
                    width: "60px",
                    height: "60px",
                    objectFit: "contain",
                    borderRadius: "var(--nr-radius-md)",
                    border: "1px solid var(--nr-border-subtle)",
                    backgroundColor: "var(--nr-bg-surface-elevated)",
                    padding: "4px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "var(--nr-radius-md)",
                    backgroundColor: "var(--nr-accent-purple-subtle)",
                    border: "1px solid var(--nr-accent-purple-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--nr-accent-purple)",
                    fontWeight: 800,
                    fontSize: "22px",
                  }}
                >
                  NR
                </div>
              )}

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--nr-text-primary)", margin: 0 }}>
                    {license?.productName || "Nano Route"}
                  </h2>
                  <Badge variant="purple">{license?.edition || "Community Edition"}</Badge>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
                  {license?.copyright || "Copyright (c) 2026 Nano Route Engineering"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Badge variant="success">Active (Open Source)</Badge>
              <Badge variant="blue">MIT Permissive</Badge>
            </div>
          </div>
        </Card>

        {/* 3. Three Dimension Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          <Card variant="default" padding="md">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <Scale style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  License Model
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                  {license?.licenseType || "MIT License"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                  Permissive terms. Both personal and commercial use are fully permitted without royalties.
                </div>
              </div>
            </div>
          </Card>

          <Card variant="default" padding="md">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <ShieldCheck style={{ width: "20px", height: "20px", color: "var(--nr-status-success)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Activation Requirement
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                  Not Required (Zero-Cloud)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                  Operates fully offline. No remote licensing server, seat checks, or DRM activation.
                </div>
              </div>
            </div>
          </Card>

          <Card variant="default" padding="md">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <Lock style={{ width: "20px", height: "20px", color: "var(--nr-accent-blue)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Expiration Policy
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginTop: "0.125rem" }}>
                  Perpetual (No Expiration)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
                  No expiration dates, trial timers, or hardware lockouts. The software remains functional indefinitely.
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 4. Local Feature Entitlements */}
        <Card variant="elevated" padding="lg">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
            <CheckCircle2 style={{ width: "20px", height: "20px", color: "var(--nr-status-success)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Authorized Local Entitlements
            </h2>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "1rem" }}>
            All core orchestration, persistence, analytics, and security subsystems are completely unlocked in this build:
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {(license?.entitlements || []).map((entitlement, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-bg-surface-elevated)",
                  border: "1px solid var(--nr-border-subtle)",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--nr-status-success)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-primary)", fontWeight: 500 }}>
                  {entitlement}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* 5. Complete Legal Notice Box */}
        <Card variant="default" padding="lg">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
                Official MIT License Notice
              </h2>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-muted)", marginTop: "0.125rem" }}>
                Unmodified legal text from root LICENSE file
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={isCopied ? <Check style={{ width: "14px", height: "14px", color: "var(--nr-status-success)" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
              onClick={handleCopyNotice}
            >
              {isCopied ? "Copied" : "Copy License Text"}
            </Button>
          </div>

          <pre
            style={{
              margin: 0,
              padding: "1rem 1.25rem",
              borderRadius: "var(--nr-radius-md)",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              border: "1px solid var(--nr-border-default)",
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              color: "var(--nr-text-secondary)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              whiteSpace: "pre-wrap",
              overflowY: "auto",
              maxHeight: "260px",
            }}
          >
            {license?.licenseNotice || "Loading license notice..."}
          </pre>
        </Card>

        {/* 6. Legal & Security Invariant Disclosure */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--nr-radius-md)",
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-border-subtle)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <Info style={{ width: "18px", height: "18px", color: "var(--nr-status-info)", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--nr-text-primary)" }}>Local Integrity Notice:</strong> Nano Route is
            provided &ldquo;as is&rdquo;, without warranty of any kind. All routing decisions, API keys encrypted
            via Windows DPAPI, and conversation histories are stored strictly on your local device. External
            provider requests occur only when you explicitly dispatch prompts to configured LLM APIs.
          </div>
        </div>
      </div>
    </div>
  );
};
