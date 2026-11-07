import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  IconButton,
  Textarea,
  Select,
  StatusIndicator,
  Divider,
  Spinner,
  Skeleton,
  Tooltip,
} from "../../../components/ui";
import { FormField, SearchField } from "../../../components/forms";
import { Alert, EmptyState, useToast } from "../../../components/feedback";
import {
  Dialog,
  ConfirmDialog,
  DropdownMenu,
  Popover,
} from "../../../components/overlays";
import { Tabs, TabList, TabTrigger, TabPanel } from "../../../components/navigation";
import { SectionHeader, ScrollContainer } from "../../../components/layout";
import { useApplicationState } from "../../../state";

export const DiagnosticDisclosure: React.FC = () => {
  const { state } = useApplicationState();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Preview interactive state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  return (
    <section aria-labelledby="diagnostics-heading" style={{ marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
          <h2
            id="diagnostics-heading"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--nr-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: 0,
            }}
          >
            System Diagnostics & Foundation Baseline
          </h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <>
              Hide Diagnostics
              <ChevronUp style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
            </>
          ) : (
            <>
              Show Diagnostics
              <ChevronDown style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
            </>
          )}
        </Button>
      </div>

      {isOpen && (
        <Card variant="elevated" padding="lg">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Foundation Verification
            </h3>
            <StatusIndicator
              status={state.isNative ? "online" : "offline"}
              label={state.isNative ? "Desktop Shell" : "Browser Dev"}
              pulse={state.isNative}
            />
          </div>

          <Divider />

          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Frontend Shell:</span>
              <Badge variant="success">React 18 + TypeScript (Ready)</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Navigation System:</span>
              <Badge variant="purple">React Router v6 + Collapsible Sidebar (Active)</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Desktop Window:</span>
              <Badge variant="blue">Tauri v2 (1440x900 Shell)</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Design System:</span>
              <Badge variant="purple">Obsidian / Purple Tokens (Active)</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Component Layer:</span>
              <Badge variant="success">Step 10 Reusable Primitives (Active)</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>IPC Smoke Test:</span>
              <Badge variant={state.isNative ? "success" : "default"}>
                {state.nativeMessage}
              </Badge>
            </div>
            {state.initializedAt && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>Initialized At:</span>
                <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", fontFamily: "var(--nr-font-mono)" }}>
                  {state.initializedAt}
                </span>
              </div>
            )}
          </div>

          <Divider style={{ marginTop: "1.25rem", marginBottom: "1.25rem" }} />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant={showPreview ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowPreview((prev) => !prev)}
              aria-expanded={showPreview}
            >
              {showPreview ? "Hide Component Library Preview" : "Component Library Preview (Step 10)"}
            </Button>
          </div>

          {showPreview && (
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <span style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--nr-accent-purple)", fontWeight: 700 }}>
                  STEP 10 REUSABLE UI COMPONENTS & INTERACTION PATTERNS
                </span>
                <h4 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: "0.25rem 0" }}>
                  Interactive Component Showcase
                </h4>
              </div>

              {/* Tabs Showcase */}
              <Card variant="default" padding="md" style={{ marginBottom: "1.25rem" }}>
                <SectionHeader
                  headingLevel="h3"
                  title="Accessible Tabs Primitive"
                  description="WAI-ARIA compliant tablist with keyboard ArrowLeft/ArrowRight navigation."
                />
                <Tabs defaultValue="buttons">
                  <TabList ariaLabel="Component Showcase Tabs">
                    <TabTrigger value="buttons">Buttons & Menus</TabTrigger>
                    <TabTrigger value="forms">Forms & Inputs</TabTrigger>
                    <TabTrigger value="overlays">Overlays & Dialogs</TabTrigger>
                    <TabTrigger value="feedback">Feedback & Toasts</TabTrigger>
                  </TabList>

                  {/* Panel 1: Buttons & Menus */}
                  <TabPanel value="buttons">
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Button Variants & Sizes
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          <Button variant="primary" size="sm">Primary</Button>
                          <Button variant="secondary" size="sm">Secondary</Button>
                          <Button variant="outline" size="sm">Outline</Button>
                          <Button variant="ghost" size="sm">Ghost</Button>
                          <Button variant="destructive" size="sm">Destructive</Button>
                          <Button variant="primary" size="sm" isLoading>Loading</Button>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Action Dropdown Menu (Distinct from Select) & Icon Buttons
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <DropdownMenu
                            trigger={
                              <Button variant="secondary" size="sm">
                                Quick Actions Menu <ChevronDown style={{ width: "14px", height: "14px", marginLeft: "0.375rem" }} />
                              </Button>
                            }
                            items={[
                              { id: "action-1", label: "Inspect Diagnostics", onClick: () => toast.info("Diagnostics inspected") },
                              { id: "action-2", label: "Copy Build ID", shortcut: "Ctrl+C", onClick: () => toast.success("Build ID copied") },
                              { id: "action-3", label: "Purge Test Cache", destructive: true, icon: <Trash2 style={{ width: "14px", height: "14px" }} />, onClick: () => toast.warning("Cache cleared") },
                            ]}
                          />

                          <Tooltip content="Settings shortcut (Escape closes)" position="top">
                            <IconButton
                              variant="ghost"
                              size="sm"
                              icon={<Settings style={{ width: "16px", height: "16px" }} />}
                              aria-label="Settings preview button"
                              onClick={() => toast.info("Settings button clicked")}
                            />
                          </Tooltip>

                          <Popover
                            trigger={
                              <Button variant="ghost" size="sm">
                                Open Popover
                              </Button>
                            }
                            content={
                              <div>
                                <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>Contextual Popover</span>
                                <p style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", margin: "0.25rem 0 0" }}>
                                  Anchored panel for contextual information and metadata.
                                </p>
                              </div>
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </TabPanel>

                  {/* Panel 2: Forms & Inputs */}
                  <TabPanel value="forms">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                      <FormField
                        label="Task Routing Strategy"
                        description="Controls model selection policy."
                        required
                      >
                        <Select
                          options={[
                            { value: "auto", label: "Automatic (SLM Dynamic)" },
                            { value: "cost", label: "Lowest Cost First" },
                            { value: "latency", label: "Fastest Latency First" },
                          ]}
                          defaultValue="auto"
                        />
                      </FormField>

                      <FormField
                        label="Search Past Executions"
                        description="Filter by model identifier or prompt tag."
                      >
                        <SearchField
                          value={searchVal}
                          onChange={(e) => setSearchVal(e.target.value)}
                          placeholder="e.g. claude-3-5-sonnet"
                        />
                      </FormField>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <FormField
                          label="Prompt System Instructions"
                          description="Custom system prompt injected before user turn."
                        >
                          <Textarea
                            placeholder="Enter system instructions..."
                            rows={2}
                            defaultValue="You are Nano Route SLM Orchestrator."
                          />
                        </FormField>
                      </div>
                    </div>
                  </TabPanel>

                  {/* Panel 3: Overlays & Dialogs */}
                  <TabPanel value="overlays">
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0 }}>
                        Standardized modal dialogs with focus trapping, focus restoration, and Escape key dismissal.
                      </p>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsDialogOpen(true)}
                        >
                          Open Modal Dialog
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setIsConfirmOpen(true)}
                        >
                          Open Confirm Dialog
                        </Button>
                      </div>

                      {/* Modal Dialog */}
                      <Dialog
                        isOpen={isDialogOpen}
                        onClose={() => setIsDialogOpen(false)}
                        title="Platform Architecture Inspector"
                        description="Inspect foundational desktop shell configuration."
                        footer={
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setIsDialogOpen(false)}
                          >
                            Close Inspector
                          </Button>
                        }
                      >
                        <p style={{ margin: "0 0 0.5rem" }}>
                          This modal demonstrates accessible focus management, Escape key handling, and background blur backdrop.
                        </p>
                        <ScrollContainer maxHeight="120px">
                          <pre style={{ margin: 0, fontSize: "0.75rem", fontFamily: "var(--nr-font-mono)", color: "var(--nr-accent-purple-light)" }}>
                            {JSON.stringify(state, null, 2)}
                          </pre>
                        </ScrollContainer>
                      </Dialog>

                      {/* Confirm Dialog */}
                      <ConfirmDialog
                        isOpen={isConfirmOpen}
                        onCancel={() => setIsConfirmOpen(false)}
                        onConfirm={() => {
                          setIsConfirmOpen(false);
                          toast.error("Demonstration destructive confirmation executed");
                        }}
                        title="Reset Local Configuration?"
                        description="This is a demonstration of the reusable ConfirmDialog primitive. No actual data will be erased."
                        confirmLabel="Reset Configuration"
                        cancelLabel="Keep Configuration"
                        isDestructive
                      />
                    </div>
                  </TabPanel>

                  {/* Panel 4: Feedback & Toasts */}
                  <TabPanel value="feedback">
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Persistent Inline Alerts
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <Alert variant="info" title="Information Notice">
                            Desktop application shell operational in offline mode.
                          </Alert>
                          <Alert variant="success" title="Verification Passed">
                            All Step 10 interaction primitives compiled and verified.
                          </Alert>
                          <Alert variant="warning" title="Warning Notice">
                            External provider keys must be configured in Settings.
                          </Alert>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Toast Notifications (Accessible Live Region)
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.success("Operation completed successfully", "Success")}
                          >
                            Trigger Success Toast
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.error("Native command failed or timed out", "Error")}
                          >
                            Trigger Error Toast
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.warning("Local SLM model weights not detected", "Warning")}
                          >
                            Trigger Warning Toast
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.info("Settings preferences synchronized", "Notice")}
                          >
                            Trigger Info Toast
                          </Button>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Loading Primitives (Respecting Reduced Motion)
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <Spinner size="sm" />
                          <Spinner size="md" />
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                            <Skeleton height="14px" width="70%" />
                            <Skeleton height="12px" width="45%" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", display: "block", marginBottom: "0.5rem" }}>
                          Empty State Primitive
                        </span>
                        <EmptyState
                          compact
                          title="No Active Background Tasks"
                          description="Demonstration of the shared EmptyState feedback primitive."
                          primaryAction={<Button variant="outline" size="sm" onClick={() => toast.info("Task refreshed")}>Refresh</Button>}
                        />
                      </div>
                    </div>
                  </TabPanel>
                </Tabs>
              </Card>
            </div>
          )}
        </Card>
      )}
    </section>
  );
};

DiagnosticDisclosure.displayName = "DiagnosticDisclosure";
