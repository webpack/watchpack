---
"watchpack": patch
---

fix: don't log "Watchpack Error (initial scan)" for unreadable entries inside a watched parent directory, e.g. `pagefile.sys` on WSL or `/efi` on Linux (fixes #187). `EACCES` / `ENODEV` (and `EINVAL` on Windows) errors are now handled like `EPERM` / `ENOENT` / `EBUSY`: the entry is recorded as missing and the scan continues silently.
