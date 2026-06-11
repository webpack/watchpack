---
"watchpack": patch
---

fix: retry `fs.lstat` on transient `EBUSY` errors instead of emitting a spurious `remove` event (fixes #223, #44). The retry count is controlled by the `WATCHPACK_RETRIES` environment variable (default: `3`; set to `0` or `"false"` to disable retrying).
