import { planTitle } from "./plan";

/** Keep Unicode titles while excluding path separators and Windows file-name syntax. */
export function planExportFilename(markdown: string): string {
  const slug = planTitle(markdown).normalize("NFC").toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[. -]+|[. -]+$/g, "");
  return `plan-${Array.from(slug).slice(0, 96).join("").replace(/[. -]+$/g, "") || "untitled"}.md`;
}

/** Download the original Markdown on this client, without writing into the project. */
export function downloadPlanMarkdown(markdown: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("File downloads are unavailable on this client");
  }
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = planExportFilename(markdown);
    document.body.appendChild(link);
    link.click();
    // Let the browser start the download before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
}
