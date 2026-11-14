# Nano Route — Workspace Profile & Preset Schema Specification

**Document Reference:** `docs/profiles/NANO_ROUTE_WORKSPACE_PROFILE_SCHEMA.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 67  
**Schema Format Identifier:** `nano-route-workspace-profile-v1`  
**Current Schema Version:** `1`  

---

## 1. Overview & JSON Envelope

All workspace profiles exported from Nano Route conform to the `nano-route-workspace-profile-v1` schema envelope. This envelope guarantees forward and backward validation, metadata auditability, and isolation from arbitrary JSON payloads.

```json
{
  "format": "nano-route-workspace-profile-v1",
  "schemaVersion": 1,
  "exportedAt": 1731580000000,
  "appName": "Nano Route",
  "profile": {
    "id": "prof_focus",
    "name": "Focus & Deep Work",
    "description": "Distraction-free environment: boots straight to Chat, suppresses routine toasts, and keeps UI clean.",
    "preferences": {
      "appearance.theme_mode": "dark",
      "appearance.density": "comfortable",
      "appearance.reduced_motion": "standard",
      "appearance.text_scale": "100%",
      "appearance.enhanced_focus": "false",
      "workspace.startup_route": "chat",
      "workspace.sidebar_collapsed": "true",
      "workspace.confirm_chat_clear": "true",
      "chat.show_timestamps": "false",
      "chat.compact_spacing": "false",
      "chat.enter_to_send": "true",
      "chat.auto_scroll_to_bottom": "true",
      "notifications.enable_non_critical_toasts": "false",
      "notifications.toast_duration_ms": "3000",
      "palette.show_descriptions": "true",
      "palette.show_shortcuts": "true"
    }
  }
}
```

---

## 2. Core TypeScript Interfaces

```typescript
export const PROFILE_SCHEMA_FORMAT = "nano-route-workspace-profile-v1";
export const PROFILE_SCHEMA_VERSION = 1;

export const MAX_PROFILES_COUNT = 10;
export const MAX_PROFILE_NAME_LENGTH = 40;
export const MAX_PROFILE_DESC_LENGTH = 120;
export const MAX_PROFILE_PAYLOAD_BYTES = 16384; // 16KB

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  preferences: Record<string, string>;
}

export interface ProfileExportFile {
  format: string;
  schemaVersion: number;
  exportedAt: number;
  appName: string;
  profile: {
    id: string;
    name: string;
    description: string;
    preferences: Record<string, string>;
  };
}

export interface ProfileSettingDiff {
  key: string;
  label: string;
  currentValue: string;
  targetValue: string;
  willChange: boolean;
}

export interface ProfileValidationResult {
  isValid: boolean;
  schemaVersion: number;
  supportedKeysCount: number;
  unsupportedKeys: string[];
  invalidValues: Array<{ key: string; error: string }>;
  errors: string[];
}

export interface ProfileImportPreview {
  profile: WorkspaceProfile;
  diffs: ProfileSettingDiff[];
  validation: ProfileValidationResult;
  isExistingName: boolean;
  existingProfileId?: string;
}
```

---

## 3. Allowlisted Preference Catalog

Profiles can snapshot and modify **only** keys explicitly declared in `EXPORTABLE_PREFERENCE_KEYS`. Any key outside this catalog is rejected during validation.

| Preference Key | Domain | Data Type | Permitted Values / Range | Default Value |
| :--- | :--- | :--- | :--- | :--- |
| `appearance.theme_mode` | Appearance | string (enum) | `"dark"`, `"light"`, `"system"` | `"dark"` |
| `appearance.density` | Appearance | string (enum) | `"comfortable"`, `"compact"` | `"comfortable"` |
| `appearance.reduced_motion` | Appearance | string (enum) | `"system"`, `"reduced"`, `"standard"` | `"system"` |
| `appearance.text_scale` | Appearance | string (enum) | `"100%"`, `"110%"`, `"125%"` | `"100%"` |
| `appearance.enhanced_focus` | Appearance | string (boolean) | `"true"`, `"false"` | `"false"` |
| `workspace.startup_route` | Workspace | string (enum) | `"overview"`, `"chat"` | `"overview"` |
| `workspace.sidebar_collapsed` | Workspace | string (boolean) | `"true"`, `"false"` | `"false"` |
| `workspace.confirm_chat_clear`| Workspace | string (boolean) | `"true"`, `"false"` | `"true"` |
| `chat.show_timestamps` | Chat | string (boolean) | `"true"`, `"false"` | `"false"` |
| `chat.compact_spacing` | Chat | string (boolean) | `"true"`, `"false"` | `"false"` |
| `chat.enter_to_send` | Chat | string (boolean) | `"true"`, `"false"` | `"true"` |
| `chat.auto_scroll_to_bottom` | Chat | string (boolean) | `"true"`, `"false"` | `"true"` |
| `notifications.enable_non_critical_toasts` | Notifications | string (boolean) | `"true"`, `"false"` | `"true"` |
| `notifications.toast_duration_ms` | Notifications | string (integer) | `1000` to `30000` (ms) | `"5000"` |
| `palette.show_descriptions` | Palette | string (boolean) | `"true"`, `"false"` | `"true"` |
| `palette.show_shortcuts` | Palette | string (boolean) | `"true"`, `"false"` | `"true"` |

---

## 4. Size & Boundary Limits

To ensure memory safety, rapid parsing, and deterministic storage bounds:
- **Maximum File Payload:** 16,384 bytes (16 KB). Payloads exceeding 16KB are rejected upfront prior to JSON parsing.
- **Profile Name:** 2 to 40 UTF-8 characters. Stripped of control characters (`[\x00-\x1F\x7F]`) and HTML brackets (`[<>]`).
- **Profile Description:** 0 to 120 UTF-8 characters.
- **Maximum Profile Capacity:** 10 total profiles (4 immutable built-in presets + up to 6 custom user profiles).

