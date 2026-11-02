import type { MdBlock, MdInline } from "./parse";

/**
 * Whether a span run holds `==mark==`, which only this plugin draws. The host's
 * renderer would print the equals signs, so a block with one stays here.
 */
function hasMark(spans: MdInline[]): boolean {
  return spans.some((span) => {
    if (span.kind === "mark") return true;
    return "spans" in span && hasMark(span.spans);
  });
}

/**
 * Whether Paseo's own native renderer can draw a block with nothing lost.
 *
 * On iOS that renderer is a native text view, and the plugin's React Native
 * `Text` is not: a selection starts in the first and never in the second. Prose,
 * headings, lists and quotes go to it. Code, tables, pictures and the degraded
 * unclosed case stay with the plugin, which draws them with its own highlighting,
 * folding and path links.
 */
export function isNativeBlock(block: MdBlock, marks: boolean): boolean {
  // With marks off the plugin prints the equals signs as typed, as the host does.
  const plain = (spans: MdInline[]) => !marks || !hasMark(spans);
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return plain(block.spans);
    case "list":
      return block.items.every((item) => plain(item.spans));
    case "quote":
      return block.paragraphs.every(plain);
    case "rule":
      return true;
    default:
      return false;
  }
}

/**
 * The Markdown source of blocks `from` up to `to`, cut from the reply by the
 * line each block opened on. The native renderer takes source text, not nodes.
 */
export function blockSource(lines: string[], starts: number[], from: number, to: number): string {
  const end = to < starts.length ? starts[to]! : lines.length;
  return lines.slice(starts[from], end).join("\n").trimEnd();
}
