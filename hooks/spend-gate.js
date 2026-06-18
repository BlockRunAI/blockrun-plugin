#!/usr/bin/env node
// PreToolUse gate for BlockRun tools.
//
// Free tools (wallet, models, list/voices actions) run silently. Paid tools
// return permissionDecision:"ask" with a cost estimate so the user confirms
// the spend before any USDC leaves the wallet — the core "ask before charge"
// UX. A per-session soft cap (BLOCKRUN_SESSION_CAP, default $5) is surfaced
// in the prompt once cumulative estimated spend approaches it.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { estimate } = require("../lib/estimate.js");

// Tools whose estimated cost is at/below this auto-run without a prompt.
// Default 0 → confirm on ANY paid call. Raise (e.g. 0.02) to let cheap
// drafts through silently.
const ASK_THRESHOLD = Number(process.env.BLOCKRUN_ASK_THRESHOLD || 0);
const SESSION_CAP = Number(process.env.BLOCKRUN_SESSION_CAP || 5);

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return {}; }
}
function sessionSpent(sessionId) {
  try {
    const f = path.join(os.tmpdir(), "blockrun-cc", `${sessionId}.json`);
    return JSON.parse(fs.readFileSync(f, "utf8")).usd || 0;
  } catch { return 0; }
}
function emit(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

const data = readStdin();
const { usd, label } = estimate(data.tool_name, data.tool_input || {});

// Free / under threshold → auto-approve so balance checks etc. never prompt.
if (usd <= ASK_THRESHOLD) emit("allow", `${label} — no charge`);

const spent = sessionSpent(data.session_id);
const after = spent + usd;
const lines = [
  `💸 **BlockRun spend** — \`${label}\``,
  `Estimated: **$${usd.toFixed(4)}**   ·   session so far: $${spent.toFixed(4)} → $${after.toFixed(4)}`,
];
if (after > SESSION_CAP) {
  lines.push(`⚠️ This exceeds the session cap of $${SESSION_CAP.toFixed(2)}.`);
}
lines.push(`Approve this charge?`);
emit("ask", lines.join("\n"));
