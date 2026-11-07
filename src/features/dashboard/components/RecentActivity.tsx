import React from "react";
import { Link } from "react-router-dom";
import { History, MessageSquare } from "lucide-react";
import { Card, Button } from "../../../components/ui";
import { ROUTE_PATHS } from "../../../routes/routePaths";

export const RecentActivity: React.FC = () => {
  return (
    <section aria-labelledby="activity-heading" style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
        <h2
          id="activity-heading"
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--nr-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}
        >
          Recent Activity
        </h2>
        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>
          Execution & Routing History
        </span>
      </div>

      <Card variant="default" padding="lg">
        <div
          style={{
            textAlign: "center",
            padding: "1.5rem 1rem",
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--nr-radius-full)",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              border: "1px solid var(--nr-border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              color: "var(--nr-text-muted)",
            }}
          >
            <History style={{ width: "22px", height: "22px" }} />
          </div>

          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--nr-text-primary)",
              marginBottom: "0.375rem",
            }}
          >
            No Recent Activity
          </h3>

          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--nr-text-secondary)",
              lineHeight: 1.5,
              marginBottom: "1.25rem",
            }}
          >
            Your prompt routing executions, provider dispatches, and session logs will
            be recorded here once you begin conversational tasks.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
            <Link to={ROUTE_PATHS.CHAT} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm">
                <MessageSquare
                  style={{ width: "14px", height: "14px", marginRight: "0.375rem" }}
                />
                Start New Chat
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
};

RecentActivity.displayName = "RecentActivity";

