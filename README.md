# blockrun-media (Claude Code plugin — prototype)

Wraps the BlockRun media MCP (`image` / `video` / `realface` / `music` / `speech`
+ `wallet` / `models`) with UX that the bare MCP can't provide:

- **Spend confirmation** — a `PreToolUse` hook estimates each paid call's cost and
  asks before charging (free tools run silently). The core "ask before charge" flow.
- **Running cost meter** — a `PostToolUse` hook records session spend and drops a
  one-line receipt into context after each paid call.
- **Status line** — bottom-bar `🪙 BlockRun · session -$X.XXXX (N calls)`.
- **Free tools pre-allowed** — `blockrun_wallet` / `blockrun_models` never prompt.
- **Slash commands** — `/blockrun-media:balance`, `/blockrun-media:report`.

> Claude Code only (CLI + VS Code extension + JetBrains). Claude Desktop does **not**
> load plugins — there it would be the bare MCP. The MCP itself works everywhere.

## Layout

```
blockrun-plugin/
├── .claude-plugin/plugin.json   manifest
├── .mcp.json                    bundled MCP (media profile)
├── settings.json                pre-allow free tools + statusLine
├── hooks/
│   ├── hooks.json               Pre/PostToolUse wiring
│   ├── spend-gate.js            confirm spend + soft budget cap
│   └── spend-tally.js           real session spend (ledger) → receipt
├── statusline/balance.js        bottom-bar session spend (real)
├── scripts/insights.js          spend report from the settlement ledger
├── lib/
│   ├── estimate.js              per-call cost estimate + savings-vs-flagship
│   └── ledger.js                reads ~/.blockrun/cost_log.jsonl (real spend)
└── commands/{balance,report,insights}.md  slash commands
```

## Account API setup

Register at [user.blockrun.ai](https://user.blockrun.ai), create a key at [API Keys](https://user.blockrun.ai/dashboard/keys), and add [Credits](https://user.blockrun.ai/dashboard/credits). Set `BLOCKRUN_API_KEY` before launching Claude Code; the bundled MCP inherits it and `.mcp.json` never stores it.

Account mode needs no wallet once the MCP release containing [MCP PR #136](https://github.com/BlockRunAI/blockrun-mcp/pull/136) is published. Until then, point the MCP command at that exact local review build. Wallet mode remains available through x402 on Solana or Base, with Solana first for new users. The local ledger/status line contains wallet settlements only; account usage belongs to the credits portal. Estimates and confirmation still apply before account calls.

## Try it locally

```bash
claude --plugin-dir /path/to/blockrun-plugin
```

Then ask Claude to generate an image — you'll get a spend-confirmation prompt
with the estimate, a receipt afterward, and the status line updating.

## Features

- **Spend confirmation** — `spend-gate` (PreToolUse) asks before a paid call, showing
  the estimated cost and real session-so-far. Free tools run silently.
- **Real-ledger spend** — `spend-tally` + status line read the SDK's settlement ledger
  (`~/.blockrun/cost_log.jsonl`), so the per-call receipt and `🪙 session` total are the
  **actual** amounts settled, across all tools, not estimates.
- **Savings narrative** — receipts note how much a cheaper model saved vs the flagship,
  e.g. `saved ~$0.0650 vs gpt-image-2`.
- **Soft budget cap** — set `BLOCKRUN_SESSION_CAP`; once real session spend would exceed
  it, the gate returns a friendly refusal the model adapts to (try a cheaper model),
  not a hard error.
- **`/blockrun-media:insights`** — totals (today/7d/30d/all-time), by-endpoint breakdown,
  and monthly/yearly projection from the ledger. Plus `/balance` and `/report`.

## Knobs (env)

- `BLOCKRUN_ASK_THRESHOLD` (default `0`) — auto-run paid calls at/under this USD amount
  without asking. e.g. `0.02` lets cheap drafts through.
- `BLOCKRUN_SESSION_CAP` (default unset = no cap) — soft refusal once real session spend
  would exceed this USD amount.
- `BLOCKRUN_INLINE_IMAGES=1` — return inline image previews (set in `.mcp.json`).

## Notes / limits

- Spend figures are the **real** settled amounts (from `~/.blockrun/cost_log.jsonl`); the
  per-call estimate in `lib/estimate.js` is only used for the pre-charge confirmation.
- The published `.mcp.json` uses `npx -y @blockrun/mcp@latest --profile media`. For local
  development against an unpublished build, point it at a local `node …/dist/index.js`.
- If your client ignores a plugin-level `statusLine`, copy the `statusLine` block from
  `settings.json` into your user `settings.json` (replace `${CLAUDE_PLUGIN_ROOT}` with the
  absolute plugin path). statusLine renders in the CLI; some clients don't show it.
