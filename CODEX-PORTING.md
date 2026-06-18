# Porting the BlockRun plugin from Claude Code to Codex

As of early 2026, OpenAI **Codex** has converged on Claude Code's extension model:
it has hooks (near-identical JSON schema), skills (`SKILL.md` + frontmatter),
subagents, a `.codex-plugin/plugin.json` manifest, and a git-based plugin
marketplace (launched 2026-03-27). Porting is mostly **translation of format and
paths**, not a rewrite. The one true gap is the command-driven status line.

> The portable core is **MCP** — write it once, configure it in each client.
> The "shell" (skills/hooks/commands/statusline) is per-client.

## Component mapping

| Claude Code | Codex equivalent | Port effort |
|---|---|---|
| MCP server (`.mcp.json` / `claude mcp add`) | `[mcp_servers.<name>]` in `~/.codex/config.toml` (note the **underscore**) or plugin `.mcp.json`; stdio + streamable HTTP; `codex mcp add` | ✅ direct. **MCP prompts/resources and image-returns are NOT supported in Codex.** |
| Skills (`SKILL.md`) | `SKILL.md` in `.agents/skills` (repo) / `~/.agents/skills` (user) / plugin `skills/` | ✅ near-identical format; move the path |
| Slash commands (`commands/*.md`) | Custom prompts `~/.codex/prompts/*.md` (`/prompts:name`) — **deprecated**; OpenAI steers to Skills | ⚠️ re-author as Skills |
| Hooks — PreToolUse / PostToolUse | `[[hooks.PreToolUse]]` / `PostToolUse` in `hooks.json` or `config.toml`; same stdin-JSON + `permissionDecision` / `updatedInput` schema | ✅ ~drop-in; tool names differ; only `type:"command"` runs |
| Other hooks (Stop, SessionStart, PreCompact, UserPromptSubmit…) | All exist, plus `PermissionRequest`, `SubagentStart`, `PostCompact` | ✅ Codex event set is a superset |
| Subagents | TOML in `~/.codex/agents/` or `.codex/agents/` | ✅ markdown+frontmatter → TOML |
| settings / permissions | `approval_policy` + `sandbox_mode` + execpolicy `rules` + `PermissionRequest` hook | ⚠️ different shape; **cannot customize approval-prompt text** |
| `statusLine` (script emitting text) | `[tui].status_line` — **built-in field IDs only, no script** | ❌ **not portable** (openai/codex#20244) |
| Marketplace (`.claude-plugin/marketplace.json`) | `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json`; `codex plugin marketplace add owner/repo`. Codex also reads `.claude-plugin/` local marketplaces. | ✅ direct analog |

## This plugin, specifically

| Our component | Codex port |
|---|---|
| media MCP (`--profile media`) | ✅ add to `config.toml` `[mcp_servers.blockrun]` / plugin `.mcp.json` |
| `spend-gate` (PreToolUse) + `spend-tally` (PostToolUse) | ✅ same hook schema; reuse the JS scripts |
| `announce-cost` / `balance` / `report` skills | ✅ move to `.agents/skills` (skills are the Codex-preferred form for the commands too) |
| `statusLine` (session spend) | ❌ no command-driven statusline in Codex — drop, or pick built-in `[tui].status_line` items |
| `confirm-spend` (MCP elicitation) | ✅ **Codex supports MCP elicitation** (openai/codex#17043) — may actually render where the Claude Code VSCode extension does not |

### The interesting reversal
The MCP-elicitation spend confirmation that does **not** fire in the Claude Code
VSCode extension may work in Codex, which added MCP elicitation support.

## Reliable cross-client baseline (both CC and Codex)
Per the client research, the only thing that renders reliably everywhere is
**plain text in the tool result** (+ `structuredContent`). So a per-call cost
footer in the tool output is the portable way to show cost — independent of
hooks/statusline/elicitation. See `reference_cc_client_ui_capabilities` memory.

## Sources
- Codex plugins: https://developers.openai.com/codex/plugins · build: https://developers.openai.com/codex/plugins/build
- Hooks: https://developers.openai.com/codex/hooks
- Skills: https://developers.openai.com/codex/skills · Subagents: https://developers.openai.com/codex/subagents
- MCP: https://developers.openai.com/codex/mcp · Config: https://developers.openai.com/codex/config-reference
- Approvals: https://developers.openai.com/codex/agent-approvals-security
- statusline gap: https://github.com/openai/codex/issues/20244 · MCP elicitation: https://github.com/openai/codex/pull/17043
