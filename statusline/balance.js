#!/usr/bin/env node
// Status-line renderer: shows BlockRun session spend in the bottom bar.
//
// Claude Code pipes session JSON (incl. session_id) on stdin and renders this
// script's stdout as the status line. We read the per-session tally written by
// the PostToolUse hook — no wallet/credential access needed. Live USDC balance
// is intentionally left to `blockrun_wallet` (the MCP does the secure lookup).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}

const data = readStdin();
const sid = data.session_id || data.sessionId || "default";
let state = { usd: 0, calls: 0 };
try {
  state = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "blockrun-cc", `${sid}.json`), "utf8"));
} catch { /* nothing spent yet */ }

process.stdout.write(`🪙 BlockRun · session -$${(state.usd || 0).toFixed(4)} (${state.calls || 0} calls)`);
