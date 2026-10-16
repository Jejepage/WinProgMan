import { describe, expect, it } from "vitest";
import {
  classifyLinkTarget,
  folderPath,
  normalizeLinkTarget,
} from "../src/domain/links";

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

describe("link destination classification", () => {
  it("identifies folder paths and converts file URLs without allowing device paths", () => {
    expect(folderPath("C:\\Users\\User\\Documents\\")).toBe(
      "C:\\Users\\User\\Documents\\",
    );
    expect(folderPath("\\\\server\\share\\folder")).toBe(
      "\\\\server\\share\\folder",
    );
    expect(folderPath("file:///C:/My%20Folder/")).toBe("C:\\My Folder\\");
    expect(folderPath("file://server/share/docs/")).toBe(
      "\\\\server\\share\\docs\\",
    );
    expect(classifyLinkTarget("C:\\Docs").kind).toBe("folder");
    for (const target of [
      "C:relative",
      "\\\\?\\C:\\Docs",
      "\\\\.\\pipe\\test",
      "C:\\Docs:stream",
      "file:///C:/Docs?run=test",
      "file:///C:/Docs#test",
      "file:///C:/bad%00name",
      "file:///C:/bad%ZZ",
      "C:\\nul",
      "C:\\Docs\\a*",
      "javascript:alert(1)",
    ]) {
      expect(folderPath(target), target).toBeUndefined();
      expect(classifyLinkTarget(target).kind, target).toBe("unknown");
    }
  });
  it("marks SharePoint only for its actual hostname and subdomains", () => {
    for (const target of [
      "https://tenant.sharepoint.com/sites/team",
      "tenant.sharepoint.com",
      "https://SHAREPOINT.COM/",
    ]) {
      expect(classifyLinkTarget(target).kind).toBe("sharepoint");
    }
    for (const target of [
      "https://sharepoint.com.evil.test",
      "https://notsharepoint.com",
      "https://example.com/sharepoint.com",
    ]) {
      expect(classifyLinkTarget(target).kind).toBe("web");
    }
    expect(classifyLinkTarget("https://sharepoint.com@evil.test").kind).toBe(
      "unknown",
    );
    expect(classifyLinkTarget("example.com")).toEqual({
      kind: "web",
      href: "https://example.com",
    });
    expect(classifyLinkTarget("mailto:a@example.com").kind).toBe("email");
    expect(classifyLinkTarget("tel:123").kind).toBe("phone");
  });
});
