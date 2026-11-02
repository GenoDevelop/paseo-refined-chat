# How the bar over runs of cards works

Notes for whoever has to change this later. The user-facing description is in the
README; the checks to run by hand are in `TESTING.md`. The code is
`client/card-runs.ts` (the store), `client/components/run-bar.tsx` (the bar),
`client/card-state.ts`, the renderers in `client/live-renderers.tsx` and the
transformers in `index.client.tsx`.

## What it does

A run is two or more consecutive cards (tool calls and reasoning traces). The first
card of a run draws a bar: what the cards did ("Ran 3 commands, read 2 files, 1
thought"), how many failed or that it is working, and the step count. Pressing it
hides every other card of the run, or shows them again. A setting can also collapse
runs by itself: never, when finished, or always.

## Why it is built this way

**The host gives a renderer nothing but its own item.** A renderer gets `agentId`,
`item`, `theme` and `timestamp`: no neighbours, no position. So every item reports
itself to a store (`useRunMember`), and the store rebuilds the order and finds the
runs.

**Hiding a card cannot be done from its renderer.** The host draws each item in a
row of its own with about 16 px of spacing, even if the renderer returns nothing.
Hidden cards would leave a gap each. The only way to remove a row is to project the
item to no items: the tool and reasoning transformers return `{ items: [] }` for
every id in the `hidden` set.

**The host caches what a transformer returned, per item.** Changing the `hidden`
set does nothing to rows already projected. Removing a transformer and adding it
again makes the host project the history again (checked by hand: cards vanish and
come back on live re-registration). `onHiddenChange` in `index.client.tsx` does
this whenever the set changes. A hidden item's transformer still runs on every
update of the item, which is how the bar learns the state of hidden cards
(`noteCardStatus`).

**Order comes from the page, not from time.** A card is stamped when its call
settles, so a long call is stamped after the prompt that follows it, and a history
loaded in one go stamps many items alike. Each row carries `data-prow="<key>"`
(`runRowProps`), and `ordered()` sorts members by `compareDocumentPosition`. Stamps
are only the fallback for a row not yet in the page (stamps closer than `TIE` are a
tie) and tell which way the list runs, since it may be drawn newest first.

**Keys must be unique.** The store holds one member per key. Cards use
`tool:<callId>:<timestamp>` and `<reasoning hash>:<timestamp>`. Replies, prompts,
notices and todos use `itemKey(kind, text, timestamp)`: the start of the text is
hashed in, because items stamped alike would otherwise share a key, only one would
end a run, and a whole history would become one group. The hash covers only the
first 48 characters so that a streaming reply keeps its key.

## The store

- `byAgent`: the members of each agent (key, id, stamp, kind, status, row element).
- `hidden`: ids of cards a bar hid. The transformers read it.
- `closedRuns`: by the key of the run's first card: `count`, `ids`, `kinds`,
  `kindOf`, `auto`, `leaderId`, `leaderKind`. A closed run draws only its bar; its
  count and description come from here, not from the cards, which are not drawn.
- `touched`: runs the reader opened or closed by hand. The collapse rule leaves
  them alone.
- `reported`: the status of hidden cards, as the transformers saw it last.

A card is identified for hiding by `tool:<callId>` or `reasoning:<hash>:<length>`.
`useRunView` turns the store into what one bar shows.

## The collapse rule

`applyCollapseRule` runs from the effect of the bar on the first card of a run.

- Closing: `closeWith` hides the cards after the first. `takeIn` lets an
  auto-closed run absorb cards that arrive later. Both go through `absorb`, which
  also folds in closed runs that sit inside the cards (history mounts in no fixed
  order) and runs whose first card was hidden by this one (`leaderId`).
- "When finished" leaves cards still running drawn; a first card still running
  keeps its card under the bar. Reasoning that is still streaming never joins a run:
  its id is a hash of its text and changes with every update.
- A failed card keeps its run open, as it keeps itself open, unless its kind starts
  collapsed (`pinning`). A run that closed by itself opens again when such a card
  fails.
- A run that has a card with no id is not closed by the rule: such a card cannot be
  hidden, so the run would look half done.
- A key change (a card is restamped as it settles) moves the run's record with it
  (`rekey`).
- The rule is applied from a `setTimeout`, not in the effect. Applied in the
  effect, a history with many runs chains one store update after another until
  React stops it with error 185 while scrolling.

## A card's own state is separate

Hiding unmounts a card, so its open or closed state would be lost.
`card-state.ts` saves it by key when it changes, and a card that mounts again starts
from it. The bar never sets a card's state and a card never sets the bar's.

## Cost on a long history

A chat loaded from top to bottom can have thousands of cards mounted, and every
one of them reports to the store. Measured on a conversation of about 4000 cards,
a reload took over two minutes before the changes below and about 12 seconds
after (10 seconds with the bar off). Keep these when changing the store:

- The order is worked out from one `querySelectorAll("[data-prow]")` and a sort
  on numbers. Comparing rows pair by pair with `compareDocumentPosition`, or
  looking each one up with `querySelector`, was nearly all of the two minutes.
- The runs of an agent are worked out once per version of the store and shared by
  the cards, and at most every `ORDER_EVERY` ms while items keep arriving. A
  decision that hides cards asks for the order of the present moment
  (`freshView`); drawing may use one that is a moment old.
- `publish` tells the bars once per tick, not once per item.
- A card gets the same view object while nothing in it changed (`signature`), so
  `useSyncExternalStore` draws only the cards whose view moved. Cards that merely
  follow the first of a run almost never do.
- Changes of the hidden set reach the transformers once per 80 ms: each change
  makes the host project the whole history again.

To measure, count calls and time in `publish`, the order and `viewOf`, and
print them in a box on the page; it takes a few lines and the totals show the
cost at once. Do not guess.

## Known limits

- A card with no `callId` cannot be hidden. A run with one is not closed by the
  rule, and closing it by hand counts it although it stays drawn.
- Only drawn rows are counted, so a host that virtualizes the list counts a long
  run by what is mounted.
- Closed runs and the state of cards are not kept when the plugin reloads.
- The `hidden` set has no reference count: if two records ever held the same id,
  the first to release it would show the card.
- Loading a history shows the cards for a moment before the rule folds them.

## Debugging

Wrong counts have come from three places: two items sharing a key, order taken
from stamps, and a closed run whose record was not merged into the run that hid its
first card. To see the store, put what you need in `RunView` and print it from
`run-bar.tsx`; there is no debug output in the build.
