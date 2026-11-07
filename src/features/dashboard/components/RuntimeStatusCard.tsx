import React, { useState } from "react";
import { RefreshCw, ShieldCheck, AlertCircle, Cpu } from "lucide-react";
import {
  Card,
  Badge,
  Button,
  StatusIndicator,
  Divider,
} from "../../../components/ui";
import { useApplicationState } from "../../../state";

export const RuntimeStatusCard: React.FC = () => {
  const { state, refreshHealth } = useApplicationState();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshHealth();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusConfig = () => {
    switch (state.lifecycle) {
      case "initializing":
        return {
          title: "Initializing Nano Route...",
          description: "Verifying native application core and local environment...",
          indicatorStatus: "routing" as const,
          indicatorLabel: "Initializing",
          badgeVariant: "purple" as const,
          badgeLabel: "Initializing",
          showRetry: false,
        };
      case "ready":
        return {
          title: "Nano Route is Ready",
          description: state.nativeMessage,
          indicatorStatus: "online" as const,
          indicatorLabel: state.isNative ? "Desktop Core Operational" : "Web Preview Mode",
          badgeVariant: "success" as const,
          badgeLabel: "Operational",
          showRetry: false,
        };
      case "degraded":
        return {
          title: "Limited Operational Availability",
          description: state.nativeMessage || "Running in degraded mode.",
          indicatorStatus: "warning" as const,
          indicatorLabel: "Degraded",
          badgeVariant: "warning" as const,
          badgeLabel: "Degraded",
          showRetry: true,
        };
      case "failed":
      default:
        return {
          title: "Application Core Error",
          description: state.lastError || "Failed to initialize native core components.",
          indicatorStatus: "offline" as const,
          indicatorLabel: "Failed",
          badgeVariant: "error" as const,
          badgeLabel: "Error",
          showRetry: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Card variant="elevated" padding="lg" style={{ marginBottom: "1.75rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--nr-radius-lg)",
              backgroundColor: "var(--nr-accent-purple-subtle)",
              border: "1px solid var(--nr-accent-purple-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nr-accent-purple)",
              flexShrink: 0,
            }}
          >
            {state.lifecycle === "failed" ? (
              <AlertCircle style={{ width: "22px", height: "22px" }} />
            ) : state.isNative ? (
              <Cpu style={{ width: "22px", height: "22px" }} />
            ) : (
              <ShieldCheck style={{ width: "22px", height: "22px" }} />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary)",
                  margin: 0,
                }}
              >
                {config.title}
              </h2>
              <Badge variant={config.badgeVariant} size="sm">
                {config.badgeLabel}
              </Badge>
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--nr-text-secondary)",
                marginTop: "0.25rem",
                marginBottom: 0,
                lineHeight: 1.5,
              }}
            >
              {config.description}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <StatusIndicator
            status={config.indicatorStatus}
            label={config.indicatorLabel}
            pulse={state.lifecycle === "ready" || state.lifecycle === "initializing"}
          />
          {config.showRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
            >
              <RefreshCw
                style={{ width: "14px", height: "14px", marginRight: "0.375rem" }}
              />
              Retry Health Check
            </Button>
          )}
        </div>
      </div>

      <Divider style={{ marginTop: "1.25rem", marginBottom: "1rem" }} />

      {/* Runtime Metadata Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--nr-text-muted)",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Runtime Environment
          </span>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--nr-text-primary)",
            }}
          >
            {state.isNative ? "Windows Native Core (Tauri)" : "Web Browser Dev Preview"}
          </span>
        </div>

        <div>
          <span
            style={{
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--nr-text-muted)",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Application Lifecycle
          </span>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--nr-text-primary)",
              textTransform: "capitalize",
            }}
          >
            {state.lifecycle}
          </span>
        </div>

        <div>
          <span
            style={{
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--nr-text-muted)",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Build Version
          </span>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--nr-text-primary)",
            }}
          >
            v{state.appVersion} ({state.environment})
          </span>
        </div>
      </div>
    </Card>
  );
};

RuntimeStatusCard.displayName = "RuntimeStatusCard";

