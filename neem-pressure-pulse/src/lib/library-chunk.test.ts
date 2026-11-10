import { describe, expect, it } from "vitest";
import { chunkPages } from "./library-chunk";

describe("chunkPages", () => {
  it("keeps the page number on every chunk and covers the whole text", () => {
    const text = "word ".repeat(1000);
    const chunks = chunkPages([{ page: 7, text }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.page === 7 && c.content.length <= 1800)).toBe(true);
    expect(chunks.at(-1)!.content.endsWith("word")).toBe(true);
  });
  it("skips empty pages", () => {
    expect(chunkPages([{ page: 1, text: "   " }])).toEqual([]);
  });
});
