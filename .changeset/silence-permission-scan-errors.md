---
"watchpack": patch
---

fix: don't log "Watchpack Error (initial scan)" for unreadable entries
inside a watched parent directory (fixes #187).

Webpack registers every ancestor of a watched file as a watched
directory (so `/mnt/c/Users/me/proj` causes watchpack to scan `/mnt/c`,
`/mnt`, `/`). When such a parent contains entries the current process
can't `lstat` — `pagefile.sys` / `hiberfil.sys` on WSL, `/efi` on Linux
when the EFI partition isn't mounted, protected paths on Node ≥22.17 on
Windows where libuv now reports `EINVAL` instead of `EACCES` — the
initial scan would print:

    Watchpack Error (initial scan): Error: EACCES: permission denied, lstat '/mnt/c/pagefile.sys'
    Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat 'C:\\hiberfil.sys'
    Watchpack Error (initial scan): Error: ENODEV: no such device, lstat '/efi'

These entries aren't actually being watched (only their sibling, e.g.
`/mnt/c/Users`, is) so the log was harmless but very noisy and sent a
lot of users on wild goose chases.

`DirectoryWatcher#doScan` now treats `EACCES` / `ENODEV` (and `EINVAL`
on Windows) the same way it already treats `EPERM` / `ENOENT` /
`EBUSY`: the offending entry is recorded as missing and the scan
continues silently. The same set is applied to the `readdir` error path
on the watched directory itself, so an unreadable mount point is
treated as removed instead of logged.

No public API change. If you were relying on the error appearing on
stderr, set the impacted entry up as an explicit watch so a real failure
on it surfaces through the existing `error` event instead.
