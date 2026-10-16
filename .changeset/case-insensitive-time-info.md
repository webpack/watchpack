---
"watchpack": patch
---

On case-insensitive file systems, give a file watched with other casing (e.g. imported as `./B` while the file is `b.js`) the time info of the file instead of `null`, so webpack rebuilds it on every change, not only the first (fixes #228).
