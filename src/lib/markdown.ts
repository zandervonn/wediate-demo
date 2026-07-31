function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMarkdown(text: string): string {
  const source = escapeHtml(text || "").replace(/\r\n/g, "\n");
  const fencedBlocks: string[] = [];
  let safe = source.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `@@CODEBLOCK${fencedBlocks.length}@@`;
    fencedBlocks.push(`<pre><code>${String(code).trim()}</code></pre>`);
    return token;
  });

  safe = safe
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  const blocks = safe.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const html = blocks
    .map((block) => {
      if (/^@@CODEBLOCK\d+@@$/.test(block)) return block;
      if (/^(?:[-*] .+(?:\n|$))+/.test(block)) {
        const items = block.split("\n").map((line) => line.replace(/^[-*]\s+/, "").trim());
        return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      }
      if (/^(?:\d+\. .+(?:\n|$))+/.test(block)) {
        // Items are routinely sent as their own paragraph, so each lands in its
        // own block. Carry the written number through (the bot's `2.` is a list
        // starting at 2, not a fresh `1.`) so blank-line-separated items keep
        // counting up instead of all rendering as "1.".
        const start = Number(block.match(/^(\d+)\./)?.[1] ?? 1);
        const items = block.split("\n").map((line) => line.replace(/^\d+\.\s+/, "").trim());
        const startAttr = start !== 1 ? ` start="${start}"` : "";
        return `<ol${startAttr}>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
      }
      if (/^(?:&gt; .+(?:\n|$))+/.test(block)) {
        const quote = block.split("\n").map((line) => line.replace(/^&gt;\s?/, "")).join("<br>");
        return `<blockquote>${quote}</blockquote>`;
      }
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html.replace(/@@CODEBLOCK(\d+)@@/g, (_, idx) => fencedBlocks[Number(idx)] || "");
}

import type { RedactionHighlightSpan } from "./types";

/**
 * Spread clusters around the colour wheel deterministically. The fill stays
 * state-coloured (terracotta when protected, sage when shared — matching the
 * protection panel); this hue only tints the underline so two distinct
 * adjacent secrets remain visually separable.
 */
function rdxHue(clusterId: number): number {
  return (Math.abs(clusterId) * 67) % 360;
}

function normalizeHighlightSpans(
  text: string,
  spans: RedactionHighlightSpan[],
): RedactionHighlightSpan[] {
  const textLength = text.length;
  const candidates = spans
    .filter((span) =>
      Number.isFinite(span.start) &&
      Number.isFinite(span.end) &&
      span.start >= 0 &&
      span.end <= textLength &&
      span.start < span.end
    )
    .sort((a, b) =>
      a.start - b.start ||
      (b.end - b.start) - (a.end - a.start) ||
      a.cluster_id - b.cluster_id
    );

  const out: RedactionHighlightSpan[] = [];
  let lastEnd = -1;
  const seen = new Set<string>();
  for (const span of candidates) {
    const key = `${span.start}:${span.end}:${span.cluster_id}`;
    if (seen.has(key) || span.start < lastEnd) continue;
    out.push(span);
    seen.add(key);
    lastEnd = span.end;
  }
  return out;
}

/**
 * Render a message as markdown with read-only redaction highlights painted
 * over the protected spans.
 *
 * Spans carry character offsets into the *raw* text. We inject sentinel
 * tokens at those offsets (right-to-left, so earlier offsets stay valid),
 * run the normal markdown pass — the sentinels contain no markdown/HTML
 * characters, so they survive escaping and even nest cleanly inside bold or
 * italic — then swap the sentinels for `<mark>` wrappers. Offsets that don't
 * fit the text (stale poll vs. edited message) are skipped, never throwing.
 */
export function renderMarkdownWithHighlights(
  text: string,
  spans: RedactionHighlightSpan[],
): string {
  if (!spans || spans.length === 0) return renderMarkdown(text);
  const ordered = normalizeHighlightSpans(text, spans).sort((a, b) => b.start - a.start);
  if (ordered.length === 0) return renderMarkdown(text);
  let marked = text;
  for (const span of ordered) {
    const open = `@@RDX:${span.cluster_id}:${span.authorized ? 1 : 0}:${rdxHue(span.cluster_id)}@@`;
    marked =
      marked.slice(0, span.start) +
      open +
      marked.slice(span.start, span.end) +
      "@@RDXEND@@" +
      marked.slice(span.end);
  }
  return renderMarkdown(marked)
    .replace(
      /@@RDX:(-?\d+):(\d):(\d+)@@/g,
      (_, cid, auth, hue) => {
        const shared = auth === "1";
        // Hover points the user to the complete surface (the "Private terms"
        // list), so a mark is read as "a specific I typed, kept private" — and
        // the list, not the highlights, is understood as the full record.
        // No system jargon ("tag"/"redact") per the prompt voice rules.
        const title = shared
          ? "Shared — you’ve allowed the other side to see this."
          : "Protected — only you can see this specific. Open ‘Private terms’ to manage what you share.";
        return (
          `<mark class="rdx-hl${shared ? " shared" : ""}"` +
          ` data-cluster="${cid}" style="--rdx-hue:${hue}" title="${title}">`
        );
      },
    )
    .replace(/@@RDXEND@@/g, "</mark>");
}
