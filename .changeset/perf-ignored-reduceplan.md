---
"watchpack": patch
---

perf: speed up `ignored` matchers (~35–45% faster on POSIX paths) and `reducePlan` (~20–40% faster on medium and large plans). Also adds a tinybench suite under `bench/` and a CodSpeed GitHub Actions workflow to catch future regressions.
