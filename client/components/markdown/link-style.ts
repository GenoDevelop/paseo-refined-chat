import { Platform } from "react-native";
import type { TextProps } from "react-native";
import { BRAND_PATHS } from "../glyph";

const STYLE_ELEMENT_ID = "refined-chat-links";

/** What a link points at, which picks its icon. */
export type LinkKind = "github" | "mail" | "web";

/**
 * A link in a reply is text the agent wrote, so its target is untrusted input
 * and the label can say anything. The reader needs to see where it goes before
 * clicking, and a Text nested in a sentence cannot carry a tooltip View: a View
 * there breaks the line box and drops the words out of the paragraph's
 * selection. The address therefore rides on a data attribute and a CSS rule
 * draws it, the same way the frosted surface and the glow reach their nodes.
 */
const svg = (body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${body}</svg>`,
  )}")`;

const GITHUB_ICON = svg(`<path fill='black' d='${BRAND_PATHS.GitHub.d}'/>`);
const WEB_ICON = svg(
  "<path fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' d='M7 17 17 7M8 7h9v9'/>",
);
const MAIL_ICON = svg(
  "<path fill='none' stroke='black' stroke-width='2.2' stroke-linejoin='round' d='M3 6h18v12H3zM3 7l9 7 9-7'/>",
);

const WARN_ICON = svg(
  "<path fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' d='M12 3 22 20H2zM12 10v4.5M12 17.6v.1'/>",
);

const RULE = `[data-rclink] {
  position: relative;
  text-decoration: none;
  cursor: pointer;
}
[data-rclink]:hover {
  /* Drawn, not \`text-decoration: dashed\`: that scales dash and gap with the
     line's thickness, and a thin line then gets long dashes and wide gaps. */
  background-image: repeating-linear-gradient(
    90deg,
    currentColor 0 3px,
    transparent 3px 5px
  );
  background-size: 100% 1px;
  background-position: 0 calc(100% - 1px);
  background-repeat: no-repeat;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
/* The line starts after the icon: icon width plus its margin. */
[data-rclink]:not([data-rckind="bare"]):hover {
  background-size: calc(100% - 1.08em) 1px;
  background-position: 1.08em calc(100% - 1px);
}
[data-rclink]:not([data-rckind="bare"])::before {
  content: "";
  display: inline-block;
  width: 0.8em;
  height: 0.8em;
  margin-right: 0.28em;
  vertical-align: -0.06em;
  background-color: currentColor;
  -webkit-mask: var(--rcicon) center / contain no-repeat;
  mask: var(--rcicon) center / contain no-repeat;
}
[data-rckind="github"] { --rcicon: ${GITHUB_ICON}; }
[data-rckind="web"] { --rcicon: ${WEB_ICON}; }
[data-rckind="mail"] { --rcicon: ${MAIL_ICON}; }
[data-rclink][data-rchref]:hover::after {
  content: attr(data-rchref);
  position: absolute;
  z-index: 50;
  left: 0;
  bottom: 100%;
  margin-bottom: 6px;
  width: max-content;
  max-width: min(520px, 80vw);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.35);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: 0;
  text-decoration: none;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
  pointer-events: none;
  /* One dark pill on every theme: it must read over any text behind it. */
  background: #1f1f23;
  color: #f4f4f5;
}
/* The label names one site and the target is another: only the icon turns
   into an amber warning mark, so the link keeps its look and the sentence
   stays calm. The tooltip says what the label claims. */
[data-rclink][data-rcwarn]::before {
  --rcicon: ${WARN_ICON};
  background-color: #f59e0b;
}
[data-rclink][data-rcwarn]:hover::after {
  content: "\\26A0  Label says " attr(data-rcshown) ", but this opens " attr(data-rchref);
  background: #3b2a05;
  color: #fde7b0;
  border: 1.5px solid #f59e0b;
  font-weight: 600;
}`;

/** Installs the link rule once. Off web there is no CSS and the links keep their underline. */
export function installLinkStyle(): () => void {
  if (typeof document === "undefined") return () => {};
  if (document.getElementById(STYLE_ELEMENT_ID)) return () => {};
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = RULE;
  document.head.appendChild(style);
  return () => style.remove();
}

function hostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function linkKind(href: string): LinkKind {
  if (/^mailto:/i.test(href)) return "mail";
  const host = hostname(href);
  return host === "github.com" || host?.endsWith(".github.com") ? "github" : "web";
}

/**
 * A file name such as `tool-collapse.ts` has the shape of an address, and some
 * of these extensions are real country domains. A bare label with one of them is
 * read as a file, not as a claim about a site, so it is not compared with the
 * target.
 */
const FILE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "mdx", "py", "rs", "sh", "yml", "yaml",
  "toml", "txt", "css", "scss", "html", "xml", "lock", "log", "cs", "rb", "php", "java", "kt",
  "swift", "c", "h", "cpp", "sql", "env", "cfg", "ini",
]);

/** True when the label reads as an address of its own that the target does not match. */
function labelMisleads(label: string, href: string): boolean {
  const text = label.trim();
  if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text)) return false;
  if (!/^https?:/i.test(text)) {
    const extension = text.split("/")[0]!.split(".").pop()!.toLowerCase();
    if (FILE_EXTENSIONS.has(extension)) return false;
  }
  const shown = hostname(/^https?:/i.test(text) ? text : `https://${text}`);
  const target = hostname(href);
  return Boolean(shown && target && shown !== target && !target.endsWith(`.${shown}`));
}

/**
 * On web the stylesheet draws the underline on hover; a touch screen has no
 * hover, so it keeps a permanent one.
 */
export const LINK_UNDERLINE = Platform.OS === "web" ? "none" : "underline";

/**
 * For a card's own link, such as a file path: the hover underline and the
 * pointer, but no icon and no address bubble. The card already says what the
 * text is, and its clipped surface would cut the bubble off.
 */
export function plainLinkProps(): TextProps {
  if (Platform.OS !== "web") return {};
  return { dataSet: { rclink: true, rckind: "bare" } } as unknown as TextProps;
}

/** Web-only attributes for one link; the cast is needed because `TextProps` has no `dataSet`. */
export function linkProps(href: string, label: string): TextProps {
  const bare = label.trim() === href.trim();
  return {
    dataSet: {
      rclink: true,
      rckind: bare ? "bare" : linkKind(href),
      rchref: href,
      ...(labelMisleads(label, href) ? { rcwarn: true, rcshown: label.trim() } : {}),
    },
  } as unknown as TextProps;
}
