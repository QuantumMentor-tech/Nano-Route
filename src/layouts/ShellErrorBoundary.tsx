import { Component, ErrorInfo, ReactNode } from "react";
import { Card, Button, Badge } from "../components/ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ShellErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DesktopShell ErrorBoundary caught error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            width: "100%",
          }}
        >
          <Card variant="elevated" padding="lg" style={{ maxWidth: "560px", width: "100%", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <Badge variant="error">Application Shell Error</Badge>
              <span className="nr-caption">Protected Boundary</span>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
              Something interrupted the view
            </h2>
            <p className="nr-body" style={{ marginBottom: "1rem" }}>
              The application shell prevented this view rendering failure from crashing the entire desktop application.
            </p>
            {this.state.error && (
              <pre className="nr-code" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginBottom: "1.25rem", display: "block" }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button variant="primary" size="sm" onClick={this.handleReset}>
                Try again
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reload Application
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
