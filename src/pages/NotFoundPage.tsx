import { Link } from "react-router-dom";
import { Card, Button, Badge } from "../components/ui";
import { ROUTE_PATHS } from "../routes/routePaths";
import { AlertTriangle, Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div style={{ margin: "2rem auto", width: "100%", maxWidth: "600px", textAlign: "center" }}>
      <Card variant="elevated" padding="lg">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "var(--nr-radius-full)",
            backgroundColor: "var(--nr-accent-warning-subtle)",
            color: "var(--nr-accent-warning)",
            marginBottom: "1.25rem",
          }}
        >
          <AlertTriangle style={{ width: "28px", height: "28px" }} />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <Badge variant="warning">404 — Route Not Found</Badge>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--nr-text-primary)", marginBottom: "0.75rem" }}>
          Page Does Not Exist
        </h1>

        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          The requested route was not recognized by the Nano Route client router.
          Please return to the Dashboard overview.
        </p>

        <Link to={ROUTE_PATHS.DASHBOARD} style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md">
            <Home style={{ width: "16px", height: "16px", marginRight: "0.5rem" }} />
            Return to Dashboard
          </Button>
        </Link>
      </Card>
    </div>
  );
}

