---
"watchpack": minor
---

feat: surface watcher errors via a new `error` event on `Watchpack`
(fixes #46).

Previously, when `fs.watch()` failed — most commonly `ENOSPC` from
exceeding `fs.inotify.max_user_watches` on Linux — `DirectoryWatcher`
logged the error to stderr and then treated the directory as removed.
Consumers like webpack's `--watch` had no way to react: a single build
ran, the watcher silently died, and the process exited 0.

`DirectoryWatcher` now also emits `error` on each subscribed watcher
when `onWatcherError` fires, and `Watchpack` re-emits those as a public
`error` event. `ENOSPC` errors are enriched with a hint pointing at
`fs.inotify.max_user_watches` so the cause is visible without digging
through `errno` tables.

The change is additive: the existing `console.error` log is preserved,
and `Watchpack` only emits `error` when a listener is attached, so
consumers that don't subscribe see no behavior change.
