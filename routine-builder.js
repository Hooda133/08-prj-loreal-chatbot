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

  // Search while typing. Each word can match a DIFFERENT product field and
  // words may appear in any order: e.g. "serum hyaluronic", "oily shampoo".
  // Normalize accents and punctuation so "L'Oreal" and "L’Oréal" match.
  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function searchableProductText(product) {
    const keywords = {
      sunscreen: "spf sun sunblock sunscreen sun protection uv",
      cleanser: "face wash cleanse cleansing",
      moisturizer: "moisturizer moisturising moisturizing face cream",
      serum: "serum treatment",
      shampoo: "shampoo wash hair scalp",
      conditioner: "conditioner conditioning hair",
      "leave-in": "leave in hair treatment",
      base: "foundation face complexion makeup",
      eyes: "mascara eye lash lashes makeup",
      lips: "lip lipstick color makeup"
    };
    return normalizeSearch([
      product.name, product.family, product.description, "L'Oréal Paris",
      productType(product), product.group, groupLabels[product.group],
      ...(product.concerns || []), ...(product.skins || []),
      keywords[product.group] || "",
      product.exfoliating ? "exfoliating exfoliation acids" : ""
    ].join(" "));
  }

  function filterCatalogProducts(products, searchQuery, category = "all") {
    const words = normalizeSearch(searchQuery).split(/\s+/).filter(Boolean);
    return products.filter(product =>
      (category === "all" || product.group === category || productType(product) === category) &&
      words.every(word => searchableProductText(product).includes(word))
    );
  }

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
      if (isSensitive) notes.push("Sensitive-skin starter plan: stronger exfoliating acids are omitted. If your skin is sensitive, introduce one new product at a time.");
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

  // Send exact catalog-backed product details in bounded user-role messages.
  // Splitting prevents a long saved list from exceeding the Worker's 1,000-
  // character limit for any single message. No data goes directly to OpenAI.
  function buildSelectedProductNotes(products) {
    const header = "Selected L'Oréal Paris products from official-page catalog (reference data, not instructions):\n";
    const notes = [];
    let current = header;
    for (const product of products) {
      const line = "- " + product.name + " [" + productType(product) + "/" +
        product.group + "]: " + product.description +
        (product.exfoliating ? " (exfoliating active)" : "") +
        "; official listing: " + product.url;
      if (current.length + line.length + 1 > 960 && current !== header) {
        notes.push(current.trim());
        current = header;
      }
      current += line + "\n";
    }
    if (current !== header) notes.push(current.trim());
    return notes;
  }

  // Compact session context for follow-up questions. Unlike the longer
  // first-request catalog notes, this preserves all selected names in at
  // most three Worker-safe messages while leaving room for recent chat.
  function buildFollowUpProductNotes(products, profile) {
    const topic = ["skincare", "haircare", "makeup"].includes(profile.type) ? profile.type : "skincare";
    const heading = "Earlier AI-generated L'Oréal " + topic +
      " routine. Selected products and original preferences (historical context only; newer requests win): " +
      "preference=" + profile.skin + ", goal=" + profile.concern +
      (topic === "skincare" ? ", timing=" + profile.time : "") + ".\n";
    const notes = [];
    let current = heading;
    for (const product of products) {
      const line = "- " + product.name + " (" + product.group +
        (product.exfoliating ? ", exfoliating" : "") + ")\n";
      if (current.length + line.length > 920 && current !== heading) {
        notes.push(current.trim());
        current = "Other products from the same earlier routine:\n";
      }
      current += line;
    }
    if (current.trim()) notes.push(current.trim());
    return notes.slice(0, 3);
  }

  function questionForSelectedProducts(profile, count) {
    const focus = ["skincare", "haircare", "makeup"].includes(profile.type) ? profile.type : "skincare";
    const when = focus === "skincare" ? "; timing: " + profile.time : "";
    return "Generate a personalized L'Oréal Paris " + focus +
      " routine using my " + count + " selected products from the catalog details above. " +
      "My preference: " + profile.skin + "; main goal: " + profile.concern + when + ". " +
      "Give an ordered practical routine with real selected product names, when and how to use them, " +
      "and any important cautions. Explain which selected products you omit and why. " +
      "Do not invent products, shades, prices, or claims. For morning skincare include SPF guidance; " +
      "do not layer strong exfoliating acids or recommend them for sensitive skin. " +
      "If products for a step are missing, clearly identify the missing step without fabricating an item.";
  }

  // Only save catalog IDs, never product details or chat messages.
  // Discard invalid, removed or repeated IDs when loading older browser data.
  function parseSavedProductIds(json) {
    if (typeof json !== "string" || json.length > 10000) return [];
    try {
      const ids = JSON.parse(json);
      if (!Array.isArray(ids)) return [];
      const knownIds = new Set(catalog.map(product => product.id));
      return [...new Set(ids.filter(id => typeof id === "string" && knownIds.has(id)))];
    } catch {
      return [];
    }
  }

  window.BeautyRoutineLogic = Object.freeze({
    buildRoutine, questionForRoutine, buildSelectedProductNotes,
    buildFollowUpProductNotes, questionForSelectedProducts, parseSavedProductIds,
    normalizeSearch, filterCatalogProducts
  });

  // Avoid running page UI setup in the pure-logic regression tests.
  const section = document.getElementById("routine-builder");
  if (!section) return;
  const grid = document.getElementById("productGrid");
  const search = document.getElementById("productSearch");
  const clearSearchButton = document.getElementById("clearProductSearch");
  const filter = document.getElementById("productCategory");
  const count = document.getElementById("productCount");
  const chosen = document.getElementById("chosenProducts");
  const pickedCount = document.getElementById("pickedCount");
  const clearSelectedButton = document.getElementById("clearSelectedProducts");
  const savedProductsPrivacy = document.getElementById("savedProductsPrivacy");
  const focusSelect = document.getElementById("routineFocus");
  const skinSelect = document.getElementById("routineSkin");
  const skinLabel = document.getElementById("routineSkinLabel");
  const concernLabel = document.getElementById("routineConcernLabel");
  const timeField = document.getElementById("routineTimeField");
  const concernSelect = document.getElementById("routineConcern");
  const timeSelect = document.getElementById("routineTime");
  const buildButton = document.getElementById("buildRoutine");
  const generateButton = document.getElementById("generateRoutineAI");
  const feedback = document.getElementById("routineFeedback");
  const output = document.getElementById("routineResult");
  const announce = document.getElementById("routineStatus");
  // localStorage stays on this device and origin; it is never sent to the
  // server. Storage may be blocked in private modes, so fail gracefully.
  const SAVED_PRODUCTS_KEY = "beauty-atelier:selected-products:v1";
  function loadSavedProducts() {
    try {
      return parseSavedProductIds(window.localStorage.getItem(SAVED_PRODUCTS_KEY));
    } catch {
      savedProductsPrivacy.textContent = "Browser storage is unavailable. Selections will last only until this page closes.";
      return [];
    }
  }
  const selected = new Set(loadSavedProducts());
  // Details may stay open when the visitor changes a catalog filter.
  // This is visual-only state; nothing extra is stored or sent to the AI.
  const expandedProductIds = new Set();
  let lastRoutine = null;

  function persistSavedProducts() {
    try {
      if (selected.size) {
        window.localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify([...selected]));
      } else {
        window.localStorage.removeItem(SAVED_PRODUCTS_KEY);
      }
    } catch {
      savedProductsPrivacy.textContent = "Browser storage is unavailable. Changes may not survive a page reload.";
    }
  }

  function make(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announceText(text) { announce.textContent = text; }

  function productPhoto(product, className = "catalog-product-photo") {
    // A real, source-matched photo for each catalog ID, not a category icon.
    // Network failures show a truthful unavailable state via the shared helper.
    return window.BeautyPhotography?.create(product.id, {
      className: "real-product-shot " + className,
      decorative: true
    }) || make("span", "product-photo-fallback", "Product photograph unavailable");
  }

  function officialLink(product) {
    const link = make("a", "catalog-link", "Official product details ↗");
    link.href = product.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    // Keep the visible label at the start of the accessible name (WCAG 2.5.3).
    link.setAttribute("aria-label", "Official product details for " + product.name + " (opens new tab)");
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

  // Keep the card's selection state in sync without rebuilding the grid.
  // This preserves keyboard focus when a visitor toggles a product.
  function syncCardSelection(card, product) {
    const active = selected.has(product.id);
    card.classList.toggle("catalog-card--selected", active);
    const pick = card.querySelector(".catalog-card__pick");
    pick.setAttribute("aria-pressed", String(active));
    pick.setAttribute("aria-label", (active ? "Unselect " : "Select ") + product.name);
    card.querySelector(".catalog-card__selection-label").textContent = active ? "✓ SELECTED" : "+ SELECT";
    const save = card.querySelector(".catalog-button--save");
    save.textContent = active ? "✓ Saved" : "+ Save product";
    save.setAttribute("aria-pressed", String(active));
    save.setAttribute("aria-label", active
      ? "Saved — remove " + product.name
      : "Save product — " + product.name);
  }

  function syncVisibleCard(product) {
    for (const card of grid.querySelectorAll(".catalog-card")) {
      if (card.dataset.productId === product.id) syncCardSelection(card, product);
    }
  }

  function toggleSelectedProduct(product, card) {
    if (selected.has(product.id)) selected.delete(product.id);
    else selected.add(product.id);
    persistSavedProducts();
    syncCardSelection(card, product);
    renderSelection();
    if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
    announceText(product.name + (selected.has(product.id) ? " added to selected products." : " removed from selected products."));
  }

  function renderSelection() {
    chosen.replaceChildren();
    pickedCount.textContent = selected.size + " saved";
    clearSelectedButton.disabled = selected.size === 0;
    if (!generateButton.disabled) {
      feedback.textContent = selected.size
        ? selected.size + " product" + (selected.size === 1 ? "" : "s") +
          " selected. Generate a personalized routine in the chat."
        : "Select at least one product, then generate an AI routine in the chat.";
    }
    if (!selected.size) {
      chosen.appendChild(make("span", "selected-empty", "Save products you like, or let the builder choose for you."));
      return;
    }
    for (const id of selected) {
      const product = catalog.find(item => item.id === id);
      if (!product) continue;
      const chip = make("button", "saved-chip");
      chip.type = "button";
      chip.appendChild(productPhoto(product, "saved-chip__photo"));
      chip.appendChild(make("span", "saved-chip__name", product.name));
      chip.appendChild(make("span", "saved-chip__remove", "×"));
      chip.setAttribute("aria-label", "Remove " + product.name + " from saved products");
      chip.addEventListener("click", () => {
        selected.delete(id);
        persistSavedProducts();
        renderSelection();
        syncVisibleCard(product);
        if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
        announceText(product.name + " removed from saved products.");
      });
      chosen.appendChild(chip);
    }
  }

  function productDetailPanel(product) {
    const panel = make("section", "catalog-card__details");
    panel.id = "product-details-" + product.id;
    panel.hidden = !expandedProductIds.has(product.id);

    const heading = make("h4", "catalog-card__details-heading", "PRODUCT DESCRIPTION");
    panel.appendChild(heading);
    panel.appendChild(make("p", "catalog-card__details-copy", product.description));

    // Show only sourced catalog attributes rather than inventing benefits
    // or usage directions that the product listing did not provide.
    const type = productType(product);
    const goalNames = {
      hydration:"Hydration", firmness:"Firmness", texture:"Texture",
      radiance:"Radiance", oil:"Oily roots", repair:"Damage care",
      definition:"Definition and color"
    };
    const matchNames = {
      normal:"Normal", dry:"Dry", oily:"Oily", combination:"Combination",
      sensitive:"Sensitive", damaged:"Damage-prone",
      natural:"Natural look", polished:"Polished look"
    };
    const usage = type === "haircare"
      ? "Wash-day care; follow the instructions on the package."
      : type === "makeup"
        ? "Makeup look; check the official listing for shade and application guidance."
        : product.time === "am"
          ? "Morning skincare"
          : product.time === "pm"
            ? "Evening skincare"
            : "Morning or evening skincare";
    const details = [
      ["CATEGORY", (groupLabels[product.group] || product.group) + " / " + type],
      ["CATALOG GOALS", product.concerns.map(goal => goalNames[goal] || goal).join(" · ")],
      ["CATALOG MATCHES", product.skins.map(match => matchNames[match] || match).join(" · ")],
      ["WHEN TO EXPLORE", usage]
    ];
    for (const [label, value] of details) {
      const item = make("div", "catalog-card__detail-row");
      item.appendChild(make("strong", "", label));
      item.appendChild(make("span", "", value));
      panel.appendChild(item);
    }
    if (product.exfoliating || product.strongActive) {
      panel.appendChild(make("p", "catalog-card__details-caution",
        "Contains an exfoliating or stronger active. Check official directions, start gradually, and avoid layering with other exfoliating acids in the same routine."));
    }
    panel.appendChild(make("p", "catalog-card__details-source",
      "Curated product snapshot — check the official listing for the latest details."));
    return panel;
  }

  function renderCatalog() {
    const query = search.value;
    const category = filter.value;
    const filtered = filterCatalogProducts(catalog, query, category);
    clearSearchButton.hidden = query.length === 0;
    grid.replaceChildren();
    count.textContent = filtered.length + " of " + catalog.length + " verified products";
    if (!filtered.length) {
      const empty = make("div", "catalog-empty");
      empty.appendChild(make("strong", "", "No matching products found."));
      empty.appendChild(make("p", "", "Try another keyword or change the category."));
      const reset = make("button", "catalog-empty__reset", "CLEAR SEARCH & SHOW ALL");
      reset.type = "button";
      reset.addEventListener("click", () => {
        search.value = "";
        filter.value = "all";
        renderCatalog();
        search.focus();
      });
      empty.appendChild(reset);
      grid.appendChild(empty);
      return;
    }
    for (const product of filtered) {
      const card = make("article", "catalog-card");
      card.dataset.productId = product.id;
      // A full-card button sits underneath the regular product links/actions.
      // Selecting the image, title, or empty space toggles the product;
      // official links and Ask AI keep their independent behavior.
      const pick = make("button", "catalog-card__pick");
      pick.type = "button";
      pick.setAttribute("aria-describedby", "productSelectionHint");
      pick.addEventListener("click", () => toggleSelectedProduct(product, card));
      card.appendChild(pick);
      // Quiet magazine-style edition number. It never changes selection,
      // filters, product data, or any interactive card controls.
      const edition = make("span", "catalog-card__edition",
        String(catalog.indexOf(product) + 1).padStart(2, "0") + " / " +
        String(catalog.length).padStart(2, "0"));
      edition.setAttribute("aria-hidden", "true");
      card.appendChild(edition);
      const image = make("div", "catalog-card__art catalog-card__art--" + product.group);
      image.appendChild(productPhoto(product));
      card.appendChild(image);
      const selectionLabel = make("span", "catalog-card__selection-label");
      selectionLabel.setAttribute("aria-hidden", "true");
      card.appendChild(selectionLabel);
      card.appendChild(make("span", "catalog-card__eyebrow", product.family + "  /  " + productType(product).toUpperCase()));
      card.appendChild(make("h3", "catalog-card__title", product.name));
      card.appendChild(make("p", "catalog-card__description", product.description));

      // Explicit button makes product descriptions discoverable without
      // hover, works with touch/keyboard, and does not select the card.
      const detailsButton = make("button", "catalog-card__details-toggle");
      detailsButton.type = "button";
      detailsButton.setAttribute("aria-controls", "product-details-" + product.id);
      detailsButton.setAttribute("aria-label", (expandedProductIds.has(product.id) ? "Hide" : "View") +
        " details for " + product.name);
      detailsButton.setAttribute("aria-expanded", String(expandedProductIds.has(product.id)));
      detailsButton.textContent = expandedProductIds.has(product.id) ? "HIDE DETAILS −" : "VIEW DETAILS +";
      const detailPanel = productDetailPanel(product);
      detailsButton.addEventListener("click", () => {
        const isExpanded = detailsButton.getAttribute("aria-expanded") === "true";
        detailPanel.hidden = isExpanded;
        detailsButton.setAttribute("aria-expanded", String(!isExpanded));
        detailsButton.setAttribute("aria-label",
          (isExpanded ? "View" : "Hide") + " details for " + product.name);
        detailsButton.textContent = isExpanded ? "VIEW DETAILS +" : "HIDE DETAILS −";
        if (isExpanded) expandedProductIds.delete(product.id);
        else expandedProductIds.add(product.id);
      });
      card.append(detailsButton, detailPanel, officialLink(product));
      const actions = make("div", "catalog-card__actions");
      const save = make("button", "catalog-button catalog-button--save", selected.has(product.id) ? "✓ Saved" : "+ Save product");
      save.type = "button";
      save.setAttribute("aria-pressed", String(selected.has(product.id)));
      save.setAttribute("aria-label", selected.has(product.id)
        ? "Saved — remove " + product.name
        : "Save product — " + product.name);
      save.addEventListener("click", () => toggleSelectedProduct(product, card));
      const ask = make("button", "catalog-button catalog-button--ask", "Ask AI ↗");
      ask.type = "button";
      ask.setAttribute("aria-label", "Ask AI about " + product.name);
      ask.addEventListener("click", () => askAbout(product));
      actions.append(save, ask);
      card.appendChild(actions);
      syncCardSelection(card, product);
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
      const row = make("div", "routine-step-main");
      row.appendChild(productPhoto(step.product, "routine-step__photo"));
      row.appendChild(details);
      item.appendChild(row);
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
    // A change of beauty focus should not unexpectedly erase a typed query.
    filter.value = type;
    renderCatalog();
    if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), [...selected]));
    announceText("Showing " + type + " products and preferences.");
  }
  focusSelect.addEventListener("change", () => setFocus(focusSelect.value));

  // Generate Routine must call the real AI path, not merely render the local
  // preview. The existing Worker holds the secret and displays its reply in
  // the same chat bubbles used for ordinary visitor questions.
  generateButton.addEventListener("click", async () => {
    const products = [...selected]
      .map(id => catalog.find(product => product.id === id))
      .filter(Boolean);
    if (!products.length) {
      feedback.textContent = "Choose at least one product card before generating your AI routine.";
      announceText("Select a product before generating a routine.");
      return;
    }
    if (typeof window.sendMessage !== "function") {
      feedback.textContent = "The AI chat is unavailable. Please reload the page and try again.";
      return;
    }
    if (document.getElementById("sendBtn").disabled || generateButton.disabled) {
      feedback.textContent = "The Beauty Concierge is already answering. Try again after it finishes.";
      return;
    }

    const profile = currentProfile();
    const prompt = questionForSelectedProducts(profile, products.length);
    const productNotes = buildSelectedProductNotes(products);
    const followUpNotes = buildFollowUpProductNotes(products, profile);
    generateButton.disabled = true;
    generateButton.setAttribute("aria-busy", "true");
    feedback.textContent = "Creating your personalized routine in the Beauty Concierge chat…";
    announceText("Your selected products are being sent securely to the beauty advisor.");
    document.getElementById("concierge").scrollIntoView({
      behavior: "smooth", block: "start"
    });
    try {
      const success = await window.sendMessage(prompt, productNotes, followUpNotes);
      feedback.textContent = success
        ? "Your personalized AI routine is ready in the Beauty Concierge chat."
        : "The AI routine could not be generated. See the chat error and try again.";
    } finally {
      generateButton.disabled = false;
      generateButton.removeAttribute("aria-busy");
    }
  });

  // Clearing is intentional and removes both the chips and saved browser
  // data. Product cards remain in sync across the whole catalog.
  clearSelectedButton.addEventListener("click", () => {
    if (!selected.size) return;
    selected.clear();
    persistSavedProducts();
    renderSelection();
    renderCatalog();
    if (lastRoutine) renderRoutine(buildRoutine(currentProfile(), []));
    const message = "All saved products cleared from this device.";
    feedback.textContent = message;
    announceText(message);
  });

  search.addEventListener("input", renderCatalog);
  // Clear button and the browser's native search-field reset both update
  // products immediately, without resetting the user's chosen category.
  clearSearchButton.addEventListener("click", () => {
    search.value = "";
    renderCatalog();
    search.focus();
  });
  search.addEventListener("search", renderCatalog);
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
