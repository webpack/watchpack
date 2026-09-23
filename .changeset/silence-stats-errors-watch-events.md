---
"watchpack": patch
---

Suppress `Watchpack Error (stats)` logging for `EACCES`, `ENODEV`, and Windows `EINVAL` lstat errors in the watch-event path, matching the handling in the scan paths (e.g. `pagefile.sys` on a watched drive root with Node >= 22.17)
