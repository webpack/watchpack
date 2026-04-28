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

Cross-platform: `EPERM` / `ENOENT` are excluded from the new `error`
event for the same reason they were already excluded from the
`console.error` log. On Windows pre-Node-v22 `fs.watch` synthesizes
`EPERM` when the watched directory is renamed; on Linux `ENOENT`
fires when it is deleted. Both are already represented by the
`remove` events that follow, so re-reporting them as `error` would be
noisy. macOS uses recursive FSEvents and surfaces real errors (e.g.
`EMFILE`) through the same path. Polling mode does not exercise
`fs.watch`, so the new event only fires for native-watcher failures.
