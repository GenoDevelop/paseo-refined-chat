# Refined Chat

Refined Chat customizes how supported coding-agent conversations are displayed in Paseo. It provides structured tool cards, syntax-highlighted code and diffs, readable Markdown replies and optional controls for long tool or reasoning output.

## Typography

The plugin has three independent text-size controls:

- **Assistant replies:** Markdown text, headings, lists and spacing.
- **Tool cards:** tool labels, reasoning details, statuses and checklists.
- **Code and terminal:** code blocks, diffs, line numbers and terminal output.

Enter any percentage from **50% to 300%**, including decimal values. Each category starts at 100% and remembers its setting in the local Paseo client. Inline code in a paragraph follows the reply scale so it remains aligned with surrounding text.

## Reading controls

Tool cards can automatically collapse when execution finishes. Manually expanded or collapsed cards keep their state, and failed tool calls or cards requiring answers remain accessible. Reasoning traces can start collapsed. Both features are disabled by default, and long expanded cards include a collapse control near the bottom.

Other settings include an accent color, an interface font choice, code ligatures, optional translucent surfaces, user-message bubbles, and Markdown presentation styles.

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

For source code, known limitations and development documentation, see the [Refined Chat README](https://github.com/GenoDevelop/refined-chat#readme).
