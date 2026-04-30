import { describe, it, expect, vi } from "vitest";
import {
  formatPageLine,
  formatHealth,
  formatPageDetail,
  formatLinks,
  formatTimeline,
  formatTraversal,
  output,
  success,
  warning,
  formatPairs,
} from "../../src/utils/format.js";
import { GlobalOptions } from "../../src/types.js";

describe("format", () => {
  const baseOpts: GlobalOptions = { json: false, quiet: false, verbose: false };
  const jsonOpts: GlobalOptions = { json: true, quiet: false, verbose: false };
  const quietOpts: GlobalOptions = { json: false, quiet: true, verbose: false };

  describe("formatPageLine", () => {
    it("formats a page with score", () => {
      const line = formatPageLine(
        { type: "person", title: "Garry Tan", slug: "people/garry-tan", score: 0.95 },
        baseOpts
      );
      expect(line).toContain("[person]");
      expect(line).toContain("Garry Tan");
      expect(line).toContain("people/garry-tan");
      expect(line).toContain("95%");
    });

    it("formats a page without score", () => {
      const line = formatPageLine(
        { type: "company", title: "OpenAI", slug: "companies/openai" },
        baseOpts
      );
      expect(line).toContain("[company]");
      expect(line).toContain("OpenAI");
      expect(line).not.toContain("%");
    });

    it("returns empty string in json mode", () => {
      const line = formatPageLine(
        { type: "person", title: "Test", slug: "test" },
        jsonOpts
      );
      expect(line).toBe("");
    });
  });

  describe("formatHealth", () => {
    it("formats health data correctly", () => {
      const result = formatHealth({
        page_count: 100,
        chunk_count: 250,
        link_count: 50,
        embed_coverage: 98,
        brain_score: 85,
        pages_by_type: { person: 30, company: 20, idea: 50 },
        most_connected: [
          { slug: "people/garry-tan", link_count: 15 },
        ],
      });
      expect(result).toContain("Brain Health");
      expect(result).toContain("100");
      expect(result).toContain("person: 30");
      expect(result).toContain("people/garry-tan");
    });
  });

  describe("formatPageDetail", () => {
    it("formats page with content and links", () => {
      const result = formatPageDetail({
        type: "person",
        title: "Garry Tan",
        slug: "people/garry-tan",
        content: "CEO of Y Combinator.",
        links: {
          outgoing: [{ title: "Y Combinator", link_type: "works_at" }],
          incoming: [],
        },
      });
      expect(result).toContain("[person]");
      expect(result).toContain("Garry Tan");
      expect(result).toContain("CEO of Y Combinator");
      expect(result).toContain("Y Combinator");
    });

    it("truncates long content", () => {
      const longContent = "a".repeat(1000);
      const result = formatPageDetail({
        type: "idea",
        title: "Big Idea",
        slug: "ideas/big",
        content: longContent,
      });
      expect(result).toContain("…");
    });
  });

  describe("formatLinks", () => {
    it("formats outgoing and incoming links", () => {
      const result = formatLinks({
        outgoing: [
          { title: "YC", link_type: "works_at" },
          { title: "Twitter", link_type: "social" },
        ],
        incoming: [{ title: "Preetham", link_type: "knows" }],
      });
      expect(result).toContain("Outgoing (2)");
      expect(result).toContain("Incoming (1)");
      expect(result).toContain("YC");
      expect(result).toContain("Preetham");
    });
  });

  describe("formatTimeline", () => {
    it("formats timeline entries", () => {
      const result = formatTimeline([
        { date: "2024-01-15", summary: "Met at YC", detail: "Demo day" },
      ]);
      expect(result).toContain("Timeline (1 entries)");
      expect(result).toContain("2024-01-15");
      expect(result).toContain("Met at YC");
      expect(result).toContain("Demo day");
    });

    it("handles empty timeline", () => {
      const result = formatTimeline([]);
      expect(result).toBe("No timeline entries.");
    });
  });

  describe("formatTraversal", () => {
    it("formats traversal results with indentation", () => {
      const result = formatTraversal(
        [
          { depth: 0, type: "person", title: "Preetham", slug: "people/preetham" },
          { depth: 1, type: "company", title: "Nous", slug: "companies/nous" },
        ],
        "people/preetham",
        "out",
        2
      );
      expect(result).toContain("Traversal from people/preetham");
      expect(result).toContain("Preetham");
      expect(result).toContain("Nous");
    });
  });

  describe("output", () => {
    it("prints JSON in json mode", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      output({ key: "value" }, jsonOpts);
      expect(spy).toHaveBeenCalledWith(JSON.stringify({ key: "value" }, null, 2));
      spy.mockRestore();
    });

    it("does nothing in quiet mode", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      output("hello", quietOpts);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("formatPairs", () => {
    it("aligns key-value pairs", () => {
      const result = formatPairs({ Name: "Garry", Type: "person", Age: 42 });
      expect(result).toContain("Name");
      expect(result).toContain("Garry");
    });
  });
});
