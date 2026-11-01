# Attribution and provenance

Refined Chat is an independent fork of [Beautiful Chat](https://github.com/ABorakati/beautiful-chat),
originally created by **ABorakati**. It preserves the original Git history,
copyright notice and MIT license.

The fork baseline used for this initial rebranding is commit
`42b61d8301b5400a67821bbbfcf99fa8b681dc37`.

- Original Beautiful Chat code: Copyright (c) 2026 ABorakati (MIT).
- Subsequent Refined Chat changes: Copyright (c) 2026 GenoDevelop and
  Refined Chat contributors (MIT).
- Embedded fonts: Inter and Iosevka, both licensed under SIL OFL 1.1.
  See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Refined Chat is not affiliated with or endorsed by the original author
or the Paseo project. Git history retains original authorship.

## Adapted community contributions

Refined Chat adapts typography and tool-card behavior from
[Beautiful Chat PR #9](https://github.com/ABorakati/beautiful-chat/pull/9),
authored by **Moyf** (`Moyf/beautiful-chat`, branch
`text-size-auto-collapse`). That contribution was published under
the project's MIT license and remains credited to Moyf.

Refined Chat changes the original proposal's single fixed-preset scale
into independent, user-entered percentage controls for assistant
replies, tool cards and code. It also makes automated folding opt-in.

The original MIT license and attribution remain in [LICENSE](LICENSE).

Refined Chat also adapts individual fixes from open Beautiful Chat pull requests,
credited to their authors and ported by hand:

- Folding finished tool cards, with the reader choosing which kinds: [PR #18](https://github.com/ABorakati/beautiful-chat/pull/18) by **philipphofmann**, adapted (kinds that start collapsed and kinds that fold when finished are two separate settings here, and a length limit applies).
- Folding long code blocks in replies: [PR #20](https://github.com/ABorakati/beautiful-chat/pull/20) by **philipphofmann**, adapted (it shares the "Long code and diffs" limit with tool cards).
- A summary of a tool card in its header: [PR #21](https://github.com/ABorakati/beautiful-chat/pull/21) by **philipphofmann**, adapted (the header says what a command did, and the size of an edit, write or read sits on the right).
- Folding long prompts: [PR #22](https://github.com/ABorakati/beautiful-chat/pull/22) by **philipphofmann**, adapted (a switch with a line count, and a "Show full prompt" control).
- Failed tool-call error text: [PR #19](https://github.com/ABorakati/beautiful-chat/pull/19) by **philipphofmann**.
- Full shell commands in tool cards: [PR #25](https://github.com/ABorakati/beautiful-chat/pull/25) by **Chengxin-Xu**.
- Images in assistant replies and spaces in image paths: [PR #26](https://github.com/ABorakati/beautiful-chat/pull/26) by **po-trottier**, adapted (remote images are not loaded automatically here).
- Idle tool-card animations and the frosted-glass switch: [PR #24](https://github.com/ABorakati/beautiful-chat/pull/24) by **thsrite**.
- Edit diff computed from old and new text: [PR #8](https://github.com/ABorakati/beautiful-chat/pull/8) by **Moyf**. The diff builder is used as written; line numbers, line statistics and in-line highlighting are original to Refined Chat.
- Custom colours for accent and bold text: [PR #7](https://github.com/ABorakati/beautiful-chat/pull/7) by **Moyf**, adapted (one shared palette, switches, light-theme steps).
- Highlight marks (`==text==`): [PR #6](https://github.com/ABorakati/beautiful-chat/pull/6) by **Moyf**, adapted (off by default). Its tappable file paths in replies are also adapted: they only reveal the file, never open it, and cover inline code only.
- Code font setting that follows Paseo's Code font: [PR #13](https://github.com/ABorakati/beautiful-chat/pull/13) by **gringolito**, adapted (Iosevka stays the default; Paseo's Code size is not read).
- Copy button on code blocks through the host clipboard: [PR #11](https://github.com/ABorakati/beautiful-chat/pull/11) by **jasonhnd**, adapted (only the clipboard call; its host settings storage and fallback dialog were not taken).
