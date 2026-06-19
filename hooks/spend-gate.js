#!/usr/bin/env node
// PreToolUse gate for BlockRun tools.
//
// 1. Captures the session baseline (ledger total before the first BlockRun
//    charge) so the tally/status line can report REAL session spend.
// 2. Soft budget cap (Franklin pattern): if real session spend + this call would
//    exceed BLOCKRUN_SESSION_CAP, return a friendly deny the model can adapt to
//    (try a cheaper model) — not a hard error. Cap is opt-in (unset = no cap).
// 3. Otherwise asks the user to confirm the spend (free/under-threshold runs
//    silently). On clients that honor PreToolUse decisions the reason shows the
//    cost; elsewhere it falls back to the native prompt.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { estimate } = require("../lib/estimate.js");
const ledger = require("../lib/ledger.js");

const ASK_THRESHOLD = Number(process.env.BLOCKRUN_ASK_THRESHOLD || 0);
const SESSION_CAP = Number(process.env.BLOCKRUN_SESSION_CAP || 0); // 0 = no cap

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}
function emit(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

const data = readStdin();
const { usd, label } = estimate(data.tool_name, data.tool_input || {});

// Baseline = ledger total before the first BlockRun call this session.
const dir = path.join(os.tmpdir(), "blockrun-cc");
const file = path.join(dir, `${data.session_id || "default"}.json`);
let state = {};
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first call */ }
if (typeof state.baseline !== "number") {
  state.baseline = ledger.totalAll();
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(state)); } catch { /* best effort */ }
}
const session = Math.max(0, ledger.totalAll() - state.baseline);

// Soft budget refusal.
if (SESSION_CAP > 0 && usd > 0 && session + usd > SESSION_CAP) {
  emit("deny",
    `BlockRun session budget reached: $${session.toFixed(4)} spent + $${usd.toFixed(4)} for this call would exceed the $${SESSION_CAP.toFixed(2)} cap. ` +
    `Use a cheaper model (e.g. zai/cogview-4 for drafts), skip this call, or raise BLOCKRUN_SESSION_CAP.`);
}

if (usd <= ASK_THRESHOLD) process.exit(0); // free / under threshold → allow silently

emit("ask",
  `💸 **BlockRun spend** — \`${label}\`\n` +
  `Estimated: **$${usd.toFixed(4)}**   ·   session so far: $${session.toFixed(4)}\n` +
  `Approve this charge?`);
