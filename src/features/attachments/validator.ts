/**
 * Nano Route — Local Attachment Validator & Preprocessor
 * File: src/features/attachments/validator.ts
 *
 * Implements Step 79:
 * - Strict allowlist enforcement for file extensions and MIME types
 * - Size bound checking (default 2 MB per file, max 5 attachments)
 * - Safe text extraction and image data preparation
 * - Rejection of dangerous executable scripts and binaries
 */

import type {
  AttachmentCategory,
  AttachmentStatus,
  PreparedAttachmentContext,
  AttachmentValidationLimits,
} from "./types.ts";

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentValidationLimits = {
  maxFileSize: 2 * 1024 * 1024, // 2 MB
  maxAttachmentsCount: 5,
  maxAggregateCharacters: 60_000,
  allowedExtensions: [
    // Text & Documents
    "txt", "md", "markdown", "log", "rtf",
    // Structured Data
    "json", "csv", "tsv", "yaml", "yml", "xml", "toml",
    // Code
    "js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "cs", "rb", "php", "sql", "html", "css", "sh",
    // Images
    "png", "jpg", "jpeg", "webp", "gif", "svg",
  ],
};

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "vbs", "ps1", "com", "msi", "scr", "pif", "dll", "so", "dylib",
]);

/**
 * Categorizes a file based on its extension and MIME type.
 */
export function categorizeFile(name: string, mimeType: string): AttachmentCategory {
  const ext = getExtension(name);

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return "unsupported";
  }

  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return "image";
  }

  if (["json", "csv", "tsv", "yaml", "yml", "xml", "toml"].includes(ext)) {
    return "structured";
  }

  if (["js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "cs", "rb", "php", "sql", "html", "css", "sh"].includes(ext)) {
    return "code";
  }

  if (["txt", "md", "markdown", "log", "rtf"].includes(ext) || mimeType.startsWith("text/")) {
    return "text";
  }

  return "unsupported";
}

export function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase().trim() : "";
}

/**
 * Validates file size, extension, and dangerous payloads.
 */
export function validateAttachment(
  file: File,
  existingCount: number,
  limits: AttachmentValidationLimits = DEFAULT_ATTACHMENT_LIMITS
): { isValid: boolean; status: AttachmentStatus; error?: string } {
  if (existingCount >= limits.maxAttachmentsCount) {
    return {
      isValid: false,
      status: "ERROR",
      error: `Maximum attachment limit reached (${limits.maxAttachmentsCount} files).`,
    };
  }

  const ext = getExtension(file.name);
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      status: "UNSUPPORTED",
      error: `Executable or script files (.${ext}) are not permitted.`,
    };
  }

  if (!limits.allowedExtensions.includes(ext) && !file.type.startsWith("text/")) {
    return {
      isValid: false,
      status: "UNSUPPORTED",
      error: `Unsupported file type (.${ext || "unknown"}).`,
    };
  }

  if (file.size > limits.maxFileSize) {
    return {
      isValid: false,
      status: "TOO_LARGE",
      error: `File size exceeds ${(limits.maxFileSize / (1024 * 1024)).toFixed(1)} MB limit.`,
    };
  }

  return { isValid: true, status: "READY" };
}

/**
 * Reads and prepares local file content safely into internal context representation.
 */
export async function prepareFileContext(
  file: File,
  attachmentId: string
): Promise<PreparedAttachmentContext> {
  const category = categorizeFile(file.name, file.type);
  const sizeBytes = file.size;

  if (category === "image") {
    const base64Data = await readAsDataURL(file);
    return {
      attachmentId,
      name: file.name,
      category,
      mimeType: file.type || "image/png",
      sizeBytes,
      base64Data,
      charCount: base64Data.length,
      isMultimodal: true,
    };
  }

  // Text, code, structured files
  const textContent = await readAsText(file);
  return {
    attachmentId,
    name: file.name,
    category,
    mimeType: file.type || "text/plain",
    sizeBytes,
    textContent,
    charCount: textContent.length,
    isMultimodal: false,
  };
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read text file: ${file.name}`));
    reader.readAsText(file);
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read image file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Formats prepared text attachments into structured prompt context.
 */
export function formatAttachmentsAsPromptContext(
  contexts: PreparedAttachmentContext[]
): string {
  if (contexts.length === 0) return "";

  const sections: string[] = [];

  for (const ctx of contexts) {
    if (ctx.textContent) {
      sections.push(
        `--- Attached File: ${ctx.name} (${ctx.category}) ---\n${ctx.textContent}\n--- End of ${ctx.name} ---`
      );
    } else if (ctx.isMultimodal) {
      sections.push(`[Attached Image: ${ctx.name} (${ctx.mimeType})]`);
    }
  }

  return sections.join("\n\n");
}
