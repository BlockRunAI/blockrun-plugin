#!/usr/bin/env node
// Status-line renderer: BlockRun session spend (REAL, from the settlement
// ledger) in the bottom bar. Reads the small per-session state file the
// PostToolUse tally writes — no ledger parse on every render, no credential
// access. Live USDC balance stays with `blockrun_wallet` (secure lookup).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}

const data = readStdin();
const sid = data.session_id || data.sessionId || "default";
let state = {};
try {
  state = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "blockrun-cc", `${sid}.json`), "utf8"));
} catch { /* nothing spent yet */ }

const session = Number(state.session || 0);
const calls = Number(state.calls || 0);
process.stdout.write(`🪙 BlockRun · session -$${session.toFixed(4)} (${calls} paid)`);
