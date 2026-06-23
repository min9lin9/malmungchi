import { describe, expect, it } from "bun:test";
import { parseQuery } from "../src/search/query";

describe("query parser", () => {
  it("parses plain terms as AND", () => {
    const parsed = parseQuery("product market fit");
    expect(parsed.phrases).toEqual([]);
    expect(parsed.terms).toEqual(["product", "market", "fit"]);
    expect(parsed.operator).toBe("and");
  });

  it("extracts quoted phrases", () => {
    const parsed = parseQuery('"product market fit" hiring');
    expect(parsed.phrases).toEqual(["product market fit"]);
    expect(parsed.terms).toEqual(["hiring"]);
    expect(parsed.operator).toBe("and");
  });

  it("detects OR operator", () => {
    const parsed = parseQuery("product OR market");
    expect(parsed.phrases).toEqual([]);
    expect(parsed.terms).toEqual(["product", "market"]);
    expect(parsed.operator).toBe("or");
  });

  it("ignores short tokens", () => {
    const parsed = parseQuery('a "b" product');
    expect(parsed.phrases).toEqual([]);
    expect(parsed.terms).toEqual(["product"]);
  });

  it("ignores short phrases", () => {
    const parsed = parseQuery('"x" product');
    expect(parsed.phrases).toEqual([]);
    expect(parsed.terms).toEqual(["product"]);
  });
});
