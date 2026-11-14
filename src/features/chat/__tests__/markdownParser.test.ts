import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks } from "../utils/markdownParser.ts";

describe("Step 80 — Safe Markdown Parser & Block Tokenizer", () => {
  describe("Block Level Parsing", () => {
    it("parses headings correctly", () => {
      const input = "# Main Title\n\n## Subtitle\n\n### Section";
      const blocks = parseBlocks(input);
      assert.equal(blocks.length, 3);
      assert.equal(blocks[0].kind, "heading");
      if (blocks[0].kind === "heading") {
        assert.equal(blocks[0].level, 1);
        assert.equal(blocks[0].content, "Main Title");
      }
      if (blocks[1].kind === "heading") {
        assert.equal(blocks[1].level, 2);
        assert.equal(blocks[1].content, "Subtitle");
      }
    });

    it("parses fenced code blocks with language identifiers", () => {
      const input = "Here is code:\n\n```typescript\nconst x: number = 42;\nconsole.log(x);\n```\n\nEnd of code.";
      const blocks = parseBlocks(input);
      assert.equal(blocks.length, 3);
      assert.equal(blocks[0].kind, "paragraph");
      assert.equal(blocks[1].kind, "code");
      if (blocks[1].kind === "code") {
        assert.equal(blocks[1].language, "typescript");
        assert.equal(blocks[1].content, "const x: number = 42;\nconsole.log(x);");
      }
    });

    it("gracefully parses unclosed code blocks during streaming", () => {
      const input = "Starting code:\n\n```python\ndef solve():\n    return True";
      const blocks = parseBlocks(input);
      assert.equal(blocks.length, 2);
      assert.equal(blocks[1].kind, "code");
      if (blocks[1].kind === "code") {
        assert.equal(blocks[1].language, "python");
        assert.ok(blocks[1].content.includes("def solve():"));
      }
    });

    it("parses unordered and ordered lists", () => {
      const unordered = "- First\n- Second\n- Third";
      const uBlocks = parseBlocks(unordered);
      assert.equal(uBlocks.length, 1);
      assert.equal(uBlocks[0].kind, "unordered-list");
      if (uBlocks[0].kind === "unordered-list") {
        assert.equal(uBlocks[0].items.length, 3);
        assert.equal(uBlocks[0].items[0], "First");
      }

      const ordered = "1. Step One\n2. Step Two";
      const oBlocks = parseBlocks(ordered);
      assert.equal(oBlocks.length, 1);
      assert.equal(oBlocks[0].kind, "ordered-list");
      if (oBlocks[0].kind === "ordered-list") {
        assert.equal(oBlocks[0].items.length, 2);
        assert.equal(oBlocks[0].items[1], "Step Two");
      }
    });

    it("parses blockquotes", () => {
      const input = "> Note: This is an important system invariant.\n> Additional line.";
      const blocks = parseBlocks(input);
      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].kind, "blockquote");
      if (blocks[0].kind === "blockquote") {
        assert.ok(blocks[0].content.includes("invariant"));
      }
    });
  });

  describe("Security & Invariant Boundaries", () => {
    it("treats raw HTML script tags as inert plain text in paragraphs", () => {
      const input = "Hello <script>alert(1)</script> World";
      const blocks = parseBlocks(input);
      assert.equal(blocks.length, 1);
      assert.equal(blocks[0].kind, "paragraph");
      if (blocks[0].kind === "paragraph") {
        assert.equal(blocks[0].content, "Hello <script>alert(1)</script> World");
      }
    });
  });
});

