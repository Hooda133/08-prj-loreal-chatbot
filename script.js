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
const expandChatBtn = document.getElementById("expandChatBtn");
const expandChatLabel = document.getElementById("expandChatLabel");
const followUpSuggestions = document.getElementById("followUpSuggestions");
const webSearchToggle = document.getElementById("webSearchToggle");
const requestDiagnostic = document.getElementById("requestDiagnostic");
const requestDiagnosticText = document.getElementById("requestDiagnosticText");
const copyRequestDiagnostic = document.getElementById("copyRequestDiagnostic");
const requestDiagnosticCopyStatus = document.getElementById("requestDiagnosticCopyStatus");


// Keep a shared reading-mode control for the optional Expand button and
// for restoring the inline panel when starting a fresh conversation.
// It reuses the SAME chat node, keeping messages and cited links intact.
let toggleChatFocusMode = () => {};

// Optional large reading view: keep the SAME chat node and in-memory
// conversation, so opening/closing cannot discard messages or web sources.
// Move the node outside the hero's isolated stacking context for a true
// viewport-sized overlay on both mobile and desktop.
if (expandChatBtn && advisor) {
  const originalParent = advisor.parentNode;
  const placeholder = document.createComment("Beauty Concierge original position");
  originalParent.insertBefore(placeholder, advisor);
  let expanded = false;

  toggleChatFocusMode = function (open) {
    if (open === expanded) return;
    expanded = open;
    if (open) {
      document.body.appendChild(advisor);
      advisor.classList.add("advisor--focus");
      document.body.classList.add("chat-focus-open");
      advisor.setAttribute("role", "dialog");
      advisor.setAttribute("aria-modal", "true");
      expandChatBtn.setAttribute("aria-pressed", "true");
      expandChatBtn.setAttribute("aria-label", "Close large Beauty Concierge chat");
      expandChatLabel.textContent = "Close";
    } else {
      originalParent.insertBefore(advisor, placeholder.nextSibling);
      advisor.classList.remove("advisor--focus");
      document.body.classList.remove("chat-focus-open");
      advisor.removeAttribute("role");
      advisor.removeAttribute("aria-modal");
      expandChatBtn.setAttribute("aria-pressed", "false");
      expandChatBtn.setAttribute("aria-label", "Open large Beauty Concierge chat");
      expandChatLabel.textContent = "Expand";
    }
    expandChatBtn.focus({ preventScroll: true });
  }

  expandChatBtn.addEventListener("click", () => toggleChatFocusMode(!expanded));
  document.addEventListener("keydown", event => {
    if (!expanded) return;
    if (event.key === "Escape") {
      event.preventDefault();
      toggleChatFocusMode(false);
      return;
    }
    if (event.key !== "Tab") return;
    // Keep keyboard navigation inside the full-window consultation.
    const selectors = "button:not([disabled]), a[href], input:not([disabled]), " +
      "select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const items = [...advisor.querySelectorAll(selectors)].filter(el =>
      el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

const GREETING =
  "Welcome to Beauty Atelier.\n\nI can help with L’Oréal skincare, makeup, haircare and fragrances, plus personalized beauty routines. What would you like to explore?";

// Temporary, in-tab conversation memory; cleared on New chat or page reload.
// Keep the full session transcript so early preferences can inform later replies.
const MAX_SESSION_MESSAGES = 80;
const RECENT_CONTEXT_MESSAGES = 10; // Last five back-and-forth turns.
const PERSONAL_DETAIL_CUE = /\b(?:my\s+(?:skin|hair|routine|budget|preferences?|concerns?|allergies|scent)|i(?:'m| am| have| prefer| like| love| use| want| need)|oily skin|dry skin|sensitive skin|combination skin|budget\s+(?:is|of))\b/i;

let messages = [];
// Explicitly shared name stays in this page session only (no cookies/storage).
// Keeping it separate preserves the name after older transcript turns roll off.
let preferredName = "";
// Product context from the most recently SUCCESSFUL generated routine.
// Stored in memory only, never browser storage; New chat clears it.
let activeRoutineNotes = [];
let busy = false;
const REPLY_TIMEOUT_MS = 30000;
const WEB_SEARCH_TIMEOUT_MS = 75000;
const CHAT_BUILD = "2026-11-18-search-diagnostics-v1";
let latestSafeDiagnostic = "";

function clearRequestDiagnostic() {
  latestSafeDiagnostic = "";
  if (requestDiagnostic) {
    requestDiagnostic.hidden = true;
    requestDiagnostic.open = false;
  }
  if (requestDiagnosticText) requestDiagnosticText.textContent = "";
  if (requestDiagnosticCopyStatus) requestDiagnosticCopyStatus.textContent = "";
}

// A local diagnostic is never sent to a server or stored. It intentionally
// excludes the question, conversation history, keys, IP, and full page URLs.
function showRequestDiagnostic({ code, phase, httpStatus, elapsedMs, searched, sources }) {
  const lines = [
    "Beauty Atelier support details",
    "Build: " + CHAT_BUILD,
    "Error code: " + code,
    "Request phase: " + phase,
    "Live search: " + (searched ? "on" : "off"),
    "HTTP status: " + (httpStatus || "no response"),
    "Elapsed: " + (Math.max(0, Math.round(elapsedMs / 1000))) + " seconds",
    "Verified sources: " + (sources === null ? "unknown" : sources)
  ];
  latestSafeDiagnostic = lines.join("\n");
  if (requestDiagnosticText) requestDiagnosticText.textContent = latestSafeDiagnostic;
  if (requestDiagnostic) requestDiagnostic.hidden = false;
}

copyRequestDiagnostic?.addEventListener("click", async () => {
  if (!latestSafeDiagnostic) return;
  try {
    if (!navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(latestSafeDiagnostic);
    requestDiagnosticCopyStatus.textContent = "Copied. You can paste these details into the chat.";
  } catch {
    requestDiagnosticCopyStatus.textContent = "Select the details above and copy them manually.";
  }
});

function chatFailure(message, code) {
  const error = new Error(message);
  error.diagnosticCode = code;
  return error;
}
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
// Accept only explicit introductions, not guessed names or text from the AI.
// Example: "My name is Maya. Can you recommend skincare?" -> "Maya".
// Keep punctuation out of name tokens to avoid capturing the next sentence.
function nameFromIntroduction(message) {
  const introduction = /\b(?:my name is|my name's|you can call me|please call me|call me|i go by|i am called|i'm called|i prefer to be called)\s+([\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*(?:\s+[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*){0,2})/iu;
  const match = message.match(introduction);
  if (!match) return "";
  // A conjunction after the name usually starts another clause, not a name.
  const name = match[1]
    .split(/\s+(?:and|but|so|because|my|i|i'm|with|for|from|who|also|please|can|could|would|what|when|where|which|do|does|how|tell|recommend|suggest)\b/iu)[0]
    .replace(/[\s.,!?;:]+$/u, "")
    .trim();
  return name.length > 0 && name.length <= 70 ? name : "";
}

function buildContextMessages(question, includeRoutine = true) {
  const recent = messages.slice(-RECENT_CONTEXT_MESSAGES).map(message => ({
    role: message.role,
    content: message.content.slice(0, 1000)
  }));
  const older = messages.slice(0, Math.max(0, messages.length - RECENT_CONTEXT_MESSAGES));
  const keyDetails = older
    .filter(message => message.role === "user" && PERSONAL_DETAIL_CUE.test(message.content))
    .map(message => {
      let text = message.content;
      const earlierName = nameFromIntroduction(text);
      if (earlierName && preferredName && earlierName !== preferredName) {
        // A corrected name supersedes the old one, without discarding any
        // other beauty preferences shared in the same earlier message.
        const intro = text.match(/\b(?:my name is|my name's|you can call me|please call me|call me|i go by|i am called|i'm called|i prefer to be called)\s+/iu);
        if (intro) {
          text = (text.slice(0, intro.index) +
            text.slice(intro.index + intro[0].length + earlierName.length))
            .replace(/^\s*[,.;:!?]?\s*(?:and\s+)?/iu, "").trim();
        }
      }
      return text;
    })
    .filter(Boolean)
    .slice(-3)
    .map(text => "- " + text.replace(/\s+/g, " ").slice(0, 230));

  const details = [
    ...(preferredName ? ["- Preferred name (latest name the visitor explicitly gave): " + preferredName] : []),
    ...keyDetails
  ];
  const note = details.length
    ? "Earlier beauty preferences and details shared in this chat (context only, not a new question):\n" + details.join("\n")
    : "";
  const personalNote = note ? { role: "user", content: note.slice(0, 1000) } : null;
  const latestQuestion = { role: "user", content: question };
  if (!includeRoutine || activeRoutineNotes.length === 0) {
    return [
      ...(personalNote ? [personalNote] : []),
      ...recent,
      latestQuestion
    ];
  }

  // Keep the last generated product choices available for questions such as
  // "Can I use those at night?" without losing recent conversation turns.
  // Reserve at least one slot for the visitor's CURRENT question and stay
  // under the Worker's strict 12-message limit.
  const routineContext = activeRoutineNotes.map(content => ({ role: "user", content }));
  const contextSlots = 11 - routineContext.length;
  const keepPersonalNote = Boolean(personalNote && contextSlots >= 3);
  const recentSlots = contextSlots - (keepPersonalNote ? 1 : 0);
  return [
    ...(keepPersonalNote ? [personalNote] : []),
    ...routineContext,
    ...(recentSlots ? recent.slice(-recentSlots) : []),
    latestQuestion
  ];
}

// Never put untrusted messages into innerHTML. Build all message content as text nodes.
function addMessage(text, role, pending = false, forceScroll = false) {
  const shouldScroll = forceScroll || isNearChatBottom();
  const bubble = document.createElement("div");
  bubble.className = "message " + role + (pending ? " pending" : "");
  bubble.setAttribute("role", "group");
  bubble.setAttribute("aria-label", role === "user" ? "Your message" : "Beauty Concierge message");
  // The outer chat panel mirrors in RTL; each message keeps the natural
  // direction and language of its own content, so English product names
  // and Arabic conversations remain readable side by side.
  bubble.setAttribute("dir", "auto");
  bubble.setAttribute("lang", /[\u0600-\u06FF]/.test(text) ? "ar" : "en");
  bubble.textContent = text;
  windowEl.appendChild(bubble);
  scrollChatIfNeeded(shouldScroll);
  return bubble;
}

// Make simple Markdown from the AI readable without importing libraries
// or turning AI-generated text into executable HTML.
// Only allow real HTTPS URLs as clickable search citations. Never interpret
// any text from OpenAI or a third-party website as HTML.
function verifiedSources(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).filter(item => {
    if (!item || typeof item.url !== "string" || typeof item.title !== "string") return false;
    try {
      const url = new URL(item.url);
      return url.protocol === "https:" && !url.username && !url.password &&
        !/^(localhost|127\.|10\.|192\.168\.)/i.test(url.hostname);
    } catch {
      return false;
    }
  });
}

function sourceAnchor(source, index, inline = false) {
  const link = document.createElement("a");
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = inline ? "chat-inline-citation" : "chat-source-link";
  link.textContent = inline ? "[" + (index + 1) + "]" :
    "[" + (index + 1) + "] " + source.title;
  link.setAttribute("aria-label", "Source " + (index + 1) + ": " + source.title + " (opens new tab)");
  return link;
}

function addInlineText(parent, value, sources = []) {
  const formatPattern = /\*\*([^*]+)\*\*|\[(\d+)\]/g;
  let last = 0;
  let match;
  while ((match = formatPattern.exec(value)) !== null) {
    parent.appendChild(document.createTextNode(value.slice(last, match.index)));
    if (match[1] !== undefined) {
      const strong = document.createElement("strong");
      strong.textContent = match[1];
      parent.appendChild(strong);
    } else {
      const index = Number(match[2]) - 1;
      const source = sources[index];
      if (source) parent.appendChild(sourceAnchor(source, index, true));
      else parent.appendChild(document.createTextNode(match[0]));
    }
    last = match.index + match[0].length;
  }
  parent.appendChild(document.createTextNode(value.slice(last)));
}
let chatAnswerSequence = 0;
function renderAssistantReply(bubble, responseText, sources = [], sourceType = "cited") {
  const shouldScroll = isNearChatBottom();
  // Consulted pages are useful references, not claim-level citations.
  // Only annotated search results may create clickable inline [1] links.
  const inlineSources = sourceType === "consulted" ? [] : sources;
  bubble.setAttribute("dir", "auto");
  bubble.setAttribute("lang", /[\u0600-\u06FF]/.test(responseText) ? "ar" : "en");
  bubble.replaceChildren();
  // The Worker should answer briefly. Older deployed Workers can still send
  // essays, so keep their full reply available behind a single explicit control.
  // This is presentation-only; never change the full message stored in history.
  const isLongAnswer = responseText.length > 600;
  const answerBody = isLongAnswer ? document.createElement("div") : bubble;
  if (isLongAnswer) {
    answerBody.className = "chat-answer-body is-collapsed";
    answerBody.setAttribute("id", "chat-answer-" + (++chatAnswerSequence));
    bubble.appendChild(answerBody);
  }
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
        answerBody.appendChild(list);
        listKind = kind;
      }
      const item = document.createElement("li");
      addInlineText(item, (numbered || bullet)[1], inlineSources);
      list.appendChild(item);
      continue;
    }
    list = null;
    listKind = "";
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const element = document.createElement(heading ? "h3" : "p");
    addInlineText(element, heading ? heading[1] : line, inlineSources);
    answerBody.appendChild(element);
  }
  if (isLongAnswer) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "chat-answer-toggle";
    toggle.textContent = "Show full answer";
    toggle.setAttribute("aria-controls", answerBody.getAttribute("id"));
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const expanding = answerBody.classList.contains("is-collapsed");
      answerBody.classList.toggle("is-collapsed", !expanding);
      toggle.textContent = expanding ? "Show less" : "Show full answer";
      toggle.setAttribute("aria-expanded", String(expanding));
    });
    bubble.appendChild(toggle);
  }
  if (sources.length) {
    const section = document.createElement("section");
    section.className = "chat-sources";
    section.setAttribute("aria-label", sourceType === "consulted"
      ? "Pages consulted during live web search" : "Web citations for this answer");
    const heading = document.createElement("strong");
    heading.textContent = sourceType === "consulted"
      ? "PAGES CONSULTED · CHECK THE DETAILS"
      : "WEB SOURCES · OPEN TO VERIFY";
    section.appendChild(heading);
    const list = document.createElement("ol");
    for (const [index, source] of sources.entries()) {
      const item = document.createElement("li");
      item.appendChild(sourceAnchor(source, index));
      list.appendChild(item);
    }
    section.appendChild(list);
    bubble.appendChild(section);
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
  document.querySelectorAll("[data-prompt], [data-followup]").forEach(button => {
    button.disabled = value;
  });
}

function updateFollowUpSuggestions() {
  if (followUpSuggestions) followUpSuggestions.hidden = messages.length === 0;
}

function newChat(focusInput = true) {
  // A new conversation starts in the normal page, with the welcome prompts
  // and message field visible. The next question can enter reading mode.
  toggleChatFocusMode(false);
  if (busy) {
    // Invalidate pending promises even if the browser or a mock transport
    // ignores AbortController, so a late result cannot reappear.
    requestGeneration += 1;
    activeRequestController?.abort();
    activeRequestController = null;
    setBusy(false);
  }
  messages = [];
  preferredName = "";
  activeRoutineNotes = [];
  updateFollowUpSuggestions();
  windowEl.replaceChildren();
  setQuestionPreview("");
  statusEl.textContent = "";
  clearRequestDiagnostic();
  chatAnnouncement.textContent = "";
  input.value = "";
  addMessage(GREETING, "ai");
  if (focusInput) chatAnnouncement.textContent = "New conversation started. The beauty advisor is ready.";
  // On phones the virtual keyboard can cover the composer if we focus
  // automatically. Let visitors see the input before choosing to type.
  if (focusInput && window.matchMedia("(pointer: fine)").matches) input.focus();
}

// Optional catalog details are passed as separate, bounded user-role notes.
// These go through the same secure Worker; no OpenAI key reaches the browser.
async function sendMessage(text, referenceNotes = [], followUpNotes = [], preserveDraft = false) {
  const content = text.trim();
  if (busy || !content) return false;
  if (content.length > 1000) {
    statusEl.textContent = "Please keep your question under 1,000 characters.";
    return false;
  }
  // The Worker limits each message to 1,000 characters and each request to
  // 12 messages. Never give catalog notes system-level privileges.
  const safeNotes = Array.isArray(referenceNotes)
    ? referenceNotes.filter(note => typeof note === "string" && note.trim() && note.length <= 1000).slice(0, 10)
    : [];
  const lastingNotes = Array.isArray(followUpNotes)
    ? followUpNotes.filter(note => typeof note === "string" && note.trim() && note.length <= 1000).slice(0, 3)
    : [];

  statusEl.textContent = "";
  clearRequestDiagnostic();
  setQuestionPreview(content);
  const userBubble = addMessage(content, "user", false, true);
  // Keep the answer inside the well-sized inline chat by default.
  // Visitors can still choose Expand themselves to read a longer answer.
  // Generating from product cards should not wipe a question the visitor
  // was typing in the chat box. Ordinary chat submits keep their old behavior.
  if (!safeNotes.length && !preserveDraft) input.value = "";

  // Retain as much existing chat context as fits beside the selected products.
  // The actual generation question must remain the LAST user message.
  let nextMessages = buildContextMessages(content, safeNotes.length === 0);
  if (safeNotes.length) {
    const questionMessage = nextMessages.pop();
    const roomForHistory = 11 - safeNotes.length;
    nextMessages = [
      ...nextMessages.slice(-roomForHistory),
      ...safeNotes.map(note => ({ role: "user", content: note })),
      questionMessage
    ];
  }
  const isWebSearch = webSearchToggle?.checked === true;
  const startedAt = Date.now();
  let phase = "connecting";
  let responseStatus = null;
  let verifiedSourceCount = null;
  const pending = addMessage(isWebSearch
    ? "Searching current L'Oréal sources and verifying links…"
    : "Preparing your personalized beauty recommendations…", "ai", true);
  chatAnnouncement.textContent = "Question sent. Your beauty advisor is preparing a response.";
  // Capture focus before disabling the input, which may move focus to body.
  const returnFocus = document.activeElement === input || document.activeElement === sendBtn;
  setBusy(true);

  const thisRequest = ++requestGeneration;
  const controller = new AbortController();
  activeRequestController = controller;
  let didTimeOut = false;
  let revealedNewReply = false;
  const timeoutId = setTimeout(() => {
    if (thisRequest !== requestGeneration) return;
    didTimeOut = true;
    controller.abort();
  }, isWebSearch ? WEB_SEARCH_TIMEOUT_MS : REPLY_TIMEOUT_MS);

  try {
    if (!WORKER_URL.startsWith("https://")) {
      throw new Error("Cloudflare Worker URL is not configured.");
    }
    // Normal conversations keep the existing Worker message shape.
    // Search adds only a boolean flag; never put credentials in this payload.
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages }),
      signal: controller.signal
    };
    if (isWebSearch) {
      options.body = JSON.stringify({ messages: nextMessages, searchWeb: true });
    }
    const response = await fetch(WORKER_URL, options);
    if (thisRequest !== requestGeneration) return;
    responseStatus = response.status || null;
    phase = "reading_response";
    let data;
    try {
      data = await response.json();
    } catch {
      throw chatFailure("The server returned an unreadable response.", "INVALID_RESPONSE");
    }
    if (thisRequest !== requestGeneration) return;
    if (!response.ok) {
      throw chatFailure(
        typeof data.error === "string" ? data.error : "The beauty advisor is unavailable right now.",
        "HTTP_" + (responseStatus || "ERROR")
      );
    }
    phase = "validating_search";
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw chatFailure("The beauty advisor returned an empty response.", "EMPTY_RESPONSE");
    }
    const sources = verifiedSources(data?.sources);
    verifiedSourceCount = sources.length;
    const isOutOfScopeSearch = isWebSearch && data?.searchStatus === "out_of_scope";
    if (isWebSearch && !isOutOfScopeSearch && sources.length === 0) {
      // The former Worker silently ignored searchWeb and returned its
      // usual chat answer. Never present that as current web research.
      if (!data?.searchStatus) {
        throw chatFailure("Live search is not active on the Cloudflare Worker yet. Turn off Search the Live Web, or ask the site owner to deploy the updated Worker.", "WORKER_OUTDATED");
      }
      throw chatFailure("Live search did not return source links. Try a more specific L'Oréal product question.", "NO_SEARCH_SOURCES");
    }
    phase = "rendering";
    pending.classList.remove("pending");
    const shouldRevealOnPhone = window.matchMedia("(max-width: 940px)").matches &&
      isNearChatBottom();
    renderAssistantReply(pending, reply, sources,
      data?.sourceType === "consulted" ? "consulted" : "cited");
    // Within the scrollable transcript, reveal the beginning of a new
    // reply on smaller screens. The surrounding card stays a sensible size.
    if (shouldRevealOnPhone || advisor.classList.contains("advisor--focus")) {
      pending.scrollIntoView({
        block: "start",
        behavior: motionIsAllowed() ? "smooth" : "auto"
      });
      revealedNewReply = true;
    }
    chatAnnouncement.textContent =
      "Beauty Concierge replied. " + reply.slice(0, 320) +
      (reply.length > 320 ? " The full response is in the conversation." : "");
    messages.push({ role: "user", content }, { role: "assistant", content: reply });
    // Remember selected product details only when the generated routine
    // succeeds. Failed or cancelled requests must not replace prior context.
    if (safeNotes.length && lastingNotes.length) activeRoutineNotes = lastingNotes;
    updateFollowUpSuggestions();
    // Update only after a successful completed exchange. Corrected names win.
    const introducedName = nameFromIntroduction(content);
    if (introducedName) preferredName = introducedName;
    if (messages.length > MAX_SESSION_MESSAGES) {
      messages = messages.slice(-MAX_SESSION_MESSAGES);
    }
    return true;
  } catch (error) {
    if (thisRequest !== requestGeneration) return;
    // A failed request must not leave a duplicate user message when retried.
    pending.remove();
    userBubble.remove();
    if (!safeNotes.length && !preserveDraft) input.value = content;
    setQuestionPreview("");
    chatAnnouncement.textContent = "";
    let code = error?.diagnosticCode || "UNEXPECTED";
    if (didTimeOut) {
      code = "TIMEOUT";
      statusEl.textContent = isWebSearch
        ? "Live search took too long to respond. Try again or turn off Search the Live Web."
        : "The beauty advisor is taking too long. Please try sending your question again.";
    } else if (error?.name === "TypeError" || error?.name === "AbortError") {
      code = "NETWORK_OR_CORS";
      statusEl.textContent = "Could not reach the Cloudflare Worker. Check your connection; a network filter, browser extension, or CORS restriction may have blocked this request.";
    } else {
      statusEl.textContent = error?.message || "Something went wrong. Please try again.";
    }
    showRequestDiagnostic({
      code, phase, httpStatus: responseStatus,
      elapsedMs: Date.now() - startedAt, searched: isWebSearch,
      sources: verifiedSourceCount
    });
    return false;
  } finally {
    clearTimeout(timeoutId);
    if (thisRequest === requestGeneration) {
      activeRequestController = null;
      setBusy(false);
      // Avoid unexpectedly opening the virtual keyboard on touch devices.
      if (returnFocus && !revealedNewReply &&
          window.matchMedia("(pointer: fine)").matches) input.focus();
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
  if (!advisor.classList.contains("advisor--focus")) scrollToAdvisor();
}
suggestions.addEventListener("click", handleSuggestedPrompt);
miniPrompts.addEventListener("click", handleSuggestedPrompt);

// Optional shortcuts for relevant questions about the conversation so far.
// Ordinary typed questions still use the very same sendMessage/history path.
followUpSuggestions?.addEventListener("click", event => {
  const button = event.target.closest("button[data-followup]");
  if (!button) return;
  sendMessage(button.dataset.followup, [], [], true);
});

function showTouchComposer() {
  // Center the input within the visible page before the virtual keyboard opens.
  // This also leaves part of the conversation visible above the form.
  form.scrollIntoView({
    behavior: motionIsAllowed() ? "smooth" : "auto",
    block: "center"
  });
}

resetBtn.addEventListener("click", () => {
  newChat(true);
  if (!window.matchMedia("(pointer: fine)").matches) showTouchComposer();
});
startButton.addEventListener("click", () => {
  if (window.matchMedia("(pointer: fine)").matches) {
    scrollToAdvisor();
    input.focus({ preventScroll: true });
  } else {
    // Focusing immediately opens a touch keyboard, covering the composer.
    // Show the message box first and let the visitor choose when to type.
    showTouchComposer();
  }
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
