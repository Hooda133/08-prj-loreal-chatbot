// Cloudflare Worker example. Store OPENAI_API_KEY as a Cloudflare Worker secret.
// Set ALLOWED_ORIGIN to your deployed site origin (e.g. https://username.github.io).
const SYSTEM_PROMPT = `You are Beauty Atelier, a friendly beauty advisor for an independent student demonstration inspired by L'Oréal. Help users explore L'Oréal makeup, skincare, haircare, and fragrances. Ask a brief clarifying question when important. Suggest practical routines and explain general ingredient benefits without diagnosing or treating medical conditions. Do not fabricate precise product names, prices, inventory, ingredients, claims or links. If information is not verified, say so and direct users to official product listings to confirm. Be inclusive, concise, and avoid collecting sensitive personal information. Mention patch testing for new skincare and seeking professional advice for persistent skin problems. Never claim to be an official L'Oréal representative.`;
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: origin === allowed ? 204 : 403, headers: cors });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (!allowed || origin !== allowed) return json({ error: "Origin not allowed" }, 403, cors);
    if (!env.OPENAI_API_KEY) return json({ error: "Server API key is not configured" }, 503, cors);
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "Expected JSON" }, 415, cors);
    if (Number(request.headers.get("Content-Length") || 0) > 20000) return json({ error: "Request too large" }, 413, cors);
    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12 ||
          body.messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 1000) ||
          body.messages[body.messages.length - 1].role !== "user") {
        return json({ error: "Invalid conversation" }, 400, cors);
      }
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...body.messages],
          max_completion_tokens: 450
        })
      });
      if (!response.ok) return json({ error: "AI service unavailable. Please retry shortly." }, 502, cors);
      const data = await response.json();
      const answer = data?.choices?.[0]?.message?.content;
      if (typeof answer !== "string") return json({ error: "No answer received." }, 502, cors);
      return json({ choices: [{ message: { content: answer } }] }, 200, cors);
    } catch {
      return json({ error: "Unable to process request." }, 400, cors);
    }
  }
};
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}