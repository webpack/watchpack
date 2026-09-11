---
"watchpack": minor
---

feat: allow the `ignored` option to be a mixed array of glob strings and
`RegExp` instances, e.g. `ignored: ["**/.cache", /generated/]`.

Previously an array was assumed to contain only glob strings, so passing a
`RegExp` inside it threw `TypeError: Expected a string`. This made it
awkward for frameworks to append their own glob ignores to a user-supplied
`RegExp` ignore, since the two could not be combined in one value.

Glob strings in the array are still merged into a single `RegExp`; `RegExp`
items are tested as-is. Behaviour for string-only arrays, single strings,
single `RegExp`s and functions is unchanged.
