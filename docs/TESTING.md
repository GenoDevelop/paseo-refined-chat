# Manual verification guide

There is intentionally **no hosted CI**. Run these checks locally before merging
this PR and after updating the Paseo SDK.

## Static check

```powershell
npm ci
npm run typecheck
```

Run from the repository root, using the Node/npm version supported by Paseo.
No GitHub Actions minutes are consumed.

## Typography

- Open **Settings → Plugins → Refined Chat**.
- Test each percentage field with `100`, `112.5`, `127,5` and `200`.
- Test invalid/empty/non-numeric input and values outside **50–300**. An
  invalid field must show a warning without changing the saved value.
- Press Enter and click outside the input to confirm both commit paths.
- Reload Paseo and verify that the last valid values persist independently.
- Use **Reset defaults** and check all scales return to 100%.
- In a long Markdown reply verify headings, lists, tables, inline code and
  code fences; increasing Reply should not change code-fence font size.
- Test a large Bash output, diff, file read, and MCP card. Increasing Tool
  should not alter body text of a fenced code block; increasing Code should
  not alter card titles and status badges.
- Confirm terminal and diff line numbers remain aligned when Code is larger.
- Compare Document, Compact and Terminal Markdown variants.
- Verify changes in both light and dark themes and at a narrow desktop width.

## Collapsing behavior

- Defaults: nothing folds on its own. "Only fold longer cards" and the
  per-kind lists are empty.
- Under "Collapse when finished", pick a kind, start a long call of that kind
  and watch it finish. The card should fold on success if untouched.
- Under "Start collapsed", pick a kind: its cards open folded, even if the call
  later fails. Those kinds appear dimmed and locked under "Collapse when
  finished". When every kind starts collapsed, "Only fold longer cards" dims.
- A manual expand or collapse must not be overridden.
- Failed calls and Ask/question cards stay open unless start-collapsed.
- A failed edit or write shows no `+X -Y` count, and a failed edit labels its
  diff "Not applied".
- Verify the **Collapse** action at the bottom of an expanded long card.
- Switch the rules off again and verify the original display returns.

## Interoperability

- Keep the original Beautiful Chat plugin disabled. Both intercept the
  same Paseo timeline and should not be activated simultaneously.
- Check rendering separately in Codex and Claude Code conversations.

## Current verification status

There is no automated test suite. `npm run typecheck` must pass, and each
change is checked by hand in a running Paseo (`paseo plugin reload`) on a dark
and a light theme. Each PR states what was and was not exercised.
