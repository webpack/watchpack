# watchpack

## 2.5.2

### Patch Changes

- fix: retry `fs.lstat` on transient `EBUSY` errors instead of flagging the (by [@alexander-akait](https://github.com/alexander-akait) in [#293](https://github.com/webpack/watchpack/pull/293))
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

- Improve perfomance for ignored and improve perfomance for reduce plan. (by [@alexander-akait](https://github.com/alexander-akait) in [#289](https://github.com/webpack/watchpack/pull/289))

- perf: skip the path-separator replacement when the input has no backslash (by [@alexander-akait](https://github.com/alexander-akait) in [#287](https://github.com/webpack/watchpack/pull/287))
  (benchmarks measure ~35–45% less time for `ignored` matchers on POSIX paths),
  fast-path single-element `ignored` arrays, and make `reducePlan`'s selection
  loop walk only structurally valid candidates with an early exit when the
  ideal reduction is found (measured ~20–40% faster on medium and large
  plans). Adds a tinybench suite under `bench/` and a CodSpeed GitHub Actions
  workflow so future regressions are caught automatically.

- fix: don't log "Watchpack Error (initial scan)" for unreadable entries (by [@alexander-akait](https://github.com/alexander-akait) in [#298](https://github.com/webpack/watchpack/pull/298))
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

- fix: prevent unbounded watcher growth when a symlinked directory points (by [@alexander-akait](https://github.com/alexander-akait) in [#297](https://github.com/webpack/watchpack/pull/297))
  back to one of its own ancestors (cycle protection for the
  `followSymlinks: true` symlink-descent path).

  The recent fixes for #190 / #231 made `DirectoryWatcher` follow
  symlinked directories whose realpath lives outside the watched real
  directory, registering them as nested watched directories. That logic
  short-circuits when the symlink target is a sibling in the same parent
  (`dirname(realPath) === this.path`), but it does not catch the case
  where the target is an _ancestor_ of the symlink itself — for example
  `a/b/loop -> ..`. In that case `readdir` followed the symlink, found
  the original tree again, and a new `DirectoryWatcher` was created at
  each recursion level until the path exceeded `PATH_MAX` (locally
  observed: ~1500 watchers within 2 s, ~2500 within 2.5 s).

  `DirectoryWatcher` now computes `path.relative(realPath, itemPath)`
  before descending; if the relative path doesn't start with `..` and
  isn't absolute (i.e. the symlink target is at-or-above the symlink in
  the directory tree), the symlink is recorded as a plain entry instead
  of being descended into. Behaviour for symlinks pointing outside the
  watched tree (the case #231 fixes) is unchanged.
