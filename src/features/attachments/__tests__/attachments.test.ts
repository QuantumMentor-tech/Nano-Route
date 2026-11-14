import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  categorizeFile,
  validateAttachment,
  formatAttachmentsAsPromptContext,
} from "../validator.ts";
import type { PreparedAttachmentContext } from "../types.ts";
import { evaluateContextPreflight } from "../../context/engine.ts";

describe("Step 79 — Local Attachments & File Context Subsystem", () => {
  describe("File Categorization", () => {
    it("categorizes code, text, structured, and image extensions", () => {
      assert.equal(categorizeFile("script.py", "text/x-python"), "code");
      assert.equal(categorizeFile("notes.txt", "text/plain"), "text");
      assert.equal(categorizeFile("data.json", "application/json"), "structured");
      assert.equal(categorizeFile("table.csv", "text/csv"), "structured");
      assert.equal(categorizeFile("diagram.png", "image/png"), "image");
    });

    it("strictly flags dangerous executables and scripts as unsupported", () => {
      assert.equal(categorizeFile("malware.exe", "application/octet-stream"), "unsupported");
      assert.equal(categorizeFile("script.bat", "application/x-bat"), "unsupported");
      assert.equal(categorizeFile("runner.cmd", "text/plain"), "unsupported");
      assert.equal(categorizeFile("macro.vbs", "text/vbscript"), "unsupported");
    });
  });

  describe("File Validation & Limits", () => {
    it("accepts valid text file within size limit", () => {
      const mockFile = {
        name: "architecture.md",
        size: 1024 * 50, // 50 KB
        type: "text/markdown",
      } as unknown as File;

      const result = validateAttachment(mockFile, 0);
      assert.equal(result.isValid, true);
      assert.equal(result.status, "READY");
    });

    it("rejects files exceeding max size limit (2 MB default)", () => {
      const mockLargeFile = {
        name: "dump.sql",
        size: 3 * 1024 * 1024, // 3 MB
        type: "application/sql",
      } as unknown as File;

      const result = validateAttachment(mockLargeFile, 0);
      assert.equal(result.isValid, false);
      assert.equal(result.status, "TOO_LARGE");
      assert.ok(result.error?.includes("exceeds"));
    });

    it("rejects attachments when max count is exceeded", () => {
      const mockFile = {
        name: "extra.txt",
        size: 100,
        type: "text/plain",
      } as unknown as File;

      const result = validateAttachment(mockFile, 5); // already 5 attachments
      assert.equal(result.isValid, false);
      assert.equal(result.status, "ERROR");
      assert.ok(result.error?.includes("Maximum attachment limit"));
    });

    it("rejects dangerous executable extensions", () => {
      const mockFile = {
        name: "payload.exe",
        size: 200,
        type: "application/octet-stream",
      } as unknown as File;

      const result = validateAttachment(mockFile, 0);
      assert.equal(result.isValid, false);
      assert.equal(result.status, "UNSUPPORTED");
      assert.ok(result.error?.includes("not permitted"));
    });
  });

  describe("Context Formatting & Preflight Integration", () => {
    it("formats text attachments into delimited prompt context", () => {
      const prepared: PreparedAttachmentContext[] = [
        {
          attachmentId: "att_1",
          name: "config.json",
          category: "structured",
          mimeType: "application/json",
          sizeBytes: 120,
          textContent: '{\n  "version": 1\n}',
          charCount: 22,
          isMultimodal: false,
        },
      ];

      const formatted = formatAttachmentsAsPromptContext(prepared);
      assert.ok(formatted.includes("--- Attached File: config.json (structured) ---"));
      assert.ok(formatted.includes('{\n  "version": 1\n}'));
      assert.ok(formatted.includes("--- End of config.json ---"));
    });

    it("prepared attachment text evaluates safely through Step 76 Context Preflight", () => {
      const prepared: PreparedAttachmentContext[] = [
        {
          attachmentId: "att_2",
          name: "summary.txt",
          category: "text",
          mimeType: "text/plain",
          sizeBytes: 300,
          textContent: "System summary details for preflight analysis.",
          charCount: 46,
          isMultimodal: false,
        },
      ];

      const contextText = formatAttachmentsAsPromptContext(prepared);
      const userPrompt = "Review the attached system summary.";
      const fullPrompt = `${userPrompt}\n\n${contextText}`;

      const preflight = evaluateContextPreflight({
        providerId: "deepseek",
        modelId: "deepseek-chat",
        prompt: fullPrompt,
        history: [],
      });

      assert.equal(preflight.allowed, true);
      assert.equal(preflight.classification, "SAFE");
      assert.ok(preflight.estimatedInputTokens > 0);
    });
  });
});
