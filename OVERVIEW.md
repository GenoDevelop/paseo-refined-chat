# Refined Chat

Refined Chat customizes how supported coding-agent conversations are displayed in Paseo. It provides structured tool cards, syntax-highlighted code and diffs, readable Markdown replies and optional controls for long tool or reasoning output.

## Text size and spacing

Three independent text-size controls cover **assistant replies**, **tool cards** and **code and terminal** output, each from **50% to 300%** (decimals allowed, default 100%). Reply line spacing is a fourth control, from 80% to 200%. Settings are remembered in the local Paseo client.

## Folding

Nothing folds until you choose. You pick which kinds of card start collapsed, which collapse when they finish (shell and git, writes, edits, reads, other tools, thinking), and how many lines a card needs before it folds. Long terminal output, code and diffs, code blocks in replies, and long prompts fold behind a "Show more" control, and Copy and find still reach the hidden text. A card you open or close yourself keeps its state.

## Colours

An optional custom accent, an optional colour for bold text, and optional `==highlight==` marks (off by default) draw from one palette or any hex colour.

## Cards, images and links

Shell, git, read, write, edit, MCP, eval, subagent, hub and Paseo tool calls get typed cards with a short summary of what each did, and failed edits are labelled as not applied. Images in replies and image reads show the picture with a viewer; remote images wait for a click unless you opt in. Links show where they go and warn when their text and target disagree.

Other settings include an interface font, a code font (Iosevka, Paseo's own, or any installed font), code ligatures, frosted surfaces, user-message bubbles and Markdown presentation styles.

## Requirements and setup

- Requires Paseo **0.11.0 or later**.
- Runs on the same machine/daemon as Paseo; no separate Refined Chat account or API key is needed.
- Works with conversation events that Paseo exposes to plugin timeline renderers. Coverage of specialized events may differ by agent provider.
- Disable Beautiful Chat and other plugins that replace the same timeline elements to avoid competing renderers.

The plugin uses a subset of Paseo's Markdown capabilities. Disable **Assistant markdown** in the plugin's settings to use Paseo's native rendering for features such as Mermaid diagrams, images or special file-path links. In that mode, the host's appearance settings control reply text size.

## Data access and permissions

Refined Chat receives the chat message and tool-result data provided by Paseo. For syntax highlighting, it passes text to the Paseo daemon, which processes it using installed local libraries. It can read a referenced local image for preview and can ask the host operating system to reveal a file path when a user chooses that action. Image previews are limited to 3 MB.

The plugin does not provide its own model service or require a separate external account. It does not add a separate network-based telemetry service. The configured agent provider may still receive chat data through Paseo as part of normal agent operation.

A Git installation prepares its locked production dependencies through npm on the daemon host. Package lifecycle scripts are disabled. Plugin server code is not sandboxed and runs with the daemon user's permissions; install only code you trust. No additional software downloads are initiated by chat controls.

For source code, known limitations and development documentation, see the [Refined Chat README](https://github.com/GenoDevelop/paseo-refined-chat#readme).
