// lib/ledger.js
//
// Reads the real x402 settlement ledger that the @blockrun/llm SDK appends to
// (~/.blockrun/cost_log.jsonl) — the same ground-truth ledger Franklin uses.
// Each row: { ts (unix seconds), endpoint, cost_usd, wallet, network, client_kind }.
// No private keys are in this file. We use it for exact, all-tool, cross-session
// spend instead of local estimates.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const LEDGER = path.join(os.homedir(), ".blockrun", "cost_log.jsonl");

function readRows() {
  try {
    return fs.readFileSync(LEDGER, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((r) => r && typeof r.cost_usd === "number");
  } catch {
    return [];
  }
}

/** Sum of all settlements (USD) ever recorded — used as a session baseline. */
function totalAll() {
  return readRows().reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
}

/** Rows within the last `days` days. */
function windowRows(days) {
  const cutoff = Date.now() / 1000 - days * 86400;
  return readRows().filter((r) => (Number(r.ts) || 0) >= cutoff);
}

/** Aggregate rows by endpoint → { endpoint: { usd, n } }. */
function byEndpoint(rows) {
  const m = {};
  for (const r of rows) {
    const e = r.endpoint || "unknown";
    if (!m[e]) m[e] = { usd: 0, n: 0 };
    m[e].usd += Number(r.cost_usd) || 0;
    m[e].n += 1;
  }
  return m;
}

module.exports = { LEDGER, readRows, totalAll, windowRows, byEndpoint };
