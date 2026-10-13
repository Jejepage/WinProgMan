import { describe, expect, it } from "vitest";
import { normalizeLinkTarget } from "../src/domain/links";

describe("link target normalization", () => {
  it("makes bare web domains usable while preserving paths and queries", () => {
    expect(normalizeLinkTarget("  example.com  ")).toBe("https://example.com");
    expect(normalizeLinkTarget("www.example.de/docs?q=a#part")).toBe(
      "https://www.example.de/docs?q=a#part",
    );
    expect(normalizeLinkTarget("example.com:8443/docs")).toBe(
      "https://example.com:8443/docs",
    );
  });
  it("preserves explicit protocols and local or ambiguous paths", () => {
    for (const value of [
      "https://example.com",
      "http://example.com",
      "mailto:a@example.com",
      "tel:123",
      "C:\\Docs\\example.com",
      "\\\\server\\share",
      "./example.com",
      "../example.com",
      "/example.com",
      "~/example.com",
      "docs/file.txt",
      "localhost",
      "example.c",
      "example.com/a b",
    ]) {
      expect(normalizeLinkTarget(value)).toBe(value);
    }
  });
  it("does not turn credentials, invalid hosts or unsafe protocols into web links", () => {
    for (const value of [
      "user@example.com",
      "example.com@evil.test",
      "-bad.example.com",
      "bad_.example.com",
      "example.com:99999",
      "javascript:alert(1)",
      "data:text/html,test",
      "//evil.test",
    ]) {
      expect(normalizeLinkTarget(value)).toBe(value);
    }
  });
});
