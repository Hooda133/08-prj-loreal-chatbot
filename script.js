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
  "Welcome to Beauty Atelier.\n\nI'm here to help you discover skincare, makeup, haircare and fragrance that feels like you. What would you love to explore today?";

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
  scrollToAdvisor();
}
suggestions.addEventListener("click", handleSuggestedPrompt);
miniPrompts.addEventListener("click", handleSuggestedPrompt);

resetBtn.addEventListener("click", () => newChat(true));
startButton.addEventListener("click", () => {
  scrollToAdvisor();
  input.focus({ preventScroll: true });
});

// Show the hero on initial page load instead of scrolling to the input.
newChat(false);


// ---------- THE MOTION EDIT ----------
// Design-only interactions. They never change the Cloudflare request logic.
const ritualCta = document.getElementById("ritualCta");
const motionToggle = document.getElementById("motionToggle");
const motionLabel = motionToggle.querySelector(".motion-toggle__label");
const motionIcon = motionToggle.querySelector(".motion-toggle__icon");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionPaused = false;

function motionIsAllowed() {
  return !motionQuery.matches && !motionPaused;
}
function scrollToAdvisor() {
  advisor.scrollIntoView({
    behavior: motionIsAllowed() ? "smooth" : "auto",
    block: "start"
  });
}
// The editorial ritual CTA behaves like other suggested prompts.
ritualCta.addEventListener("click", () => {
  if (busy) return;
  scrollToAdvisor();
  sendMessage(ritualCta.dataset.prompt);
});

function setMotionPaused(paused) {
  motionPaused = paused;
  document.body.classList.toggle("motion-paused", paused);
  motionToggle.setAttribute("aria-pressed", String(paused));
  motionLabel.textContent = paused ? "RESUME MOTION" : "PAUSE MOTION";
  motionIcon.textContent = paused ? "▶" : "Ⅱ";
  // Cards should not remain tilted while the visitor pauses movement.
  if (paused) {
    document.querySelectorAll(".category-card").forEach(card => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    });
  }
}
motionToggle.addEventListener("click", () => {
  setMotionPaused(!motionPaused);
});
function updateMotionPreference() {
  motionToggle.hidden = motionQuery.matches;
  if (motionQuery.matches) document.body.classList.remove("has-motion");
}
if (typeof motionQuery.addEventListener === "function") {
  motionQuery.addEventListener("change", updateMotionPreference);
}
updateMotionPreference();

// IntersectionObserver is optional. No JS, old browsers and reduced-motion
// settings get all content immediately without animation or hidden sections.
if (!motionQuery.matches && "IntersectionObserver" in window) {
  const revealTargets = document.querySelectorAll(
    ".section-title, .category-card, .ritual__visual, .ritual__story, .manifesto__inner"
  );
  revealTargets.forEach(element => element.setAttribute("data-reveal", ""));
  document.body.classList.add("has-motion");
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px 60px 0px" });
  revealTargets.forEach(element => revealObserver.observe(element));
}

// Pointer-responsive product cards with gentle 3D tilt.
// Disabled on touch-only devices or where users request reduced motion.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("pointermove", event => {
      if (!motionIsAllowed()) return;
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      card.style.setProperty("--tilt-x", ((0.5 - y) * 6).toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", ((x - 0.5) * 7).toFixed(2) + "deg");
      card.style.setProperty("--glare-x", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--glare-y", (y * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
      card.style.removeProperty("--glare-x");
      card.style.removeProperty("--glare-y");
    });
  });
}
