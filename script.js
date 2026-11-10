// Beauty Atelier: beginner-friendly frontend. OpenAI credentials stay in Cloudflare.
const WORKER_URL = "https://loreal-beauty-advisor.elshamandy133.workers.dev";

const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const windowEl = document.getElementById("chatWindow");
const statusEl = document.getElementById("status");
const chatAnnouncement = document.getElementById("chatAnnouncement");
const questionPreview = document.getElementById("questionPreview");
const questionPreviewText = document.getElementById("questionPreviewText");
const sendBtn = document.getElementById("sendBtn");
const suggestions = document.getElementById("suggestions");
const miniPrompts = document.getElementById("miniPrompts");
const resetBtn = document.getElementById("resetBtn");
const startButton = document.getElementById("startConsultation");
const advisor = document.getElementById("concierge");

const GREETING =
  "Welcome to Beauty Atelier.\n\nI can help with L’Oréal skincare, makeup, haircare and fragrances, plus personalized beauty routines. What would you like to explore?";

// Temporary, in-tab conversation memory; cleared on New chat or page reload.
// Keep the full session transcript so early preferences can inform later replies.
const MAX_SESSION_MESSAGES = 80;
const RECENT_CONTEXT_MESSAGES = 10; // Last five back-and-forth turns.
const PERSONAL_DETAIL_CUE = /\b(?:my\s+(?:skin|hair|routine|budget|preferences?|concerns?|allergies|scent)|i(?:'m| am| have| prefer| like| love| use| want| need)|oily skin|dry skin|sensitive skin|combination skin|budget\s+(?:is|of))\b/i;

let messages = [];
let busy = false;
const REPLY_TIMEOUT_MS = 30000;
let requestGeneration = 0;
let activeRequestController = null;

// A visitor reading earlier exchanges should not be yanked to the bottom
// when the assistant finishes. Sending a new question intentionally scrolls.
function isNearChatBottom() {
  const distance = windowEl.scrollHeight - windowEl.clientHeight - windowEl.scrollTop;
  return !Number.isFinite(distance) || distance < 130;
}
function scrollChatIfNeeded(shouldScroll) {
  if (shouldScroll) windowEl.scrollTop = windowEl.scrollHeight;
}

function setQuestionPreview(question) {
  const value = question.trim();
  questionPreview.hidden = !value;
  questionPreviewText.textContent = value; // Text only, never HTML.
}

// The Worker accepts <= 12 messages with <= 1,000 characters each.
// Preserve recent exchanges and (when older) up to three beauty preferences.
// The memory note stays a regular user-role message: it cannot override
// the Worker's server-side system prompt or topic restrictions.
function buildContextMessages(question) {
  const recent = messages.slice(-RECENT_CONTEXT_MESSAGES).map(message => ({
    role: message.role,
    content: message.content.slice(0, 1000)
  }));
  const older = messages.slice(0, Math.max(0, messages.length - RECENT_CONTEXT_MESSAGES));
  const keyDetails = older
    .filter(message => message.role === "user" && PERSONAL_DETAIL_CUE.test(message.content))
    .slice(-3)
    .map(message => "- " + message.content.replace(/\s+/g, " ").slice(0, 230));

  const note = keyDetails.length
    ? "Earlier beauty preferences shared in this chat (context only, not a new question):\n" + keyDetails.join("\n")
    : "";
  return [
    ...(note ? [{ role: "user", content: note.slice(0, 1000) }] : []),
    ...recent,
    { role: "user", content: question }
  ];
}

// Never put untrusted messages into innerHTML. Build all message content as text nodes.
function addMessage(text, role, pending = false, forceScroll = false) {
  const shouldScroll = forceScroll || isNearChatBottom();
  const bubble = document.createElement("div");
  bubble.className = "message " + role + (pending ? " pending" : "");
  bubble.setAttribute("role", "group");
  bubble.setAttribute("aria-label", role === "user" ? "Your message" : "Beauty Concierge message");
  bubble.textContent = text;
  windowEl.appendChild(bubble);
  scrollChatIfNeeded(shouldScroll);
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
  const shouldScroll = isNearChatBottom();
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
  scrollChatIfNeeded(shouldScroll);
}

function setBusy(value) {
  busy = value;
  input.disabled = value;
  sendBtn.disabled = value;
  // Keep New chat usable so people can stop an unresponsive response.
  resetBtn.disabled = false;
  resetBtn.title = value
    ? "Cancel the current reply and start a new conversation"
    : "Start a new conversation";
  sendBtn.setAttribute("aria-label", value ? "Sending your question" : "Send message");
  ritualCta.disabled = value;
  windowEl.setAttribute("aria-busy", String(value));
  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.disabled = value;
  });
}

