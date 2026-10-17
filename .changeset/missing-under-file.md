---
"watchpack": patch
---

Watch a missing file whose parent path is a file (e.g. `src/foo/index.js`, tried by a resolver alias, while `src/foo` is a file) like one whose parent is missing: no more `ENOTDIR` "Watchpack Error (initial scan)" log, and the file is reported once the parent becomes a directory (fixes #226's case).
