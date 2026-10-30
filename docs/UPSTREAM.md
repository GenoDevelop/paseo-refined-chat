# Maintaining the upstream relationship

Refined Chat is a GitHub fork of
[ABorakati/beautiful-chat](https://github.com/ABorakati/beautiful-chat).
Keep the fork relationship and full original Git history.

Review upstream changes manually; do **not** merge automatically.
For a proposed update:

```bash
git remote add upstream https://github.com/ABorakati/beautiful-chat.git
git fetch upstream
git switch -c chore/review-upstream-update
git merge --no-commit --no-ff upstream/main
```

Inspect and resolve conflicts. Preserve Refined Chat's distinct
`paseo-plugin.json` ID, package name, browser storage namespace,
CSS/DOM identifiers, copyright notices and font licenses.

Verify with `npm ci` and `npm run typecheck` locally, then create
a PR. No hosted CI is configured.

Refined Chat has adapted changes from
[upstream PR #9](https://github.com/ABorakati/beautiful-chat/pull/9),
credited to Moyf in `NOTICE.md`. These changes were ported individually,
not merged into upstream main. When syncing future upstream changes, resolve
any duplicate or overlapping edits explicitly.

Avoid enabling Beautiful Chat and Refined Chat simultaneously;
both replace the same timeline surfaces in Paseo.
