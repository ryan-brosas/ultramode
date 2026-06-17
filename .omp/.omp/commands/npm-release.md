---
description: "Cut an npm release through GitHub Releases and trusted publishing."
argument-hint: "<patch|minor|major|prepatch|preminor|premajor|prerelease|x.y.z>"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(npm run release:check:*), Bash(npm version:*), Bash(git push:*), Bash(gh release create:*), Bash(gh release view:*), Bash(npm view:*), Read
---

## Purpose

Create a normal npm release without local npm tokens. This command bumps `package.json`, pushes the tag, creates a GitHub Release, and lets the repository's npm trusted-publishing workflow run `npm publish --provenance --access public`.

## Prerequisites (CHECK FIRST)

1. `package.json` exists.
2. `.github/workflows/npm-publish.yml` exists and publishes on `release.published`.
3. npm trusted publishing is connected for this exact GitHub workflow.
4. Working tree is clean.
5. Current branch is the release branch, normally `main`.
6. `$ARGUMENTS` is one npm version argument: `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, `prerelease`, or an exact semver like `1.2.3`.

Run:

```bash
git status --short
git branch --show-current
```

If dirty: STOP. Say exactly which files are dirty and ask the user to commit/stash them first.
If not on the release branch: STOP unless the user explicitly requested this branch.
If `$ARGUMENTS` is empty or invalid: STOP and show the allowed values.

## Verify Before Bump

Run:

```bash
npm run release:check
```

If it fails: STOP. Do not bump versions or push tags.

## Bump Version

Run:

```bash
npm version "$ARGUMENTS"
```

Capture the printed tag, e.g. `v1.0.1`, as `TAG`.

## Push Commit and Tag

Run:

```bash
git push --follow-tags
```

If push fails: STOP and report the exact failure. Do not create the GitHub Release.

## Create GitHub Release

Run:

```bash
gh release create "$TAG" --generate-notes
```

This publishes the GitHub Release. The `npm-publish.yml` workflow should start automatically and publish to npm through trusted publishing.

## Verify Release

Run:

```bash
gh release view "$TAG"
npm view "$(node -p "require('./package.json').name")" version dist-tags --json
```

Confirm npm `latest` matches the package version from `package.json`. If the workflow is still running, report the GitHub Release URL and say npm may update after the Action completes.

## Report

Return:

```text
Release: <TAG>
GitHub: <release URL>
npm: <package name>@<version>
Verification: release:check passed; npm latest <matched|pending>
Next: monitor the GitHub Action if npm latest is pending
```

## Rules

- Never run `npm publish` locally in this command.
- Never use or request an npm token.
- Never create the GitHub Release if `npm run release:check` fails.
- Never continue after a failed version bump or failed push.
- Do not use prerelease identifiers unless the user explicitly requested a prerelease argument.
