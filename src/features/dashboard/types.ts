/**
 * Nano Route — Dashboard Types & Contracts
 * Step 9: Dashboard Shell & Global Application States
 */

export type CapabilityStatusLevel =
  | "ready"
  | "available"
  | "not-configured"
  | "unavailable"
  | "coming-soon";

export interface CapabilityItem {
  id: string;
  label: string;
  description: string;
  status: CapabilityStatusLevel;
  badgeText: string;
  badgeVariant: "success" | "purple" | "blue" | "warning" | "default";
  route?: string;
}

export interface MetricCardContract {
  id: string;
  label: string;
  status: "unavailable" | "available";
  emptyMessage: string;
  iconName?: string;
}

export interface ActivityCardContract {
  hasActivity: boolean;
  emptyTitle: string;
  emptyDescription: string;
}