function newChat(focusInput = true) {
  if (busy) {
    // Invalidate pending promises even if the browser or a mock transport
    // ignores AbortController, so a late result cannot reappear.
    requestGeneration += 1;
    activeRequestController?.abort();
    activeRequestController = null;
    setBusy(false);
  }
  messages = [];
  windowEl.replaceChildren();
  setQuestionPreview("");
  statusEl.textContent = "";
  chatAnnouncement.textContent = "";
  input.value = "";
  addMessage(GREETING, "ai");
  if (focusInput) chatAnnouncement.textContent = "New conversation started. The beauty advisor is ready.";
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
  setQuestionPreview(content);
  const userBubble = addMessage(content, "user", false, true);
  input.value = "";

  // Send contextual recent history and earlier beauty preferences.
  // Never send the full unbounded session or repeat the synthetic note in memory.
  const nextMessages = buildContextMessages(content);
  const pending = addMessage("Finding your perfect beauty edit…", "ai", true);
  chatAnnouncement.textContent = "Question sent. Your beauty advisor is preparing a response.";
  setBusy(true);

  const thisRequest = ++requestGeneration;
  const controller = new AbortController();
  activeRequestController = controller;
  const returnFocus = document.activeElement === input || document.activeElement === sendBtn;
  let didTimeOut = false;
  const timeoutId = setTimeout(() => {
    if (thisRequest !== requestGeneration) return;
    didTimeOut = true;
    controller.abort();
  }, REPLY_TIMEOUT_MS);

  try {
    if (!WORKER_URL.startsWith("https://")) {
      throw new Error("Cloudflare Worker URL is not configured.");
    }
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages }),
      signal: controller.signal
    });
    if (thisRequest !== requestGeneration) return;
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (thisRequest !== requestGeneration) return;
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "The beauty advisor is unavailable right now.");
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The beauty advisor returned an empty response.");
    }
    pending.classList.remove("pending");
    renderAssistantReply(pending, reply);
    chatAnnouncement.textContent =
      "Beauty Concierge replied. " + reply.slice(0, 320) +
      (reply.length > 320 ? " The full response is in the conversation." : "");
    messages.push({ role: "user", content }, { role: "assistant", content: reply });
    if (messages.length > MAX_SESSION_MESSAGES) {
      messages = messages.slice(-MAX_SESSION_MESSAGES);
    }
  } catch (error) {
    if (thisRequest !== requestGeneration) return;
    // A failed request must not leave a duplicate user message when retried.
    pending.remove();
    userBubble.remove();
    input.value = content;
    setQuestionPreview("");
    chatAnnouncement.textContent = "";
    if (didTimeOut) {
      statusEl.textContent = "The beauty advisor is taking too long. Please try sending your question again.";
    } else if (error?.name === "TypeError" || error?.name === "AbortError") {
      statusEl.textContent = "Could not reach the beauty advisor. Check your connection and try again.";
    } else {
      statusEl.textContent = error?.message || "Something went wrong. Please try again.";
    }
  } finally {
    clearTimeout(timeoutId);
    if (thisRequest === requestGeneration) {
      activeRequestController = null;
      setBusy(false);
      // Avoid unexpectedly opening the virtual keyboard on touch devices.
      if (returnFocus && window.matchMedia("(pointer: fine)").matches) input.focus();
    }
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(input.value);
});

// Remove the previous "You asked" strip as soon as a new typed question begins.
input.addEventListener("input", () => setQuestionPreview(""));

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
  motionLabel.textContent = paused ? "RESUME MOTION" : "PAUSE MOTION";
  motionToggle.setAttribute("aria-label", paused ? "Resume animations" : "Pause animations");
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
  if (motionQuery.matches) {
    document.body.classList.remove("has-motion");
    document.querySelectorAll(".category-card").forEach(card => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    });
  }
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
  // Keyboard users must never tab into an element that is visually hidden.
  document.addEventListener("focusin", event => {
    const reveal = event.target.closest("[data-reveal]");
    if (reveal) reveal.classList.add("is-visible");
  });
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
