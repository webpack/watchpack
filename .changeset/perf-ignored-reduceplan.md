---
"watchpack": patch
---

perf: skip the path-separator replacement when the input has no backslash
(benchmarks measure ~35–45% less time for `ignored` matchers on POSIX paths),
fast-path single-element `ignored` arrays, and make `reducePlan`'s selection
loop walk only structurally valid candidates with an early exit when the
ideal reduction is found (measured ~20–40% faster on medium and large
plans). Adds a tinybench suite under `bench/` and a CodSpeed GitHub Actions
workflow so future regressions are caught automatically.
