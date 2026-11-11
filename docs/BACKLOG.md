# Product backlog

## Conversation outline (implemented)

A readable index of prompts, questions, plans and errors. Routine file changes
are excluded after user feedback about noise. Start with
an agent panel, history pagination and an entry preview. Jump to loaded chat rows
on desktop; the SDK currently exposes no cross-platform scroll-to-history API.

## Plan comparison and export (implemented)

Desktop offers a .md download and native clients can share the original Markdown
text. Compare with allows an explicit choice of two plans from the same agent's
history, with a directional Markdown diff. Plans are not paired automatically.
Further diff presentation changes are reserved for a follow-up PR.

## History filters

Show user messages, plans and decisions, file changes, or errors without changing
the underlying conversation history. Type filters for the outline itself are implemented.

## Turn summaries

Summarize changed files, executed checks and failed commands from tool records.
No additional model calls or invented verification claims.

## Mobile and iPad usability

Improve text selection, card expansion and reading plans on small screens.
Investigate the native text-selection issues described in PR #51 on a real iPad.
