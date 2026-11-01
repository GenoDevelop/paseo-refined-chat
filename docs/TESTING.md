# Manual verification guide

There is intentionally **no hosted CI**. Run these checks locally before merging
a change and after updating the Paseo SDK.

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

## File preview

Use a project that holds a Markdown file with a heading, a link to another file and a link to a heading.

- Press a file path in inline code in a reply: the side panel opens with the
  file, syntax colours and line numbers. Press another: the panel shows that one.
- Press `file.ts:55`: the line is marked and scrolled to. Press a Markdown file
  with a line: the block holding it is tinted.
- In a rendered Markdown file, press a link to another file (Back returns), and a
  link to a heading (it scrolls and tints).
- Press the file name on a read card and an edit card: the panel opens at the
  line the read began at and the line the edit changed. The path above the code
  is relative to the working directory, and a file outside it keeps its full path.
- Press `~/.gitconfig` and a folder path (`src/`): the first opens in the panel
  if it is a file, the second opens the file manager.
- Open a picture (a panel with a Full screen button) and one over 3 MB (a message).
- Open a file outside the project: the panel says why, until **Preview files
  outside the project** is on. A network path never opens.
- Switch **File paths in replies** to the file manager: nothing opens in the panel.

## Interoperability

- Keep the original Beautiful Chat plugin disabled. Both intercept the
  same Paseo timeline and should not be activated simultaneously.
- Check rendering separately in Codex and Claude Code conversations.

## Current verification status

There is no automated test suite. `npm run typecheck` must pass, and each
change is checked by hand in a running Paseo (`paseo plugin reload`) on a dark
and a light theme. Each PR states what was and was not exercised.
