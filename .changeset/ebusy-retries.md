---
"watchpack": patch
---

fix: retry `fs.lstat` on transient `EBUSY` errors instead of flagging the
file as removed (fixes #223, #44).

On Windows it is common for anti-virus scanners, indexers or the editor
itself to briefly hold an exclusive handle on a file that has just
changed. Before this change the watcher would receive the `fs.watch`
event, call `lstat`, get back `EBUSY`, and fall through to `setMissing`
— causing a spurious `remove` event and in some cases leaving the
watcher unable to see further changes for that file until the directory
was re-scanned.

`DirectoryWatcher` now retries `lstat` up to three times (100 ms apart)
before giving up, and does not emit a remove when the only reason the
file could not be stat'd was `EBUSY`.

The retry count is controlled by the `WATCHPACK_RETRIES` environment
variable (default: `3`; set to `0` or `"false"` to disable retrying and
restore the previous behaviour).
