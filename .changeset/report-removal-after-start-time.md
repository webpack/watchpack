---
"watchpack": patch
---

fix: report a file removed after `startTime` to a watcher attached later, as a change after `startTime` already is.

Previously a watcher attached with a `startTime` learned of files changed since then ("outdated on attach") but not of files removed since then, so webpack missed a dependency deleted while a build ran.
