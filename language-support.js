// Layout direction for languages written right-to-left, such as Arabic.
// This project provides an RTL-ready layout, not a full copy translation.
(function () {
  "use strict";

  const switcher = document.getElementById("languageDirection");
  const announcement = document.getElementById("directionAnnouncement");
  if (!switcher) return;

  const storageKey = "beauty-atelier:layout-language:v1";

  function savedLanguage() {
    try {
      return window.localStorage.getItem(storageKey) === "ar" ? "ar" : "en";
    } catch {
      // Private browsing or locked-down storage still permits manual switching.
      return "en";
    }
  }

  function setLayoutLanguage(language, save = false) {
    const code = language === "ar" ? "ar" : "en";
    const rtl = code === "ar";
    document.documentElement.setAttribute("dir", rtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", code);
    switcher.value = code;

    // Product copy and most page labels are currently written in English.
    // Give those regions their truthful language for screen readers; chat
    // bubbles identify their own language based on the message content.
    for (const tag of ["header", "main", "footer"]) {
      const region = document.querySelector(tag);
      if (region) region.setAttribute("lang", "en");
    }

    if (save) {
      try {
        window.localStorage.setItem(storageKey, code);
      } catch {
        // Direction still changes in the current tab if storage is blocked.
      }
      announcement.textContent = rtl
        ? "تم تفعيل التنسيق من اليمين إلى اليسار."
        : "Left-to-right layout enabled.";
    }
  }

  switcher.addEventListener("change", () => setLayoutLanguage(switcher.value, true));
  setLayoutLanguage(savedLanguage());
})();
