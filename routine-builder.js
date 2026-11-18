// Beauty Atelier routine builder. No API key, package, or unofficial product API.
// The catalog is a small, reviewed snapshot of official L'Oréal Paris pages.
(function () {
  "use strict";
  const catalog = window.BeautyCatalog || [];
  const groups = ["cleanser", "serum", "moisturizer", "sunscreen"];
  const groupLabels = {
    cleanser: "Cleanse", serum: "Treat", moisturizer: "Moisturize", sunscreen: "Protect",
    shampoo: "Shampoo", conditioner: "Condition", "leave-in": "Leave-in care",
    base: "Complexion", eyes: "Eyes", lips: "Lips"
  };
  const normalize = value => String(value || "").toLowerCase().trim();
  const productType = product => product.type || "skincare";

  // Every recommendation comes from our curated official-page catalog.
  // Saved products get priority only within the matching beauty focus.
  function buildRoutine(profile, selectedIds = []) {
    const type = ["skincare", "haircare", "makeup"].includes(normalize(profile.type))
      ? normalize(profile.type) : "skincare";
    const skin = normalize(profile.skin) || (type === "makeup" ? "natural" : "normal");
    const concern = normalize(profile.concern) || (type === "makeup" ? "radiance" : "hydration");
    const time = type === "skincare" ? (normalize(profile.time) || "both") : type;
    const selected = new Set(selectedIds);
    const notes = ["Check each product's official directions and patch-test new formulas."];
    const isSensitive = type === "skincare" && skin === "sensitive";

    function choices(group, period, avoidExfoliating = false) {
      return catalog
        .filter(product => productType(product) === type && product.group === group)
        // Don't recommend a dry-hair leave-in for oily roots (or a shade/style
        // intended for a different makeup look) merely to fill every step.
        .filter(product => !["haircare", "makeup"].includes(type) || product.skins.includes(skin))
        .filter(product => type !== "skincare" || product.time === "both" || product.time === period)
        .filter(product => !isSensitive || (!product.exfoliating && !product.strongActive))
        .filter(product => !avoidExfoliating || !product.exfoliating)
        .map(product => ({
          product,
          points: (selected.has(product.id) ? 30 : 0) +
            (product.concerns.includes(concern) ? 9 : 0) +
            (product.skins.includes(skin) ? 8 : -5) +
            (product.id === "radiant-cleanser" ? 2 : 0) +
            (product.id === "fragrance-free" && isSensitive ? 8 : 0)
        }))
        .sort((a, b) => b.points - a.points)
        .map(item => item.product);
    }

    function step(group, product) {
      return product ? { group, label: groupLabels[group], product } : null;
    }

    function skinPeriod(period) {
      // Pick the treatment and cream before the cleanser so we can prevent
      // a strong acid serum + exfoliating cream + acid cleanser combination.
      const serum = choices("serum", period)[0];
      const moisturizer = choices("moisturizer", period, Boolean(serum?.exfoliating))[0];
      const activeTreatment = Boolean(serum?.exfoliating || moisturizer?.exfoliating);
      const cleanser = choices("cleanser", period, activeTreatment)[0];
      return [
        step("cleanser", cleanser), step("serum", serum),
        step("moisturizer", moisturizer),
        period === "am" ? step("sunscreen", choices("sunscreen", period)[0]) : null
      ].filter(Boolean);
    }

    let am = [];
    let pm = [];
    if (type === "skincare") {
      am = time !== "pm" ? skinPeriod("am") : [];
      pm = time !== "am" ? skinPeriod("pm") : [];
      if (isSensitive) notes.push("Sensitive-skin starter plan: stronger exfoliating acids are omitted. Introduce one new product at a time.");
      if ([...am, ...pm].some(s => s.product.exfoliating)) {
        notes.push("An exfoliating treatment is included. Start gradually and do not layer it with other acid treatments on the same occasion.");
      }
      if (am.length) notes.push("Use broad-spectrum SPF as the last skincare step each morning. Reapply as the label directs.");
    } else if (type === "haircare") {
      am = ["shampoo", "conditioner", "leave-in"]
        .map(group => step(group, choices(group, "am")[0]))
        .filter(Boolean);
      notes.push("These are wash-day steps, not a requirement to wash daily. Apply conditioner mainly to lengths and ends; follow package timing.");
      notes.push("Use leave-in treatments as directed after washing; frequency depends on hair needs.");
    } else {
      am = ["base", "eyes", "lips"]
        .map(group => step(group, choices(group, "am")[0]))
        .filter(Boolean);
      notes.push("Use moisturizer and daytime broad-spectrum SPF before makeup; remove makeup gently at the end of the day.");
      notes.push("Foundation and lipstick shades are not matched by this tool. Use official shade-finder and try-on guidance.");
    }

    if (selected.size) {
      const included = new Set([...am, ...pm].map(item => item.product.id));
      if ([...selected].some(id => !included.has(id))) {
        notes.push("Some saved products were left out because they belong to another focus, are not matched to your stated preferences, or conflict with the plan.");
      }
    }
    return { type, am, pm, notes, skin, concern, time };
  }

  function questionForRoutine(routine) {
    const labels = routine.type === "haircare"
      ? ["Wash day", ""] : routine.type === "makeup"
        ? ["Makeup look", ""] : ["Morning", "Evening"];
    const parts = [
      "Please explain and refine this L'Oréal Paris " + routine.type +
        " routine, using only these verified catalog product names. Do not invent product claims, shades, prices, or availability.",
      "My preference: " + routine.skin + ". My goal: " + routine.concern + ".",
      ...[[labels[0], routine.am], [labels[1], routine.pm]]
        .filter(item => item[0] && item[1].length)
        .map(item => item[0] + ": " + item[1].map(s => s.product.name).join("; ") + "."),
      "Explain step order, note any precautions, and ask one useful beauty-related follow-up."
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
  const focusSelect = document.getElementById("routineFocus");
  const skinSelect = document.getElementById("routineSkin");
  const skinLabel = document.getElementById("routineSkinLabel");
  const concernLabel = document.getElementById("routineConcernLabel");
  const timeField = document.getElementById("routineTimeField");
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
    const map = { cleanser:"ui-compact", serum:"ui-serum", moisturizer:"ui-hair", sunscreen:"ui-perfume", shampoo:"ui-hair", conditioner:"ui-hair", "leave-in":"ui-serum", base:"ui-compact", eyes:"ui-lipstick", lips:"ui-lipstick" };
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
      (category === "all" || product.group === category || productType(product) === category) &&
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
      card.appendChild(make("span", "catalog-card__eyebrow", product.family + "  /  " + productType(product).toUpperCase()));
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
    return { type: focusSelect.value, skin: skinSelect.value, concern: concernSelect.value, time: timeSelect.value };
  }

  function routinePanel(period, steps) {
    const panel = make("div", "routine-result__panel");
    panel.appendChild(make("h4", "", lastRoutine?.type === "haircare" ? "✦ Wash-day ritual" : lastRoutine?.type === "makeup" ? "✦ Your makeup edit" : period === "am" ? "☀ Morning ritual" : "☾ Evening ritual"));
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
      "Focus: " + routine.type + " | Preference: " + routine.skin + " | Goal: " + routine.concern,
      ...[[routine.type === "haircare" ? "WASH DAY" : routine.type === "makeup" ? "MAKEUP LOOK" : "MORNING", routine.am], ["EVENING", routine.pm]]
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
    const preferenceLabel = routine.type === "haircare" ? "hair" : routine.type === "makeup" ? "style" : "skin";
    title.appendChild(make("p", "", "Based on your " + routine.skin + " " + preferenceLabel + " preference and " + routine.concern + " goal. Every product links to its official listing."));
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

  // The same builder supports three distinct beauty journeys, with suitable
  // profile questions and a catalog filter that follows the chosen journey.
  const profileOptions = {
    skincare: {
      skinLabel: "WHAT IS YOUR SKIN TYPE?", concernLabel: "YOUR MAIN SKIN GOAL",
      skins: [["normal","Normal"],["dry","Dry"],["oily","Oily"],["combination","Combination"],["sensitive","Sensitive"]],
      concerns: [["hydration","Hydration & comfort"],["radiance","Radiance & dark spots"],["firmness","Fine lines & firmness"],["texture","Texture & uneven tone"]]
    },
    haircare: {
      skinLabel: "WHICH BEST DESCRIBES YOUR HAIR?", concernLabel: "YOUR HAIR GOAL",
      skins: [["dry","Dry/dehydrated"],["oily","Oily roots"],["damaged","Long or damage-prone"],["normal","Normal"]],
      concerns: [["hydration","Hydration"],["oil","Refresh oily roots"],["repair","Reduce breakage"]]
    },
    makeup: {
      skinLabel: "YOUR MAKEUP STYLE", concernLabel: "YOUR LOOK GOAL",
      skins: [["natural","Natural / everyday"],["polished","Polished / fuller coverage"]],
      concerns: [["radiance","Glow & radiance"],["definition","Definition & color"]]
    }
  };
  function fillOptions(select, options) {
    select.replaceChildren();
    for (const [value, label] of options) {
      const option = make("option", "", label);
      option.value = value;
      select.appendChild(option);
    }
  }
  function setFocus(type) {
    const config = profileOptions[type] || profileOptions.skincare;
    skinLabel.textContent = config.skinLabel;
    concernLabel.textContent = config.concernLabel;
    fillOptions(skinSelect, config.skins);
    fillOptions(concernSelect, config.concerns);
    timeField.hidden = type !== "skincare";
    search.value = "";
    filter.value = type;
    renderCatalog();
    if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
    announceText("Showing " + type + " products and preferences.");
  }
  focusSelect.addEventListener("change", () => setFocus(focusSelect.value));

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
  setFocus(focusSelect.value);
  renderSelection();
})();
