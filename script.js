// Beauty Atelier: beginner-friendly frontend. OpenAI credentials stay in Cloudflare.
const WORKER_URL = "https://loreal-beauty-advisor.elshamandy133.workers.dev";

const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const windowEl = document.getElementById("chatWindow");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const suggestions = document.getElementById("suggestions");
const miniPrompts = document.getElementById("miniPrompts");
const resetBtn = document.getElementById("resetBtn");
const startButton = document.getElementById("startConsultation");
const advisor = document.getElementById("concierge");

const GREETING =
  "Welcome to your Beauty Atelier ✦\n\nI'm here to help you discover skincare, makeup, haircare and fragrance that feels like you. What would you love to explore today?";

let messages = [];
let busy = false;

// Never put untrusted messages into innerHTML. Build all message content as text nodes.
function addMessage(text, role, pending = false) {
  const bubble = document.createElement("div");
  bubble.className = "message " + role + (pending ? " pending" : "");
  bubble.textContent = text;
  windowEl.appendChild(bubble);
  windowEl.scrollTop = windowEl.scrollHeight;
  return bubble;
}

// Make simple Markdown from the AI readable without importing libraries
// or turning AI-generated text into executable HTML.
function addInlineText(parent, value) {
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match;
  while ((match = boldPattern.exec(value)) !== null) {
    parent.appendChild(document.createTextNode(value.slice(last, match.index)));
    const strong = document.createElement("strong");
    strong.textContent = match[1];
    parent.appendChild(strong);
    last = match.index + match[0].length;
  }
  parent.appendChild(document.createTextNode(value.slice(last)));
}
function renderAssistantReply(bubble, responseText) {
  bubble.replaceChildren();
  const lines = responseText.split(/\r?\n/);
  let list = null;
  let listKind = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      list = null;
      listKind = "";
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const kind = numbered ? "ol" : "ul";
      if (!list || listKind !== kind) {
        list = document.createElement(kind);
        bubble.appendChild(list);
        listKind = kind;
      }
      const item = document.createElement("li");
      addInlineText(item, (numbered || bullet)[1]);
      list.appendChild(item);
      continue;
    }
    list = null;
    listKind = "";
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const element = document.createElement(heading ? "h3" : "p");
    addInlineText(element, heading ? heading[1] : line);
    bubble.appendChild(element);
  }
  windowEl.scrollTop = windowEl.scrollHeight;
}

function setBusy(value) {
  busy = value;
  input.disabled = value;
  sendBtn.disabled = value;
  windowEl.setAttribute("aria-busy", String(value));
  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.disabled = value;
  });
}

function newChat(focusInput = true) {
  if (busy) return;
  messages = [];
  windowEl.replaceChildren();
  statusEl.textContent = "";
  input.value = "";
  addMessage(GREETING, "ai");
  if (focusInput) input.focus();
}

async function sendMessage(text) {
  const content = text.trim();
  if (busy || !content) return;
  if (content.length > 1000) {
    statusEl.textContent = "Please keep your question under 1,000 characters.";
    return;
  }

  statusEl.textContent = "";
  const userBubble = addMessage(content, "user");
  input.value = "";

  // The deployed Cloudflare Worker accepts at most 12 messages of 1,000
  // characters each. The full AI response stays visible in the interface.
  const history = messages.slice(-10).map(message => ({
    role: message.role,
    content: message.content.slice(0, 1000)
  }));
  const nextMessages = [...history, { role: "user", content }];
  const pending = addMessage("Finding your perfect beauty edit…", "ai", true);
  setBusy(true);

  try {
    if (!WORKER_URL.startsWith("https://")) {
      throw new Error("Cloudflare Worker URL is not configured.");
    }
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages })
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "The beauty advisor is unavailable right now.");
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The beauty advisor returned an empty response.");
    }
    pending.classList.remove("pending");
    renderAssistantReply(pending, reply);
    messages = [...nextMessages, { role: "assistant", content: reply }].slice(-12);
  } catch (error) {
    // A failed request must not leave a duplicate user message when retried.
    pending.remove();
    userBubble.remove();
    input.value = content;
    statusEl.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

function handleSuggestedPrompt(event) {
  const button = event.target.closest("button[data-prompt]");
  if (!button) return;
  sendMessage(button.dataset.prompt);
  advisor.scrollIntoView({ behavior: "smooth", block: "start" });
}
suggestions.addEventListener("click", handleSuggestedPrompt);
miniPrompts.addEventListener("click", handleSuggestedPrompt);

resetBtn.addEventListener("click", () => newChat(true));
startButton.addEventListener("click", () => {
  advisor.scrollIntoView({ behavior: "smooth", block: "start" });
  input.focus({ preventScroll: true });
});

// Show the hero on initial page load instead of scrolling to the input.
newChat(false);
