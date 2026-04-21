import { describe, it, expect } from "bun:test";
import { handleRedirectUser, REDIRECT_MARKER_PREFIX, REDIRECT_MARKER_SUFFIX } from "../../lib/tools/redirectUser";

describe("handleRedirectUser", () => {
  const baseInput = {
    url: "https://linkedin.com/export",
    label: "Export LinkedIn Data",
    reason: "We need your LinkedIn export to build your profile.",
  };

  it("returns success: true", () => {
    const result = handleRedirectUser(baseInput);
    expect(result.success).toBe(true);
  });

  it("echoes all input fields into the redirect payload", () => {
    const result = handleRedirectUser(baseInput);
    expect(result.redirect.url).toBe(baseInput.url);
    expect(result.redirect.label).toBe(baseInput.label);
    expect(result.redirect.reason).toBe(baseInput.reason);
  });

  it("defaults open_in_new_tab to true when not specified", () => {
    const result = handleRedirectUser(baseInput);
    expect(result.redirect.open_in_new_tab).toBe(true);
  });

  it("respects open_in_new_tab: false", () => {
    const result = handleRedirectUser({ ...baseInput, open_in_new_tab: false });
    expect(result.redirect.open_in_new_tab).toBe(false);
  });

  it("includes a human-readable message string", () => {
    const result = handleRedirectUser(baseInput);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("redirect stream marker constants", () => {
  it("prefix starts with a null byte", () => {
    expect(REDIRECT_MARKER_PREFIX.charCodeAt(0)).toBe(0);
  });

  it("suffix is a null byte", () => {
    expect(REDIRECT_MARKER_SUFFIX).toBe("\x00");
  });

  it("a payload can be round-tripped through the marker format", () => {
    const payload = { url: "https://example.com", label: "Go", reason: "test", open_in_new_tab: true };
    const serialized = `${REDIRECT_MARKER_PREFIX}${JSON.stringify(payload)}${REDIRECT_MARKER_SUFFIX}`;

    // Extract the JSON between markers
    const start = serialized.indexOf(REDIRECT_MARKER_PREFIX) + REDIRECT_MARKER_PREFIX.length;
    const end = serialized.lastIndexOf(REDIRECT_MARKER_SUFFIX);
    const parsed = JSON.parse(serialized.slice(start, end));

    expect(parsed).toEqual(payload);
  });
});
