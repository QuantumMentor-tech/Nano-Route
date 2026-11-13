import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Sparkles } from "lucide-react";
import { Button, Badge } from "../../../components/ui";
import { useApplicationState } from "../../../state";
import { ROUTE_PATHS } from "../../../routes/routePaths";

export interface DashboardHeaderProps {
  onOpenOnboarding?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onOpenOnboarding }) => {
  const { state } = useApplicationState();

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "2rem",
        paddingBottom: "1.25rem",
        borderBottom: "1px solid var(--nr-border-subtle)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--nr-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <Badge variant="purple" size="sm">
            v{state.appVersion}
          </Badge>
          <Badge variant="default" size="sm">
            {state.environment}
          </Badge>
        </div>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--nr-text-secondary)",
            marginTop: "0.375rem",
            marginBottom: 0,
          }}
        >
          Your local AI orchestration control center & intelligent model router.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {onOpenOnboarding && (
          <Button variant="secondary" size="sm" onClick={onOpenOnboarding}>
            <Sparkles
              style={{ width: "16px", height: "16px", marginRight: "0.5rem", color: "var(--nr-accent-purple)" }}
            />
            Setup Guide
          </Button>
        )}
        <Link to={ROUTE_PATHS.CHAT} style={{ textDecoration: "none" }}>
          <Button variant="primary" size="sm">
            <MessageSquare
              style={{ width: "16px", height: "16px", marginRight: "0.5rem" }}
            />
            Start Chat
          </Button>
        </Link>
      </div>
    </header>
  );
};

DashboardHeader.displayName = "DashboardHeader";

