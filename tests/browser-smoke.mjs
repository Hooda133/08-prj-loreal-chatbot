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
async function setupPage(width, height, reducedMotion = false, touch = false) {
  const page = await browser.newPage();
  await page.setViewport({
    width, height, deviceScaleFactor: 1,
    isMobile: touch, hasTouch: touch
  });
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
                content: request.searchWeb
                  ? /cologne/i.test(request.messages.at(-1).content)
                    ? "Check the latest fragrance collections for L'Oréal-related brands."
                    : "Current L’Oréal serum information is available [1]."
                  : "## Your L’Oréal routine\n- Start by considering your skin type.\n- Choose products that fit your preferences."
              }
            }],
            ...(request.searchWeb ? {
              searchStatus: "complete",
              sourceType: /cologne/i.test(request.messages.at(-1).content) ? "consulted" : "cited",
              sources: [{
                title: "L’Oréal Paris official serum catalog",
                url: "https://www.lorealparisusa.com/skin-care/face-serums"
              }]
            } : {})
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

  // The Atelier Edition design is a real page redesign, not a mock-up:
  // inspect live layout, navigation, color, product art and movement.
  const editorial = await desktop.evaluate(() => {
    const hero = document.querySelector("#consultation");
    const heading = document.querySelector("#hero-title");
    const links = [...document.querySelectorAll(".atelier-path a")];
    const firstCard = document.querySelector("#productGrid .catalog-card");
    return {
      theme:document.querySelector('meta[name="theme-color"]')?.content,
      cssLoaded:[...document.styleSheets].some(sheet =>
        sheet.href?.split("?")[0].endsWith("/atelier-redesign.css")),
      build:document.querySelector('meta[name="beauty-atelier-build"]')?.content,
      cacheBustedChat:!!document.querySelector('script[src*="script.js?v=20261119-balanced"]'),
      darkCover:getComputedStyle(hero).backgroundImage.includes("linear-gradient"),
      headingColor:getComputedStyle(heading).color,
      stickyHeader:getComputedStyle(document.querySelector(".site-header")).position,
      journeyLinks:links.map(link => link.getAttribute("href")),
      editorialArt:!!document.querySelector(".hero-art__issue"),
      issue:document.querySelector(".hero-art__issue")?.textContent,
      progress:!!document.querySelector("#readingProgressBar"),
      cardEdition:firstCard?.querySelector(".catalog-card__edition")?.textContent,
      cardEditionHidden:firstCard?.querySelector(".catalog-card__edition")?.getAttribute("aria-hidden"),
      hasBuilder:!!document.querySelector("#routine-builder"),
      hasChat:!!document.querySelector("#chatWindow")
    };
  });
  assert.equal(editorial.theme, "#251b20");
  assert.equal(editorial.cssLoaded, true, "Premium design stylesheet should load");
  assert.equal(editorial.build, "2026-11-19-balanced-chat",
    "The HTML must identify the balanced-chat deployment version");
  assert.equal(editorial.cacheBustedChat, true,
    "The HTML should load fresh chat JavaScript after deployment");
  assert.equal(editorial.darkCover, true, "Cover must use editorial gradients");
  assert.equal(editorial.headingColor, "rgb(255, 250, 242)");
  assert.equal(editorial.stickyHeader, "relative", "Masthead must not cover scrolled-to controls");
  assert.deepEqual(editorial.journeyLinks, ["#concierge", "#routine-builder", "#discover"]);
  assert.match(editorial.issue, /ATELIER/);
  assert.equal(editorial.progress, true);
  assert.equal(editorial.cardEdition, "01 / 23");
  assert.equal(editorial.cardEditionHidden, "true");
  assert.equal(editorial.hasBuilder, true);
  assert.equal(editorial.hasChat, true);

  // Studio v2 is actual source-owned vector artwork on dimensional display
  // stages, not remote stock icons or visual overlays blocking controls.
  const sculptedArt = await desktop.evaluate(() => {
    const iconIds = ["ui-serum","ui-lipstick","ui-perfume","ui-compact","ui-hair"];
    const stage = document.querySelector(".category-card__disc");
    const glint = document.querySelector(".category-card__visual");
    const catalogArt = document.querySelector("#productGrid .catalog-card__art");
    const symbolUses = [...document.querySelectorAll(".category-card__visual use")];
    return {
      build:document.querySelector('meta[name="beauty-atelier-art-version"]')?.content,
      styleVersion:!!document.querySelector('link[href*="atelier-redesign.css?v=20261119-sculpted-v2"]'),
      sourceSymbols:iconIds.every(id => !!document.getElementById(id)),
      beveledMaterial:!!document.getElementById("ui-bevel-v2"),
      prismaticMaterial:!!document.getElementById("ui-prism-v2"),
      displays:symbolUses.map(use => use.getAttribute("href")),
      pedestal:getComputedStyle(stage,"::before").backgroundImage,
      pedestalTop:getComputedStyle(stage,"::after").backgroundImage,
      sparkle:getComputedStyle(glint,"::after").clipPath,
      catalogPedestal:getComputedStyle(catalogArt,"::before").backgroundImage,
      catalogPedestalTop:getComputedStyle(catalogArt,"::before").top,
      catalogPedestalBottom:getComputedStyle(catalogArt,"::before").bottom,
      catalogStillClickable:!!catalogArt.parentElement.querySelector(".catalog-card__pick"),
      imageRequests:[...document.images].filter(img =>
        /unsplash|pexels|stockphotos/i.test(img.src)).length
    };
  });
  assert.equal(sculptedArt.build,"sculpted-icons-v2");
  assert.equal(sculptedArt.styleVersion,true,"Load versioned premium icon CSS");
  assert.equal(sculptedArt.sourceSymbols,true,"All five reusable product SVG illustrations exist");
  assert.equal(sculptedArt.beveledMaterial,true);
  assert.equal(sculptedArt.prismaticMaterial,true);
  assert.deepEqual(sculptedArt.displays,
    ["#ui-serum","#ui-lipstick","#ui-hair","#ui-perfume"]);
  assert.match(sculptedArt.pedestal,/linear-gradient/);
  assert.match(sculptedArt.pedestalTop,/linear-gradient/);
  assert.match(sculptedArt.sparkle,/polygon/);
  assert.match(sculptedArt.catalogPedestal,/linear-gradient/);
  assert.ok(parseFloat(sculptedArt.catalogPedestalTop) > 100,
    "Catalog podium must be positioned near the bottom, not above the bottle");
  assert.equal(sculptedArt.catalogPedestalBottom,"7px");
  assert.equal(sculptedArt.catalogStillClickable,true);
  assert.equal(sculptedArt.imageRequests,0,"No stock icon images added");
  await desktop.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 3));
  await desktop.waitForFunction(() => {
    const t = document.querySelector("#readingProgressBar").style.transform;
    return /scaleX\(0\.[1-9]/.test(t);
  });
  await desktop.evaluate(() => window.scrollTo(0, 0));


  // The actual page CSP must block a browser fetch to OpenAI. Only the
  // approved Worker is allowed to receive browser-side AI requests.
  const cspViolations = await desktop.evaluate(async () => {
    const seen = [];
    const onViolation = event => seen.push({
      directive:event.effectiveDirective, blocked:event.blockedURI
    });
    document.addEventListener("securitypolicyviolation", onViolation);
    try {
      await fetch("https://api.openai.com/v1/models", { method:"GET" });
    } catch {
      // A CSP denial normally makes fetch reject. No real API call is sent.
    }
    await new Promise(resolve => setTimeout(resolve, 75));
    document.removeEventListener("securitypolicyviolation", onViolation);
    return seen;
  });
  assert.ok(cspViolations.some(event => event.directive === "connect-src" &&
    event.blocked.includes("api.openai.com")), "CSP must block direct OpenAI requests from the webpage");

  // Bonus: explicit web search sends a bounded opt-in flag and shows
  const lookup = await setupPage(1440, 900);
  // real-clickable source links alongside the in-answer citation.
  await lookup.click("#webSearchToggle");
  assert.equal(await lookup.$eval("#webSearchToggle", el => el.checked), true);
  await sendQuestion(lookup, "What is the latest L'Oréal Paris serum information?");
  const searched = await lookup.evaluate(() => {
    const bubble = document.querySelector(".chat-window .message.ai:last-child");
    const inline = bubble.querySelector(".chat-inline-citation");
    const source = bubble.querySelector(".chat-source-link");
    return {
      request:window.__mockRequests.at(-1),
      inline: inline?.textContent,
      href: inline?.href,
      source: source?.textContent,
      sourceHref:source?.href,
      rel:source?.rel,
      present:!!bubble.querySelector(".chat-sources"),
      horizontalOverflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.equal(searched.request.searchWeb, true);
  assert.equal(searched.inline, "[1]");
  assert.match(searched.href, /lorealparisusa\.com\/skin-care\/face-serums/);
  assert.match(searched.source, /official serum catalog/);
  assert.equal(searched.sourceHref, searched.href);
  assert.equal(searched.rel, "noopener noreferrer");
  assert.equal(searched.present, true);
  assert.ok(searched.horizontalOverflow <= 2, "Search citation links must not cause horizontal overflow");
  // The reported failure involved a fragrance query without inline
  // annotations. Real consulted URLs should display even with no [1] token.
  await sendQuestion(lookup, "any cologne recommendation from L'Oréal-related brands?");
  const consulted = await lookup.evaluate(() => {
    const bubble = document.querySelector(".chat-window .message.ai:last-child");
    return {
      sourceHeading:bubble.querySelector(".chat-sources strong")?.textContent,
      sourceLink:bubble.querySelector(".chat-source-link")?.href,
      inlineCitation:!!bubble.querySelector(".chat-inline-citation"),
      status:document.querySelector("#status").textContent
    };
  });
  assert.match(consulted.sourceHeading, /PAGES CONSULTED/);
  assert.match(consulted.sourceLink, /^https:\/\/www\.lorealparisusa\.com\//);
  assert.equal(consulted.inlineCitation, false,
    "Source list is available without inventing inline citations");
  assert.equal(consulted.status, "");

  // Full-window view must contain the same successful chat and real links,
  // not create a second conversation or lose the search setting.
  const lookupSourcesBefore = await lookup.$eval("#chatWindow",
    el => el.querySelectorAll(".chat-source-link").length);
  await lookup.click("#expandChatBtn");
  const fullView = await lookup.evaluate(() => {
    const advisor = document.querySelector("#concierge");
    const rect = advisor.getBoundingClientRect();
    return {
      active:advisor.classList.contains("advisor--focus"),
      role:advisor.getAttribute("role"),
      modal:advisor.getAttribute("aria-modal"),
      width:rect.width,
      height:rect.height,
      viewportWidth:innerWidth,
      viewportHeight:innerHeight,
      conversation:document.querySelector("#chatWindow").getBoundingClientRect().height,
      links:advisor.querySelectorAll(".chat-source-link").length,
      searchChecked:document.querySelector("#webSearchToggle").checked,
      expanded:document.querySelector("#expandChatBtn").getAttribute("aria-pressed")
    };
  });
  assert.equal(fullView.active, true);
  assert.equal(fullView.role, "dialog");
  assert.equal(fullView.modal, "true");
  assert.ok(fullView.width > fullView.viewportWidth - 40);
  assert.ok(fullView.height > fullView.viewportHeight - 40);
  assert.ok(fullView.conversation > 300, "Focus mode shows a large transcript");
  assert.equal(fullView.links, lookupSourcesBefore);
  assert.equal(fullView.searchChecked, true);
  assert.equal(fullView.expanded, "true");
  await lookup.keyboard.press("Escape");
  const restoredView = await lookup.evaluate(() => ({
    focusMode:document.querySelector("#concierge").classList.contains("advisor--focus"),
    location:document.querySelector("#concierge").parentElement.classList.contains("hero-grid"),
    scrollLocked:document.body.classList.contains("chat-focus-open"),
    expanded:document.querySelector("#expandChatBtn").getAttribute("aria-pressed"),
    links:document.querySelectorAll("#chatWindow .chat-source-link").length
  }));
  assert.deepEqual(restoredView,{
    focusMode:false,location:true,scrollLocked:false,
    expanded:"false",links:lookupSourcesBefore
  });

  await lookup.click("#webSearchToggle");
  assert.equal(await lookup.$eval("#webSearchToggle", el => el.checked), false);

  await lookup.close();

  // Desktop keeps a usable, scrollable transcript even with composer
  // shortcuts and web-search controls present.
  const desktopTranscript = await desktop.evaluate(() => {
    const chat = document.querySelector("#chatWindow");
    const composer = document.querySelector(".advisor__composer");
    const chatRect = chat.getBoundingClientRect();
    return {
      height:chatRect.height,
      overflow:getComputedStyle(chat).overflowY,
      composerTop:composer.getBoundingClientRect().top,
      chatBottom:chatRect.bottom
    };
  });
  assert.ok(desktopTranscript.height >= 400 && desktopTranscript.height <= 515,
    "Desktop transcript should be a balanced 400–510px instead of dominating the page");
  assert.equal(desktopTranscript.overflow, "auto");
  assert.ok(desktopTranscript.composerTop >= desktopTranscript.chatBottom - 2);

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
  // A paused fade-in animation must not make a freshly rendered message invisible.
  const messageOpacity = await desktop.evaluate(() =>
    getComputedStyle(document.querySelector(".chat-window .message")).opacity);
  assert.equal(messageOpacity, "1", "Paused motion must never hide chat messages");
  await desktop.click("#resetBtn");
  const newlyCreatedMessageOpacity = await desktop.evaluate(() =>
    getComputedStyle(document.querySelector(".chat-window .message")).opacity);
  assert.equal(newlyCreatedMessageOpacity, "1", "New chat remains visible while motion is paused");

  // New routine-builder journeys must work in an actual browser, not only
  // in the isolated recommendation logic tests.
  await desktop.select("#routineFocus", "haircare");
  await desktop.select("#routineSkin", "oily");
  await desktop.select("#routineConcern", "oil");
  await desktop.click("#buildRoutine");
  const hairState = await desktop.evaluate(() => ({
    heading: document.querySelector(".routine-result__panel h4")?.textContent,
    products: [...document.querySelectorAll(".routine-result__step strong")].map(el => el.textContent),
    filter: document.querySelector("#productCategory").value,
    timeHidden: document.querySelector("#routineTimeField").hidden
  }));
  assert.match(hairState.heading, /Wash-day ritual/);
  assert.equal(hairState.filter, "haircare");
  assert.equal(hairState.timeHidden, true);
  assert.equal(hairState.products.length, 2, "Oily roots should not get an unsuitable dry-hair leave-in");
  assert.match(hairState.products[0], /Hyaluron.*Pure/);

  await desktop.select("#routineFocus", "makeup");
  await desktop.select("#routineSkin", "polished");
  await desktop.select("#routineConcern", "definition");
  await desktop.click("#buildRoutine");
  const makeupState = await desktop.evaluate(() => ({
    heading: document.querySelector(".routine-result__panel h4")?.textContent,
    products: [...document.querySelectorAll(".routine-result__step strong")].map(el => el.textContent),
    noShadeGuess: document.querySelector("#routineResult").textContent.includes("not matched")
  }));
  assert.match(makeupState.heading, /makeup edit/);
  assert.match(makeupState.products[0], /True Match/);
  assert.equal(makeupState.noShadeGuess, true, "The builder must not invent makeup shade matching");

  const beforeRefine = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.click("#routineResult .routine-primary");
  await desktop.waitForFunction(previous => window.__mockRequests.length === previous + 1, {}, beforeRefine);
  const aiHandoff = await desktop.evaluate(() => window.__mockRequests.at(-1).messages.at(-1).content);
  assert.match(aiHandoff, /makeup routine/);
  assert.match(aiHandoff, /True Match/);
  assert.ok(aiHandoff.length <= 1000, "AI handoff respects Worker input size limits");

  // Reveal Product Description: every catalog card must expose a real
  // expandable panel that can be opened by click, touch or keyboard.
  await desktop.select("#productCategory", "all");
  const detailCoverage = await desktop.evaluate(() => [...document.querySelectorAll(".catalog-card")].map(card => {
    const button = card.querySelector(".catalog-card__details-toggle");
    const panel = card.querySelector(".catalog-card__details");
    return {
      id:card.dataset.productId,
      buttonTag:button?.tagName,
      buttonType:button?.type,
      controls:button?.getAttribute("aria-controls"),
      expanded:button?.getAttribute("aria-expanded"),
      panelId:panel?.id,
      hidden:panel?.hidden,
      description:panel?.querySelector(".catalog-card__details-copy")?.textContent
    };
  }));
  assert.equal(detailCoverage.length, 23, "All catalog products must reveal a description");
  for (const row of detailCoverage) {
    assert.equal(row.buttonTag, "BUTTON");
    assert.equal(row.buttonType, "button");
    assert.equal(row.controls, row.panelId, row.id + ": button controls its own details");
    assert.equal(row.expanded, "false", row.id + ": details initially collapsed");
    assert.equal(row.hidden, true, row.id + ": details initially hidden");
    assert.ok(row.description, row.id + ": details contain a readable product description");
  }

  const acidCard = '[data-product-id="glycolic-serum"]';
  const countBeforeDetails = await desktop.$eval("#pickedCount", node => node.textContent);
  await desktop.click(acidCard + " .catalog-card__details-toggle");
  const acidExpanded = await desktop.evaluate(() => {
    const card = document.querySelector('[data-product-id="glycolic-serum"]');
    const panel = card.querySelector(".catalog-card__details");
    const button = card.querySelector(".catalog-card__details-toggle");
    return {
      expanded:button.getAttribute("aria-expanded"),
      hidden:panel.hidden,
      visible:getComputedStyle(panel).display !== "none",
      content:panel.textContent,
      cardSelected:card.classList.contains("catalog-card--selected"),
      count:document.querySelector("#pickedCount").textContent,
      focused:document.activeElement === button
    };
  });
  assert.equal(acidExpanded.expanded, "true");
  assert.equal(acidExpanded.hidden, false);
  assert.equal(acidExpanded.visible, true);
  assert.match(acidExpanded.content, /Exfoliating serum for uneven-looking tone and texture/);
  assert.match(acidExpanded.content, /CATALOG GOALS/);
  assert.match(acidExpanded.content, /Check official directions/);
  assert.equal(acidExpanded.cardSelected, false, "Opening details does not select the product");
  assert.equal(acidExpanded.count, countBeforeDetails, "Details leave saved products alone");
  assert.equal(acidExpanded.focused, true, "Details toggle preserves focus");

  await desktop.keyboard.press("Space");
  const acidCollapsed = await desktop.evaluate(() => {
    const card = document.querySelector('[data-product-id="glycolic-serum"]');
    return {
      expanded:card.querySelector(".catalog-card__details-toggle").getAttribute("aria-expanded"),
      hidden:card.querySelector(".catalog-card__details").hidden,
      focused:document.activeElement === card.querySelector(".catalog-card__details-toggle")
    };
  });
  assert.deepEqual(acidCollapsed, {expanded:"false",hidden:true,focused:true},
    "Keyboard Space collapses product details and preserves focus");

  await desktop.click(acidCard + " .catalog-card__details-toggle");
  await desktop.select("#productCategory", "makeup");
  await desktop.select("#productCategory", "all");
  assert.equal(await desktop.$eval(acidCard + " .catalog-card__details-toggle",
    node => node.getAttribute("aria-expanded")), "true",
    "Expanded state survives switching product categories");
  await desktop.select("#productCategory", "makeup");

  // Product Search: filters immediately on each keystroke, combines
  // keyword matches with category filters, and offers a clear/reset path.
  await desktop.select("#productCategory", "all");
  const inputSearch = await desktop.$eval("#productSearch", el => ({
    kind:el.type, placeholder:el.placeholder, controls:el.getAttribute("aria-controls")
  }));
  assert.equal(inputSearch.kind, "search");
  assert.equal(inputSearch.controls, "productGrid");
  await desktop.focus("#productSearch");
  await desktop.type("#productSearch", "serum hyaluronic");
  const matched = await desktop.evaluate(() => ({
    ids:[...document.querySelectorAll("#productGrid .catalog-card")].map(card => card.dataset.productId),
    count:document.querySelector("#productCount").textContent,
    clearVisible:!document.querySelector("#clearProductSearch").hidden,
    inputFocused:document.activeElement === document.querySelector("#productSearch")
  }));
  assert.ok(matched.ids.includes("ha-serum"), "Search words match product name in any order");
  assert.ok(matched.ids.every(id => id.includes("serum")), "Nonmatching products are filtered");
  assert.equal(matched.count, matched.ids.length + " of 23 verified products");
  assert.equal(matched.clearVisible, true);
  assert.equal(matched.inputFocused, true, "Typing does not lose keyboard focus");

  await desktop.select("#productCategory", "makeup");
  assert.equal(await desktop.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length), 0,
    "Keyword + nonmatching category results in empty state");
  assert.match(await desktop.$eval("#productGrid .catalog-empty", el => el.textContent),
    /No matching products found/);
  await desktop.select("#productCategory", "serum");
  assert.ok(await desktop.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length) > 0,
    "Changing category updates results without clearing search");
  assert.equal(await desktop.$eval("#productSearch", el => el.value), "serum hyaluronic");
  await desktop.click("#clearProductSearch");
  const clearedSearch = await desktop.evaluate(() => ({
    search: document.querySelector("#productSearch").value,
    category: document.querySelector("#productCategory").value,
    clearHidden:document.querySelector("#clearProductSearch").hidden,
    products:document.querySelectorAll("#productGrid .catalog-card").length
  }));
  assert.equal(clearedSearch.search, "");
  assert.equal(clearedSearch.category, "serum", "Clearing keywords does not change category");
  assert.equal(clearedSearch.clearHidden, true);
  assert.ok(clearedSearch.products > 1);

  await desktop.select("#productCategory", "all");
  await desktop.type("#productSearch", "nonexistentzzproduct");
  assert.equal(await desktop.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length), 0);
  await desktop.click("#productGrid .catalog-empty__reset");
  assert.equal(await desktop.$eval("#productSearch", el => el.value), "");
  assert.equal(await desktop.$eval("#productCategory", el => el.value), "all");
  assert.equal(await desktop.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length), 23,
    "No-results reset restores entire product library");
  await desktop.select("#productCategory", "makeup");

  // Product selection requirement: a click on the *card* toggles selection,
  // visibly highlights it, and updates the selected list above Build My Routine.
  const lumiCard = '[data-product-id="lumi-glotion"]';
  await desktop.click(lumiCard + " .catalog-card__art");
  let productState = await desktop.evaluate(() => {
    const card = document.querySelector('[data-product-id="lumi-glotion"]');
    return {
      selected: card.classList.contains("catalog-card--selected"),
      pressed: card.querySelector(".catalog-card__pick").getAttribute("aria-pressed"),
      label: card.querySelector(".catalog-card__selection-label").textContent,
      count: document.querySelector("#pickedCount").textContent,
      inList: document.querySelector("#chosenProducts").textContent.includes("Lumi Glotion"),
      highlighted: getComputedStyle(card).boxShadow !== "none"
    };
  });
  assert.deepEqual(productState, {
    selected:true, pressed:"true", label:"✓ SELECTED", count:"1 saved",
    inList:true, highlighted:true
  }, "Clicking product artwork must select the product and update visuals + selected list");

  // Filtering out a selected card does not remove its saved selection.
  await desktop.focus("#productSearch");
  await desktop.type("#productSearch", "mascara");
  const temporarilyHidden = await desktop.evaluate(() => ({
    hasLumi:!!document.querySelector('[data-product-id="lumi-glotion"]'),
    saved:document.querySelector("#pickedCount").textContent,
    chip:document.querySelector("#chosenProducts").textContent.includes("Lumi Glotion")
  }));
  assert.deepEqual(temporarilyHidden, {hasLumi:false,saved:"1 saved",chip:true});
  await desktop.click("#clearProductSearch");
  assert.equal(await desktop.$eval(lumiCard, card => card.classList.contains("catalog-card--selected")), true,
    "Selected product returns highlighted after search is cleared");

  await desktop.click(lumiCard + " .catalog-card__title");
  productState = await desktop.evaluate(() => {
    const card = document.querySelector('[data-product-id="lumi-glotion"]');
    return {
      selected:card.classList.contains("catalog-card--selected"),
      pressed:card.querySelector(".catalog-card__pick").getAttribute("aria-pressed"),
      count:document.querySelector("#pickedCount").textContent,
      inList:document.querySelector("#chosenProducts").textContent.includes("Lumi Glotion")
    };
  });
  assert.deepEqual(productState, {
    selected:false, pressed:"false", count:"0 saved", inList:false
  }, "Clicking the same product again must unselect it and remove its saved chip");

  // Keyboard visitors can toggle selection without losing focus on a re-render.
  await desktop.focus(lumiCard + " .catalog-card__pick");
  await desktop.keyboard.press("Enter");
  const afterKeyboard = await desktop.evaluate(() => ({
    pressed:document.querySelector('[data-product-id="lumi-glotion"] .catalog-card__pick').getAttribute("aria-pressed"),
    focusPreserved:document.activeElement === document.querySelector('[data-product-id="lumi-glotion"] .catalog-card__pick'),
    saved:document.querySelectorAll("#chosenProducts .saved-chip").length
  }));
  assert.deepEqual(afterKeyboard, {pressed:"true",focusPreserved:true,saved:1});

  // Ask AI stays independent; clicking it must not unselect the product.
  await desktop.click(lumiCard + " .catalog-button--ask");
  assert.equal(await desktop.$eval(lumiCard + " .catalog-card__pick", el => el.getAttribute("aria-pressed")), "true");

  // Explicit Save product control and selected chip use the same state as card clicks.
  await desktop.click(lumiCard + " .catalog-button--save");
  assert.equal(await desktop.$eval("#pickedCount", el => el.textContent), "0 saved");
  await desktop.click(lumiCard + " .catalog-button--save");
  assert.equal(await desktop.$eval("#pickedCount", el => el.textContent), "1 saved");
  await desktop.click("#chosenProducts .saved-chip");
  assert.equal(await desktop.$eval(lumiCard + " .catalog-card__pick", el => el.getAttribute("aria-pressed")), "false");

  // Routine Generation requirement: empty selection must not send an API request.
  await desktop.waitForFunction(() => document.querySelector("#sendBtn").disabled === false);
  const emptyCount = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.click("#generateRoutineAI");
  const emptyGeneration = await desktop.evaluate(() => ({
    count: window.__mockRequests.length,
    feedback: document.querySelector("#routineFeedback").textContent
  }));
  assert.equal(emptyGeneration.count, emptyCount, "No selected products: do not call the API");
  assert.match(emptyGeneration.feedback, /Choose at least one product/);

  // Select two verified products, then Generate Routine. The request must
  // include actual catalog names, descriptions and official links, not just
  // an unsourced generic text prompt.
  await desktop.click(lumiCard + " .catalog-card__art");
  await desktop.click('[data-product-id="lash-paradise"] .catalog-card__art');
  assert.equal(await desktop.$eval("#pickedCount", node => node.textContent), "2 saved");
  await desktop.type("#userInput", "Draft a separate question");
  const beforeGeneration = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.click("#generateRoutineAI");
  await desktop.waitForFunction(previous => window.__mockRequests.length === previous + 1, {}, beforeGeneration);
  await desktop.waitForFunction(() => document.querySelector("#generateRoutineAI").disabled === false &&
    document.querySelector(".chat-window .message.ai:last-child:not(.pending)") !== null);
  const generated = await desktop.evaluate(() => {
    const req = window.__mockRequests.at(-1);
    return {
      request: req,
      lastQuestion: req.messages.at(-1).content,
      transcript: document.querySelector("#chatWindow").textContent,
      feedback: document.querySelector("#routineFeedback").textContent,
      draft: document.querySelector("#userInput").value,
      busy: document.querySelector("#generateRoutineAI").disabled,
      count: document.querySelector("#pickedCount").textContent
    };
  });
  assert.ok(generated.request.messages.length <= 12, "Worker request has at most 12 messages");
  assert.ok(generated.request.messages.every(m => m.content.length <= 1000), "Each Worker message stays within limits");
  assert.ok(generated.request.messages.every(m => ["user","assistant"].includes(m.role)), "No browser-supplied system role");
  assert.match(generated.lastQuestion, /Generate a personalized L'Oréal Paris makeup routine/);
  assert.match(generated.lastQuestion, /main goal: definition/);
  assert.match(generated.lastQuestion, /polished/);
  const selectedReference = generated.request.messages.map(m => m.content).join("\n");
  assert.match(selectedReference, /True Match Lumi Glotion Glow Enhancer/);
  assert.match(selectedReference, /Voluminous Lash Paradise Washable Mascara/);
  assert.match(selectedReference, /lorealparisusa.com\/makeup/);
  assert.match(selectedReference, /Sheer glow enhancer/);
  assert.match(generated.transcript, /Your L’Oréal routine/, "Generated AI response shows in the chat");
  assert.match(generated.feedback, /ready in the Beauty Concierge chat/);
  assert.equal(generated.draft, "Draft a separate question", "Generating must not erase a typed chat draft");
  assert.equal(generated.busy, false, "Generate button is reenabled after a response");
  assert.equal(generated.count, "2 saved", "Selected products remain saved after generation");

  // Follow-Up Chat: the NEXT request must remember the previous routine,
  // its original selected products, and the earlier model response.
  assert.equal(await desktop.$eval("#followUpSuggestions", node => node.hidden), false);
  const beforeFollowUp = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.click("#followUpSuggestions button[data-followup]");
  await desktop.waitForFunction(n => window.__mockRequests.length === n + 1, {}, beforeFollowUp);
  await desktop.waitForFunction(() => document.querySelector("#sendBtn").disabled === false);
  const followUpRequest = await desktop.evaluate(() => ({
    messages: window.__mockRequests.at(-1).messages,
    draft: document.querySelector("#userInput").value,
    suggestionsVisible: !document.querySelector("#followUpSuggestions").hidden
  }));
  assert.match(followUpRequest.messages.at(-1).content, /Which of the products or steps we just discussed/);
  assert.ok(followUpRequest.messages.some(m => m.content.includes("Lumi Glotion Glow Enhancer")));
  assert.ok(followUpRequest.messages.some(m => m.content.includes("Lash Paradise Washable Mascara")));
  assert.ok(followUpRequest.messages.some(m => m.role === "assistant" &&
    m.content.includes("Your L’Oréal routine")), "Include the prior AI response");
  assert.ok(followUpRequest.messages.length <= 12);
  assert.ok(followUpRequest.messages.every(m => m.content.length <= 1000 && m.role !== "system"));
  assert.equal(followUpRequest.suggestionsVisible, true);
  assert.equal(followUpRequest.draft, "Draft a separate question",
    "Clicking a suggested follow-up preserves a separate typed draft");

  // New chat must forget the previous generated routine entirely.
  await desktop.click("#resetBtn");
  assert.equal(await desktop.$eval("#followUpSuggestions", node => node.hidden), true);
  const beforeFreshChat = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.focus("#userInput");
  await desktop.type("#userInput", "What L’Oréal products suit dry hair?");
  await desktop.click("#sendBtn");
  await desktop.waitForFunction(n => window.__mockRequests.length === n + 1, {}, beforeFreshChat);
  await desktop.waitForFunction(() => document.querySelector("#sendBtn").disabled === false);
  const newChatRequest = await desktop.evaluate(() => window.__mockRequests.at(-1).messages);
  assert.equal(newChatRequest.length, 1);
  assert.doesNotMatch(JSON.stringify(newChatRequest), /Lumi Glotion|Lash Paradise/);
  assert.equal(await desktop.$eval("#followUpSuggestions", node => node.hidden), false);

  // Save Selected Products: persist across reload, remove one, or clear all.
  const storageKey = "beauty-atelier:selected-products:v1";
  const priorSaved = await desktop.evaluate(key => ({
    saved: JSON.parse(localStorage.getItem(key)),
    count: document.querySelector("#pickedCount").textContent,
    clearDisabled: document.querySelector("#clearSelectedProducts").disabled
  }), storageKey);
  assert.deepEqual(priorSaved, {
    saved: ["lumi-glotion", "lash-paradise"],
    count: "2 saved",
    clearDisabled: false
  });
  await desktop.reload({ waitUntil: "domcontentloaded" });
  const restored = await desktop.evaluate(() => ({
    count: document.querySelector("#pickedCount").textContent,
    chips: [...document.querySelectorAll("#chosenProducts .saved-chip")].map(button => button.textContent),
    clearDisabled: document.querySelector("#clearSelectedProducts").disabled
  }));
  assert.equal(restored.count, "2 saved", "Selections survive a full page reload");
  assert.equal(restored.chips.length, 2);
  assert.ok(restored.chips.some(name => name.includes("Lumi Glotion")));
  assert.ok(restored.chips.some(name => name.includes("Lash Paradise")));
  assert.equal(restored.clearDisabled, false);

  await desktop.select("#routineFocus", "makeup");
  const selectedAfterReload = await desktop.evaluate(() => ({
    lumi: document.querySelector('[data-product-id="lumi-glotion"]').classList.contains("catalog-card--selected"),
    mascara: document.querySelector('[data-product-id="lash-paradise"]').querySelector(".catalog-card__pick").getAttribute("aria-pressed")
  }));
  assert.deepEqual(selectedAfterReload, {lumi:true, mascara:"true"}, "Card highlights restore with saved selection");

  // Restored products are not just decorative: AI generation includes them.
  const requestCountAfterReload = await desktop.evaluate(() => window.__mockRequests.length);
  await desktop.click("#generateRoutineAI");
  await desktop.waitForFunction(n => window.__mockRequests.length === n + 1, {}, requestCountAfterReload);
  await desktop.waitForFunction(() => document.querySelector("#generateRoutineAI").disabled === false);
  const restoredGenerationPayload = await desktop.evaluate(() =>
    window.__mockRequests.at(-1).messages.map(message => message.content).join("\n"));
  assert.match(restoredGenerationPayload, /Lumi Glotion Glow Enhancer/);
  assert.match(restoredGenerationPayload, /Lash Paradise Washable Mascara/);

  await desktop.click("#chosenProducts .saved-chip");
  const afterSingleRemove = await desktop.evaluate(key => ({
    saved:JSON.parse(localStorage.getItem(key)),
    count:document.querySelector("#pickedCount").textContent,
    remaining:document.querySelector("#chosenProducts").textContent
  }), storageKey);
  assert.deepEqual(afterSingleRemove.saved, ["lash-paradise"]);
  assert.equal(afterSingleRemove.count, "1 saved");
  assert.match(afterSingleRemove.remaining, /Lash Paradise/);
  await desktop.reload({ waitUntil:"domcontentloaded" });
  assert.equal(await desktop.$eval("#pickedCount", el => el.textContent), "1 saved",
    "Removed products must not come back after reload");

  await desktop.click("#clearSelectedProducts");
  const afterClearAll = await desktop.evaluate(key => ({
    storage:localStorage.getItem(key),
    count:document.querySelector("#pickedCount").textContent,
    chips:document.querySelectorAll("#chosenProducts .saved-chip").length,
    clearDisabled:document.querySelector("#clearSelectedProducts").disabled,
    feedback:document.querySelector("#routineFeedback").textContent
  }), storageKey);
  assert.equal(afterClearAll.storage, null, "Clear All removes the storage entry");
  assert.equal(afterClearAll.count, "0 saved");
  assert.equal(afterClearAll.chips, 0);
  assert.equal(afterClearAll.clearDisabled, true);
  assert.match(afterClearAll.feedback, /All saved products cleared/);
  await desktop.reload({waitUntil:"domcontentloaded"});
  assert.equal(await desktop.$eval("#pickedCount", el => el.textContent), "0 saved",
    "Clear All must persist after reload");
  assert.equal(await desktop.$eval("#clearSelectedProducts", el => el.disabled), true);

  await desktop.screenshot({ path: "/tmp/final-beauty-desktop.png", fullPage: true });
  await desktop.close();

  // Emulate an actual touchscreen: viewport width alone does NOT reproduce
  // mobile pointer media queries and touch keyboard-focused flows.
  const mobile = await setupPage(375, 812, true, true);
  const mobileState = await mobile.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    previewDisplay: getComputedStyle(document.querySelector("#questionPreview")).display,
    motionDisplay: getComputedStyle(document.querySelector("#motionToggle")).display,
    heroVisible: !!document.querySelector(".hero-story h1"),
    prompts: document.querySelectorAll(".quick-prompts button").length,
    secondaryNavDisplay: getComputedStyle(document.querySelector(".header-nav__ritual")).display,
    touchPointer: matchMedia("(pointer: coarse)").matches
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
  assert.equal(mobileState.touchPointer, true, "Mobile test must emulate a real touch device");

  // Reported mobile bug: Start Consultation focused a hidden composer, opened
  // the keyboard, and left the actual question field below the visible screen.
  await mobile.click("#startConsultation");
  const chatEntry = await mobile.evaluate(() => {
    const rect = document.querySelector("#chatForm").getBoundingClientRect();
    return {
      top: rect.top, bottom: rect.bottom, viewport: innerHeight,
      inputFocused: document.activeElement?.id === "userInput",
      formVisible: getComputedStyle(document.querySelector("#chatForm")).display !== "none"
    };
  });
  assert.equal(chatEntry.inputFocused, false,
    "Start Consultation must not pop the phone keyboard before the input is visible");
  assert.equal(chatEntry.formVisible, true, "Chat form must remain displayed");
  assert.ok(chatEntry.top >= 0 && chatEntry.bottom <= chatEntry.viewport,
    "Start Consultation must scroll the composer into the visible mobile viewport: " + JSON.stringify(chatEntry));

  await mobile.focus("#userInput");
  const singleOutline = await mobile.evaluate(() => ({
    inner: getComputedStyle(document.querySelector(".chat-form input")).outlineStyle,
    outer: getComputedStyle(document.querySelector(".chat-form")).outlineStyle
  }));
  assert.equal(singleOutline.inner, "none", "No duplicate inner focus border");
  assert.equal(singleOutline.outer, "solid", "One visible outer keyboard focus ring");

  await sendQuestion(mobile, "Recommend L’Oréal products for dry skin");
  const mobileConversation = await mobile.evaluate(() => {
    const chat = document.querySelector("#chatWindow");
    return {
      overflow:document.documentElement.scrollWidth - innerWidth,
      replyVisible:document.querySelectorAll(".chat-window .message.ai:not(.pending)").length === 2,
      readingMode:document.querySelector("#concierge").classList.contains("advisor--focus"),
      transcriptHeight:chat.getBoundingClientRect().height,
      transcriptOverflow:getComputedStyle(chat).overflowY,
      composerTop:document.querySelector(".advisor__composer").getBoundingClientRect().top,
      chatBottom:chat.getBoundingClientRect().bottom
    };
  });
  assert.ok(mobileConversation.overflow <= 2, "Mobile chat overflow: " + mobileConversation.overflow);
  assert.equal(mobileConversation.replyVisible, true);
  assert.equal(mobileConversation.readingMode, false,
    "Sending a message must NOT automatically take over the phone screen");
  assert.ok(mobileConversation.transcriptHeight >= 380 && mobileConversation.transcriptHeight <= 470,
    "Phone transcript must be comfortable to read without being oversized");
  assert.equal(mobileConversation.transcriptOverflow, "auto",
    "Long replies scroll inside their own readable chat panel");
  assert.ok(mobileConversation.composerTop >= mobileConversation.chatBottom - 2,
    "The mobile composer must not overlap the conversation");
  await mobile.screenshot({ path: "/tmp/final-beauty-mobile.png", fullPage: true });

  // New Chat should also clear the conversation without reopening the keyboard
  // over the composer on phones.
  await mobile.click("#resetBtn");
  const afterReset = await mobile.evaluate(() => {
    const rect = document.querySelector("#chatForm").getBoundingClientRect();
    return {
      focused: document.activeElement?.id === "userInput",
      top: rect.top, bottom: rect.bottom, viewport: innerHeight,
      messages: document.querySelectorAll(".chat-window .message").length
    };
  });
  assert.equal(afterReset.focused, false, "New Chat should not auto-focus the mobile keyboard");
  assert.equal(afterReset.messages, 1, "New Chat resets to the welcome message");
  assert.equal(await mobile.$eval("#concierge",
    el => el.classList.contains("advisor--focus")), false,
    "New Chat returns the reader to the normal page");
  assert.ok(afterReset.top >= 0 && afterReset.bottom <= afterReset.viewport,
    "New Chat must leave the mobile composer visible");

  // On touch devices, tapping View Details must NOT trigger the card
  // selection overlay, and text must remain visible in the expanded panel.
  const mobileCountBeforeDetails = await mobile.$eval("#pickedCount", node => node.textContent);
  await mobile.click('[data-product-id="radiant-cleanser"] .catalog-card__details-toggle');
  const phoneDetail = await mobile.evaluate(() => {
    const card = document.querySelector('[data-product-id="radiant-cleanser"]');
    const panel = card.querySelector(".catalog-card__details");
    return {
      expanded:card.querySelector(".catalog-card__details-toggle").getAttribute("aria-expanded"),
      visible:!panel.hidden && getComputedStyle(panel).display !== "none",
      description:panel.textContent,
      count:document.querySelector("#pickedCount").textContent,
      selected:card.classList.contains("catalog-card--selected"),
      overflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.equal(phoneDetail.expanded, "true");
  assert.equal(phoneDetail.visible, true);
  assert.match(phoneDetail.description, /Cream cleanser with a gentle smoothing/);
  assert.equal(phoneDetail.selected, false);
  assert.equal(phoneDetail.count, mobileCountBeforeDetails);
  assert.ok(phoneDetail.overflow <= 2, "Expanded mobile details should not cause horizontal overflow");
  await mobile.click('[data-product-id="radiant-cleanser"] .catalog-card__details-toggle');
  assert.equal(await mobile.$eval('[data-product-id="radiant-cleanser"] .catalog-card__details', el => el.hidden), true);

  // Search sources remain readable and tappable on a real touchscreen.
  await mobile.click("#webSearchToggle");
  const mobileSearchBefore = await mobile.evaluate(() => window.__mockRequests.length);
  await mobile.focus("#userInput");
  await mobile.type("#userInput", "What is new from L'Oréal Paris?");
  await mobile.click("#sendBtn");
  await mobile.waitForFunction(before => window.__mockRequests.length === before + 1, {}, mobileSearchBefore);
  await mobile.waitForFunction(() => document.querySelector("#sendBtn").disabled === false);
  const mobileCitations = await mobile.evaluate(() => ({
    inline: document.querySelector(".chat-window .message.ai:last-child .chat-inline-citation")?.textContent,
    link: document.querySelector(".chat-window .message.ai:last-child .chat-source-link")?.href,
    overflow: document.documentElement.scrollWidth - innerWidth
  }));
  assert.equal(mobileCitations.inline, "[1]");
  assert.match(mobileCitations.link, /^https:\/\/www\.lorealparisusa\.com\//);
  assert.ok(mobileCitations.overflow <= 2);
  assert.equal(await mobile.$eval("#concierge",
    el => el.classList.contains("advisor--focus")), false,
    "Live-search results should remain inside the normal-sized chat");
  // Full-window reading is still available on purpose, and keeps source links.
  await mobile.click("#expandChatBtn");
  const mobileFocus = await mobile.evaluate(() => ({
    full:document.querySelector("#concierge").classList.contains("advisor--focus"),
    panelHeight:document.querySelector("#concierge").getBoundingClientRect().height,
    areaHeight:document.querySelector("#chatWindow").getBoundingClientRect().height,
    sources:document.querySelector("#chatWindow").querySelectorAll(".chat-source-link").length,
    overflow:document.documentElement.scrollWidth - innerWidth
  }));
  assert.equal(mobileFocus.full,true);
  assert.ok(mobileFocus.panelHeight >= 800,
    "Mobile focus mode should occupy the entire phone viewport");
  assert.ok(mobileFocus.areaHeight > 250);
  assert.ok(mobileFocus.sources > 0);
  assert.ok(mobileFocus.overflow <= 2);
  await mobile.keyboard.press("Escape");
  assert.equal(await mobile.$eval("#concierge",
    el => el.classList.contains("advisor--focus")),false);

  await mobile.click("#webSearchToggle");

  // Product searching also works on narrow touchscreens, alongside categories.
  await mobile.select("#productCategory", "all");
  await mobile.focus("#productSearch");
  await mobile.type("#productSearch", "oily shampoo");
  const mobileMatches = await mobile.evaluate(() => ({
    ids:[...document.querySelectorAll("#productGrid .catalog-card")].map(card => card.dataset.productId),
    overflow:document.documentElement.scrollWidth - innerWidth,
    clearVisible:!document.querySelector("#clearProductSearch").hidden
  }));
  assert.ok(mobileMatches.ids.includes("pure-shampoo"));
  assert.ok(mobileMatches.ids.every(id => id.includes("shampoo")));
  assert.equal(mobileMatches.clearVisible, true);
  assert.ok(mobileMatches.overflow <= 2, "Product search must not overflow on mobile");
  await mobile.select("#productCategory", "skincare");
  assert.equal(await mobile.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length), 0);
  await mobile.click("#clearProductSearch");
  assert.equal(await mobile.$eval("#productCategory", el => el.value), "skincare");
  assert.ok(await mobile.$eval("#productGrid", el => el.querySelectorAll(".catalog-card").length) > 0);

  // Finger taps use the same card-wide hit area at phone widths.
  await mobile.click('[data-product-id="radiant-cleanser"] .catalog-card__art');
  const mobileSelected = await mobile.evaluate(() => ({
    selected: document.querySelector('[data-product-id="radiant-cleanser"]').classList.contains("catalog-card--selected"),
    count: document.querySelector("#pickedCount").textContent,
    chip: document.querySelector("#chosenProducts").textContent.includes("Radiant Smoothing")
  }));
  assert.deepEqual(mobileSelected, {selected:true,count:"1 saved",chip:true});

  // The touch workflow also submits selected product details to the Worker.
  const mobileBefore = await mobile.evaluate(() => window.__mockRequests.length);
  await mobile.click("#generateRoutineAI");
  await mobile.waitForFunction(previous => window.__mockRequests.length === previous + 1, {}, mobileBefore);
  await mobile.waitForFunction(() => document.querySelector("#generateRoutineAI").disabled === false);
  const mobileGenerated = await mobile.evaluate(() => ({
    payload:window.__mockRequests.at(-1).messages.map(m => m.content).join("\n"),
    text:document.querySelector("#chatWindow").textContent,
    button:document.querySelector("#generateRoutineAI").textContent
  }));
  assert.match(mobileGenerated.payload, /RevitaLift Radiant Smoothing Cream Cleanser/);
  assert.match(mobileGenerated.text, /Your L’Oréal routine/);
  assert.match(mobileGenerated.button, /GENERATE ROUTINE/);

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

  // Browser translation drives RTL automatically. No website language selector,
  // no English/Arabic toggle, no manually chosen or persisted language state.
  // Simulate the DOM signals Chrome/Edge translators expose, without requiring
  // a third-party translation service during automated browser tests.
  const rtlDesktop = await setupPage(1440, 900);
  // Puppeteer pages share a browser profile. Isolate saved-product fixtures
  // from the prior mobile test so a click starts with an unselected card.
  await rtlDesktop.evaluate(() => localStorage.removeItem("beauty-atelier:selected-products:v1"));
  await rtlDesktop.reload({waitUntil:"domcontentloaded"});
  assert.equal(await rtlDesktop.$("#languageDirection"), null, "The page must not have a custom language selector");
  await rtlDesktop.evaluate(() => document.documentElement.classList.add("translated-rtl"));
  await rtlDesktop.waitForFunction(() => document.documentElement.dir === "rtl");
  const rtlLayout = await rtlDesktop.evaluate(() => {
    const grid = document.querySelector("#productGrid");
    const cards = [...grid.querySelectorAll(".catalog-card")];
    const catalog = document.querySelector(".catalog-panel");
    const sidebar = document.querySelector(".builder-side");
    const chat = document.querySelector("#chatWindow");
    return {
      dir:document.documentElement.dir,
      lang:document.documentElement.lang,
      customLanguageControls:document.querySelectorAll("#languageDirection,.language-switch").length,
      gridDirection:getComputedStyle(grid).direction,
      savedDirection:getComputedStyle(document.querySelector("#chosenProducts")).direction,
      chatDirection:getComputedStyle(chat).direction,
      firstCardX:cards[0].getBoundingClientRect().x,
      secondCardX:cards[1].getBoundingClientRect().x,
      catalogX:catalog.getBoundingClientRect().x,
      sidebarX:sidebar.getBoundingClientRect().x,
      overflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.equal(rtlLayout.dir, "rtl");
  assert.equal(rtlLayout.lang, "en", "Page language is not overwritten by the website");
  assert.equal(rtlLayout.customLanguageControls, 0);
  assert.equal(rtlLayout.gridDirection, "rtl");
  assert.equal(rtlLayout.savedDirection, "rtl");
  assert.equal(rtlLayout.chatDirection, "rtl");
  assert.ok(rtlLayout.firstCardX > rtlLayout.secondCardX, "Product grid columns mirror right to left");
  assert.ok(rtlLayout.catalogX > rtlLayout.sidebarX, "RTL catalog and sidebar mirror their positions");
  assert.ok(rtlLayout.overflow <= 2, "RTL desktop layout must not scroll horizontally");

  // The existing card selection + saved chips remain functional in RTL.
  await rtlDesktop.click('[data-product-id="radiant-cleanser"] .catalog-card__art');
  await rtlDesktop.click('[data-product-id="glycolic-cleanser"] .catalog-card__art');
  const rtlSaved = await rtlDesktop.evaluate(() => {
    const chips = [...document.querySelectorAll("#chosenProducts .saved-chip")];
    return {
      count:document.querySelector("#pickedCount").textContent,
      chips:chips.length,
      firstX:chips[0].getBoundingClientRect().x,
      secondX:chips[1].getBoundingClientRect().x,
      firstY:chips[0].getBoundingClientRect().y,
      secondY:chips[1].getBoundingClientRect().y,
      containerRight:document.querySelector("#chosenProducts").getBoundingClientRect().right,
      firstRight:chips[0].getBoundingClientRect().right,
      pressed:document.querySelector('[data-product-id="radiant-cleanser"] .catalog-card__pick')
        .getAttribute("aria-pressed")
    };
  });
  assert.equal(rtlSaved.count, "2 saved");
  assert.equal(rtlSaved.chips, 2);
  assert.ok(Math.abs(rtlSaved.firstRight - rtlSaved.containerRight) < 5,
    "The first selected chip starts at the right edge");
  assert.ok(Math.abs(rtlSaved.firstY - rtlSaved.secondY) < 5
    ? rtlSaved.firstX > rtlSaved.secondX
    : rtlSaved.firstY < rtlSaved.secondY,
    "RTL saved chips progress right-to-left, or wrap to the next row");
  assert.equal(rtlSaved.pressed, "true");

  await rtlDesktop.focus("#userInput");
  await rtlDesktop.type("#userInput", "ما أفضل روتين من لوريال للبشرة الجافة؟");
  await rtlDesktop.click("#sendBtn");
  await rtlDesktop.waitForFunction(() =>
    document.querySelectorAll(".chat-window .message.ai:not(.pending)").length === 2);
  const rtlChat = await rtlDesktop.evaluate(() => {
    const chat = document.querySelector("#chatWindow");
    const ai = chat.querySelector(".message.ai");
    const user = chat.querySelector(".message.user");
    const send = document.querySelector("#sendBtn");
    const input = document.querySelector("#userInput");
    return {
      messageCount:chat.querySelectorAll(".message").length,
      aiX:ai.getBoundingClientRect().x,
      userX:user.getBoundingClientRect().x,
      userDir:user.getAttribute("dir"),
      userLang:user.getAttribute("lang"),
      aiLang:ai.getAttribute("lang"),
      sendX:send.getBoundingClientRect().x,
      inputX:input.getBoundingClientRect().x,
      overflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.equal(rtlChat.messageCount, 3);
  assert.ok(rtlChat.aiX > rtlChat.userX, "AI bubble starts on right, user bubble on left");
  assert.equal(rtlChat.userDir, "auto", "Arabic message controls its own reading direction");
  assert.equal(rtlChat.userLang, "ar");
  assert.equal(rtlChat.aiLang, "en", "English brand copy retains English screen-reader language");
  assert.ok(rtlChat.sendX < rtlChat.inputX, "RTL chat composer mirrors send button and input");
  assert.ok(rtlChat.overflow <= 2);

  // Clicking "Show original" in Chrome removes its translated-rtl class.
  // Both layout and chat geometry must switch back without losing state.
  await rtlDesktop.evaluate(() => document.documentElement.classList.remove("translated-rtl"));
  await rtlDesktop.waitForFunction(() => document.documentElement.getAttribute("dir") === null);
  const switchedBack = await rtlDesktop.evaluate(() => ({
    dir:getComputedStyle(document.documentElement).direction,
    lang:document.documentElement.lang,
    chat:document.querySelectorAll(".chat-window .message").length,
    saved:document.querySelector("#pickedCount").textContent,
    gridDirection:getComputedStyle(document.querySelector("#productGrid")).direction
  }));
  assert.deepEqual(switchedBack, {dir:"ltr",lang:"en",chat:3,saved:"2 saved",gridDirection:"ltr"});

  // Edge/other translators may change lang without adding a translated class.
  await rtlDesktop.evaluate(() => document.documentElement.lang = "ar");
  await rtlDesktop.waitForFunction(() => document.documentElement.dir === "rtl");
  await rtlDesktop.evaluate(() => document.documentElement.lang = "en");
  await rtlDesktop.waitForFunction(() => document.documentElement.getAttribute("dir") === null);

  // Some translators only replace visible text; two static translated headings
  // are enough to trigger RTL. An Arabic *chat message alone* must not.
  const headings = await rtlDesktop.evaluate(() => {
    const a = document.querySelector("#advisorTitle");
    const b = document.querySelector(".catalog-header h3");
    const original = [a.textContent, b.textContent];
    a.textContent = "مستشار الجمال";
    b.textContent = "اكتشف المجموعة";
    return original;
  });
  await rtlDesktop.waitForFunction(() => document.documentElement.dir === "rtl");
  await rtlDesktop.evaluate(originals => {
    document.querySelector("#advisorTitle").textContent = originals[0];
    document.querySelector(".catalog-header h3").textContent = originals[1];
  }, headings);
  await rtlDesktop.waitForFunction(() => document.documentElement.getAttribute("dir") === null);

  // A browser-supplied dir=rtl always works even without the Chrome class.
  await rtlDesktop.evaluate(() => document.documentElement.dir = "rtl");
  assert.equal(await rtlDesktop.$eval("#chosenProducts", el => getComputedStyle(el).direction), "rtl");
  await rtlDesktop.evaluate(() => document.documentElement.removeAttribute("dir"));

  // The only persisted setting is the visitor's saved products, not a
  // custom language preference; browser translation is external to this app.
  await rtlDesktop.evaluate(() => document.documentElement.classList.add("translated-rtl"));
  await rtlDesktop.waitForFunction(() => document.documentElement.dir === "rtl");
  await rtlDesktop.screenshot({path:"/tmp/beauty-rtl-desktop.png",fullPage:true});
  await rtlDesktop.reload({waitUntil:"domcontentloaded"});
  assert.equal(await rtlDesktop.$eval("html", el => el.getAttribute("dir")), null);
  assert.equal(await rtlDesktop.$eval("#pickedCount", el => el.textContent), "2 saved");
  assert.equal(await rtlDesktop.$eval("html", el => localStorage.getItem("beauty-atelier:layout-language:v1")), null);
  await rtlDesktop.close();

  // RTL mobile: Chrome's native Translate marker changes layout without
  // adding any app-owned controls; touch interactions remain functional.
  const rtlMobile = await setupPage(375, 812, true, true);
  await rtlMobile.evaluate(() => localStorage.removeItem("beauty-atelier:selected-products:v1"));
  await rtlMobile.reload({waitUntil:"domcontentloaded"});
  await rtlMobile.evaluate(() => document.documentElement.classList.add("translated-rtl"));
  await rtlMobile.waitForFunction(() => document.documentElement.dir === "rtl");
  const mobileRtlState = await rtlMobile.evaluate(() => {
    const grid = document.querySelector("#productGrid");
    return {
      dir:document.documentElement.dir,
      gridDirection:getComputedStyle(grid).direction,
      chatDirection:getComputedStyle(document.querySelector("#chatWindow")).direction,
      chosenDirection:getComputedStyle(document.querySelector("#chosenProducts")).direction,
      customLanguageControls:document.querySelectorAll("#languageDirection,.language-switch").length,
      overflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.equal(mobileRtlState.dir, "rtl");
  assert.equal(mobileRtlState.gridDirection, "rtl");
  assert.equal(mobileRtlState.chatDirection, "rtl");
  assert.equal(mobileRtlState.chosenDirection, "rtl");
  assert.equal(mobileRtlState.customLanguageControls, 0);
  assert.ok(mobileRtlState.overflow <= 2, "375px RTL mobile page must not overflow");
  await rtlMobile.click('[data-product-id="radiant-cleanser"] .catalog-card__art');
  assert.equal(await rtlMobile.$eval("#pickedCount", el => el.textContent), "1 saved");
  await rtlMobile.click("#chosenProducts .saved-chip");
  assert.equal(await rtlMobile.$eval("#pickedCount", el => el.textContent), "0 saved");
  await rtlMobile.focus("#userInput");
  await rtlMobile.type("#userInput", "هل عند لوريال منتجات للشعر؟");
  await rtlMobile.click("#sendBtn");
  await rtlMobile.waitForFunction(() => document.querySelectorAll(".chat-window .message.user").length === 1);
  assert.equal(await rtlMobile.$eval(".chat-window .message.user", el => el.getAttribute("lang")), "ar");
  await rtlMobile.screenshot({path:"/tmp/beauty-rtl-mobile.png",fullPage:true});
  await rtlMobile.close();




  // Regression for the cramped Beauty Concierge screenshot (594x690):
  // suggestion controls used to consume nearly all the fixed-height card,
  // leaving only a ~40px strip where sourced answers should have appeared.
  const replyLayout = await setupPage(594, 690, true, true);
  await sendQuestion(replyLayout, "Help me find a L'Oréal fragrance.");
  await replyLayout.click("#webSearchToggle");
  await sendQuestion(replyLayout, "Latest L'Oréal Paris fragrances with sources?");
  const inlineReader = await replyLayout.evaluate(() => ({
    full:document.querySelector("#concierge").classList.contains("advisor--focus"),
    panelHeight:document.querySelector("#concierge").getBoundingClientRect().height,
    transcriptHeight:document.querySelector("#chatWindow").getBoundingClientRect().height
  }));
  assert.equal(inlineReader.full, false,
    "The reported 594×690 viewport must keep the chat inline after sending");
  assert.ok(inlineReader.panelHeight < 1050,
    "The whole narrow chat card must no longer dominate the page");
  assert.ok(inlineReader.transcriptHeight >= 360 && inlineReader.transcriptHeight <= 470,
    "The answer space should be compact but never collapsed");
  // Put the cited source into the scrollable transcript's viewing area.
  await replyLayout.evaluate(() => document.querySelector("#chatWindow .message.ai:last-child .chat-source-link")
    ?.scrollIntoView({block:"nearest",behavior:"instant"}));
  const replyGeometry = await replyLayout.evaluate(() => {
    const advisor = document.querySelector("#concierge");
    const chat = document.querySelector("#chatWindow");
    const composer = document.querySelector(".advisor__composer");
    const latest = chat.querySelector(".message.ai:last-child");
    const source = latest.querySelector(".chat-source-link");
    const chatBox = chat.getBoundingClientRect();
    const sourceBox = source?.getBoundingClientRect();
    return {
      advisorHeight:advisor.getBoundingClientRect().height,
      chatHeight:chatBox.height,
      chatScrollHeight:chat.scrollHeight,
      chatClientHeight:chat.clientHeight,
      chatOverflow:getComputedStyle(chat).overflowY,
      composerTop:composer.getBoundingClientRect().top,
      chatBottom:chatBox.bottom,
      sources:latest.querySelectorAll(".chat-source-link").length,
      sourceInside:!!sourceBox && sourceBox.top >= chatBox.top &&
        sourceBox.bottom <= chatBox.bottom + 2,
      initialPromptDisplay:getComputedStyle(document.querySelector("#miniPrompts")).display,
      followUpsVisible:!document.querySelector("#followUpSuggestions").hidden,
      overflow:document.documentElement.scrollWidth - innerWidth
    };
  });
  assert.ok(replyGeometry.chatHeight >= 360 && replyGeometry.chatHeight <= 470,
    "594px layout uses a manageable transcript rather than a huge scrolling page");
  assert.equal(replyGeometry.chatOverflow, "auto",
    "The answer pane scrolls without making the entire page giant");
  assert.ok(replyGeometry.advisorHeight < 1050,
    "The total narrow chat card stays proportionate");
  assert.ok(replyGeometry.chatScrollHeight >= replyGeometry.chatClientHeight,
    "Long messages remain scrollable rather than clipping");
  assert.ok(replyGeometry.composerTop >= replyGeometry.chatBottom - 2,
    "Composer may not overlap or conceal the conversation");
  assert.equal(replyGeometry.sources, 1);
  assert.equal(replyGeometry.sourceInside, true,
    "A source link can be scrolled into the visible answer pane");
  assert.equal(replyGeometry.initialPromptDisplay, "none",
    "One-time prompt choices should no longer crowd an active conversation");
  assert.equal(replyGeometry.followUpsVisible, true);
  assert.ok(replyGeometry.overflow <= 2,
    "Compact mobile conversation must not create sideways scrolling");
  // Expand is optional: opening and closing it keeps all citations intact.
  await replyLayout.click("#expandChatBtn");
  const manuallyExpanded = await replyLayout.evaluate(() => ({
    active:document.querySelector("#concierge").classList.contains("advisor--focus"),
    height:document.querySelector("#concierge").getBoundingClientRect().height,
    sources:document.querySelectorAll("#chatWindow .chat-source-link").length
  }));
  assert.equal(manuallyExpanded.active, true);
  assert.ok(manuallyExpanded.height >= 688);
  assert.ok(manuallyExpanded.sources > 0);
  await replyLayout.keyboard.press("Escape");
  assert.equal(await replyLayout.$eval("#concierge",
    el => el.classList.contains("advisor--focus")), false);
  await replyLayout.evaluate(() => document.querySelector("#chatWindow .message.ai:last-child")
    .scrollIntoView({block:"start",behavior:"instant"}));
  await replyLayout.waitForFunction(() => {
    const bubble = document.querySelector("#chatWindow .message.ai:last-child");
    const top = bubble?.getBoundingClientRect().top;
    return typeof top === "number" && top >= -4 && top < innerHeight;
  }, {timeout:5000});

  // A balanced chat transcript adapts to narrow phones and tablets.
  for (const width of [375, 320, 768]) {
    await replyLayout.setViewport({
      width, height:720, deviceScaleFactor:1, isMobile:true, hasTouch:true
    });
    const metrics = await replyLayout.evaluate(() => {
      const chat = document.querySelector("#chatWindow");
      return {
        chatHeight:chat.getBoundingClientRect().height,
        scroller:getComputedStyle(chat).overflowY,
        sources:chat.querySelectorAll(".chat-source-link").length,
        overflow:document.documentElement.scrollWidth - innerWidth
      };
    });
    assert.ok(metrics.chatHeight >= 360 && metrics.chatHeight <= 470,
      width + "px viewport must keep the chat comfortable and compact");
    assert.equal(metrics.scroller,"auto");
    assert.equal(metrics.sources,1);
    assert.ok(metrics.overflow <= 2,
      width + "px viewport must not scroll horizontally");
  }
  await replyLayout.setViewport({
    width:594,height:690,deviceScaleFactor:1,isMobile:true,hasTouch:true
  });
  await replyLayout.screenshot({path:"/tmp/beauty-chat-reply-visible.png",fullPage:true});
  await replyLayout.click("#resetBtn");
  assert.notEqual(await replyLayout.$eval("#miniPrompts", el => getComputedStyle(el).display),
    "none", "New Chat restores introductory prompt shortcuts");
  await replyLayout.close();

  // Reproduce a blocked Worker request on the phone and ensure that its
  // diagnostic can be expanded without exposing the visitor's message.
  const diagnosticsPhone = await setupPage(375, 812, true, true);
  await diagnosticsPhone.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (String(url).includes("loreal-beauty-advisor.elshamandy133.workers.dev")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return original(url, options);
    };
  });
  await diagnosticsPhone.click("#webSearchToggle");
  await diagnosticsPhone.focus("#userInput");
  await diagnosticsPhone.type("#userInput", "private question that must never be in diagnostics");
  await diagnosticsPhone.click("#sendBtn");
  await diagnosticsPhone.waitForFunction(() =>
    !document.querySelector("#requestDiagnostic").hidden);
  const diagnosticState = await diagnosticsPhone.evaluate(() => ({
    error:document.querySelector("#status").textContent,
    diagnostic:document.querySelector("#requestDiagnosticText").textContent,
    title:document.querySelector("#requestDiagnostic summary").textContent,
    overflow:document.documentElement.scrollWidth - innerWidth
  }));
  assert.match(diagnosticState.error, /Could not reach the Cloudflare Worker/);
  assert.match(diagnosticState.diagnostic, /Error code: NETWORK_OR_CORS/);
  assert.match(diagnosticState.diagnostic, /HTTP status: no response/);
  assert.doesNotMatch(diagnosticState.diagnostic, /private question/);
  assert.match(diagnosticState.title, /technical details/i);
  assert.ok(diagnosticState.overflow <= 2, "Mobile diagnostic must not cause overflow");
  await diagnosticsPhone.click("#requestDiagnostic summary");
  assert.equal(await diagnosticsPhone.$eval("#requestDiagnostic", el => el.open), true);
  await diagnosticsPhone.click("#resetBtn");
  assert.equal(await diagnosticsPhone.$eval("#requestDiagnostic", el => el.hidden), true,
    "New Chat removes stale error details");
  await diagnosticsPhone.close();

  assert.deepEqual(failures, [], "There must be no uncaught browser JavaScript errors");
  console.log("PASS: Real Chrome desktop + mobile smoke test");
  console.log("PASS: Prompt buttons, distinct chat bubbles, preview, context, New Chat, motion and accessible input");
  console.log("PASS: Touchscreen Start Consultation and New Chat show the composer without opening the keyboard");
  console.log("PASS: No unintended horizontal overflow at 1440px / 375px");
} finally {
  await browser.close();
}
