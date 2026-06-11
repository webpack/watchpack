---
"watchpack": patch
---

fix: prevent unbounded watcher growth when a symlinked directory points back to one of its own ancestors (e.g. `a/b/loop -> ..`) with `followSymlinks: true`. Such symlinks are now recorded as plain entries instead of being descended into; symlinks pointing outside the watched tree (#231) behave as before.
