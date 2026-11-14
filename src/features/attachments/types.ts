/**
 * Nano Route — Local Attachment & File Context Types
 * File: src/features/attachments/types.ts
 *
 * Implements Step 79:
 * - Local attachment lifecycle and state representations
 * - Supported file type taxonomy and category definitions
 * - File validation outcomes and error classifications
 * - Prepared context payload representation for downstream Step 76 preflight
 */

export type AttachmentCategory =
  | "text"
  | "code"
  | "document"
  | "structured"
  | "image"
  | "unsupported";

export type AttachmentStatus =
  | "SELECTED"
  | "VALIDATING"
  | "PREPARING"
  | "READY"
  | "UNSUPPORTED"
  | "TOO_LARGE"
  | "UNREADABLE"
  | "ERROR";

export interface AttachmentMetadata {
  id: string;
  name: string;
  sizeBytes: number;
  extension: string;
  mimeType: string;
  category: AttachmentCategory;
  lastModified?: number;
}

export interface PreparedAttachmentContext {
  attachmentId: string;
  name: string;
  category: AttachmentCategory;
  mimeType: string;
  sizeBytes: number;
  textContent?: string;
  base64Data?: string;
  charCount: number;
  isMultimodal: boolean;
}

export interface LocalAttachment {
  id: string;
  file: File;
  metadata: AttachmentMetadata;
  status: AttachmentStatus;
  errorMessage?: string;
  preparedContext?: PreparedAttachmentContext;
}

export interface AttachmentValidationLimits {
  maxFileSize: number; // Bytes (default: 2 MB)
  maxAttachmentsCount: number; // default: 5
  maxAggregateCharacters: number; // default: 60,000 characters
  allowedExtensions: string[];
}

