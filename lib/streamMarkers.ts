// All null-byte delimited markers injected into the streaming response.
// Format: \x00MARKER_TYPE:payload\x00  (payload is optional)
// \x00 never appears in natural text or JSON, making it safe to parse by
// splitting on the null byte.

import type { RedirectPayload } from "@/lib/tools/redirectUser";

// ── Marker constants ─────────────────────────────────────────────────────────

export const REDIRECT_MARKER_PREFIX = "\x00REDIRECT:";
export const REDIRECT_MARKER_SUFFIX = "\x00";

// Emitted once per tool call, immediately before the tool executes.
export const TOOL_CALL_MARKER_PREFIX = "\x00TOOL:";
export const TOOL_CALL_MARKER_SUFFIX = "\x00";

// Emitted after all tool results for a round are pushed, signalling the client
// to open a fresh bubble for the next round of assistant text.
export const NEW_BUBBLE_MARKER = "\x00NEW_BUBBLE\x00";

// ── Stream parser ─────────────────────────────────────────────────────────────

export type ProcessedStream = {
  // One entry per assistant "turn" separated by NEW_BUBBLE markers.
  // Each string is the text content for that bubble (finalize tags NOT stripped).
  bubbles: string[];
  // The last TOOL marker seen since the most recent text token.
  // null once text arrives (tool call is no longer "in flight").
  toolStatus: string | null;
  // All REDIRECT payloads found in the stream so far.
  redirects: RedirectPayload[];
};

/**
 * Parse the full accumulated raw stream into per-bubble text, current tool
 * status, and redirect payloads.
 *
 * The stream is split on \x00; even-indexed segments are plain text,
 * odd-indexed segments are marker bodies (e.g. "TOOL:save_experience_block",
 * "NEW_BUBBLE", "REDIRECT:{...}").
 */
export function processStream(raw: string): ProcessedStream {
  const parts = raw.split("\x00");
  const bubbles: string[] = [""];
  const redirects: RedirectPayload[] = [];
  let toolStatus: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Plain text segment
      if (parts[i]) {
        bubbles[bubbles.length - 1] += parts[i];
        toolStatus = null; // text arrived — tool is no longer pending
      }
    } else {
      // Marker body segment
      const marker = parts[i];
      if (marker === "NEW_BUBBLE") {
        toolStatus = null; // tools done for this round
        bubbles.push("");
      } else if (marker.startsWith("TOOL:")) {
        toolStatus = marker.slice(5);
      } else if (marker.startsWith("REDIRECT:")) {
        try {
          redirects.push(JSON.parse(marker.slice(9)) as RedirectPayload);
        } catch { /* skip malformed */ }
      }
    }
  }

  return { bubbles, toolStatus, redirects };
}
