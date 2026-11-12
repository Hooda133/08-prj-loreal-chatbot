// End-to-end smoke tests in a REAL headless Chrome browser.
// No live OpenAI calls: the Worker fetch is mocked before page JavaScript loads.
// CI installs puppeteer-core only in the temporary GitHub runner.
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const base = process.env.TEST_URL || "http://127.0.0.1:8000/";
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
});
const failures = [];
async function setupPage(width, height, reducedMotion = false) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }
  ]);
  page.on("pageerror", error => failures.push(error.message));
  await page.evaluateOnNewDocument(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__mockRequests = [];
    window.fetch = (url, options) => {
      const href = typeof url === "string" ? url : url.url;
      if (href.includes("loreal-beauty-advisor.elshamandy133.workers.dev")) {
        const request = JSON.parse(options.body);
        window.__mockRequests.push(request);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                content: "## Your L’Oréal routine\n- Start by considering your skin type.\n- Choose products that fit your preferences."
              }
            }]
          })
        });
      }
      return nativeFetch(url, options);
    };
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  return page;
}

async function sendQuestion(page, question) {
  await page.focus("#userInput");
  await page.type("#userInput", question, { delay: 0 });
  await page.click("#sendBtn");
  await page.waitForFunction(
    () => document.querySelectorAll(".chat-window .message.user").length >= window.__mockRequests.length &&
      document.querySelectorAll(".chat-window .message.ai:not(.pending)").length >= window.__mockRequests.length + 1,
    { timeout: 10000 }
  );
}

