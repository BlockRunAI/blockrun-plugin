#!/usr/bin/env node
// PostToolUse tally — REAL spend from the SDK settlement ledger.
//
// Session spend = (current ledger total) − (baseline captured before the first
// BlockRun call this session, set by spend-gate). This call's cost = the delta
// since the previous tally — i.e. exactly what the gateway settled, not an
// estimate. Persists to a per-session temp file (read by the status line) and
// feeds a one-line receipt back into context.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ledger = require("../lib/ledger.js");
const { estimate, savings } = require("../lib/estimate.js");

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}

const data = readStdin();
const dir = path.join(os.tmpdir(), "blockrun-cc");
const file = path.join(dir, `${data.session_id || "default"}.json`);

let state = {};
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first call */ }

const now = ledger.totalAll();
// If the gate never set a baseline (e.g. matcher miss), anchor here so we don't
// attribute the entire wallet history to this session.
if (typeof state.baseline !== "number") state.baseline = now;

const session = Math.max(0, now - state.baseline);
const prev = state.session || 0;
const delta = Math.max(0, session - prev);
if (delta > 0) state.calls = (state.calls || 0) + 1;
state.session = session;
try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(state)); } catch { /* best effort */ }

const { label } = estimate(data.tool_name, data.tool_input || {});
let receipt;
if (delta > 0) {
  const saved = savings(data.tool_name, data.tool_input || {});
  const savedNote = saved > 0 ? ` · saved ~$${saved.toFixed(4)} vs gpt-image-2` : "";
  receipt = `[BlockRun] ${label} −$${delta.toFixed(4)} · session $${session.toFixed(4)} (${state.calls} paid)${savedNote}`;
} else {
  receipt = `[BlockRun] ${label} · no charge · session $${session.toFixed(4)}`;
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse" },
  additionalContext: receipt,
}));
