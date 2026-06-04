# ADR Action

GitHub action to automatically accept merged Architecture Decision Records (ADRs).

When a new ADR file is merged to your main branch, this action finds any ADRs with a status of `Pending` and updates them to `Accepted` — committed back to the branch automatically.

## Usage

Add a workflow file to your repository:

```yaml
# .github/workflows/adr-accept.yml
name: Accept ADRs

on:
  push:
    branches: [main]
    paths: ["doc/adr/**"]

jobs:
  accept_adrs:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: jackdar/adr-action@v1
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for reading and committing ADR files | Yes | `${{ github.token }}` |
| `adr-directory` | Path to the ADR directory relative to the repo root | No | `doc/adr` |

## ADR format

ADRs must be Markdown files with a `## Status` section. The action looks for the exact text `Pending` on the line immediately following the heading and replaces it with `Accepted`.

```markdown
## Status

Pending
```

Only files with a status of exactly `Pending` are updated — everything else is skipped silently. If you want to merge an ADR to main without it being auto-accepted (e.g. it is still under discussion), use `Draft` or `Proposed` as the status instead.

See [`adr-example.md`](adr-example.md) for a full template.

## How it works

1. On each push to `main` that touches your ADR directory, the action inspects the triggering commit for newly added `.md` files.
2. Any new file with `## Status\n\nPending` has its status updated to `Accepted`.
3. The changes are committed back to the branch in a single commit.

## Releasing

Merge PRs to main freely — no version bump required. When ready for a new release:

1. Bump the version in `package.json` using `npm version patch/minor/major`
2. Open a PR and merge to main

The release workflow will build, create a GitHub release with auto-generated notes, and update the floating major tag  automatically.
