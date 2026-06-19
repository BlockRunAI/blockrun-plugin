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
│   ├── spend-gate.js            estimate cost → ask before charge
│   └── spend-tally.js           record session spend → receipt
├── statusline/balance.js        bottom-bar session spend
├── lib/estimate.js              shared per-call cost estimator
└── commands/{balance,report}.md slash commands
```

## Try it locally

```bash
claude --plugin-dir /path/to/blockrun-plugin
```

Then ask Claude to generate an image — you'll get a spend-confirmation prompt
with the estimate, a receipt afterward, and the status line updating.

## Knobs (env)

- `BLOCKRUN_ASK_THRESHOLD` (default `0`) — auto-run paid calls at/under this USD
  amount without asking. e.g. `0.02` lets cheap drafts through.
- `BLOCKRUN_SESSION_CAP` (default `5`) — warn in the prompt once estimated session
  spend would exceed this.

## Notes / limits

- Cost figures are **estimates** to inform the user; the MCP/gateway settles the
  real amount. Tune `lib/estimate.js` as pricing changes.
- The `.mcp.json` points at the local MCP build for now. Once `@blockrun/mcp` ships
  `--profile`, switch to `npx -y @blockrun/mcp@latest --profile media`.
- If your client ignores a plugin-level `statusLine`, copy the `statusLine` block
  from `settings.json` into your user `settings.json` (replace `${CLAUDE_PLUGIN_ROOT}`
  with the absolute plugin path).

## Roadmap

Planned (not yet implemented):

- **Savings narrative** — show how much a call saved vs the flagship model in the
  cost line / report, e.g. `cogview-4 $0.015 (saved ~$0.065 vs gpt-image-2)`.
  Mirrors Franklin's "saved vs Opus baseline" framing — good for conveying value.
- **Per-task budget cells** — beyond the session cap, let a user set a budget per
  task/campaign (e.g. "3 images, $0.30 cap"); when a call would exceed it, return
  a friendly message the model reads and adapts to (try a cheaper model) instead of
  a hard error. Mirrors Franklin's per-content budget + soft-refusal pattern.
- **Real-ledger costs** — read the SDK's `~/.blockrun/cost_log.jsonl` settlement
  ledger for exact, all-tool, cross-session spend instead of local estimates.
- **/insights** — per-endpoint breakdown + daily/monthly projection from the ledger.
