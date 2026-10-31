# Changelog

All notable changes to Refined Chat are documented here.
The project is an independent MIT-licensed fork of Beautiful Chat.

## [Unreleased]

### Added
- "Reply line spacing": a percentage (80% to 200%, default 100%) that sets the height of each line in assistant replies, apart from the text size. Body text, lists, tables and headings follow it; the gaps between blocks, tool cards and code do not.
- "Let Paseo fold tool calls and turns" (off by default). Paseo's Chat display can fold tool calls into one row, or a whole turn into its reply, but only for rows it draws itself, and this plugin replaces them with its own. With the setting on and Chat display set to Collapse tool calls, tool calls and reasoning are left to Paseo; with Collapse turns, prompts and replies are too. Rows are drawn once when they load, so after changing either setting reload the plugin or restart the app.
- Links in replies show where they go and look like links in Codex: an icon before the text (GitHub, mail or web), a dashed underline on hover, and the full address in a bubble above the link on hover. When the text reads as an address that differs from the real target, the icon turns into an amber warning and the bubble names both. File paths and links on tool cards get the same hover underline. Web and desktop only; a touch screen keeps its permanent underline.
- A command card (shell, git) says what the command did on the right of its header, folded or open: what git changed (`+53 −0`), how many lines the command printed (`8 lines`), or `no output`. A failed call keeps its exit code and a call that wrote to stderr shows none.
- Long prompts fold in the prompt bubble: past "Long prompts" lines (default 15, 0 never folds) a prompt shows its first rows behind a "Show full prompt" control. A long paragraph with no line breaks counts by about 70 characters a line. Copy still copies the whole prompt, and the find bar opens a folded prompt that holds the search.
- Code blocks in replies fold under the existing "Long code and diffs" limit, with the same "Show N more lines" control as tool cards.

### Changed
- The size of an edit, write or read (`+X −Y`, `N lines`, `lines A–B`) moved from beside the title to the right of the header, with the new command summary, so every card keeps its measurements in one place and a long file path no longer pushes them out.

## [0.3.0] - 2026-10-31

### Added
- Images in assistant replies: a paragraph holding only `![alt](src)` is drawn as the picture instead of an "Image" link: a small thumbnail with no frame, several in a row, with the description, size and weight shown over it on hover. Local files (`file://`) load through the daemon and `data:` images as they are. A remote `http(s)` image is a tile of the same size that names the server and waits for a "Load" click; the setting "Load remote images automatically (at your own risk)" lifts that, and is off by default because the agent writes the address. Pixel size and, where the server allows it, weight are read after a remote image loads.
- Pictures and image cards open in a viewer on click: never larger than the image's own size, the wheel zooms around the pointer, a drag moves it, two fingers pinch and move it on a touch screen, and buttons give zoom, 1:1 and fit. Esc, the close button or a click on the backdrop closes it.
- Folding also covers stderr, eval output and code, MCP input and response, GitHub replies, files and requests, and subagent prompts, under the same two settings. Hub cards are left whole.
- Long tool output folds after a finished call: command output keeps its start and end (default 20 lines) and file reads, writes and diffs keep their first lines (default 30), each behind a "Show N more lines" control. Both limits are settings; 0 turns folding off. Copy still copies everything, and the find bar opens the folded blocks that contain the search and folds them again on close.
- Edit cards show a diff for providers that report an edit as the replaced and replacement text only (Claude, Codex, opencode), instead of a bare "[Edit: diff applied]".
- Edit and write cards show `+X -Y` beside the file name; read cards show how many lines came back, or which (`lines 120-179`) when the read began mid-file.
- Diffs draw old and new line numbers in two columns. For a diff built from old and new text the daemon locates the written text in the file; if it cannot do so unambiguously, no numbers are drawn rather than wrong ones.
- A changed word or value inside a modified line is highlighted more strongly than the rest of the row.
- Reads that start mid-file number their lines from the real first line.
- Read, edit and write cards are titled with the file name alone; the tool is already named by the pill beside it.

### Changed
- Tool-card icons breathe only while the call is running; finished cards are still, which stops an animation loop on every card in a long chat.
- Turning "Frosted glass" off now drops the backdrop blur itself, not only the translucent tint, so surfaces are no longer re-filtered on every repaint.
- The time under a prompt or a reply always includes seconds, and carries the weekday (within a week) or the date (older) when the message is not from today. Prompts previously showed only the clock.

### Fixed
- Image and reveal paths keep spaces in file names: a path such as `my shot.png` was cut at the first space, and a `file://` URL with `%20` or a bare `%` no longer fails.
- A prompt that is only a pasted image is left to Paseo's own bubble instead of being redrawn as an empty one. A prompt with text and an image still loses the image in the enhanced bubble, because Paseo does not pass images to plugins; the "Enhanced prompt bubble" setting hands prompts back to the host.
- Shell tool cards show the full command: the header is one line ending in an ellipsis instead of cutting the command at 55 characters, and the expanded card shows the whole command above its output.
- PowerShell, pwsh, cmd and other command-line tools are drawn as shell cards with a `$ command` title. Previously they got the tool name as title and a `bash` label.
- A tool result delivered as a list of text blocks (as Claude does) is shown instead of "Command completed without output."
- A failed tool call now shows its error message. Providers that report the error as an object (for example Claude) previously rendered as `[object Object]` or as "Command completed without output."

## [0.2.0] - 2026-10-30

### Added
- First public Refined Chat release based on Beautiful Chat.
- Independent percentage controls for assistant replies, tool cards and code/terminal text.
- Decimal percentage input from 50% through 300%, with persistent preferences.
- Proportional Markdown typography and layout spacing for readable scaling.
- Optional auto-collapse of finished tool cards, respecting manual interactions.
- Optional collapsed reasoning and collapse controls at the bottom of long cards.
- Independent plugin ID, preference namespace and DOM/CSS identifiers.
- Project provenance and licenses for original code and embedded Inter/Iosevka fonts.
- Public catalog metadata, an inherited default chat screenshot and a dedicated listing overview. A new screenshot showing the added settings is still recommended before catalog submission.

### Changed
- Git installations prepare production dependencies from the existing lockfile without running npm lifecycle scripts.
- Auto-collapse and collapse-thinking remain **off** unless explicitly enabled.
- Minimum Paseo version for the listing metadata is 0.11.0.

### Attribution
- Original plugin: [ABorakati/beautiful-chat](https://github.com/ABorakati/beautiful-chat).
- Typography and folding architecture adapted from [Moyf's PR #9](https://github.com/ABorakati/beautiful-chat/pull/9).
- MIT license for code; SIL OFL 1.1 for embedded fonts.

### Verification
- The redesigned presentation was manually exercised in Paseo Desktop by the project maintainer. Clean release installation and packaging still require separate local verification.
- The initial repository has no GitHub Actions or hosted CI workflow.
- Maintainers and contributors should run `npm ci` and `npm run typecheck` locally before publishing changes.
