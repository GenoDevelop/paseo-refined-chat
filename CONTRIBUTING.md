# Contributing to Refined Chat

Refined Chat is an independent MIT-licensed fork of
[Beautiful Chat](https://github.com/ABorakati/beautiful-chat).

## Working locally

1. Fork this repository and create a focused feature branch.
2. Install dependencies using `npm ci`.
3. Implement and document the change.
4. Run `npm run typecheck` locally and include the result in your PR.
5. Follow [the manual testing checklist](docs/TESTING.md) for visual changes.
6. Describe behavior, manual testing, risks and relevant screenshots.
7. Link any source PRs or commits from which code was adapted.

**No hosted CI is configured.** Please do not add GitHub Actions or
other hosted jobs consuming runner minutes without prior discussion.

## Contributions and licensing

The repository's code is released under MIT. Keep the original ABorakati
MIT copyright notice, provenance and Git history. The embedded Inter and
Iosevka fonts retain their independent SIL OFL 1.1 terms; see
`THIRD_PARTY_NOTICES.md`.

When importing code from another community PR, verify its license and
preserve contributor attribution. This applies to unmerged upstream PRs too.

No copyright assignment or CLA is currently requested.
