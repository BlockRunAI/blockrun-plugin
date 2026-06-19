#!/usr/bin/env node
// BlockRun spend insights from the real settlement ledger (~/.blockrun/cost_log.jsonl).
// Totals (today / 7d / 30d / all-time), by-endpoint breakdown, and a projection.

const ledger = require("../lib/ledger.js");

const f = (n) => "$" + n.toFixed(4);
const sum = (a) => a.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);

const all = ledger.readRows();
if (!all.length) {
  console.log("No BlockRun spend recorded yet (~/.blockrun/cost_log.jsonl is empty).");
  process.exit(0);
}

const now = Date.now() / 1000;
const within = (days) => all.filter((r) => (Number(r.ts) || 0) >= now - days * 86400);
const d1 = within(1), d7 = within(7), d30 = within(30);
const avg = sum(d30) / 30;

console.log("# BlockRun spend insights\n");
console.log(`Today: ${f(sum(d1))}  ·  7d: ${f(sum(d7))}  ·  30d: ${f(sum(d30))}  ·  all-time: ${f(sum(all))}  (${all.length} calls)`);
console.log(`\nDaily avg (30d): ${f(avg)}  →  projected month: ${f(avg * 30)}  ·  year: ${f(avg * 365)}\n`);

const be = ledger.byEndpoint(d30);
const rows = Object.entries(be).sort((a, b) => b[1].usd - a[1].usd);
console.log("By endpoint (last 30d):");
for (const [e, v] of rows) console.log(`  ${e.padEnd(36)} ${f(v.usd).padStart(10)}  (${v.n})`);
