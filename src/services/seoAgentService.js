const DEFAULT_TIMEOUT_MS = 20000;

function getWebhookUrl() {
  return String(process.env.SEO_AGENT_WEBHOOK_URL || "").trim();
}

function getTimeoutMs() {
  const raw = Number(process.env.SEO_AGENT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function getHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  const bearer = String(process.env.SEO_AGENT_WEBHOOK_BEARER || "").trim();
  const apiKey = String(process.env.SEO_AGENT_WEBHOOK_API_KEY || "").trim();

  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (apiKey) headers["x-api-key"] = apiKey;

  return headers;
}

function isSeoAgentConfigured() {
  return Boolean(getWebhookUrl());
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractReply(payload) {
  if (typeof payload === "string") return payload.trim();
  if (!payload) return "";

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractReply(item);
      if (text) return text;
    }
    return "";
  }

  if (typeof payload === "object") {
    const direct = firstNonEmptyString([
      payload.reply,
      payload.response,
      payload.output,
      payload.answer,
      payload.text,
      payload.message
    ]);
    if (direct) return direct;

    const nestedKeys = ["data", "result", "body"];
    for (const key of nestedKeys) {
      const text = extractReply(payload[key]);
      if (text) return text;
    }
  }

  return "";
}

async function askSeoAgent({ message, user }) {
  const url = getWebhookUrl();
  if (!url) {
    const err = new Error("Agente SEO não configurado.");
    err.code = "SEO_AGENT_NOT_CONFIGURED";
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const payload = {
      message,
      chatInput: message,
      input: message,
      text: message,
      source: "visitmaia-dashboard",
      timestamp: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            username: user.username,
            email: user.email
          }
        : undefined
    };

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (cause) {
      const err = new Error(`Falha de ligação ao webhook n8n: ${url}`);
      err.code = "SEO_AGENT_CONNECTION_ERROR";
      err.cause = cause;
      throw err;
    }

    const rawText = await response.text();
    let raw = {};
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      raw = rawText;
    }

    if (!response.ok) {
      const err = new Error(`n8n respondeu com erro HTTP ${response.status}.`);
      err.code = "SEO_AGENT_UPSTREAM_ERROR";
      err.status = response.status;
      err.payload = raw;
      throw err;
    }

    const reply = extractReply(raw);
    if (!reply) {
      const err = new Error("n8n não devolveu texto de resposta.");
      err.code = "SEO_AGENT_EMPTY_REPLY";
      err.payload = raw;
      throw err;
    }

    return { reply, raw };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  askSeoAgent,
  isSeoAgentConfigured
};
