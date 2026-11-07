---
name: nowyoumaycommitdonkey
description: The user's go-ahead to commit. Only the user runs this, by typing /nowyoumaycommitdonkey. Without it, never commit, push, or ask to (CLAUDE.md, "Git — commits are the user's call").
disable-model-invocation: true
---

# Now you may commit

The user has allowed commits for this run only. Afterwards the CLAUDE.md rule applies again: no commits, no pushes,
no asking.

Arguments: `$ARGUMENTS`. Anything in them goes first: which files, a message, `push`, "only the tests". When they
name what to commit, commit only that.

1. **Look first.** `git status` and `git diff --stat`. Read anything you didn't write in this session before staging it.
2. **Decide what goes in.** Only work the user asked for. Leave out scratch and test files, personal data
   (`projects/`), anything they said doesn't ship, and anything that looks like a secret. Stage files by name,
   never `git add -A` or `git add .`.
3. **Check.** `npx tsc --noEmit`, `npm run lint` and `npm test` must pass. If one fails, stop and report it. Don't
   commit around a failure.
4. **Commit.** Split unrelated work into separate commits. Each message: a short subject saying what changed, a body
   saying why, and the attribution line from the session's system reminder.
5. **Push only if `push` is in the arguments.** Otherwise say how many commits `main` is ahead of GitHub.
6. **Report.** Each commit's hash and subject, what was left out and why. Then stop. Don't suggest a next commit.
