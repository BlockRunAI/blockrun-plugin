// Shared cost estimator for BlockRun media tools.
// Returns { usd: number, label: string } — a conservative per-call estimate
// derived from the tool name + arguments. Used by both the PreToolUse gate
// (decide allow vs ask) and the PostToolUse tally (record session spend).
//
// Estimates are intentionally rough upper-ish bounds; the MCP/gateway settles
// the real amount. They exist to inform the user, not to bill.
//
// Prices MIRROR the live @blockrun/mcp tables (src/tools/{image,video,music,
// speech,realface}.ts). Keep them in sync when the MCP catalog changes.

// Per-image USD by model. Base = 1024x1024; larger renders cost more on the
// models in IMAGE_LARGE (matches image.ts GENERATE_MODEL_COST / LARGE_SIZE_COST).
const IMAGE = {
  "zai/cogview-4": 0.015,
  "xai/grok-imagine-image": 0.02,
  "openai/gpt-image-1": 0.02,
  "google/nano-banana": 0.05,
  "openai/gpt-image-2": 0.06,
  "xai/grok-imagine-image-pro": 0.07,
  "google/nano-banana-pro": 0.10,
};
const IMAGE_DEFAULT = 0.06; // openai/gpt-image-2 (the MCP default)
const IMAGE_LARGE = {
  "openai/gpt-image-1": 0.04,
  "openai/gpt-image-2": 0.12,
  "google/nano-banana-pro": 0.15, // 4096px tier
};

// Per-second USD by video model — text-to-video rate, and the cheaper
// image-to-video tier when a seed image / RealFace asset is supplied
// (matches video.ts VIDEO_PRICE_PER_SECOND / _IMAGE).
const VIDEO_RATE = {
  "xai/grok-imagine-video": 0.05,
  "bytedance/seedance-1.5-pro": 0.092,
  "bytedance/seedance-2.0-fast": 0.238,
  "bytedance/seedance-2.0": 0.298,
  "azure/sora-2": 0.10,
};
const VIDEO_RATE_IMAGE = {
  "bytedance/seedance-2.0-fast": 0.140,
  "bytedance/seedance-2.0": 0.183,
};
const VIDEO_DEFAULT_RATE = 0.05; // xai/grok-imagine-video (the MCP default)
const VIDEO_DEFAULT_SECS = { // per-model default duration
  "xai/grok-imagine-video": 8,
  "bytedance/seedance-1.5-pro": 5,
  "bytedance/seedance-2.0-fast": 5,
  "bytedance/seedance-2.0": 5,
  "azure/sora-2": 4,
};

const MUSIC_COST = 0.1575; // minimax/music-2.5+ (music.ts MUSIC_COST)

// Speech per-1k-char rate by model (speech.ts). flash/turbo $0.05, others $0.10.
const SPEECH_RATE = {
  "elevenlabs/flash-v2.5": 0.05,
  "elevenlabs/turbo-v2.5": 0.05,
  "elevenlabs/multilingual-v2": 0.10,
  "elevenlabs/v3": 0.10,
};
const SPEECH_DEFAULT_RATE = 0.05; // elevenlabs/flash-v2.5 (the MCP default)
const SOUND_EFFECT_COST = 0.0525;

// A dimension >1024 pushes gpt-image-* / nano-banana-pro into the large tier.
function isLargerThanBase(size) {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(size || "");
  if (!m) return false;
  return Math.max(Number(m[1]), Number(m[2])) > 1024;
}

// Map a full MCP tool name (mcp__<server>__blockrun_<tool>) to the bare tool.
function bareTool(toolName) {
  const m = /blockrun_([a-z]+)$/.exec(toolName || "");
  return m ? m[1] : null;
}

function estimate(toolName, input = {}) {
  const tool = bareTool(toolName);
  switch (tool) {
    case "image": {
      const model = input.model || "openai/gpt-image-2";
      let usd = IMAGE[model] ?? IMAGE_DEFAULT;
      if (IMAGE_LARGE[model] && isLargerThanBase(input.size)) usd = IMAGE_LARGE[model];
      return { usd, label: `image · ${model}` };
    }
    case "video": {
      const model = input.model || "xai/grok-imagine-video";
      const hasImage = Boolean(input.image_url || input.real_face_asset_id);
      const rate = (hasImage ? VIDEO_RATE_IMAGE[model] : undefined)
        ?? VIDEO_RATE[model] ?? VIDEO_DEFAULT_RATE;
      const secs = Number(input.duration_seconds) || VIDEO_DEFAULT_SECS[model] || 8;
      return { usd: rate * secs, label: `video · ${model} · ${secs}s${hasImage ? " (i2v)" : ""}` };
    }
    case "music":
      return { usd: MUSIC_COST, label: `music · ${input.model || "minimax/music-2.5+"}` };
    case "speech": {
      const action = input.action || "speak";
      if (action === "voices") return { usd: 0, label: "speech · list voices (free)" };
      if (action === "sound_effect") return { usd: SOUND_EFFECT_COST, label: "speech · sound effect" };
      const model = input.model || "elevenlabs/flash-v2.5";
      const rate = SPEECH_RATE[model] ?? SPEECH_DEFAULT_RATE;
      const chars = (input.input || "").length || 100;
      return { usd: Math.max(0.001, (chars / 1000) * rate), label: `speech · ${model} · ${chars} chars` };
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

// Savings vs the flagship image model, for the "you saved $X" narrative.
const IMAGE_FLAGSHIP = 0.06; // openai/gpt-image-2 base
function savings(toolName, input = {}) {
  const m = /blockrun_([a-z]+)$/.exec(toolName || "");
  if (!m || m[1] !== "image") return 0;
  const model = input.model || "openai/gpt-image-2";
  const chosen = IMAGE[model] ?? IMAGE_DEFAULT;
  const saved = IMAGE_FLAGSHIP - chosen;
  return saved > 0 ? saved : 0;
}

module.exports = { estimate, savings };
