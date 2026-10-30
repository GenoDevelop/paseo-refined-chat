# Changelog

All notable changes to Refined Chat are documented here.
The project is an independent MIT-licensed fork of Beautiful Chat.

## [Unreleased]

### Added
- Long tool output folds after a finished call: command output keeps its start and end (default 20 lines) and file reads, writes and diffs keep their first lines (default 30), each behind a "Show N more lines" control. Both limits are settings; 0 turns folding off. Copy still copies everything, and the find bar opens the folded blocks that contain the search and folds them again on close.
- Edit cards show a diff for providers that report an edit as the replaced and replacement text only (Claude, Codex, opencode), instead of a bare "[Edit: diff applied]".
- Edit and write cards show `+X -Y` beside the file name; read cards show how many lines came back, or which (`lines 120-179`) when the read began mid-file.
- Diffs draw old and new line numbers in two columns. For a diff built from old and new text the daemon locates the written text in the file; if it cannot do so unambiguously, no numbers are drawn rather than wrong ones.
- A changed word or value inside a modified line is highlighted more strongly than the rest of the row.
- Reads that start mid-file number their lines from the real first line.
- Read, edit and write cards are titled with the file name alone; the tool is already named by the pill beside it.

### Changed
- The time under a prompt or a reply always includes seconds, and carries the weekday (within a week) or the date (older) when the message is not from today. Prompts previously showed only the clock.

### Fixed
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
