/**
 * Layout-aware hierarchical section chunking.
 * Splits long-form text (resumes, LinkedIn exports) into top-level sections
 * (each job/project), with sub-chunks for bullet points within each section.
 */

export type Chunk = {
  heading: string;
  body: string;
  bullets: string[];
};

const SECTION_HEADING_RE = /^([A-Z][A-Z\s&/,]{2,})\s*$/m;
const BULLET_RE = /^[\s]*[•\-–—*►▸]\s+(.+)$/;

export function chunkResume(text: string): Chunk[] {
  const lines = text.split("\n").map((l) => l.trimEnd());
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  let bodyLines: string[] = [];

  function flush() {
    if (!current) return;
    current.body = bodyLines.join(" ").replace(/\s+/g, " ").trim();
    if (current.heading || current.body || current.bullets.length) {
      chunks.push(current);
    }
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    const isHeading = SECTION_HEADING_RE.test(line);
    const bulletMatch = BULLET_RE.exec(line);

    if (isHeading) {
      flush();
      current = { heading: line.trim(), body: "", bullets: [] };
      bodyLines = [];
    } else if (bulletMatch && current) {
      current.bullets.push(bulletMatch[1].trim());
    } else {
      if (!current) {
        current = { heading: "", body: "", bullets: [] };
        bodyLines = [];
      }
      bodyLines.push(line);
    }
  }

  flush();
  return chunks;
}

export function chunksToEmbeddedText(chunk: Chunk): string {
  const parts = [chunk.heading, chunk.body, ...chunk.bullets].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
