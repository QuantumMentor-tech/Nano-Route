/**
 * Nano Route — License IPC Bridge & Metadata
 * Authoritative single entry point for license information and entitlements.
 */

import { safeInvoke, isTauriContext } from "./client.ts";
import { IPC_COMMANDS, type LicenseInfoDto } from "./types.ts";

export const DEFAULT_LICENSE_INFO: LicenseInfoDto = {
  productName: "Nano Route",
  edition: "Community Edition (Open Source)",
  licenseType: "MIT License",
  status: "active",
  statusExplanation:
    "Permissive open-source license. Offline execution with full local feature entitlements. No activation server or remote validation required.",
  copyright: "Copyright (c) 2026 Nano Route Engineering",
  validFrom: "2026",
  validUntil: null,
  activationRequired: false,
  isCommercialAllowed: true,
  entitlements: [
    "Local SLM Intent Classification & Task Analysis",
    "Multi-Dimensional Provider Routing & Scoring",
    "Windows DPAPI Encrypted Key Management",
    "Local SQLite Chat History & Full-Text Search",
    "Privacy-First Local Telemetry & Cost Analytics",
    "Data Lifecycle, Retention & Secure Wipe Engine",
  ],
  licenseNotice: `MIT License

Copyright (c) 2026 Nano Route Engineering

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
};

let mockLicenseOverride: LicenseInfoDto | null = null;

export function setMockLicenseInfo(info: LicenseInfoDto | null): void {
  mockLicenseOverride = info;
}

export function resetMockLicenseInfo(): void {
  mockLicenseOverride = null;
}

export async function getLicenseInfo(): Promise<LicenseInfoDto> {
  if (mockLicenseOverride) {
    return { ...mockLicenseOverride };
  }

  if (!isTauriContext()) {
    return { ...DEFAULT_LICENSE_INFO };
  }

  try {
    return await safeInvoke<LicenseInfoDto>(IPC_COMMANDS.GET_LICENSE_INFO);
  } catch {
    return { ...DEFAULT_LICENSE_INFO };
  }
}

