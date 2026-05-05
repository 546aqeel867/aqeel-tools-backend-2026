import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as AppwriteDB from "./db/appwrite";

const DEFAULT_HF_MODEL = process.env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.1-8B-Instruct";

// Ordered list of free OpenRouter models — tried in sequence on 429/404
const FREE_OPENROUTER_MODELS = [
  // openrouter/auto lets OpenRouter pick the best available free model automatically
  process.env.OPENROUTER_MODEL || "openrouter/auto",
  // Manual fallbacks if auto routing fails
  "tencent/hy3-preview:free",
  "meta-llama/llama-3.2-1b-instruct:free",
  "google/gemma-2-2b-it:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

type AiProvider = "openrouter" | "huggingface";

interface AiCallParams {
  provider: AiProvider;
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

function resolveKey(req: Request): { provider: AiProvider; apiKey: string; model?: string } {
  const provider = (req.body?.provider as AiProvider) || "openrouter";
  const headerKey = (req.headers["x-api-key"] as string) || "";
  const bodyKey = (req.body?.apiKey as string) || "";
  const envKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.HUGGINGFACE_API_KEY;
  const apiKey = (bodyKey || headerKey || envKey || "").trim();
  const model = req.body?.model as string | undefined;
  return { provider, apiKey, model };
}

async function callOpenRouterModel(
  apiKey: string,
  model: string,
  allMessages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number
): Promise<{ ok: boolean; text: string; status: number }> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aqeel-tools-hub.replit.app",
      "X-Title": "Aqeel Tools Hub",
    },
    body: JSON.stringify({ model, messages: allMessages, max_tokens: maxTokens, temperature }),
  });
  const text = await response.text();
  return { ok: response.ok, text, status: response.status };
}

