# Benchmarks

This directory holds watchpack's performance benchmarks. The layout mirrors
[webpack/enhanced-resolve's `benchmark/`](https://github.com/webpack/enhanced-resolve/tree/main/benchmark):
each scenario lives under `cases/<name>/index.bench.mjs`, `run.mjs` discovers
every case and runs it through [tinybench](https://github.com/tinylibs/tinybench),
and the same entry point works both locally (wall-clock) and under
[CodSpeed](https://codspeed.io/) (instruction-count simulation) via the
`with-codspeed.mjs` bridge.

## Running

```sh
# Run every case
npm run benchmark

# Run only cases whose directory name contains "ignored"
BENCH_FILTER=ignored npm run benchmark
#  - or, equivalently -
npm run benchmark -- ignored
```

The output is a table of `ops/s`, mean latency, p99 latency, RME, and
sample count per registered task. When run under `CodSpeedHQ/action` the
bridge switches to instrumentation mode automatically.

## Layout

```
bench/
├── README.md
├── run.mjs             # entry: discovers cases, runs them, prints a table
├── with-codspeed.mjs   # tinybench <-> @codspeed/core bridge
└── cases/
    └── <case-name>/
        └── index.bench.mjs
```

Each `index.bench.mjs` exports a default `register(bench, ctx)` function
that calls `bench.add(name, fn)` one or more times. The `ctx` argument is
`{ caseName, caseDir, fixtureDir }`; `fixtureDir` points at
`cases/<name>/fixture/` (the directory is optional — only create it if you
need a real on-disk tree).

## Writing a case

1. Create `bench/cases/<name>/index.bench.mjs`.
2. Default-export a `register` function.
3. Pre-build expensive fixtures **outside** the benchmark callback so only
   the hot path is measured.
4. Each `bench.add` body should loop over a fixed batch of inputs so the
   measurement window sees enough work to be stable (tens of microseconds
   minimum).
5. Avoid any non-determinism — use fixed request lists, no `Math.random`.
6. Focus one case on one scenario. If you need a materially different
   shape (warm vs. cold cache, POSIX vs. Windows paths), prefer a new case
   directory over piling `bench.add` calls into an existing one.

## CodSpeed

`bench/run.mjs` wraps the `Bench` with `withCodSpeed()`. When `CODSPEED_*`
env vars are absent the wrapper returns the bench untouched and tinybench's
built-in timing is used. Under `CodSpeedHQ/action` with
`mode: "simulation"` the wrapper overrides `bench.run` to call the
instrumentation hooks once per task, which produces reproducible
instruction-count measurements independent of the runner's load.

The `@codspeed/tinybench-plugin` package is intentionally not used here:
it reads private tinybench v6 Task fields and breaks in simulation mode.
Both webpack and enhanced-resolve ran into the same issue and wrote their
own bridges; `with-codspeed.mjs` is ported from enhanced-resolve's.
