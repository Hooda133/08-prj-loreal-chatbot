// Set this to the URL of your deployed Cloudflare Worker (no API key in frontend code).
const WORKER_URL = ""; // Example: "https://loreal-beauty-advisor.your-account.workers.dev"
const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const windowEl = document.getElementById("chatWindow");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const suggestions = document.getElementById("suggestions");
const resetBtn = document.getElementById("resetBtn");
const miniPrompts = document.getElementById("miniPrompts");
const GREETING =
  "Hello, beautiful! ✨ I'm your personal beauty advisor. Tell me what you're looking for, or choose a topic below to get started.";
let messages = [];
let busy = false;

// Use textContent, not innerHTML, so messages cannot inject HTML.
function addMessage(text, role, pending = false) {
  const bubble = document.createElement("div");
  bubble.className = "message " + role + (pending ? " pending" : "");
  bubble.textContent = text;
  windowEl.appendChild(bubble);
  windowEl.scrollTop = windowEl.scrollHeight;
  return bubble;
}
function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  input.disabled = value;
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.disabled = value;
  });
}
function newChat() {
  messages = [];
  windowEl.replaceChildren();
  statusEl.textContent = "";
  addMessage(GREETING, "ai");
  input.value = "";
  input.focus();
}
async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;
  if (content.length > 1000) {
    statusEl.textContent = "Please keep messages under 1,000 characters.";
    return;
  }
  statusEl.textContent = "";
  addMessage(content, "user");
  input.value = "";
  const nextMessages = [...messages, { role: "user", content }].slice(-12);
  const pending = addMessage("Curating your beauty advice…", "ai", true);
  setBusy(true);
  try {
    if (!WORKER_URL || !/^https:\/\//.test(WORKER_URL)) {
      throw new Error(
        "Chat isn't connected yet. Deploy your Cloudflare Worker and paste its HTTPS URL into WORKER_URL in script.js.",
      );
    }
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages }),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok)
      throw new Error(
        data.error || "The beauty advisor is temporarily unavailable.",
      );
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim())
      throw new Error("The assistant sent an empty response.");
    pending.textContent = reply;
    pending.classList.remove("pending");
    messages = [...nextMessages, { role: "assistant", content: reply }].slice(
      -12,
    );
  } catch (error) {
    pending.remove();
    statusEl.textContent = error.message || "Something went wrong. Try again.";
    // Keep previous conversation; user can retry the failed message.
    input.value = content;
  } finally {
    setBusy(false);
    input.focus();
  }
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});
function handlePrompt(event) {
  const button = event.target.closest("button[data-prompt]");
  if (button) sendMessage(button.dataset.prompt);
}
suggestions.addEventListener("click", handlePrompt);
miniPrompts.addEventListener("click", handlePrompt);
resetBtn.addEventListener("click", newChat);
newChat();
