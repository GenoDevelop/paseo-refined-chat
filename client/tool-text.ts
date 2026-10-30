/**
 * Keys a provider may carry a tool's readable result under, most specific
 * first. `details` is left out on purpose: it is a typed record that the cards
 * render from, and its text is never the prose of the answer.
 */
const TEXT_KEYS = ["stdout", "text", "content", "output", "result", "message"] as const;

const MAX_DEPTH = 3;

/**
 * The readable text of a tool result, whatever shape the provider wrapped it
 * in: a string, a list of text blocks (Claude's tool result), or a record that
 * nests either under one of `TEXT_KEYS`. Returns undefined rather than
 * stringifying the envelope, because a raw JSON dump is worse than an honest
 * empty card.
 */
export function extractToolText(value: unknown, depth = 0): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (!value || typeof value !== "object" || depth > MAX_DEPTH) return undefined;

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => extractToolText(entry, depth + 1))
      .filter((part): part is string => part !== undefined);
    return parts.length > 0 ? parts.join("\n") : undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const found = extractToolText(record[key], depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}
