---
"watchpack": patch
---

fix: prevent unbounded watcher growth when a symlinked directory points
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
