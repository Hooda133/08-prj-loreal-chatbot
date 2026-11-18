// Browser-translation RTL support. This site has NO language selector.
// Visitors use Chrome/Edge/Firefox's own Translate Page feature; this file
// only mirrors the layout when the translated page actually uses RTL text.
(function () {
  "use strict";

  const root = document.documentElement;
  const rtlLanguage = /^(ar|fa|he|iw|ur|ps|sd|ug|yi|dv)(?:-|$)/i;
  const rtlScript = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const staticHeadings = [
    "#hero-title", "#advisorTitle", "#routine-title",
    "#discover-title", ".catalog-header h3", ".header-nav a"
  ];
  let directionWasAutoApplied = false;

  // Translators differ: Chrome usually adds html.translated-rtl;
  // others may only change html.lang or replace the text nodes.
  // Check stable *page headings*, not user-entered chat or product content,
  // to avoid switching the whole site just because someone types Arabic.
  function translatedStaticText() {
    let rtlHeadings = 0;
    for (const selector of staticHeadings) {
      const heading = document.querySelector(selector);
      if (heading && rtlScript.test(heading.textContent)) rtlHeadings++;
    }
    return rtlHeadings >= 2;
  }

  function browserIsDisplayingRtl() {
    if (root.classList.contains("translated-rtl")) return true;
    if (root.classList.contains("translated-ltr")) return false;
    return rtlLanguage.test(root.getAttribute("lang") || "") || translatedStaticText();
  }

  function updateDirection() {
    if (browserIsDisplayingRtl()) {
      if (root.getAttribute("dir") !== "rtl") {
        root.setAttribute("dir", "rtl");
        directionWasAutoApplied = true;
      }
    } else if (directionWasAutoApplied) {
      // Restore the original LTR page on 'Show original'. Do not overwrite
      // an explicit direction supplied by a different translator or author.
      if (root.getAttribute("dir") === "rtl") root.removeAttribute("dir");
      directionWasAutoApplied = false;
    }
  }

  // One-time migration: remove the previous *website-owned* language choice.
  // This has no effect on browser translation or saved product selections.
  try {
    window.localStorage.removeItem("beauty-atelier:layout-language:v1");
  } catch {
    // Storage may be disabled; no storage is needed for browser translation.
  }

  const observer = new MutationObserver(updateDirection);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "lang", "dir"]
  });
  for (const selector of staticHeadings) {
    const node = document.querySelector(selector);
    if (node) {
      observer.observe(node, { childList: true, characterData: true, subtree: true });
    }
  }

  // Do not set html.lang, which belongs to the browser's translation engine.
  // Do not render language controls, show banners, or call translation APIs.
  updateDirection();
})();
