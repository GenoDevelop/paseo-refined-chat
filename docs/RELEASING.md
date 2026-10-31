# Releasing Refined Chat manually

This project intentionally does **not** use GitHub Actions or hosted CI. A
release is a GitHub tag plus a GitHub Release, followed by a separate registry
submission. Neither step runs a GitHub Actions workflow by itself.

## 1. Verify the intended revision

Check out the final `main` commit after merging the release-preparation PR.
Do **not** tag the release-preparation feature branch.

```powershell
git fetch origin --tags
git switch main
git pull --ff-only
git status --short
```

The working tree should be clean. Confirm that `package.json` and the root
`package-lock.json` both declare the release version, and that `paseo-plugin.json`
declares ID `refined-chat` with a compatible Paseo minimum.

## 2. Check locally (no hosted runner minutes)

```powershell
npm ci
npm run typecheck
```

Then separately check the same dependency preparation used when installing
the plugin from Git:

```powershell
npm ci --omit=dev --ignore-scripts
```

Note: this removes local development dependencies (including TypeScript) from
`node_modules`. Run `npm ci` again before further typechecking. Test the
plugin in Paseo with an isolated test ID, while other chat-rendering plugins
are disabled:

```powershell
paseo plugin install "$PWD" --id refined-chat-release-test
paseo plugin ls refined-chat-release-test
```

Expect `running`. Verify all three independent percentage settings, tool-card
folding, Markdown, terminal output and image previews. If preparation or
activation fails, use:

```powershell
paseo plugin logs refined-chat-release-test
```

Disable/remove the test plugin after verification.

## 3. Verify the catalog image

Visual plugins require at least one **current, truthful screenshot**. The
existing `images/hero.png` originates from the Beautiful Chat baseline. It
depicts the inherited default chat appearance but does not show Refined
Chat's new typography controls.

Before registry submission, capture a current Refined Chat interface with
sample content (no real chat, repository paths, credentials, or personal
details). Update `images/hero.png` or add a new PNG to `media`, committing
that change **before** tagging the release. The screenshot and commit must
correspond to the version being reviewed.

## 4. Tag and publish GitHub Release

From the verified `main` commit, use GitHub's **Releases → Draft a new
release** interface (or `gh release create`). Create tag `vX.Y.Z` targeting
`main`, title the release `Refined Chat vX.Y.Z`, include highlights from
`CHANGELOG.md`, and publish. If a new screenshot was needed, merge that update first.

Do not create a workflow or an automatic release pipeline.

## 5. Test the tagged GitHub source

```powershell
paseo plugin add git:GenoDevelop/refined-chat --ref vX.Y.Z --id refined-chat-tag-test
paseo plugin ls refined-chat-tag-test
```

Only after the tag has been published should a pinned `--ref vX.Y.Z`
installation be expected to work. Better still, run the same install against
`main` (without `--ref`) **before** tagging, so a broken install is found while
the release can still be changed.

## 6. Submit to the Paseo catalog

Submit the versioned source through the official form:

https://github.com/getpaseo/plugins/issues/new?template=submit-plugin.yml

Use the public GitHub repository URL, preferably identifying the reviewed
tag in the submission. Choose the appropriate category (typically
**Utils** or **Extras**) and link a current screenshot as needed.

The registry reviewer checks the code, permissions, image and dependency
lockfile. Submission is **not** the same as approval, and it does not
automatically create a published listing.

Once approved, users can install using:

```powershell
paseo plugin add GenoDevelop/refined-chat
```
