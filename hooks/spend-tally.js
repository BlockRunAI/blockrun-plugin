#!/usr/bin/env node
// PostToolUse tally for BlockRun tools.
//
// Fires only after a tool actually ran (i.e. the user approved any prompt),
// so re-estimating the cost here gives a running session spend. Persists to a
// per-session temp file (read by the status line) and feeds a one-line receipt
// back into context via additionalContext.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { estimate } = require("../lib/estimate.js");

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}

const data = readStdin();
const { usd, label } = estimate(data.tool_name, data.tool_input || {});

const dir = path.join(os.tmpdir(), "blockrun-cc");
const file = path.join(dir, `${data.session_id || "default"}.json`);
let state = { usd: 0, calls: 0 };
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first call */ }
if (usd > 0) { state.usd += usd; state.calls += 1; }
try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(state)); } catch { /* best effort */ }

const receipt = usd > 0
  ? `[BlockRun] ${label} ≈ -$${usd.toFixed(4)} · session $${state.usd.toFixed(4)} (${state.calls} paid calls)`
  : `[BlockRun] ${label}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse" },
  additionalContext: receipt,
}));
