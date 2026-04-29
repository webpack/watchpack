---
"watchpack": patch
---

fix: do not emit spurious initial-scan `change` events for files and
directories created within `FS_ACCURACY` (up to two seconds) of
`startTime` (fixes #295).

`DirectoryWatcher` previously compared an entry's `safeTime`
(`Math.min(now, mtime) + FS_ACCURACY`) against the watcher's
`startTime`. Because `safeTime` is intentionally inflated by
`FS_ACCURACY` to account for filesystem timestamp granularity, every
file or directory whose actual `mtime`/`birthtime` was up to
`FS_ACCURACY` _before_ `startTime` was being flagged as changed during
the initial scan.

The `startTime` filter now compares against the raw `mtime`/`birthtime`
instead, so only entries actually modified at or after `startTime`
trigger a change event. The `change` event payload (and the existing
`safeTime` semantics for consumers) are unchanged.
