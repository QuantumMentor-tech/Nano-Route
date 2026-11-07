import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Settings, History, ArrowRight } from "lucide-react";
import { Card, Button } from "../../../components/ui";
import { ROUTE_PATHS } from "../../../routes/routePaths";

export const QuickActions: React.FC = () => {
  return (
    <section aria-labelledby="quick-actions-heading" style={{ marginBottom: "1.75rem" }}>
      <h2
        id="quick-actions-heading"
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--nr-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.75rem",
        }}
      >
        Quick Actions
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Action 1: Chat Studio */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-accent-purple-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--nr-accent-purple)",
                  marginBottom: "0.75rem",
                }}
              >
                <MessageSquare style={{ width: "18px", height: "18px" }} />
              </div>
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary)",
                  margin: "0 0 0.25rem",
                }}
              >
                Start Chat
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--nr-text-secondary)",
                  lineHeight: 1.4,
                  margin: "0 0 1rem",
                }}
              >
                Open the conversational studio to compose prompts and test model responses.
              </p>
            </div>

            <Link to={ROUTE_PATHS.CHAT} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm" style={{ width: "100%" }}>
                Open Chat Studio
                <ArrowRight style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Action 2: Settings */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-bg-surface-elevated)",
                  border: "1px solid var(--nr-border-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--nr-text-secondary)",
                  marginBottom: "0.75rem",
                }}
              >
                <Settings style={{ width: "18px", height: "18px" }} />
              </div>
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary)",
                  margin: "0 0 0.25rem",
                }}
              >
                Configure Settings
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--nr-text-secondary)",
                  lineHeight: 1.4,
                  margin: "0 0 1rem",
                }}
              >
                Manage provider keys, local SLM paths, and DPAPI security preferences.
              </p>
            </div>

            <Link to={ROUTE_PATHS.SETTINGS} style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Open Settings
                <ArrowRight style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Action 3: History */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--nr-radius-md)",
                  backgroundColor: "var(--nr-bg-surface-elevated)",
                  border: "1px solid var(--nr-border-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--nr-text-secondary)",
                  marginBottom: "0.75rem",
                }}
              >
                <History style={{ width: "18px", height: "18px" }} />
              </div>
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary)",
                  margin: "0 0 0.25rem",
                }}
              >
                Session History
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--nr-text-secondary)",
                  lineHeight: 1.4,
                  margin: "0 0 1rem",
                }}
              >
                Inspect past prompt sessions, model decisions, and telemetry audit logs.
              </p>
            </div>

            <Link to={ROUTE_PATHS.HISTORY} style={{ textDecoration: "none" }}>
              <Button variant="outline" size="sm" style={{ width: "100%" }}>
                View History
                <ArrowRight style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
};

QuickActions.displayName = "QuickActions";

