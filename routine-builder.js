// Beauty Atelier routine builder. No API key, package, or unofficial product API.
// The catalog is a small, reviewed snapshot of official L'Oréal Paris pages.
(function () {
  "use strict";
  const catalog = window.BeautyCatalog || [];
  const groups = ["cleanser", "serum", "moisturizer", "sunscreen"];
  const groupLabels = {
    cleanser: "Cleanse", serum: "Treat", moisturizer: "Moisturize", sunscreen: "Protect"
  };
  const normalize = value => String(value || "").toLowerCase().trim();

  // Pure logic is exposed for the lightweight built-in Node regression tests.
  function buildRoutine(profile, selectedIds = []) {
    const skin = normalize(profile.skin) || "normal";
    const concern = normalize(profile.concern) || "hydration";
    const time = normalize(profile.time) || "both";
    const selected = new Set(selectedIds);
    const notes = ["Patch-test new products and follow the instructions on the official packaging."];
    const isSensitive = skin === "sensitive";

    function candidates(group, period, chosenSerum) {
      return catalog
        .filter(product => product.group === group)
        .filter(product => product.time === "both" || product.time === period)
        .filter(product => !isSensitive || (!product.exfoliating && !product.strongActive))
        .filter(product => !(group === "cleanser" && chosenSerum?.exfoliating && product.exfoliating))
        .map(product => ({
          product,
          points: (selected.has(product.id) ? 30 : 0) +
            (product.concerns.includes(concern) ? 9 : 0) +
            (product.skins.includes(skin) ? 5 : 0) +
            (product.id === "radiant-cleanser" ? 2 : 0) +
            (product.id === "fragrance-free" && isSensitive ? 6 : 0)
        }))
        .sort((a, b) => b.points - a.points)
        .map(item => item.product);
    }

    function forPeriod(period) {
      const serum = candidates("serum", period)[0];
      const steps = [];
      // The order matters: cleanse, one treatment, moisturizer, AM SPF.
      for (const group of groups) {
        if (group === "sunscreen" && period === "pm") continue;
        const product = group === "serum" ? serum : candidates(group, period, serum)[0];
        if (product) steps.push({ group, label: groupLabels[group], product });
      }
      return steps;
    }

    const am = time !== "pm" ? forPeriod("am") : [];
    const pm = time !== "am" ? forPeriod("pm") : [];
    if (isSensitive) notes.push("For sensitive skin, the starter routine omits stronger acids; introduce products slowly.");
    if ([...am, ...pm].some(step => step.product.exfoliating)) {
      notes.push("Go slowly with exfoliating products, avoid stacking exfoliating steps, and protect your skin from the sun.");
    }
    if (am.length) notes.push("Apply broad-spectrum sunscreen as the last morning skincare step; reapply as directed on its label.");
    if (selected.size) {
      const included = new Set([...am, ...pm].map(step => step.product.id));
      if ([...selected].some(id => !included.has(id))) {
        notes.push("Some saved products were left out due to timing, skin sensitivity, or to keep the routine simple.");
      }
    }
    return { am, pm, notes, skin, concern, time };
  }

  function questionForRoutine(routine) {
    const parts = [
      "Please personalize and explain this L'Oréal Paris skincare routine using the real catalog products listed. Do not invent product claims or prices.",
      "My skin: " + routine.skin + ". My goal: " + routine.concern + ".",
      ...[["Morning", routine.am], ["Evening", routine.pm]]
        .filter(item => item[1].length)
        .map(item => item[0] + ": " + item[1].map(step => step.product.name).join("; ") + "."),
      "Give clear order and usage cautions. Ask one helpful follow-up."
    ];
    return parts.join("\n").slice(0, 1000);
  }

  window.BeautyRoutineLogic = Object.freeze({ buildRoutine, questionForRoutine });

  // Avoid running page UI setup in the pure-logic regression tests.
  const section = document.getElementById("routine-builder");
  if (!section) return;
  const grid = document.getElementById("productGrid");
  const search = document.getElementById("productSearch");
  const filter = document.getElementById("productCategory");
  const count = document.getElementById("productCount");
  const chosen = document.getElementById("chosenProducts");
  const pickedCount = document.getElementById("pickedCount");
  const skinSelect = document.getElementById("routineSkin");
  const concernSelect = document.getElementById("routineConcern");
  const timeSelect = document.getElementById("routineTime");
  const buildButton = document.getElementById("buildRoutine");
  const output = document.getElementById("routineResult");
  const announce = document.getElementById("routineStatus");
  const selected = new Set();
  let lastRoutine = null;

  function make(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announceText(text) { announce.textContent = text; }

  function productIcon(product) {
    const map = { cleanser: "ui-compact", serum: "ui-serum", moisturizer: "ui-hair", sunscreen: "ui-perfume" };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 80 80");
    svg.setAttribute("class", "beauty-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + map[product.group]);
    svg.appendChild(use);
    return svg;
  }

  function officialLink(product) {
    const link = make("a", "catalog-link", "Official product details ↗");
    link.href = product.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "View " + product.name + " on the official L'Oréal Paris site (opens new tab)");
    return link;
  }

  function askAbout(product) {
    const question = "Tell me about this real L'Oréal Paris product: " + product.name +
      ". Official listing summary: " + product.description +
      " Explain its place in a routine, who may prefer it, and any usage precautions. Don't invent claims.";
    askAI(question);
  }

  function askAI(question) {
    if (typeof window.sendMessage !== "function") {
      announceText("The AI chat is not ready. Please refresh the page.");
      return;
    }
    // The existing chat permits only one pending AI request at a time.
    if (document.getElementById("sendBtn").disabled) {
      announceText("The Beauty Concierge is answering another question. Try again when that reply finishes.");
      return;
    }
    const advisorPanel = document.getElementById("concierge");
    advisorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.sendMessage(question);
    announceText("Sent your product question to the Beauty Concierge.");
  }

  function renderSelection() {
    chosen.replaceChildren();
    pickedCount.textContent = selected.size + " saved";
    if (!selected.size) {
      chosen.appendChild(make("span", "selected-empty", "Save products you like, or let the builder choose for you."));
      return;
    }
    for (const id of selected) {
      const product = catalog.find(item => item.id === id);
      if (!product) continue;
      const chip = make("button", "saved-chip", product.name + " ×");
      chip.type = "button";
      chip.setAttribute("aria-label", "Remove " + product.name + " from saved products");
      chip.addEventListener("click", () => {
        selected.delete(id);
        renderSelection();
        renderCatalog();
        if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
        announceText(product.name + " removed from saved products.");
      });
      chosen.appendChild(chip);
    }
  }

  function renderCatalog() {
    const query = normalize(search.value);
    const category = filter.value;
    const filtered = catalog.filter(product =>
      (category === "all" || product.group === category) &&
      (!query || normalize(product.name + " " + product.family + " " + product.description).includes(query))
    );
    grid.replaceChildren();
    count.textContent = filtered.length + " of " + catalog.length + " verified products";
    if (!filtered.length) {
      grid.appendChild(make("p", "catalog-empty", "No matching products. Try a different search or category."));
      return;
    }
    for (const product of filtered) {
      const card = make("article", "catalog-card");
      const image = make("div", "catalog-card__art catalog-card__art--" + product.group);
      image.appendChild(productIcon(product));
      card.appendChild(image);
      card.appendChild(make("span", "catalog-card__eyebrow", product.family + "  /  " + product.group.toUpperCase()));
      card.appendChild(make("h3", "catalog-card__title", product.name));
      card.appendChild(make("p", "catalog-card__description", product.description));
      card.appendChild(officialLink(product));
      const actions = make("div", "catalog-card__actions");
      const save = make("button", "catalog-button catalog-button--save", selected.has(product.id) ? "✓ Saved" : "+ Save product");
      save.type = "button";
      save.setAttribute("aria-pressed", String(selected.has(product.id)));
      save.setAttribute("aria-label", (selected.has(product.id) ? "Remove " : "Save ") + product.name);
      save.addEventListener("click", () => {
        if (selected.has(product.id)) selected.delete(product.id);
        else selected.add(product.id);
        renderCatalog();
        renderSelection();
        if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
        announceText(product.name + (selected.has(product.id) ? " saved." : " removed."));
      });
      const ask = make("button", "catalog-button catalog-button--ask", "Ask AI ↗");
      ask.type = "button";
      ask.setAttribute("aria-label", "Ask the beauty assistant about " + product.name);
      ask.addEventListener("click", () => askAbout(product));
      actions.append(save, ask);
      card.appendChild(actions);
      grid.appendChild(card);
    }
  }

  function currentProfile() {
    return { skin: skinSelect.value, concern: concernSelect.value, time: timeSelect.value };
  }

  function routinePanel(period, steps) {
    const panel = make("div", "routine-result__panel");
    panel.appendChild(make("h4", "", period === "am" ? "☀ Morning ritual" : "☾ Evening ritual"));
    const list = make("ol", "routine-result__steps");
    for (const step of steps) {
      const item = make("li", "routine-result__step");
      const details = make("div", "routine-result__step-copy");
      details.appendChild(make("span", "routine-result__step-label", step.label));
      details.appendChild(make("strong", "", step.product.name));
      details.appendChild(make("small", "", step.product.description));
      item.appendChild(details);
      item.appendChild(officialLink(step.product));
      list.appendChild(item);
    }
    panel.appendChild(list);
    return panel;
  }

  function routineAsText(routine) {
    return [
      "MY BEAUTY ATELIER ROUTINE",
      "Skin: " + routine.skin + " | Goal: " + routine.concern,
      ...[["MORNING", routine.am], ["EVENING", routine.pm]]
        .filter(item => item[1].length)
        .flatMap(item => [item[0], ...item[1].map((step, index) =>
          (index + 1) + ". " + step.label + ": " + step.product.name + " (" + step.product.url + ")")]),
      ...routine.notes,
      "Independent educational demo. Always check official product directions."
    ].join("\n");
  }

  function renderRoutine(routine) {
    lastRoutine = routine;
    output.replaceChildren();
    const title = make("div", "routine-result__heading");
    title.appendChild(make("span", "routine-kicker", "THE PERSONAL EDIT / YOUR PLAN"));
    title.appendChild(make("h3", "", "Your ritual, thoughtfully curated."));
    title.appendChild(make("p", "", "Based on your " + routine.skin + " skin and " + routine.concern + " goal. Each product links to its official listing."));
    output.appendChild(title);
    const columns = make("div", "routine-result__columns");
    if (routine.am.length) columns.appendChild(routinePanel("am", routine.am));
    if (routine.pm.length) columns.appendChild(routinePanel("pm", routine.pm));
    output.appendChild(columns);
    const notes = make("ul", "routine-result__notes");
    for (const note of routine.notes) notes.appendChild(make("li", "", note));
    output.appendChild(notes);
    const actions = make("div", "routine-result__actions");
    const refine = make("button", "routine-primary", "REFINE WITH BEAUTY AI ↗");
    refine.type = "button";
    refine.addEventListener("click", () => askAI(questionForRoutine(routine)));
    const copy = make("button", "routine-secondary", "COPY MY ROUTINE");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(routineAsText(routine));
        announceText("Routine copied to clipboard.");
      } catch {
        announceText("Copy unavailable in this browser. You can still select the routine text.");
      }
    });
    actions.append(refine, copy);
    output.appendChild(actions);
  }

  search.addEventListener("input", renderCatalog);
  filter.addEventListener("change", renderCatalog);
  buildButton.addEventListener("click", () => {
    renderRoutine(buildRoutine(currentProfile(), [...selected]));
    announceText("Your custom routine is ready below.");
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  for (const input of [skinSelect, concernSelect, timeSelect]) {
    input.addEventListener("change", () => {
      if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
    });
  }
  renderCatalog();
  renderSelection();
})();
