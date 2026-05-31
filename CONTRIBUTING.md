# Contributing to Campus Music

This project uses a simple, PR-based branching workflow. `main` is always
deployable and is **protected** — all changes land via pull request, never by
pushing directly. (For maintainers: branch-protection setup is documented in
[RUNNING.md](RUNNING.md#branch-protection-github).)

For local setup and how to run the app, see [RUNNING.md](RUNNING.md). For
environment/tooling gotchas, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## The workflow at a glance

```
main ──●────────────────────────────●──  (protected; merges only via PR)
        \                          /
         ●──●──●  feature/xyz  ────●   ← branch → commit → push → PR → review → merge
```

1. **Branch** off the latest `main`.
2. **Commit** small, focused changes with clear messages.
3. **Push** the branch to GitHub.
4. **Open a PR** into `main` (the PR template auto-populates).
5. **Review** — at least one approval; CI/typecheck green.
6. **Merge** (squash) and delete the branch.

---

## 1. Branch

Always start from an up-to-date `main`:

```bash
git checkout main
git pull
git checkout -b <prefix>/<short-description>
```

### Branch naming convention

| Prefix      | Use for                                   | Example                          |
| ----------- | ----------------------------------------- | -------------------------------- |
| `feature/`  | New user-facing functionality             | `feature/playlist-sharing`       |
| `fix/`      | Bug fixes                                  | `fix/android-feed-empty`         |
| `chore/`    | Tooling, deps, config, refactors          | `chore/git-workflow-setup`       |
| `docs/`     | Documentation only                        | `docs/api-endpoints`             |

Use short, kebab-case descriptions. One branch = one logical change.

## 2. Commit

- Keep commits focused; prefer several small commits over one giant one.
- Write imperative, present-tense subjects ≤ ~72 chars:
  `Add Array.isArray guard to PlayerContext track mapping`
- Explain the *why* in the body when it isn't obvious.
- **Never commit secrets.** `.env*` files are gitignored — keep credentials local.

```bash
git add -p          # stage intentionally
git commit
```

## 3. Push

```bash
git push -u origin <prefix>/<short-description>
```

## 4. Open a pull request

- Target `main`.
- Fill out the [PR template](.github/pull_request_template.md): summary, type of
  change, testing notes, and screenshots for any UI change.
- Link related issues (`Closes #123`).
- Keep PRs reviewable — if it's getting large, split it.

## 5. Review

- At least **one approving review** before merge.
- Address comments with follow-up commits (don't force-push during active
  review unless asked — it makes re-review harder).
- Keep the branch current with `main` if it drifts:
  ```bash
  git fetch origin && git merge origin/main   # or: git rebase origin/main
  ```
- CI / `pnpm run typecheck` must be green.

## 6. Merge

- Use **Squash and merge** to keep `main` history linear and readable.
- Ensure the squashed commit message is meaningful.
- **Delete the branch** after merge (GitHub offers a button).

---

## Commit message trailer (AI-assisted changes)

When a change is co-authored with Claude Code, include the trailer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Quick reference

```bash
git checkout main && git pull
git checkout -b feature/my-thing
# ...edit, then...
pnpm run typecheck
git add -p && git commit
git push -u origin feature/my-thing
# open the PR on GitHub, request review, squash-merge, delete branch
```
