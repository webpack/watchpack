---
"watchpack": patch
---

Report a watched missing directory that appeared while the previous watcher was paused (e.g. during a webpack build) to the watcher that replaces it, like a file; before, a `node_modules` directory created during a build could be missed until the next unrelated change, most often with polling.
