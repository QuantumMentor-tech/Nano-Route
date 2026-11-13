/**
//! Nano Route — Safe Pure-React Markdown Parser Core Functions
//! File: src/features/chat/utils/markdownParser.ts
//!
//! Pure parser functions decoupled from JSX/TSX for high-performance processing and Node testing.
*/

export type MarkdownBlock =
  | { kind: "code"; language: string; content: string }
  | { kind: "heading"; level: number; content: string }
  | { kind: "blockquote"; content: string }
  | { kind: "unordered-list"; items: string[] }
  | { kind: "ordered-list"; items: string[] }
  | { kind: "paragraph"; content: string };

/**
 * Parses raw text into discrete Markdown block tokens.
 */
export function parseBlocks(content: string): MarkdownBlock[] {
  const lines = content.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank lines: skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block: ```lang ... ```
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // skip closing ```
      }
      blocks.push({
        kind: "code",
        language: language || "",
        content: codeLines.join("\n"),
      });
      continue;
    }

    // Heading: #, ##, ###
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote: > ...
    if (line.startsWith(">")) {
      const quoteLines: string[] = [line.replace(/^>\s?/, "")];
      i++;
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        kind: "blockquote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // Unordered list item: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({
        kind: "unordered-list",
        items: listItems,
      });
      continue;
    }

    // Ordered list item: 1. , 2. , etc.
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({
        kind: "ordered-list",
        items: listItems,
      });
      continue;
    }

    // Paragraph
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].match(/^(#{1,6})\s+(.*)$/) &&
      !lines[i].startsWith(">") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({
      kind: "paragraph",
      content: paragraphLines.join("\n"),
    });
  }

  return blocks;
}
