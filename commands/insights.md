---
description: BlockRun spend insights — real ledger totals, by-endpoint, projections
---

Run the BlockRun insights script and present its output cleanly:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/insights.js"
```

It reads `~/.blockrun/cost_log.jsonl` (the real x402 settlement ledger) and prints
today / 7d / 30d / all-time totals, a by-endpoint breakdown, and a monthly/yearly
projection. Show me the numbers as a tidy markdown summary. If `$CLAUDE_PLUGIN_ROOT`
isn't set, find `scripts/insights.js` inside the blockrun-media plugin directory.
