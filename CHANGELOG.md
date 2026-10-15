# watchpack

## 2.6.1

### Patch Changes

- fix: stop a tight `fs.watch` retry loop behind a dangling directory symlink, and retry once a second until its target appears. (by [@alexander-akait](https://github.com/alexander-akait) in [#346](https://github.com/webpack/watchpack/pull/346))

## 2.6.0

### Minor Changes

- feat: allow the `ignored` option to be a mixed array of glob strings and (by [@stormslowly](https://github.com/stormslowly) in [#336](https://github.com/webpack/watchpack/pull/336))
  `RegExp` instances, e.g. `ignored: ["**/.cache", /generated/]`.

  Previously an array was assumed to contain only glob strings, so passing a
  `RegExp` inside it threw `TypeError: Expected a string`. This made it
  awkward for frameworks to append their own glob ignores to a user-supplied
  `RegExp` ignore, since the two could not be combined in one value.

  Glob strings in the array are still merged into a single `RegExp`; `RegExp`
  items are tested as-is. Behaviour for string-only arrays, single strings,
  single `RegExp`s and functions is unchanged.

### Patch Changes

- fix: report a file removed after `startTime` to a watcher attached later, as a change after `startTime` already is. (by [@alexander-akait](https://github.com/alexander-akait) in [#345](https://github.com/webpack/watchpack/pull/345))

  Previously a watcher attached with a `startTime` learned of files changed since then ("outdated on attach") but not of files removed since then, so webpack missed a dependency deleted while a build ran.

- Suppress `Watchpack Error (stats)` logging for `EACCES`, `ENODEV`, and Windows `EINVAL` lstat errors in the watch-event path, matching the handling in the scan paths (e.g. `pagefile.sys` on a watched drive root with Node >= 22.17) (by [@danielroe](https://github.com/danielroe) in [#326](https://github.com/webpack/watchpack/pull/326))

## 2.5.2

### Patch Changes

- fix: retry `fs.lstat` on transient `EBUSY` errors instead of emitting a spurious `remove` event (fixes #223, #44). The retry count is controlled by the `WATCHPACK_RETRIES` environment variable (default: `3`; set to `0` or `"false"` to disable retrying). (by [@alexander-akait](https://github.com/alexander-akait) in [#293](https://github.com/webpack/watchpack/pull/293))

- Improve perfomance for ignored and improve perfomance for reduce plan. (by [@alexander-akait](https://github.com/alexander-akait) in [#289](https://github.com/webpack/watchpack/pull/289))

- perf: speed up `ignored` matchers (~35–45% faster on POSIX paths) and `reducePlan` (~20–40% faster on medium and large plans). Also adds a tinybench suite under `bench/` and a CodSpeed GitHub Actions workflow to catch future regressions. (by [@alexander-akait](https://github.com/alexander-akait) in [#287](https://github.com/webpack/watchpack/pull/287))

- fix: don't log "Watchpack Error (initial scan)" for unreadable entries inside a watched parent directory, e.g. `pagefile.sys` on WSL or `/efi` on Linux (fixes #187). `EACCES` / `ENODEV` (and `EINVAL` on Windows) errors are now handled like `EPERM` / `ENOENT` / `EBUSY`: the entry is recorded as missing and the scan continues silently. (by [@alexander-akait](https://github.com/alexander-akait) in [#298](https://github.com/webpack/watchpack/pull/298))

- fix: prevent unbounded watcher growth when a symlinked directory points back to one of its own ancestors (e.g. `a/b/loop -> ..`) with `followSymlinks: true`. Such symlinks are now recorded as plain entries instead of being descended into; symlinks pointing outside the watched tree (#231) behave as before. (by [@alexander-akait](https://github.com/alexander-akait) in [#297](https://github.com/webpack/watchpack/pull/297))
