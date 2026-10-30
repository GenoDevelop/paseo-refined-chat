# Changelog

All notable changes to Refined Chat are documented here.
The project is an independent MIT-licensed fork of Beautiful Chat.

## [Unreleased]

### Fixed
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
