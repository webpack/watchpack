---
"watchpack": patch
---

fix: do not report directories created shortly before `startTime` as changed when the initial scan sees only directories (#295).

Timestamp accuracy was learned only from file mtimes, so a scan that found only directories kept the 2000ms default and flagged anything created in the 2s before `startTime`. Directory mtimes now lower it the same way.
