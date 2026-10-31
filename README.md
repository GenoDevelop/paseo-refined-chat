# Refined Chat

A [Paseo](https://paseo.sh) plugin that redraws the Oh My Pi (OMP) chat stream: tool calls, reasoning,
prompts, approvals and checklists become typed, syntax-aware cards that follow the active Paseo
theme, and you decide how big the text is, what folds, and how it is coloured.

![A turn in Refined Chat: a prompt, a command card, a folded read, and a reply with a coloured accent, bold text and a highlight mark](images/hero.png)

- **Three independent text sizes** for replies, tool cards and code, plus reply line spacing.
- **You choose what folds**: which card kinds start collapsed, which fold when they finish, and how long
  an output must be before it folds at all. Long prompts, code blocks and tool output fold too.
- **Colours**: a custom accent, a colour for bold text, and optional `==highlight==` marks, all from
  one palette or any hex.
- **Readable cards** for shell, git, read, write, edit, MCP, eval, subagents, hub and Paseo tools,
  with a one-line summary of what each did.
- **Images** in replies and image reads, with a viewer.
- **Links** that show where they go and warn when the text disagrees with the target.
- Its own **find bar** (Ctrl/Cmd+F) that searches the whole chat, tool cards included.

Refined Chat is an independent fork of [Beautiful Chat](https://github.com/ABorakati/beautiful-chat)
by ABorakati. It is not affiliated with or endorsed by the upstream developer or Paseo. Both plugins
intercept Paseo timeline items, so **disable Beautiful Chat before enabling Refined Chat**. See
[Credits](#credits-and-license).

## Install

Install from the public GitHub repository, which follows `main`:

```bash
paseo plugin add git:GenoDevelop/paseo-refined-chat
```

To stay on a published release, pin its tag:

```bash
paseo plugin add git:GenoDevelop/paseo-refined-chat --ref v0.4.0
```

Once the plugin is approved in the Paseo catalog, `paseo plugin add GenoDevelop/paseo-refined-chat` works
too. Requires **Paseo 0.11.0 or later**. Everything below is configured in
**Settings → Plugins → Refined Chat**, and each setting is stored on the client you change it on.

---

## Settings

![The settings page: Appearance open with a custom bold colour, Replies and prompts collapsed, Tool card folding open](docs/images/settings.png)

The settings page is grouped into collapsible sections; a section remembers whether you left it open.
A setting that depends on another dims when it cannot apply, and says why.

### Appearance

| Setting | Effect |
| --- | --- |
| Custom accent colour | Off follows the Paseo theme. On, pick a palette colour or **Custom**. |
| Colour bold text | Off keeps the surrounding text colour. On, pick a palette colour or **Custom**. |
| Interface font | Embedded Inter, or the system interface face. |
| Code font | Iosevka, Paseo's own Code font (followed live), or an installed font you name. |
| Code glyphs | Iosevka only: with ligatures, or literal glyphs. |
| Frosted glass | Blur card surfaces, or paint them solid. |
| Pointer glow | A soft light follows the pointer across each card (desktop and web). |

Accent, bold text and marks draw from **one palette of soft pastels** (Rose, Orange, Yellow, Green,
Sky, Violet), so a name means the same colour wherever you pick it. On a light theme, text colours use
a deeper step of the same name so they stay readable. **Custom** opens a strip of 24 hues and a hex
field, and each setting remembers its own custom colour when you switch to a preset and back.

![Picking a custom colour: the palette, the Custom chip, the hue strip and the hex field](docs/images/colours.png)

### Text size and spacing

Enter any percentage between **50% and 300%**, decimals included (`112.5`), then press Enter or leave
the field to apply it.

| Control | What it scales |
| --- | --- |
| **Assistant replies** | Markdown text, headings, lists and their spacing. |
| **Tool cards** | Tool UI, labels, reasoning, checklists, statuses and metadata. |
| **Code and terminal** | Fenced code, diffs, line numbers and terminal output. |
| **Reply line spacing** | Line height in replies, 80% to 200%, apart from the text size. Gaps between blocks, tool cards and code do not change. |

Each starts at 100%. Inline code follows the reply size so lines wrap naturally. The reply size
applies to the plugin's own Markdown renderer; with **Assistant markdown** off, Paseo's appearance
settings control that text.

### Replies and prompts

| Setting | Effect |
| --- | --- |
| Assistant markdown | The plugin's headings, lists and highlighted code blocks. Off hands replies back to Paseo, which also brings back mermaid diagrams, images and its file-path links. |
| Markdown style | **Document** (airy), **Compact** (tight) or **Terminal** (body in the code face). |
| File paths in replies | A file path in inline code opens a read-only side panel (default), or shows the file in your file manager. See [Opening files](#opening-files). |
| Highlight marks | Draws `==text==` as a highlighter mark, in a palette colour or a custom one. Off by default: it is not standard Markdown, and an assistant writes it only if your instructions ask for it. Off shows the equals signs as typed. |
| Enhanced prompt bubble | Off hands prompts back to Paseo, whose bubble shows pasted images. |
| Selection actions | Selecting text in a card raises **Copy** and **Add to chat** (desktop and web). |

### Tool card folding

Nothing folds on its own until you pick something here.

| Setting | Effect |
| --- | --- |
| Cards that start collapsed | Kinds drawn folded from the start, even while running and when the call fails. |
| Cards to collapse when finished | Kinds that fold back up once they finish. A thinking stream stays open while it streams. A kind that already starts collapsed is dimmed here. |
| Only fold longer cards | Keeps a card open while its output, code and diff add up to fewer lines than the limit. Dimmed when no kind is left to fold. |

The kinds are Shell and Git, Writes, Edits, Reads, Other tools and Thinking. A card you open or close
yourself keeps its state, and an ask card never folds. Expanded cards have a **Collapse** control at the
bottom, so you do not scroll back to the header.

![Folding: a read folded after it finished, a written file cut off after 30 lines, and command output with its middle folded](docs/images/folding.png)

### Long content

Each limit is a switch plus a number that appears when it is on. A block that would hide fewer than
five lines stays whole, and a running call is never folded.

| Setting | Default | What it folds |
| --- | --- | --- |
| **Long terminal output** | 20 lines | Text results (command output, errors, eval output, GitHub replies). They keep their start and end and fold the middle, because the error and the summary are at the end. |
| **Long code and diffs** | 30 lines | File reads, writes, diffs, structured data (MCP input and response, GitHub files and requests, eval code, subagent prompts) and code blocks in replies. They show their first lines and fold the rest. Hub cards are not folded. |
| **Long prompts** | 15 lines | A prompt shows its first rows behind **Show full prompt**. A long paragraph with no line breaks counts about 70 characters a line. |

**Copy** always copies everything, and the find bar opens the folded blocks that hold what you search
for, then folds them again when it closes. Text selection covers only the lines on screen.

### Advanced

| Setting | Effect |
| --- | --- |
| Load remote images automatically (at your own risk) | Off by default. See [Images](#images). |
| Preview files outside the project (at your own risk) | Off by default. Lets the File preview panel read a text file outside the agent's working directory. See [Opening files](#opening-files). |
| Let Paseo fold tool calls and turns | Off by default. With it on and Paseo's Chat display set to Collapse tool calls or Collapse turns, those rows are drawn by Paseo, which can only fold its own rows. Reload the plugin or restart the app after changing it. |

---

## What the cards show

| Card | What you get |
| --- | --- |
| **Shell and Git** | A terminal frame with Bash highlighting, exit code and duration. The header says what the command did: what git changed (`+53 −0`), how many lines it printed (`8 lines`), or `no output`. A failed call keeps its exit code. |
| **Read** | The file's language logo, a path that is a link, line numbers (real ones when the read starts mid-file), a copy button, and how many lines came back. |
| **Write and Edit** | Diffs with old and new line numbers, adjacent removed and added rows joined into one block, and the changed words highlighted. The header carries `+X −Y`. A failed call shows no count, and a failed edit labels its diff "Not applied". |
| **Images** | The picture itself instead of an empty code block. See [Images](#images). |
| **Reasoning** | Live thinking text, a token badge, numbered steps, a connected rail with per-step time. |
| **MCP** | Server badge, transport, input parameters and the response, each highlighted. |
| **Eval** | One card per kernel cell: the source that ran, then what it printed. |
| **Ask** | Option cards with the recommended badge, the chosen answer marked, and a typed reply labelled as typed. |
| **Task** | Subagent name, type, model and the delegated instructions. |
| **Hub** | Every `hub` op: process cards with launch line, readiness and output, message cards, job snapshots. They report only, because a plugin cannot restart or cancel anything. |
| **Paseo tools** | Paseo's mark leads the card, and a created agent's provider carries its brand mark. |
| **Checklist** | Phase name, per-task status and duration, and a blocked task with its reason. |
| **Approval** | Risk class, the exact command, target path and working directory, with the approve and deny actions the host owns. |
| **Prompt** | The authored turn on a raised surface with a copy button and the turn's token usage. |

A tool the plugin has no typed card for still shows its output in the terminal frame, and a call that
printed nothing says so. No card renders an empty panel.

## Images

A read of a `.png` carries no bytes through the timeline, so the host draws an empty code block. The
image card draws the file: a picture mark, the path as a link, the pixel and file size, and an eye
control that hides the thumbnail. The bytes come from the plugin's own daemon-side RPC (`file.image`),
the only side that can reach the file. PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG are recognised, and
anything past 3 MB reports its size rather than inlining it.

When an agent writes `![description](file:///path/to/image.png)` on a line of its own, the reply shows
the picture as a small thumbnail, several in a row when they follow one another, with the description,
size and weight over it on hover. A click opens a viewer that never draws it larger than its own size;
the wheel zooms around the pointer, a drag moves it, two fingers pinch it, and buttons give zoom, 1:1
and fit.

Local files and `data:` images load at once. A remote `http(s)` image waits as a tile that names the
server and has a **Load** button: the agent writes the address, and a prompt injection can use it to
send chat data off your machine. **Load remote images automatically** removes the wait.

## Links

A link in a reply shows where it goes: an icon before the text (GitHub, mail or web), a dashed
underline on hover, and the full address in a bubble above it. When the text reads as an address that
differs from the real target, the icon turns into an amber warning and the bubble names both. File
paths and links on tool cards get the same underline. On a touch screen the underline stays permanent.

![Links in a reply: the full address in a bubble on hover, and an amber warning on a link whose text names another site](docs/images/links.png)

## Opening files

A file name in a read, write, edit or code block is a link. Pressing it calls the plugin's own
daemon-side RPC (`file.reveal`), which resolves the path against the agent's working directory and asks
the platform shell to show it:

| Platform | Behaviour |
| -------- | --------- |
| Windows | `explorer.exe /select,<file>` selects the file. |
| macOS | `open -R <file>` selects the file in Finder. |
| Other | `xdg-open <directory>` opens the containing directory. |

A file path in inline code in a reply works the same way: `src/app.ts`, `C:\work\app.ts:55` or `./notes.md`
becomes a link (a `:55` line selector is accepted and ignored). A bare file name needs a common source or
text extension, so `v1.beta` stays text. The path comes from the agent, so network paths (`\\host\share`,
`//host/share`) are never linked and the daemon refuses them. The link only shows the file; it never opens
or runs it. A link carries a file icon and, on hover, a bubble saying what pressing does.

By default pressing a file path opens a read-only **File preview** panel in Paseo's side view, with
syntax colours and line numbers (a Markdown file opens rendered, with its local images beside it, and a button for its source); a second
press replaces the file in the open panel. The panel reads the
file through a second daemon-side RPC (`file.read`), which is stricter than `file.reveal` because it
returns contents: the file must be inside the agent's working directory once symbolic links are
resolved, at most 1 MB, and text. Any other file, and every folder, goes to the file manager instead (the
panel says why and offers a button). A path with a line (`app.ts:55`) marks that line and scrolls to it; for a range the first line is marked. In a rendered Markdown file the block holding the line is tinted, and a link to another file beside it (`docs/TESTING.md`, `../README.md#L12`) shows that file in the panel; Back returns. A link to a heading (`#usage`, `docs/X.md#usage`) scrolls to it and tints it. The same rules apply to the linked file as to a path pressed in a reply. A picture opens drawn, with a Full screen button, through the same
image RPC that draws pictures on tool cards: it reads only recognised image types of up to 3 MB and, unlike
`file.read`, is not limited to the working directory. The setting "File paths in replies" switches the whole thing back to
the file manager. The Advanced setting "Preview files outside the project" lifts the working-directory rule
for text files (network paths, the 1 MB limit and the text check still apply); it is off by default because
the agent writes the path, so a prompt injection can link a private file such as `~/.ssh/config`.

A folder in inline code links too, with a folder icon and the bubble "Open folder", when it cannot be
mistaken for prose: it ends with a separator (`src/`, `.\build\`) or starts from a drive or `~` (`C:\work\app`,
`~/app`). `and/or`, `/api/users` and `/compact` stay text.

A directory path opens that directory. A path the daemon cannot stat does nothing. The link cannot open
Paseo's own file editor, which plugins cannot target: see the first
[limitation](#plugin-sdk-limitations-found-while-building-this). The side panel is the plugin's own viewer.

## Finding text

Paseo's own chat find (Ctrl/Cmd+F) cannot reach a prompt or reply this plugin draws (see
[limitation 14](#plugin-sdk-limitations-found-while-building-this)). The plugin therefore takes
Ctrl/Cmd+F on desktop and web and opens its own find bar over the chat. It searches everything the chat
has rendered, tool cards included. Enter moves to the next match, Shift+Enter to the previous one, and
Escape closes the bar. It searches only messages the chat has loaded, so scroll up first to include
older history.

To keep Paseo's native search, which also searches unloaded history, turn off **Assistant markdown** and
**Enhanced prompt bubble**. Paseo then draws replies and prompts itself, and Ctrl/Cmd+F opens Paseo's
find. Tool, reasoning and checklist cards keep the plugin's styling, so Paseo's find still cannot reveal
a match inside one of them.

---

## Plugin SDK limitations found while building this

Measured against `@getpaseo/plugin` 0.8.0 and the Paseo 0.8.0 desktop build; the plugin now builds
against 0.14.0, but the entries have not all been re-measured. Each entry names the evidence and the
workaround this plugin uses.

1. **No file navigation.** Timeline renderer props are exactly `{agentId, theme, host, layout,
timestamp, item}`, and plugin navigation offers only `openSettings`, `openSurface`,
   `openWorkspacePanel`, `openAgentPanel`, `openAgent`, and `openWorkspace`. The host's own file tab
   target (`{kind:"file", path}`, reachable in-app through `?open=file:<path>`) is not exposed, and
   the `paseo://` scheme only carries agent deep links. Workaround: a daemon-side RPC that reveals
   the path in the operating system's file manager.
2. **Transformers see a stripped item.** The app maps its stream item to the plugin item before any
   transformer runs, and a user message keeps only `text`, `messageId`, and `clientMessageId`. Pasted
   images never reach plugin code, and the daemon timeline row stores the same item, so a server RPC
   cannot recover them either. Workaround: the **Enhanced prompt bubble** setting returns prompts to
   the host.
3. **Interception is all or nothing.** A transformer replaces the host item completely. There is no
   way to decorate an item or keep host affordances that the plugin does not reimplement. Returning
   `undefined` is the only opt-out.
4. **Transform results are cached per item.** Changing a preference does not re-run transformers for
   items already on screen. New items follow the change; existing ones need a reload.
5. **Renderers get no workspace.** Props carry `agentId` only, so `cwd` and `workspaceId` need a
   second lookup through `useAgent`.
6. **Token usage is live-only.** Usage is not persisted on timeline items, so a turn this client did
   not observe live shows no figures.
7. **RPC names are validated late.** The host requires `^[a-z][a-z0-9._-]*$`. A camelCase name such
   as `revealPath` typechecks, then fails the whole plugin at install or reload with
   `Invalid plugin RPC method`.
8. **The React Native runtime module is a stub in the package.** `@getpaseo/plugin/client/react-native`
   ships as `export {}`; the host injects the implementations. Bundling or testing plugin UI outside
   Paseo needs a shim, which is what `.showcase/shims` provides.
9. **The theme carries six colours.** `PluginTheme` exposes `surface0`–`surface2`, `border`,
   `foreground`, `foregroundMuted`, `accent`, `accentForeground`, and three status colours. Every
   other surface, including code backgrounds and diff tints, must be derived with alpha; that is what
   `client/components/theme-tokens.ts` exists for.
10. **No CSS escape hatch.** React Native styles drop unknown keys, so `backdrop-filter` is
    impossible through the style API. Frosted glass is a hand-injected `<style>` rule matched by a
    data attribute.
11. **No font registration.** Faces are embedded as data URIs in an injected `@font-face` rule, and
    every surface needs a wrapper that escapes the host's own font cascade.
12. **A closed module allowlist, and no SVG renderer.** Plugin client code may import only
    `react`, `react/jsx-runtime`, `react-native`, `@tanstack/react-query`, `zod`,
    `@getpaseo/plugin`, `@getpaseo/plugin/client`, `@getpaseo/plugin/client/react-native`, and
    `@getpaseo/plugin/client/ui`. Anything else throws
    `Module "x" is not available in plugin client code` when the bundle loads, so
    `react-native-svg` and `lucide-react-native` are out of reach. Lucide icons still work,
    because the host renders them: `Icon` from `@getpaseo/plugin/client/react-native` takes any
    Lucide name. Brand marks are not in Lucide, and React Native's `<Image>` decodes PNG, JPEG,
    GIF, and WebP but never SVG, so a data-URI SVG renders on web and stays blank on iOS and
    Android. Those marks ship as PNG rasters in `client/components/mark-bitmaps.ts`.
13. **Settings are host-scoped only.** `defineSettings` rejects any scope other than `host`, so
    per-workspace or per-agent presentation settings are impossible. This plugin keeps presentation
    preferences in client storage instead.
14. **Paseo's chat find cannot reach replaced rows.** Paseo 0.9.1 finds a match by its original
    message id, then waits for a row carrying that id. A transformed row always carries
    `<pluginId>/<itemId>` instead, so Ctrl+F on a styled prompt or reply never reveals the match.
    Workaround: the plugin's own find bar, described in [Finding text](#finding-text).

---

---

## Project structure

```text
refined-chat/
  paseo-plugin.json          # Manifest: id and Paseo requirement
  index.client.tsx           # Timeline transformers, renderers, settings screen
  index.server.ts            # Daemon-side RPCs (file.reveal, file.image, highlighting)
  shared/                    # Contracts shared by client and server, one file per RPC
  client/
    live-renderers.tsx       # Timeline item to component mapping
    settings-page.tsx        # Settings screen
    preferences.ts           # Client-side preferences, palette and migrations
    tool-collapse.ts         # Which cards fold, and when
    fold.ts                  # Long-content folding
    components/              # Cards, markdown, syntax block, glyphs, theme tokens
      mark-bitmaps.ts        # GENERATED PNG rasters of every brand mark
      devicon-data.ts        # Vendor SVG sources, read only by the generator
      lobe-marks.ts          # Vendor SVG sources, read only by the generator
  .showcase/                 # Offline harness for rendering cards outside Paseo
  docs/                      # Testing, releasing and upstream notes, screenshots
```

## Development

```bash
npm ci
npm run typecheck
paseo plugin reload refined-chat
```

There is no automated test suite and no hosted CI: checks run locally, by hand, in a running Paseo
(see [docs/TESTING.md](docs/TESTING.md)). For a manual release, see
[docs/RELEASING.md](docs/RELEASING.md). Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

`.showcase/` renders the cards offline with React Native Web. To rebuild it:

```bash
esbuild .showcase/showcase.tsx --bundle --outfile=.showcase/showcase.js --jsx=automatic \
  --alias:react-native=react-native-web \
  --alias:@getpaseo/plugin/client/react-native=./.showcase/shims/plugin-react-native.tsx
```

## Credits and license

The original Beautiful Chat implementation is by **ABorakati**, and Refined Chat keeps its Git history
and MIT license. Several features adapt work from open upstream pull requests, credited to their authors
in [NOTICE.md](NOTICE.md).

Code is MIT-licensed; embedded fonts keep their own SIL OFL 1.1 terms. See [LICENSE](LICENSE),
[NOTICE.md](NOTICE.md) and [third-party notices](THIRD_PARTY_NOTICES.md).
