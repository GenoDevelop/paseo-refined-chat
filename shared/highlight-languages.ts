/** Source grammars shared by file previews and diff bodies. */
export const HIGHLIGHT_EXTENSIONS: Record<string, string> = {
  cs: "csharp",
  razor: "razor",
  cshtml: "razor",
  java: "java",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  py: "python",
  pyi: "python",
  diff: "diff",
  patch: "diff",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  rs: "rust",
  go: "go",
  html: "html",
  htm: "html",
  css: "css",
  sql: "sql",
  toml: "toml",
  dockerfile: "docker",
  ps1: "powershell",
  psm1: "powershell",
};

export function fileHighlightLanguage(filename?: string): string | null {
  const base = (filename || "").replace(/\\/g, "/").split("/").pop()?.trim().toLowerCase() || "";
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "docker";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? HIGHLIGHT_EXTENSIONS[base.slice(dot + 1)] ?? null : null;
}
