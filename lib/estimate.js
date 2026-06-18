// Shared cost estimator for BlockRun media tools.
// Returns { usd: number, label: string } — a conservative per-call estimate
// derived from the tool name + arguments. Used by both the PreToolUse gate
// (decide allow vs ask) and the PostToolUse tally (record session spend).
//
// Estimates are intentionally rough upper-ish bounds; the MCP/gateway settles
// the real amount. They exist to inform the user, not to bill.

// Per-image USD by model (1024px base; hd / large sizes cost more).
const IMAGE = {
  "zai/cogview-4": 0.015,
  "xai/grok-imagine-image": 0.02,
  "openai/gpt-image-1": 0.03,
  "google/nano-banana": 0.05,
  "xai/grok-imagine-image-pro": 0.07,
  "openai/gpt-image-2": 0.08,
  "google/nano-banana-pro": 0.12,
};
const IMAGE_DEFAULT = 0.08; // gpt-image-2

// Per-second USD by video model.
const VIDEO_RATE = {
  "bytedance/seedance-2.0-fast": 0.05,
  "bytedance/seedance-1.5-pro": 0.09,
  "bytedance/seedance-2.0": 0.12,
  "xai/grok-imagine-video": 0.10,
  "azure/sora-2": 0.10,
};
const VIDEO_DEFAULT_RATE = 0.10; // xai/grok-imagine-video
const VIDEO_DEFAULT_SECS = 8;

// Map a full MCP tool name (mcp__<server>__blockrun_<tool>) to the bare tool.
function bareTool(toolName) {
  const m = /blockrun_([a-z]+)$/.exec(toolName || "");
  return m ? m[1] : null;
}

function estimate(toolName, input = {}) {
  const tool = bareTool(toolName);
  switch (tool) {
    case "image": {
      const usd = IMAGE[input.model] ?? IMAGE_DEFAULT;
      const hd = input.quality === "hd" ? usd * 0.5 : 0;
      return { usd: usd + hd, label: `image · ${input.model || "gpt-image-2"}` };
    }
    case "video": {
      const rate = VIDEO_RATE[input.model] ?? VIDEO_DEFAULT_RATE;
      const secs = Number(input.duration_seconds) || VIDEO_DEFAULT_SECS;
      return { usd: rate * secs, label: `video · ${input.model || "grok-imagine-video"} · ${secs}s` };
    }
    case "music":
      return { usd: 0.02, label: "music · MiniMax" };
    case "speech": {
      const action = input.action || "speak";
      if (action === "voices") return { usd: 0, label: "speech · list voices (free)" };
      if (action === "sound_effect") return { usd: 0.0525, label: "speech · sound effect" };
      const chars = (input.input || "").length || 100;
      return { usd: Math.ceil(chars / 1000) * 0.07, label: `speech · TTS · ${chars} chars` };
    }
    case "realface": {
      const action = input.action || "list";
      const paid = action === "enroll" || action === "portrait";
      return { usd: paid ? 0.01 : 0, label: `realface · ${action}${paid ? "" : " (free)"}` };
    }
    case "price": {
      const cat = input.category;
      const paid = input.action !== "list" && (cat === "stocks" || cat === "usstock");
      return { usd: paid ? 0.001 : 0, label: `price · ${cat || "crypto"}${paid ? "" : " (free)"}` };
    }
    case "chat": {
      const free = input.mode === "free" || /^nvidia\//.test(input.model || "");
      return { usd: free ? 0 : 0.005, label: `chat${free ? " (free tier)" : ""}` };
    }
    // Wallet + models are always free; data tools (if a fuller profile is used)
    // are sub-cent — treat as free for gating purposes.
    case "wallet":
    case "models":
      return { usd: 0, label: `${tool} (free)` };
    default:
      // Unknown blockrun tool: treat as a small paid call so it still confirms.
      return { usd: tool ? 0.005 : 0, label: tool || "non-blockrun" };
  }
}

module.exports = { estimate };
