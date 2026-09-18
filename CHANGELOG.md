# watchpack

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

## 2.5.2

### Patch Changes

- fix: retry `fs.lstat` on transient `EBUSY` errors instead of emitting a spurious `remove` event (fixes #223, #44). The retry count is controlled by the `WATCHPACK_RETRIES` environment variable (default: `3`; set to `0` or `"false"` to disable retrying). (by [@alexander-akait](https://github.com/alexander-akait) in [#293](https://github.com/webpack/watchpack/pull/293))

- Improve perfomance for ignored and improve perfomance for reduce plan. (by [@alexander-akait](https://github.com/alexander-akait) in [#289](https://github.com/webpack/watchpack/pull/289))

- perf: speed up `ignored` matchers (~35–45% faster on POSIX paths) and `reducePlan` (~20–40% faster on medium and large plans). Also adds a tinybench suite under `bench/` and a CodSpeed GitHub Actions workflow to catch future regressions. (by [@alexander-akait](https://github.com/alexander-akait) in [#287](https://github.com/webpack/watchpack/pull/287))

- fix: don't log "Watchpack Error (initial scan)" for unreadable entries inside a watched parent directory, e.g. `pagefile.sys` on WSL or `/efi` on Linux (fixes #187). `EACCES` / `ENODEV` (and `EINVAL` on Windows) errors are now handled like `EPERM` / `ENOENT` / `EBUSY`: the entry is recorded as missing and the scan continues silently. (by [@alexander-akait](https://github.com/alexander-akait) in [#298](https://github.com/webpack/watchpack/pull/298))

- fix: prevent unbounded watcher growth when a symlinked directory points back to one of its own ancestors (e.g. `a/b/loop -> ..`) with `followSymlinks: true`. Such symlinks are now recorded as plain entries instead of being descended into; symlinks pointing outside the watched tree (#231) behave as before. (by [@alexander-akait](https://github.com/alexander-akait) in [#297](https://github.com/webpack/watchpack/pull/297))