try {
  const desktop = await setupPage(1440, 900);
  let state = await desktop.evaluate(() => ({
    greeting: document.querySelector("#chatWindow").innerText.includes("Welcome to Beauty Atelier"),
    previewHidden: document.querySelector("#questionPreview").hidden,
    previewDisplay: getComputedStyle(document.querySelector("#questionPreview")).display,
    inputLabel: document.querySelector('label[for="userInput"]')?.textContent,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    buttons: document.querySelectorAll("button[data-prompt]").length
  }));
  assert.equal(state.greeting, true, "Greeting should be visible");
  assert.equal(state.previewHidden, true, "Preview should start hidden");
  assert.equal(state.previewDisplay, "none", "Hidden preview must not occupy space");
  assert.match(state.inputLabel, /L.Oréal products/);
  assert.equal(state.buttons, 8, "All eight shortcut prompts remain functional");
  assert.ok(state.horizontalOverflow <= 2, "Desktop should not scroll horizontally: " + state.horizontalOverflow);

  await sendQuestion(desktop, "My name is Emma. Can you suggest a L’Oréal routine?");
  state = await desktop.evaluate(() => ({
    user: document.querySelectorAll(".chat-window .message.user").length,
    assistant: document.querySelectorAll(".chat-window .message.ai:not(.pending)").length,
    userAlign: getComputedStyle(document.querySelector(".chat-window .message.user")).alignSelf,
    aiAlign: getComputedStyle(document.querySelectorAll(".chat-window .message.ai")[1]).alignSelf,
    preview: document.querySelector("#questionPreviewText").textContent,
    visible: getComputedStyle(document.querySelector("#questionPreview")).display !== "none",
    transcript: window.__mockRequests[0].messages,
    errorText: document.querySelector("#status").textContent
  }));
  assert.equal(state.user, 1);
  assert.equal(state.assistant, 2);
  assert.equal(state.userAlign, "flex-end");
  assert.equal(state.aiAlign, "flex-start");
  assert.match(state.preview, /My name is Emma/);
  assert.equal(state.visible, true);
  assert.equal(state.transcript[0].role, "user");
  assert.equal(state.errorText, "");

  await desktop.focus("#userInput");
  await desktop.type("#userInput", "Which L’Oréal moisturizer should I consider?");
  state = await desktop.evaluate(() => ({
    hidden: document.querySelector("#questionPreview").hidden,
    display: getComputedStyle(document.querySelector("#questionPreview")).display
  }));
  assert.equal(state.hidden, true, "Question preview should clear as next input starts");
  assert.equal(state.display, "none");

  await desktop.click("#sendBtn");
  await desktop.waitForFunction(() => window.__mockRequests.length === 2 &&
    document.querySelectorAll(".chat-window .message.ai:not(.pending)").length === 3);
  const context = await desktop.evaluate(() => window.__mockRequests.at(-1).messages);
  assert.match(context.at(-1).content, /Which L.Oréal moisturizer/);
  assert.ok(context.some(item => item.role === "user" && /My name is Emma/.test(item.content)));

  await desktop.click("#resetBtn");
  const cleared = await desktop.evaluate(() => ({
    messages: document.querySelectorAll(".chat-window .message").length,
    hidden: document.querySelector("#questionPreview").hidden,
    input: document.querySelector("#userInput").value
  }));
  assert.deepEqual(cleared, { messages: 1, hidden: true, input: "" });

  await desktop.click("#motionToggle");
  const motionPaused = await desktop.evaluate(() => document.body.classList.contains("motion-paused"));
  assert.equal(motionPaused, true, "Pause motion control must work");

  await desktop.screenshot({ path: "/tmp/final-beauty-desktop.png", fullPage: true });
  await desktop.close();

  const mobile = await setupPage(375, 812, true);
  const mobileState = await mobile.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    previewDisplay: getComputedStyle(document.querySelector("#questionPreview")).display,
    motionDisplay: getComputedStyle(document.querySelector("#motionToggle")).display,
    heroVisible: !!document.querySelector(".hero-story h1"),
    prompts: document.querySelectorAll(".quick-prompts button").length,
    secondaryNavDisplay: getComputedStyle(document.querySelector(".header-nav__ritual")).display
  }));
  if (mobileState.overflow > 2) {
    const offscreen = await mobile.evaluate(() => [...document.querySelectorAll("body *")].map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName, className: typeof el.className === "string" ? el.className.slice(0, 90) : "svg",
        left: Math.round(rect.left), right: Math.round(rect.right),
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth
      };
    }).filter(item => item.right > innerWidth + 3 || item.left < -3)
      .sort((a, b) => b.right - a.right).slice(0, 18));
    console.log("Mobile overflow contributors:", JSON.stringify(offscreen));
    const outsideTicker = await mobile.evaluate(() => [...document.querySelectorAll("body *")]
      .filter(el => !el.closest(".luxury-ticker"))
      .map(el => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, className: typeof el.className === "string" ? el.className.slice(0, 75) : "svg",
          right: Math.round(r.right), left: Math.round(r.left),
          scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      })
      .filter(el => el.right > innerWidth + 2 || el.left < -2)
      .sort((a,b) => b.right - a.right)
      .slice(0, 24));
    console.log("Mobile offenders EXCLUDING ticker:", JSON.stringify(outsideTicker));
    await mobile.screenshot({ path: "/tmp/final-beauty-mobile.png", fullPage: true });
  }
  assert.ok(mobileState.overflow <= 2, "375px mobile overflow: " + mobileState.overflow);
  assert.equal(mobileState.previewDisplay, "none");
  assert.equal(mobileState.motionDisplay, "none", "Reduced motion should hide the motion toggle");
  assert.equal(mobileState.heroVisible, true);
  assert.equal(mobileState.prompts, 3);
  assert.equal(mobileState.secondaryNavDisplay, "none", "Secondary navigation must be hidden on phones");

  await mobile.focus("#userInput");
  const singleOutline = await mobile.evaluate(() => ({
    inner: getComputedStyle(document.querySelector(".chat-form input")).outlineStyle,
    outer: getComputedStyle(document.querySelector(".chat-form")).outlineStyle
  }));
  assert.equal(singleOutline.inner, "none", "No duplicate inner focus border");
  assert.equal(singleOutline.outer, "solid", "One visible outer keyboard focus ring");

  await sendQuestion(mobile, "Recommend L’Oréal products for dry skin");
  const mobileConversation = await mobile.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    replyVisible: document.querySelectorAll(".chat-window .message.ai:not(.pending)").length === 2
  }));
  assert.ok(mobileConversation.overflow <= 2, "Mobile chat overflow: " + mobileConversation.overflow);
  assert.equal(mobileConversation.replyVisible, true);
  await mobile.screenshot({ path: "/tmp/final-beauty-mobile.png", fullPage: true });
  for (const width of [320, 768]) {
    await mobile.setViewport({ width, height: 840, deviceScaleFactor: 1 });
    const extra = await mobile.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      secondaryNavDisplay: getComputedStyle(document.querySelector(".header-nav__ritual")).display
    }));
    assert.ok(extra.overflow <= 2, width + "px responsive overflow: " + extra.overflow);
    assert.equal(extra.secondaryNavDisplay, "none", "Responsive navigation should fit at " + width + "px");
  }
  await mobile.close();

  assert.deepEqual(failures, [], "There must be no uncaught browser JavaScript errors");
  console.log("PASS: Real Chrome desktop + mobile smoke test");
  console.log("PASS: Prompt buttons, distinct chat bubbles, preview, context, New Chat, motion and accessible input");
  console.log("PASS: No unintended horizontal overflow at 1440px / 375px");
} finally {
  await browser.close();
}
