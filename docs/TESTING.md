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

- Defaults: both Auto-collapse tools and Collapse thinking are **off**.
- Enable auto-collapse, start a long tool call and watch it finish. The card
  should collapse upon successful completion if untouched.
- An earlier manual expand/collapse must not be overridden.
- Failed calls and Ask/question cards should remain accessible.
- Verify the **Collapse** action at the bottom of an expanded long card.
- Enable Collapse thinking and verify streaming reasoning starts closed,
  remains available on demand, and has a bottom collapse action.
- Disable both options and verify the original display behavior returns.

## Interoperability

- Keep the original Beautiful Chat plugin disabled. Both intercept the
  same Paseo timeline and should not be activated simultaneously.
- Check rendering separately in Codex and Claude Code conversations.

## Current verification status

The patch is code-reviewed and mechanically checked against upstream PR #9.
Full `npm ci && npm run typecheck` and Paseo UI smoke tests **must still be
run locally**; the environment used for preparing this branch could not
access the npm registry. Do not treat this list as completed test evidence.
