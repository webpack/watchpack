---
"watchpack": patch
---

When the system runs out of file watchers (`ENOSPC`/`EMFILE`, e.g. `fs.inotify.max_user_watches` on Linux), poll the directories it cannot watch instead of reporting their files as removed and retrying in a loop, and log the error once with a hint (fixes #46).
