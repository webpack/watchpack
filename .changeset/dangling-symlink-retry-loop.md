---
"watchpack": patch
---

fix: stop a tight `fs.watch` retry loop behind a dangling directory symlink, and retry once a second until its target appears.