async function callOpenRouter({ apiKey, messages, systemPrompt, maxTokens = 1024, temperature = 0.7, model }: AiCallParams): Promise<string> {
  const allMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages;

  // If a specific model was requested (e.g., user has paid key), use it directly
  if (model) {
    const { ok, text, status } = await callOpenRouterModel(apiKey, model, allMessages, maxTokens, temperature);
    if (!ok) throw new Error(`OpenRouter ${status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    return data.choices?.[0]?.message?.content || "";
  }

  // Try each free model in sequence; skip on 429 or 404
  let lastError = "";
  for (const m of FREE_OPENROUTER_MODELS) {
    const { ok, text, status } = await callOpenRouterModel(apiKey, m, allMessages, maxTokens, temperature);
    if (ok) {
      const data = JSON.parse(text);
      return data.choices?.[0]?.message?.content || "";
    }
    lastError = `OpenRouter ${status} (${m}): ${text.slice(0, 200)}`;
    console.warn(`[ai] model ${m} failed (${status}), trying next…`);
    if (status !== 429 && status !== 404) break; // non-retryable error
  }
  throw new Error(lastError || "All OpenRouter free models are currently unavailable. Add your own API key in Settings for priority access.");
}

// Like callOpenRouter but also returns which model succeeded — used by /chat endpoint
async function callOpenRouterWithModel(
  apiKey: string,
  userMessage: string,
  maxTokens = 1024,
  temperature = 0.7
): Promise<{ reply: string; modelUsed: string }> {
  const messages = [{ role: "user", content: userMessage }];
  let lastError = "";
  for (const m of FREE_OPENROUTER_MODELS) {
    const { ok, text, status } = await callOpenRouterModel(apiKey, m, messages, maxTokens, temperature);
    if (ok) {
      const data = JSON.parse(text);
      const reply = data.choices?.[0]?.message?.content || "";
      return { reply, modelUsed: m };
    }
    lastError = `OpenRouter ${status} (${m}): ${text.slice(0, 200)}`;
    console.warn(`[chat] model ${m} failed (${status}), trying next…`);
    if (status !== 429 && status !== 404) break;
  }
  throw new Error(lastError || "All models are currently unavailable.");
}

async function callHuggingFace({ apiKey, messages, systemPrompt, maxTokens = 1024, temperature = 0.7, model }: AiCallParams): Promise<string> {
  const allMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages;
  const m = model || DEFAULT_HF_MODEL;
  const response = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m,
      messages: allMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HuggingFace ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAi(params: AiCallParams): Promise<string> {
  if (!params.apiKey) throw new Error("API key not provided. Add your AI API key in Settings.");
  if (params.provider === "huggingface") return callHuggingFace(params);
  return callOpenRouter(params);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple /chat endpoint — accepts { message }, returns { reply, modelUsed }
  app.post("/chat", async (req: Request, res: Response) => {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Request body must include a non-empty 'message' string." });
    }
    const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "Server is not configured with an OpenRouter API key." });
    }
    try {
      const { reply, modelUsed } = await callOpenRouterWithModel(apiKey, message.trim());
      return res.json({ reply, modelUsed });
    } catch (err: any) {
      console.error("[/chat]", err.message);
      return res.status(500).json({ error: err.message || "All models failed. Please try again later." });
    }
  });

  // Health + env check
  app.get("/api/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      defaultOpenRouterModel: FREE_OPENROUTER_MODELS[0],
      defaultHuggingFaceModel: DEFAULT_HF_MODEL,
      envOpenRouterConfigured: !!process.env.OPENROUTER_API_KEY,
      envHuggingFaceConfigured: !!process.env.HUGGINGFACE_API_KEY,
    });
  });

  // Main chat endpoint
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    const { messages, systemPrompt } = req.body;
    const { provider, apiKey, model } = resolveKey(req);
    if (!apiKey) {
      return res.status(401).json({
        error: "Please add your API key in Settings to use AI features.",
        configured: false,
      });
    }
    try {
      const message = await callAi({ provider, apiKey, model, messages, systemPrompt, maxTokens: 1200, temperature: 0.7 });
      res.json({ message, configured: true });
    } catch (err: any) {
      console.error("[ai/chat]", err.message);
      res.status(500).json({ error: err.message, configured: true });
    }
  });

  // Trip planner (single-shot)
  app.post("/api/ai/trip", async (req: Request, res: Response) => {
    const { latitude, longitude, cityName } = req.body;
    const { provider, apiKey, model } = resolveKey(req);
    if (!apiKey) return res.status(401).json({ error: "Please add your API key in Settings to use AI features.", configured: false });
    const location = cityName || `coordinates ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}`;
    const prompt = `You are a travel guide. Create a day trip plan for ${location}. Include: top 5 attractions, local food, travel tips, and best time to visit. Format with sections and emojis.`;
    try {
      const plan = await callAi({ provider, apiKey, model, messages: [{ role: "user", content: prompt }], maxTokens: 1200, temperature: 0.8 });
      res.json({ plan, location, configured: true });
    } catch (err: any) {
      console.error("[ai/trip]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Translator
  app.post("/api/ai/translate", async (req: Request, res: Response) => {
    const { text, targetLanguage, sourceLanguage } = req.body;
    const { provider, apiKey, model } = resolveKey(req);
    if (!apiKey) return res.status(401).json({ error: "Please add your API key in Settings to use AI features.", configured: false });
    const prompt = `Translate from ${sourceLanguage || "auto"} to ${targetLanguage}. Return ONLY the translated text.\n\nText: ${text}`;
    try {
      const translation = await callAi({ provider, apiKey, model, messages: [{ role: "user", content: prompt }], maxTokens: 500, temperature: 0.3 });
      res.json({ translation: translation.trim(), configured: true });
    } catch (err: any) {
      console.error("[ai/translate]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Generic generate
  app.post("/api/ai/generate", async (req: Request, res: Response) => {
    const { prompt, systemPrompt, maxTokens, temperature } = req.body;
    const { provider, apiKey, model } = resolveKey(req);
    if (!apiKey) return res.status(401).json({ error: "Please add your API key in Settings to use AI features.", configured: false });
    try {
      const result = await callAi({
        provider, apiKey, model,
        messages: [{ role: "user", content: prompt }],
        systemPrompt, maxTokens: maxTokens || 1024, temperature: temperature || 0.7,
      });
      res.json({ result, configured: true });
    } catch (err: any) {
      console.error("[ai/generate]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // AI image prompt builder
  app.post("/api/ai/image-prompt", async (req: Request, res: Response) => {
    const { idea, style } = req.body;
    const { provider, apiKey, model } = resolveKey(req);
    if (!apiKey) return res.status(401).json({ error: "Please add your API key in Settings to use AI features.", configured: false });
    const prompt = `You are an expert AI image prompt engineer. Create a detailed, vivid image generation prompt for this idea: "${idea}"${style ? ` in ${style} style` : ""}. 
Output ONLY the prompt itself (max 150 words), no explanation, no quotes. Make it highly descriptive with colors, lighting, composition, and artistic style details.`;
    try {
      const enhancedPrompt = await callAi({
        provider, apiKey, model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 300, temperature: 0.9,
      });
      res.json({ prompt: enhancedPrompt.trim() || idea, configured: true });
    } catch (err: any) {
      console.error("[ai/image-prompt]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ElevenLabs Text-to-Speech proxy — streams audio back to client
  app.post("/api/voice/tts", async (req: Request, res: Response) => {
    const { text, voiceId, modelId } = req.body || {};
    const apiKey =
      (req.body?.apiKey as string) ||
      (req.headers["x-elevenlabs-key"] as string) ||
      process.env.ELEVENLABS_API_KEY ||
      "";

    if (!apiKey) {
      return res.status(401).json({ error: "Please add your ElevenLabs API key in Settings to use voice features." });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required." });
    }

    const voice = voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel by default
    const model = modelId || "eleven_turbo_v2_5";

    try {
      const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return res.status(upstream.status).json({ error: `ElevenLabs ${upstream.status}: ${errText.slice(0, 300)}` });
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch (err: any) {
      console.error("[voice/tts]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // List ElevenLabs voices for the user (so they can pick one)
  app.get("/api/voice/voices", async (req: Request, res: Response) => {
    const apiKey =
      (req.query?.apiKey as string) ||
      (req.headers["x-elevenlabs-key"] as string) ||
      process.env.ELEVENLABS_API_KEY ||
      "";

    if (!apiKey) {
      return res.status(401).json({ error: "Please add your ElevenLabs API key in Settings." });
    }
    try {
      const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!upstream.ok) {
        const errText = await upstream.text();
        return res.status(upstream.status).json({ error: `ElevenLabs ${upstream.status}: ${errText.slice(0, 200)}` });
      }
      const data = await upstream.json();
      const voices = (data.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
      }));
      res.json({ voices });
    } catch (err: any) {
      console.error("[voice/voices]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Groq Whisper speech-to-text transcription
  app.post("/api/voice/transcribe", async (req: Request, res: Response) => {
    const { audioBase64, groqKey } = req.body || {};
    const key = (groqKey as string) || process.env.GROQ_API_KEY || "";
    if (!key) {
      return res.status(401).json({ error: "Groq API key required. Add it in Settings → Voice STT (Groq)." });
    }
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "audioBase64 is required." });
    }
    try {
      const buf = Buffer.from(audioBase64, "base64");
      const blob = new Blob([buf], { type: "audio/mp4" });
      const form = new FormData();
      form.append("file", blob, "audio.m4a");
      form.append("model", "whisper-large-v3-turbo");
      form.append("response_format", "json");
      const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form as any,
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Groq ${resp.status}: ${txt.slice(0, 260)}`);
      }
      const data = await resp.json();
      res.json({ transcript: data.text || "" });
    } catch (err: any) {
      console.error("[voice/transcribe]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Promo Code Validation ──────────────────────────────────
  app.post("/api/promo/validate", (req: Request, res: Response) => {
    const { code } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.json({ valid: false, message: "Please enter a promo code." });
    }
    const rawCodes = process.env.PROMO_CODES || "";
    const entries = rawCodes.split(",").filter(Boolean);
    const upperCode = code.trim().toUpperCase();
    for (const entry of entries) {
      const parts = entry.split(":");
      if (parts.length < 3) continue;
      const [entryCode, planRaw, daysStr] = parts;
      if (entryCode?.trim().toUpperCase() === upperCode) {
        const plan = planRaw?.trim() === "nitro_bat" ? "nitro_bat" : "nitro";
        const days = parseInt(daysStr?.trim() || "7", 10);
        const planName = plan === "nitro_bat" ? "🦇 Nitro Bat" : "⚡ Nitro";
        return res.json({ valid: true, plan, days, message: `🎉 ${days} days of ${planName} unlocked!` });
      }
    }
    return res.json({ valid: false, message: "Invalid or expired promo code." });
  });

  // ── Subscription Plans Info ────────────────────────────────
  app.get("/api/plans", (_req: Request, res: Response) => {
    res.json({
      plans: [
        { id: "free",            name: "Free",       price: 0,     period: null,    days: null, hasAds: true  },
        { id: "nitro_month",     name: "Nitro",      price: 2.99,  period: "month", days: 30,   hasAds: false },
        { id: "nitro_year",      name: "Nitro",      price: 24.99, period: "year",  days: 365,  hasAds: false, savings: "Save 30%" },
        { id: "nitro_bat_month", name: "Nitro Bat",  price: 4.99,  period: "month", days: 30,   hasAds: false },
        { id: "nitro_bat_year",  name: "Nitro Bat",  price: 39.99, period: "year",  days: 365,  hasAds: false, savings: "Save 33%" },
      ],
    });
  });

  // ── Video Downloader ──────────────────────────────────────────────────────
  app.post("/api/video-downloader/info", async (req: Request, res: Response) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required." });
    }

    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
    const isTikTok  = url.includes("tiktok.com");

    try {
      if (isYouTube) {
        const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (!r.ok) return res.status(400).json({ error: "Could not fetch YouTube video. Check the URL." });
        const d = await r.json();
        return res.json({
          platform: "youtube",
          title: d.title || "YouTube Video",
          thumbnail: d.thumbnail_url || "",
          author: d.author_name || "",
          duration: null,
        });
      }

      if (isTikTok) {
        const r = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!r.ok) return res.status(400).json({ error: "Could not fetch TikTok video. Check the URL." });
        const d = await r.json();
        if (d.code !== 0 || !d.data) {
          return res.status(400).json({ error: d.msg || "TikTok video not found." });
        }
        return res.json({
          platform: "tiktok",
          title: d.data.title || "TikTok Video",
          thumbnail: d.data.cover || d.data.origin_cover || "",
          author: d.data.author?.nickname || "Unknown",
          duration: d.data.duration || null,
          hdUrl: d.data.hdplay || d.data.play || null,
          sdUrl: d.data.play || null,
          audioUrl: d.data.music || null,
        });
      }

      return res.status(400).json({ error: "Only YouTube and TikTok links are supported." });
    } catch (err: any) {
      console.error("[video-downloader/info]", err.message);
      return res.status(500).json({ error: "Failed to fetch video info. Try again." });
    }
  });

  app.post("/api/video-downloader/download", async (req: Request, res: Response) => {
    const { url, quality = "720" } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required." });
    }
    try {
      const r = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ url, videoQuality: quality, filenameStyle: "classic", alwaysProxy: false }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(r.status).json({ error: `Cobalt error: ${t.slice(0, 200)}` });
      }
      const d = await r.json();
      if (d.status === "error") {
        return res.status(400).json({ error: d.error?.code || "Download failed." });
      }
      return res.json({ ok: true, status: d.status, url: d.url, filename: d.filename, picker: d.picker });
    } catch (err: any) {
      console.error("[video-downloader/download]", err.message);
      return res.status(500).json({ error: "Failed to get download link. Try again." });
    }
  });

  // ── AI Key Validation ────────────────────────────────────────────────────────
  app.post("/api/ai/validate-key", async (req: Request, res: Response) => {
    const { provider, apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== "string") {
      return res.json({ valid: false, error: "API key is required." });
    }
    const prov: AiProvider = (provider as AiProvider) || "openrouter";
    try {
      await callAi({
        provider: prov,
        apiKey,
        messages: [{ role: "user", content: "Say: ok" }],
        maxTokens: 5,
        temperature: 0,
      });
      return res.json({ valid: true });
    } catch (err: any) {
      const msg = err.message || "Invalid API key";
      const isAuthError = msg.includes("401") || msg.includes("403") || msg.includes("invalid") || msg.includes("unauthorized");
      return res.json({ valid: !isAuthError, error: isAuthError ? "Invalid or expired API key." : msg });
    }
  });

  // ── Appwrite DB Status ───────────────────────────────────────────────────────
  app.get("/api/db/status", (_req: Request, res: Response) => {
    res.json({
      configured: AppwriteDB.isConfigured(),
      collections: Object.values(AppwriteDB.COLLECTIONS),
      databaseId: AppwriteDB.DATABASE_ID,
    });
  });

  // ── Appwrite DB Setup (auto-create collections) ──────────────────────────────
  app.post("/api/db/setup", async (_req: Request, res: Response) => {
    const result = await AppwriteDB.setupCollections();
    res.json(result);
  });

  // ── User Profile ─────────────────────────────────────────────────────────────
  app.post("/api/db/profile", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ ok: false, reason: "Appwrite not configured" });
    const profile = req.body;
    if (!profile?.email) return res.status(400).json({ ok: false, error: "email required" });
    const ok = await AppwriteDB.saveProfile(profile);
    res.json({ ok });
  });

  app.get("/api/db/profile/:email", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json(null);
    const profile = await AppwriteDB.getProfile(String(req.params.email));
    res.json(profile);
  });

  // ── Notes ────────────────────────────────────────────────────────────────────
  app.post("/api/db/notes/sync", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ ok: false, reason: "Appwrite not configured" });
    const { userId, notes } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
    const ok = await AppwriteDB.syncNotes(String(userId), notes || []);
    res.json({ ok });
  });

  app.get("/api/db/notes/:userId", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ notes: [] });
    const notes = await AppwriteDB.getNotes(String(req.params.userId));
    res.json({ notes });
  });

  // ── Chat Sessions ─────────────────────────────────────────────────────────────
  app.post("/api/db/sessions/sync", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ ok: false, reason: "Appwrite not configured" });
    const { userId, sessions } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
    const ok = await AppwriteDB.syncChatSessions(String(userId), sessions || []);
    res.json({ ok });
  });

  app.get("/api/db/sessions/:userId", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ sessions: [] });
    const sessions = await AppwriteDB.getChatSessions(String(req.params.userId));
    res.json({ sessions });
  });

  // ── API Keys Cloud Storage ────────────────────────────────────────────────────
  app.post("/api/db/api-keys", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json({ ok: false, reason: "Appwrite not configured" });
    const { userId, ...keys } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
    const ok = await AppwriteDB.saveApiKeys(String(userId), { userId: String(userId), ...keys });
    res.json({ ok });
  });

  app.get("/api/db/api-keys/:userId", async (req: Request, res: Response) => {
    if (!AppwriteDB.isConfigured()) return res.json(null);
    const keys = await AppwriteDB.getApiKeys(String(req.params.userId));
    res.json(keys);
  });

  const httpServer = createServer(app);
  return httpServer;
}
