export function hexMatches(text: string, prefix = ""): Array<{ index: number; hex: string }> {
  return Array.from(text.matchAll(/(?<![\p{L}\p{N}_/#?=&%.-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\p{L}\p{N}_-])/giu), m => ({ index: m.index!, hex: m[0] })).filter(m => !/^#[0-9]+$/.test(m.hex) || !/(?:\b(?:pr|pull[ \t]+requests?|issues?)|\b(?:refs?|fix(?:es)?|clos(?:e[sd]?|ing)|resolves?))[ \t]*(?:[:\u2013\u2014-][ \t]*)?$/i.test(prefix + text.slice(0, m.index)));
}
export function hexChannels(hex: string) {
  let value = hex.slice(1);
  if (value.length <= 4) value = [...value].map(c => c + c).join("");
  const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16);
  const alpha = value.length === 8 ? parseInt(value.slice(6), 16) / 255 : 1;
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, delta = max - min, l = (max + min) / 2;
  const hue = !delta ? 0 : max === r / 255 ? ((g - b) / 255 / delta + 6) % 6 : max === g / 255 ? (b - r) / 255 / delta + 2 : (r - g) / 255 / delta + 4;
  return { r, g, b, alpha, h: Math.round(hue * 60), s: Math.round(delta ? delta / (1 - Math.abs(2 * l - 1)) * 100 : 0), l: Math.round(l * 100) };
}
