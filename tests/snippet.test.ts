import { describe, expect, it } from "bun:test";
import { buildSnippet } from "../src/search/snippet";

describe("snippet", () => {
  it("extracts a window around matching terms", () => {
    const text = "One two three four five six seven eight nine ten eleven twelve.";
    const snippet = buildSnippet(text, "seven");
    expect(snippet.toLowerCase()).toContain("seven");
  });

  it("prefers windows with more matches", () => {
    const text =
      "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu. " +
      "Product market fit is the key concept here and it matters a lot. " +
      "Nu xi omicron pi rho sigma tau upsilon phi chi psi omega.";
    const snippet = buildSnippet(text, "product market fit");
    expect(snippet.toLowerCase()).toContain("product");
    expect(snippet.toLowerCase()).toContain("market");
    expect(snippet.toLowerCase()).toContain("fit");
  });

  it("returns prefix for empty or non-matching query", () => {
    const text = "Hello world this is a transcript.";
    const snippet = buildSnippet(text, "xyznonsense");
    expect(snippet.length).toBeGreaterThan(0);
  });
});
